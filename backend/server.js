import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";

const app = express();
const PORT = 8000;

app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
}));
app.use(express.json({ limit: "1mb" }));

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const AI_PROVIDER = process.env.AI_PROVIDER || "auto"; // auto | ollama | gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const writeSse = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const geminiStreamToSse = async ({ system, userText }, res) => {
  if (!GEMINI_API_KEY) {
    writeSse(res, { type: "error", error: "Missing GEMINI_API_KEY in backend env." });
    writeSse(res, { type: "done" });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const prompt = `${system || ""}\n\n${userText || ""}`.trim();
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    writeSse(res, { type: "error", error: `Gemini error (${upstream.status}). ${text || ""}`.trim() });
    writeSse(res, { type: "done" });
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) break;
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const lines = chunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          const text =
            evt?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
          if (text) writeSse(res, { type: "delta", text });
        } catch {
          // ignore
        }
      }
    }
  }

  writeSse(res, { type: "done" });
};

const listOllamaModels = async () => {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: "GET" });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  const models = Array.isArray(json.models) ? json.models : [];
  return models.map((m) => m?.name).filter(Boolean);
};

const pullOllamaModel = async (model) => {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, stream: false })
  });
  return res.ok;
};

const pickWorkingModel = async () => {
  const installed = await listOllamaModels();
  if (installed.includes(OLLAMA_MODEL)) return OLLAMA_MODEL;
  if (installed.length) return installed[0];
  // If nothing is installed, try pulling the configured default model.
  const ok = await pullOllamaModel(OLLAMA_MODEL);
  if (ok) return OLLAMA_MODEL;
  return null;
};

const ollamaStreamToSse = async ({ system, userText }, res) => {
  const prompt = `${system || ""}\n\n${userText || ""}`.trim();
  const modelToUse = await pickWorkingModel();
  if (!modelToUse) {
    writeSse(res, {
      type: "error",
      error:
        "No local Ollama model is available. Install Ollama, then run: `ollama pull qwen2.5-coder:7b` (or any model) and retry."
    });
    writeSse(res, { type: "done" });
    return;
  }
  writeSse(res, { type: "meta", model: modelToUse });

  const upstream = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelToUse,
      prompt,
      stream: true
    })
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    writeSse(res, {
      type: "error",
      error: `Local model error (${upstream.status}). ${text || ""}`.trim()
    });
    writeSse(res, { type: "done" });
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const nl = buffer.indexOf("\n");
      if (nl === -1) break;
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line);
        if (evt.response) writeSse(res, { type: "delta", text: evt.response });
        if (evt.done) writeSse(res, { type: "done" });
      } catch {
        // ignore
      }
    }
  }

  writeSse(res, { type: "done" });
};

const ensureTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codelens-"));
  return dir;
};

const runProcess = (command, args, input = "", timeoutMs = 5000) =>
  new Promise((resolve) => {
    const safeEnv = { ...process.env };
    delete safeEnv.GEMINI_API_KEY;

    const child = spawn(command, args, { windowsHide: true, env: safeEnv });
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
import traceback

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

def capture_stack(frame):
    frames = []
    f = frame
    depth = 0
    while f is not None and depth < 12:
        fname = os.path.abspath(f.f_code.co_filename)
        if fname == user_code_file:
            locals_map = {}
            for k, v in f.f_locals.items():
                if not k.startswith("_") and k not in ("__builtins__",):
                    locals_map[k] = safe_repr(v)
            frames.append({
                "func": f.f_code.co_name,
                "line": f.f_lineno,
                "locals": locals_map
            })
        f = f.f_back
        depth += 1
    return list(reversed(frames))

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
            "func": frame.f_code.co_name if event in ("call", "return") else "",
            "stack": capture_stack(frame)
        }
        if event == "return":
            entry["returnVal"] = safe_repr(arg)
        trace_data.append(entry)
    return tracer

sys.settrace(tracer)
try:
    exec(open(user_code_file).read(), {"__name__": "__main__", "__builtins__": __builtins__})
except Exception as e:
    tb = traceback.extract_tb(e.__traceback__)
    line_no = 0
    bad_line = ""
    for fr in reversed(tb):
        if os.path.abspath(fr.filename) == user_code_file:
            line_no = fr.lineno
            bad_line = source_lines[line_no - 1] if line_no and line_no <= len(source_lines) else ""
            break
    trace_data.append({
        "line": line_no,
        "event": "error",
        "error_type": type(e).__name__,
        "error_message": str(e),
        "code": bad_line,
        "vars": {},
        "output": writer.getvalue(),
        "func": "",
        "stack": []
    })
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
  const { levelId, language, code, prompt } = req.body;
  // Evaluate with local open-source model: logic-focused, case-insensitive output.
  const system = `You are CodeLens.ai Practice Evaluator.
Return ONLY JSON (no markdown) in this exact format:
{ "passed": true/false, "feedback": "...", "hint": "..." }

Rules:
- Judge LOGIC correctness, not exact output formatting.
- Output comparison is CASE INSENSITIVE.
- Do NOT reveal the full answer code.
- If code has errors, passed=false and feedback should mention the error type plainly.`;

  const userText = `Language: ${language}
Level: ${levelId}
Problem statement:
${prompt || ""}

User code:
${code || ""}`.trim();

  let collected = "";
  try {
    const upstream = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: `${system}\n\n${userText}`, stream: false })
    });
    const json = await upstream.json();
    collected = json.response || "";
    const parsed = JSON.parse(collected);
    res.json({ ...parsed, message: parsed.passed ? "Passed" : "Try Again" });
  } catch (e) {
    res.json({
      passed: false,
      message: "Try Again",
      feedback: "Unable to evaluate with the local model. Make sure Ollama is running.",
      hint: "Start Ollama and pull a model (e.g., qwen2.5-coder:7b), then retry."
    });
  }
});

app.post("/api/ai/stream", async (req, res) => {
  const { system, userText } = req.body || {};

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  writeSse(res, { type: "start" });

  try {
    const s = typeof system === "string" ? system : "";
    const u = typeof userText === "string" ? userText : "";
    const provider = AI_PROVIDER.toLowerCase();

    if (provider === "gemini") {
      await geminiStreamToSse({ system: s, userText: u }, res);
    } else if (provider === "ollama") {
      await ollamaStreamToSse({ system: s, userText: u }, res);
    } else {
      // auto: prefer Gemini if key exists, otherwise Ollama
      if (GEMINI_API_KEY) {
        await geminiStreamToSse({ system: s, userText: u }, res);
      } else {
        await ollamaStreamToSse({ system: s, userText: u }, res);
      }
    }
  } catch (e) {
    writeSse(res, { type: "error", error: e?.message || "Streaming failed." });
    writeSse(res, { type: "done" });
  } finally {
    res.end();
  }
});

// Back-compat alias
app.post("/api/claude/stream", (req, res) => {
  const { system, messages } = req.body || {};
  const firstText = messages?.[0]?.content?.[0]?.text || "";
  req.body = { system, userText: firstText };
  return app._router.handle(req, res, () => {});
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
          const safeEnv = { ...process.env };
          delete safeEnv.GEMINI_API_KEY;
          const compile = spawn(compiler, [filePath, "-o", outputPath], { windowsHide: true, env: safeEnv });

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
          const safeEnv = { ...process.env };
          delete safeEnv.GEMINI_API_KEY;
          child = spawn(cmd, args, { windowsHide: true, env: safeEnv });

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
