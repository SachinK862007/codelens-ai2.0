import { extractJsonFromText } from "./partialJson.js";

/** Fix common LLM JSON escape mistakes (e.g. print(\\"\n\\")) */
export function repairLlmEscapeArtifacts(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\\\\"/g, '\\"').replace(/\\\\n/g, "\\n").replace(/\\\\t/g, "\\t");
}

function normalizeError(entry, index) {
  if (!entry || typeof entry !== "object") {
    return {
      error_type: "Error",
      line_number: index + 1,
      wrong_line: String(entry ?? ""),
      corrected_line: "",
      explanation: ""
    };
  }
  return {
    error_type: String(entry.error_type || entry.type || "Error"),
    line_number: Number(entry.line_number ?? entry.line ?? index + 1) || index + 1,
    wrong_line: String(entry.wrong_line ?? entry.wrong ?? "").trim(),
    corrected_line: String(entry.corrected_line ?? entry.correct ?? entry.fix ?? "").trim(),
    explanation: String(entry.explanation ?? entry.message ?? entry.detail ?? "").trim()
  };
}

function normalizeExecutionOutput(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((line) => String(line ?? "")).join("\n");
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function cleanCodeString(code) {
  if (code == null) return "";
  let s = String(code).trim();
  // Only expand JSON-style escapes when the blob has no real newlines
  if (s.includes("\\n") && !s.includes("\n")) {
    s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }
  return s;
}

/**
 * Build runnable program: prefer full corrected_code, else patch source by line.
 */
export function buildCorrectedProgram(sourceCode, normalized) {
  const source = (sourceCode || "").trim();
  const fromAi = cleanCodeString(normalized?.corrected_code || "");
  const sourceLines = source ? source.split("\n") : [];

  const looksComplete =
    fromAi &&
    (fromAi.split("\n").length >= Math.max(2, Math.floor(sourceLines.length * 0.4)) ||
      /^(#include|def |class |import |int main|public static|fn main)/m.test(fromAi) ||
      (sourceLines.length <= 1 && fromAi.length > 20));

  if (looksComplete) return fromAi;

  if (!sourceLines.length) return fromAi;

  const out = [...sourceLines];
  const errors = normalized?.errors || [];

  for (const err of errors) {
    const lineIdx = (Number(err.line_number) || 1) - 1;
    const fix = (err.corrected_line || "").trim();
    if (lineIdx >= 0 && lineIdx < out.length && fix) {
      out[lineIdx] = fix;
    }
  }

  const merged = out.join("\n").trim();
  return merged || fromAi;
}

/**
 * Normalize debugger payload from LLM (arrays, loose shapes, bad escapes).
 */
export function normalizeDebuggerResult(raw) {
  if (!raw || typeof raw !== "object") return null;

  let errors = raw.errors ?? raw.Errors ?? raw.issues;
  if (!Array.isArray(errors)) {
    if (errors && typeof errors === "object") errors = [errors];
    else errors = [];
  }

  return {
    errors: errors.map(normalizeError),
    corrected_code: cleanCodeString(raw.corrected_code ?? raw.fixed_code ?? raw.code ?? ""),
    language: String(raw.language || raw.lang || "python").toLowerCase(),
    execution_output: normalizeExecutionOutput(
      raw.execution_output ?? raw.output ?? raw.stdout ?? ""
    )
  };
}

/**
 * Parse debugger AI response into structured report data.
 * @param {string} collected - Raw LLM output
 * @param {string} [sourceCode] - User's original code (for line-level merges)
 */
export function parseDebuggerResponse(collected, sourceCode = "") {
  if (!collected || typeof collected !== "string") return null;

  const repaired = repairLlmEscapeArtifacts(collected);
  let obj = extractJsonFromText(repaired);
  if (!obj) obj = extractJsonFromText(collected);

  if (!obj) {
    const start = repaired.indexOf("{");
    const end = repaired.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        obj = JSON.parse(repairLlmEscapeArtifacts(repaired.slice(start, end + 1)));
      } catch {
        return null;
      }
    }
  }

  const normalized = normalizeDebuggerResult(obj);
  if (!normalized) return null;
  if (!normalized.errors.length && !normalized.corrected_code) return null;

  normalized.corrected_code = buildCorrectedProgram(sourceCode, normalized);
  normalized.ai_execution_output = normalized.execution_output;
  return normalized;
}
