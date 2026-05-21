import { extractJsonFromText, extractJsonBool, extractJsonString } from "./partialJson.js";

const NONE_HINT = /^(none|n\/a|na|no hint|not needed|—|-|\.)[\s,.]*$/i;

/**
 * Normalize practice evaluation from JSON object or loose LLM shapes.
 */
export function normalizePracticeResult(raw) {
  if (!raw || typeof raw !== "object") return null;

  let passed = raw.passed ?? raw.Passed ?? raw.pass ?? raw.Pass;
  if (typeof passed === "string") {
    const s = passed.trim().toLowerCase();
    passed = s === "true" || s === "pass" || s === "passed" || s === "yes";
  }
  if (typeof passed !== "boolean") return null;

  const feedback = String(raw.feedback ?? raw.Feedback ?? "").trim();
  const hintRaw = String(raw.hint ?? raw.Hint ?? "").trim();

  return {
    passed,
    feedback: feedback || (passed ? "Your solution looks correct." : "Your solution needs changes."),
    hint: cleanHint(hintRaw)
  };
}

function cleanHint(text) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (NONE_HINT.test(t) || /^none\b/i.test(t)) return "";
  return t;
}

/**
 * Parse prose evaluations like:
 * "Passed: true Feedback: ... Hint: None"
 */
export function parseProsePractice(raw) {
  if (!raw || typeof raw !== "string") return null;

  const passedMatch = raw.match(/\bpassed\s*:\s*(true|false)\b/i);
  const passed = passedMatch ? passedMatch[1].toLowerCase() === "true" : null;

  let feedback = null;
  let hint = null;

  const fbMatch = raw.match(/\bfeedback\s*:\s*([\s\S]*?)(?=\bhint\s*:|$)/i);
  if (fbMatch) feedback = fbMatch[1].trim().replace(/\s+/g, " ");

  const hintMatch = raw.match(/\bhint\s*:\s*([\s\S]*?)(?=\n\n[A-Z]|The code |$)/i);
  if (hintMatch) hint = cleanHint(hintMatch[1].trim().replace(/\s+/g, " "));

  if (passed === null && !feedback) return null;

  return {
    passed: passed ?? false,
    feedback: feedback || (passed ? "Your solution looks correct." : "Review your approach and try again."),
    hint: hint || ""
  };
}

/**
 * Parse practice AI output — strict JSON first, then partial keys, then prose.
 */
export function parsePracticeResponse(raw) {
  if (!raw || typeof raw !== "string") return null;

  const json = extractJsonFromText(raw);
  const fromJson = normalizePracticeResult(json);
  if (fromJson) return fromJson;

  const passed = extractJsonBool(raw, "passed");
  const feedback = extractJsonString(raw, "feedback");
  const hint = extractJsonString(raw, "hint");

  if (passed !== null || feedback) {
    return {
      passed: passed ?? false,
      feedback: feedback || (passed ? "Your solution looks correct." : "Review your approach and try again."),
      hint: cleanHint(hint || "")
    };
  }

  return parseProsePractice(raw);
}
