export function extractJsonString(raw, key) {
  const k = `"${key}"`;
  const i = raw.indexOf(k);
  if (i === -1) return null;
  const colon = raw.indexOf(":", i + k.length);
  if (colon === -1) return null;
  const firstQuote = raw.indexOf('"', colon + 1);
  if (firstQuote === -1) return null;

  let out = "";
  let esc = false;
  for (let p = firstQuote + 1; p < raw.length; p += 1) {
    const ch = raw[p];
    if (esc) {
      if (ch === "n") out += "\n";
      else if (ch === "t") out += "\t";
      else out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
  }
  return out;
}

export function extractJsonBool(raw, key) {
  const k = `"${key}"`;
  const i = raw.indexOf(k);
  if (i === -1) return null;
  const colon = raw.indexOf(":", i + k.length);
  if (colon === -1) return null;
  const tail = raw.slice(colon + 1).trimStart();
  if (tail.startsWith("true")) return true;
  if (tail.startsWith("false")) return false;
  return null;
}

/**
 * Repair JSON that has literal newlines inside string values.
 * llama3.1 often outputs unescaped newlines in JSON strings.
 */
function repairJsonNewlines(text) {
  let result = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && ch === "\n") {
      result += "\\n";
      continue;
    }

    if (inString && ch === "\r") {
      continue; // skip \r
    }

    if (inString && ch === "\t") {
      result += "\\t";
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Extract JSON from raw LLM output that may contain markdown fences,
 * prose before/after, unescaped newlines in strings, or other non-JSON text.
 * Returns the parsed object or null.
 */
export function extractJsonFromText(raw) {
  if (!raw || typeof raw !== "string") return null;

  // 1. Try direct parse first
  try {
    return JSON.parse(raw.trim());
  } catch {
    // continue
  }

  // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      // Try with newline repair
      try {
        return JSON.parse(repairJsonNewlines(inner));
      } catch {
        // continue
      }
    }
  }

  // 3. Find the first { ... } block using brace counting
  const start = raw.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          const block = raw.slice(start, i + 1);
          // Try direct parse
          try {
            return JSON.parse(block);
          } catch {
            // Try with newline repair
            try {
              return JSON.parse(repairJsonNewlines(block));
            } catch {
              return null;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Shared safe JSON parse — tries extractJsonFromText first.
 */
export function safeJsonParse(text) {
  return extractJsonFromText(text);
}
