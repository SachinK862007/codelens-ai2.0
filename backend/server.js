import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const ensureTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codelens-"));
  return dir;
};

const runProcess = (command, args, input = "", timeoutMs = 5000) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        child.kill();
        resolve({
          stdout,
          stderr: stderr || "Process timed out.",
          exitCode: 1,
          timedOut: true
        });
      }
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, timedOut: false });
    });
    if (input) {
      const normalized = input.endsWith("\n") ? input : `${input}\n`;
      child.stdin.write(normalized);
    }
    child.stdin.end();
  });

const runPython = async (code, input = "") => {
  const dir = await ensureTempDir();
  const filePath = path.join(dir, "main.py");
  await fs.writeFile(filePath, code, "utf8");
  const result = await runProcess("python", [filePath], input);
  return result;
};

const runC = async (code, input = "") => {
  const dir = await ensureTempDir();
  const filePath = path.join(dir, "main.c");
  const outputPath = path.join(dir, "main.exe");
  await fs.writeFile(filePath, code, "utf8");
  const compile = await runProcess("gcc", [filePath, "-o", outputPath]);
  if (compile.exitCode !== 0) {
    return { ...compile, stdout: "", compileError: true };
  }
  return runProcess(outputPath, [], input);
};

const runCpp = async (code, input = "") => {
  const dir = await ensureTempDir();
  const filePath = path.join(dir, "main.cpp");
  const outputPath = path.join(dir, "main.exe");
  await fs.writeFile(filePath, code, "utf8");
  const compile = await runProcess("g++", [filePath, "-o", outputPath]);
  if (compile.exitCode !== 0) {
    return { ...compile, stdout: "", compileError: true };
  }
  return runProcess(outputPath, [], input);
};

const runByLanguage = async (language, code, input = "") => {
  if (language === "python") return runPython(code, input);
  if (language === "c") return runC(code, input);
  if (language === "cpp") return runCpp(code, input);
  return {
    stdout: "",
    stderr: "Unsupported language.",
    exitCode: 1
  };
};

const sanitizeLabel = (value) =>
  value.replace(/["`]/g, "'").slice(0, 40) || "Step";

const buildFlowchartFromCode = (code) => {
  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return `flowchart TD
Start --> End`;
  }

  const nodes = [];
  const links = [];
  let nodeIndex = 0;
  let prevNode = "Start";
  nodes.push(`Start([Start])`);

  const createNode = (label) => {
    nodeIndex += 1;
    const id = `S${nodeIndex}`;
    nodes.push(`${id}["${sanitizeLabel(label)}"]`);
    links.push(`${prevNode} --> ${id}`);
    prevNode = id;
    return id;
  };

  const stack = [];

  lines.forEach((line) => {
    if (line.startsWith("if ")) {
      const id = `D${nodeIndex + 1}`;
      nodes.push(`${id}{"${sanitizeLabel(line)}"}`);
      links.push(`${prevNode} --> ${id}`);
      stack.push({ type: "if", id });
      prevNode = id;
      nodeIndex += 1;
      return;
    }

    if (line.startsWith("else")) {
      const last = stack[stack.length - 1];
      if (last?.type === "if") {
        prevNode = last.id;
        links.push(`${last.id} -- No --> ${createNode("else branch")}`);
      }
      return;
    }

    if (line.startsWith("for ") || line.startsWith("while ")) {
      const id = `L${nodeIndex + 1}`;
      nodes.push(`${id}{"${sanitizeLabel(line)}"}`);
      links.push(`${prevNode} --> ${id}`);
      prevNode = id;
      nodeIndex += 1;
      stack.push({ type: "loop", id });
      return;
    }

    if (line.startsWith("return ")) {
      createNode("return");
      return;
    }

    if (line.startsWith("print") || line.includes("cout") || line.includes("printf")) {
      createNode("output");
      return;
    }

    createNode(line);
  });

  nodes.push(`End([End])`);
  links.push(`${prevNode} --> End`);
  return `flowchart TD\n${nodes.join("\n")}\n${links.join("\n")}`;
};

const getSteps = (code) => code.split("\n").map((_, index) => index);

const getAlgorithmSteps = (code) => {
  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) {
    return ["Read input", "Process logic", "Display output"];
  }
  return lines.map((line, index) => `${index + 1}. ${line}`);
};

