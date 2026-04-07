import { spawn } from "child_process";
import path from "path";

const PORT = 8000;
const URL = `http://localhost:${PORT}/api/run`;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("Starting backend server...");
  const serverPath = path.resolve("./server.js");
  const serverProcess = spawn("node", [serverPath], {
    env: { ...process.env, GEMINI_API_KEY: "test-secret-key-1234" }
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[SERVER]: ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[SERVER ERR]: ${d}`));

  await delay(2000); // wait for server to start

  let testsPassed = true;

  try {
    console.log("Running Test 1: Code execution works and doesn't leak GEMINI_API_KEY...");
    const pythonCode = `import os; print('GEMINI=' + os.environ.get('GEMINI_API_KEY', 'NOT_FOUND'))`;

    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "python", code: pythonCode })
    });

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const data = await res.json();
    console.log("Response:", data.stdout);

    if (data.stdout.includes("test-secret-key-1234")) {
      console.error("❌ FAILED: Data leak detected! GEMINI_API_KEY was exposed to the Python process.");
      testsPassed = false;
    } else {
      console.log("✅ PASSED: No GEMINI_API_KEY in the environment.");
    }
  } catch (err) {
    console.error("Test failed due to an error:", err);
    testsPassed = false;
  } finally {
    console.log("Killing server...");
    serverProcess.kill();
  }

  if (!testsPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
