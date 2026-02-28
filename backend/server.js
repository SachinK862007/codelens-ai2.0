import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";

const app = express();
const PORT = 5050;

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

app.listen(PORT, () => {
  console.log(`Codelens backend running on http://localhost:${PORT}`);
});