const buildDiagnosis = (stderr) => {
  if (!stderr) {
    return {
      summary: "No errors detected.",
      steps: ["Your code executed without runtime errors."]
    };
  }

  if (stderr.includes("SyntaxError")) {
    return {
      summary: "Syntax error detected in the code.",
      steps: [
        "Check missing colons, brackets, or indentation.",
        "Review the line mentioned in the error output.",
        "Fix the syntax and run again."
      ]
    };
  }

  if (stderr.includes("EOFError: EOF when reading a line")) {
    return {
      summary: "Input required but none provided.",
      steps: [
        "Your code asked for user input, but the 'Program input (stdin)' box was empty.",
        "Type your input into the 'Program input (stdin)' box before running your code.",
        "If you have multiple inputs, separate them with spaces or newlines."
      ]
    };
  }

  if (stderr.includes("error:")) {
    return {
      summary: "Compiler error detected.",
      steps: [
        "Read the compiler error message carefully.",
        "Locate the line number referenced by the compiler.",
        "Fix the syntax or missing include and recompile."
      ]
    };
  }

  return {
    summary: "Runtime error detected.",
    steps: [
      "Check input handling and data types.",
      "Add print/log statements to locate the crash.",
      "Fix the issue and re-run."
    ]
  };
};

const simpleSuggestedCode = (language, intent) => {
  if (!intent) return "";
  if (language === "python") {
    return `# ${intent}\nprint("Replace this with your logic")`;
  }
  if (language === "c") {
    return `#include <stdio.h>\n\nint main() {\n  // ${intent}\n  printf(\"Replace this with your logic\\n\");\n  return 0;\n}`;
  }
  return `#include <iostream>\n\nint main() {\n  // ${intent}\n  std::cout << \"Replace this with your logic\" << std::endl;\n  return 0;\n}`;
};

app.post("/api/run", async (req, res) => {
  const { language, code, intent, input } = req.body;
  const result = await runByLanguage(language, code || "", input || "");
  const success = result.exitCode === 0 && !result.stderr;
  res.json({
    success,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    message: result.stderr ? "Execution failed." : "Execution success.",
    generatedCode: success ? "" : simpleSuggestedCode(language, intent),
    flowchart: buildFlowchartFromCode(code || ""),
    steps: getSteps(code || ""),
    algorithmSteps: getAlgorithmSteps(code || "")
  });
});

