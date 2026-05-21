import { runCodeOnServer } from "./codeRun.js";

function normalizeOutput(stdout) {
  return (stdout || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const GREETING_RE = /\b(hello|hi|hey|greetings?|welcome|good\s+(morning|afternoon|evening))\b/i;

/**
 * Fast local grading for simple practice tasks (no Ollama wait).
 * Checks behavior by running code, not exact character match.
 */
export async function tryLocalPracticeGrade(language, code, question) {
  if (!question?.id || !code?.trim()) return null;

  const id = question.id;

  try {
    // Hello / greeting (py-1, c-1, js-1, ...)
    if (/-1$/.test(id)) {
      const data = await runCodeOnServer(language, code, "");
      if (!data) return null;

      const out = (data.stdout || "").trim();
      const err = (data.stderr || "").trim();

      if (err && !out) {
        return {
          passed: false,
          feedback: `Program error: ${err.slice(0, 180)}`,
          hint: "Fix syntax or runtime errors, then run again."
        };
      }
      if (!out) {
        return {
          passed: false,
          feedback: "Your program ran but produced no output.",
          hint: 'Use print/printf/console.log to show a greeting (e.g. "Hello").'
        };
      }
      if (GREETING_RE.test(out) || (/[a-zA-Z]/.test(out) && out.length >= 2)) {
        return {
          passed: true,
          feedback: `Your program prints output ("${out.slice(0, 80)}${out.length > 80 ? "…" : ""}") — that satisfies the greeting task.`,
          hint: ""
        };
      }
      return {
        passed: false,
        feedback: "Output should be a greeting message, not unrelated text.",
        hint: 'Try printing "Hello" or a similar welcome message.'
      };
    }

    // Sum two integers (py-2, c-2, js-2, ...)
    if (/-2$/.test(id) && ["python", "javascript", "typescript"].includes(language)) {
      const data = await runCodeOnServer(language, code, "3\n4\n");
      if (!data) return null;

      const out = normalizeOutput(data.stdout);
      const err = (data.stderr || "").trim();

      if (err && !out) {
        return {
          passed: false,
          feedback: `Program error: ${err.slice(0, 180)}`,
          hint: "Read two numbers and print their sum."
        };
      }
      if (out.includes("7")) {
        return {
          passed: true,
          feedback: "Correct — your program outputs the sum for the test inputs 3 and 4.",
          hint: ""
        };
      }
      if (out) {
        return {
          passed: false,
          feedback: `For inputs 3 and 4, expected sum 7 but got "${data.stdout?.trim().slice(0, 60)}".`,
          hint: "Read two integers and print their sum (order of inputs may vary)."
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}
