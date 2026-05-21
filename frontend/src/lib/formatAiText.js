import { extractJsonFromText } from "./partialJson.js";

/**
 * Turn raw LLM output (often JSON) into readable plain text for MarkdownRenderer.
 */
export function formatAiTextForDisplay(raw) {
  if (!raw || typeof raw !== "string") return "";

  const parsed = extractJsonFromText(raw);
  if (!parsed || typeof parsed !== "object") {
    return stripJsonNoise(raw);
  }

  return jsonToReadableText(parsed);
}

function stripJsonNoise(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  t = t.replace(/^(?:here\s+is\s+(?:the\s+)?(?:json|response|output)\s*[:.]?\s*)/i, "");
  return t.trim();
}

function jsonToReadableText(obj, depth = 0) {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  if (Array.isArray(obj)) {
    return obj
      .map((item, i) => {
        if (typeof item === "string") return `• ${item}`;
        if (typeof item === "object" && item !== null) {
          const inner = jsonToReadableText(item, depth + 1);
          return inner ? `${i + 1}. ${inner.replace(/\n/g, "\n   ")}` : "";
        }
        return `• ${String(item)}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const lines = [];
  const indent = "  ".repeat(depth);

  for (const [key, value] of Object.entries(obj)) {
    const label = keyLabel(key);
    if (value == null || value === "") continue;

    if (typeof value === "string") {
      if (value.includes("\n") && value.length > 80) {
        lines.push(`${indent}**${label}**\n${value.split("\n").map((l) => `${indent}  ${l}`).join("\n")}`);
      } else {
        lines.push(`${indent}**${label}:** ${value}`);
      }
    } else if (Array.isArray(value)) {
      lines.push(`${indent}**${label}**`);
      lines.push(jsonToReadableText(value, depth + 1));
    } else if (typeof value === "object") {
      lines.push(`${indent}**${label}**`);
      lines.push(jsonToReadableText(value, depth + 1));
    } else {
      lines.push(`${indent}**${label}:** ${value}`);
    }
  }

  return lines.filter(Boolean).join("\n\n");
}

function keyLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