app.post("/api/trace", async (req, res) => {
  const { language, code, input } = req.body;
  if (language !== "python") {
    // For C/C++, fall back to simple sequential trace
    const lines = (code || "").split("\n");
    const trace = lines.map((line, i) => ({
      line: i + 1,
      event: "line",
      code: line,
      vars: {},
      output: ""
    }));
    const result = await runByLanguage(language, code || "", input || "");
    return res.json({ success: true, trace, stdout: result.stdout.trim() });
  }

  // Build a tracer wrapper for Python
  const dir = await ensureTempDir();
  const userCodePath = path.join(dir, "user_code.py");
  const tracerPath = path.join(dir, "tracer.py");
  await fs.writeFile(userCodePath, code || "", "utf8");

  const tracerCode = `
import sys, json, io, os

trace_data = []
user_code_file = os.path.abspath("${userCodePath.replace(/\\/g, "\\\\")}")
source_lines = open(user_code_file).read().split("\\n")
original_stdout = sys.stdout
max_steps = 200
step_count = 0

class DualWriter:
    def __init__(self):
        self.buffer = io.StringIO()
    def write(self, s):
        self.buffer.write(s)
    def flush(self):
        pass
    def getvalue(self):
        return self.buffer.getvalue()

writer = DualWriter()
sys.stdout = writer

def safe_repr(v):
    try:
        r = repr(v)
        return r[:80] if len(r) > 80 else r
    except:
        return "?"

def tracer(frame, event, arg):
    global step_count
    if step_count >= max_steps:
        return None
    fname = os.path.abspath(frame.f_code.co_filename)
    if fname != user_code_file:
        return tracer
    lineno = frame.f_lineno
    if event in ("line", "call", "return"):
        step_count += 1
        local_vars = {}
        for k, v in frame.f_locals.items():
            if not k.startswith("_") and k not in ("__builtins__",):
                local_vars[k] = safe_repr(v)
        code_text = source_lines[lineno - 1] if lineno <= len(source_lines) else ""
        entry = {
            "line": lineno,
            "event": event,
            "code": code_text,
            "vars": local_vars,
            "output": writer.getvalue(),
            "func": frame.f_code.co_name if event in ("call", "return") else ""
        }
        if event == "return":
            entry["returnVal"] = safe_repr(arg)
        trace_data.append(entry)
    return tracer

sys.settrace(tracer)
try:
    exec(open(user_code_file).read(), {"__name__": "__main__", "__builtins__": __builtins__})
except Exception as e:
    trace_data.append({"line": 0, "event": "error", "code": str(e), "vars": {}, "output": writer.getvalue(), "func": ""})
finally:
    sys.settrace(None)

final_output = writer.getvalue()
sys.stdout = original_stdout
print(json.dumps({"trace": trace_data, "stdout": final_output}))
`;

  await fs.writeFile(tracerPath, tracerCode, "utf8");
  const result = await runProcess("python", ["-u", tracerPath], input || "", 10000);

  try {
    const parsed = JSON.parse(result.stdout);
    res.json({ success: true, trace: parsed.trace || [], stdout: (parsed.stdout || "").trim() });
  } catch {
    // If trace parsing fails, build a simple trace from the code lines
    const lines = (code || "").split("\n");
    const simpleTrace = lines.map((line, i) => ({
      line: i + 1,
      event: "line",
      code: line,
      vars: {},
      output: result.stdout || ""
    }));
    res.json({ success: true, trace: simpleTrace, stdout: (result.stdout || "").trim() });
  }
});

app.post("/api/diagnose", async (req, res) => {
  const { language, code } = req.body;
  const result = await runByLanguage(language, code || "");
  const diagnosis = buildDiagnosis(result.stderr);
  res.json({
    success: result.exitCode !== 0,
    summary: diagnosis.summary,
    steps: diagnosis.steps,
    fixedCode: result.stderr ? simpleSuggestedCode(language, "Fix the errors") : ""
  });
});

app.post("/api/idea", (req, res) => {
  const { idea } = req.body;
  res.json({
    success: true,
    summary: `Idea: ${idea || "Describe the project idea here."}`,
    problem:
      "Define the real-world pain point and who is affected by it. Clarify scope and constraints.",
    solution:
      "Break the solution into modules: UI, backend services, data storage, and integrations.",
    resources: [
      "Open-source docs for Python/C/C++",
      "Local database if needed (SQLite)",
      "Free UI libraries (e.g. Tailwind, Chakra)",
      "Mermaid.js for flowcharts",
      "FFmpeg (optional) for advanced video export"
    ],
    apis: [
      "If using AI: local open-source models or free tiers only",
      "Public datasets APIs if needed (Kaggle, data.gov)",
      "No paid APIs required for MVP"
    ],
    references: [
      "Basic algorithm and data structure references",
      "Research: user-friendly IDE onboarding",
      "Paper: Code comprehension and visualization tools (survey)"
    ],
    stack: ["Frontend: React", "Backend: Node/Express", "DB: SQLite (optional)"],
    steps: [
      "Sketch user flows and UI screens.",
      "Build UI shell with history and model switcher.",
      "Implement backend endpoints for run/diagnose/idea/levels.",
      "Add local execution pipeline with timeouts.",
      "Polish UX with loading and error states.",
      "Test with sample Python/C/C++ snippets."
    ],
    fileTree: `project-root/
  frontend/
    public/
    src/
      assets/
      components/
        HistoryPanel.jsx
        ModelSwitcher.jsx
      models/
        ModelOne.jsx
        ModelTwo.jsx
        ModelThree.jsx
        ModelFour.jsx
      App.jsx
      main.jsx
      styles.css
    package.json
    vite.config.js
  backend/
    server.js
    package.json
  docs/
    ARCHITECTURE.md
    MODELS.md
  README.md`
  });
});

