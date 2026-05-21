import { extractJsonFromText } from "./partialJson.js";
import { repairLlmEscapeArtifacts } from "./debuggerParse.js";

/**
 * Turn file_folder_structure from LLM into displayable tree text.
 */
export function formatFileStructure(value) {
  if (value == null || value === "") return "";

  if (typeof value === "string") {
    return value.replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          const name = item.name || item.path || item.file || "";
          const children = item.children || item.files;
          if (children) return `${name}\n${formatFileStructure(children)}`;
          return formatFileStructure(item);
        }
        return String(item);
      })
      .join("\n");
  }

  if (typeof value === "object") {
    return formatObjectTree(value, 0);
  }

  return String(value);
}

function formatObjectTree(obj, depth) {
  const pad = "  ".repeat(depth);
  const lines = [];

  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      lines.push(`${pad}${key}/`);
      lines.push(formatObjectTree(val, depth + 1));
    } else if (Array.isArray(val)) {
      lines.push(`${pad}${key}/`);
      val.forEach((child) => {
        if (typeof child === "string") lines.push(`${pad}  ${child}`);
        else lines.push(formatObjectTree(child, depth + 1));
      });
    } else {
      lines.push(`${pad}${key}${val ? ` — ${val}` : ""}`);
    }
  }

  return lines.filter(Boolean).join("\n");
}

export function normalizeRoadmapResult(raw) {
  if (!raw || typeof raw !== "object") return null;

  return {
    project_title: String(raw.project_title || raw.title || "Project"),
    project_description: String(raw.project_description || raw.description || ""),
    recommended_tech_stack: Array.isArray(raw.recommended_tech_stack)
      ? raw.recommended_tech_stack.map(String)
      : [],
    recommended_apis: Array.isArray(raw.recommended_apis) ? raw.recommended_apis : [],
    research_references: Array.isArray(raw.research_references) ? raw.research_references : [],
    file_folder_structure: formatFileStructure(
      raw.file_folder_structure ?? raw.file_structure ?? raw.structure ?? ""
    ),
    phases: Array.isArray(raw.phases) ? raw.phases : [],
    deployment: Array.isArray(raw.deployment) ? raw.deployment.map(String) : []
  };
}

export function parseRoadmapResponse(collected) {
  if (!collected || typeof collected !== "string") return null;
  const repaired = repairLlmEscapeArtifacts(collected);
  const obj = extractJsonFromText(repaired) || extractJsonFromText(collected);
  if (!obj) return null;
  const normalized = normalizeRoadmapResult(obj);
  if (!normalized?.project_title && !normalized?.file_folder_structure) return null;
  return normalized;
}