app.post("/api/levels/submit", async (req, res) => {
  const { levelId, language, code } = req.body;
  const expectations = {
    1: { input: "", output: "Hello World" },
    2: { input: "2 3", output: "5" },
    3: { input: "3 4", output: "12" },
    4: { input: "10 5", output: "25" },
    5: { input: "", output: "" }
  };
  const { input, output } = expectations[levelId] || expectations[1];
  const run = await runByLanguage(language, code || "", input);
  const cleaned = (run.stdout || "").trim();
  const passed =
    run.exitCode === 0 && (levelId === 5 ? true : cleaned === output);
  res.json({
    passed,
    message: passed
      ? "Great job! You can move to the next level."
      : run.stderr
        ? "Your code has errors. Fix them and try again."
        : "Output did not match the expected answer.",
    hint:
      !passed && levelId !== 5
        ? "Check input handling and output format."
        : ""
  });
});

const server = app.listen(PORT, () => {
  console.log(`Codelens backend running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let child = null;

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "init") {
        const { language, code } = message;
        const dir = await ensureTempDir();
        let cmd = "";
        let args = [];

        ws.send(JSON.stringify({ type: "output", data: `\x1b[35m$ run ${language}\x1b[0m\r\n` }));

        if (language === "python") {
          const filePath = path.join(dir, "main.py");
          await fs.writeFile(filePath, code, "utf8");
          cmd = "python";
          args = ["-u", filePath]; // -u disables stdout buffering
        } else if (language === "c" || language === "cpp") {
          const ext = language === "c" ? ".c" : ".cpp";
          const compiler = language === "c" ? "gcc" : "g++";
          const filePath = path.join(dir, `main${ext}`);
          const outputPath = path.join(dir, "main.exe");
          await fs.writeFile(filePath, code, "utf8");

          ws.send(JSON.stringify({ type: "output", data: `\x1b[90mCompiling...\x1b[0m\r\n` }));
          const compile = spawn(compiler, [filePath, "-o", outputPath], { windowsHide: true });

          const compileSucceeded = await new Promise((resolve) => {
            let errorOccurred = false;
            compile.stderr.on("data", (d) => {
              errorOccurred = true;
              ws.send(JSON.stringify({ type: "output", data: d.toString().replace(/\n/g, "\r\n") }));
            });
            compile.on("close", (c) => resolve(c === 0 && !errorOccurred));
          });

          if (!compileSucceeded) {
            ws.send(JSON.stringify({ type: "exit", code: 1 }));
            return;
          }
          cmd = outputPath;
          args = [];
        }

        try {
          child = spawn(cmd, args, { windowsHide: true });

          child.stdout.on("data", (d) => {
            ws.send(JSON.stringify({ type: "output", data: d.toString().replace(/\n/g, "\r\n") }));
          });

          child.stderr.on("data", (d) => {
            ws.send(JSON.stringify({ type: "output", data: d.toString().replace(/\n/g, "\r\n") }));
          });

          child.on("close", (code) => {
            ws.send(JSON.stringify({ type: "exit", code }));
            child = null;
          });
        } catch (e) {
          ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[31mError launching process.\x1b[0m` }));
          ws.send(JSON.stringify({ type: "exit", code: 1 }));
        }

      } else if (message.type === "input") {
        if (child && child.stdin) {
          child.stdin.write(message.input);
        }
      } else if (message.type === "kill") {
        if (child) child.kill();
      }
    } catch (err) {
      console.error(err);
    }
  });

  ws.on("close", () => {
    if (child) {
      child.kill();
    }
  });
});
