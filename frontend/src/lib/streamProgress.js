import { extractJsonBool, extractJsonString } from "./partialJson.js";

const PROGRESS_BY_VARIANT = {
  debugger: [
    { key: "errors", label: "Scanning errors", icon: "scan" },
    { key: "corrected_code", label: "Building fixes", icon: "fix" },
    { key: "execution_output", label: "Preview output", icon: "run" }
  ],
  roadmap: [
    { key: "project_title", label: "Project overview", icon: "title" },
    { key: "recommended_tech_stack", label: "Tech stack", icon: "stack" },
    { key: "phases", label: "Build phases", icon: "phases" },
    { key: "deployment", label: "Deployment plan", icon: "deploy" }
  ],
  practice: [
    { key: "passed", label: "Evaluating logic", icon: "check" },
    { key: "feedback", label: "Writing feedback", icon: "feedback" },
    { key: "hint", label: "Preparing hint", icon: "hint" }
  ],
  codewriter: [
    { key: "code", label: "Writing code", icon: "code" },
    { key: "algorithm", label: "Algorithm steps", icon: "algo" },
    { key: "logic_explanation", label: "Logic explanation", icon: "logic" },
    { key: "flowchart", label: "Flowchart", icon: "flow" }
  ]
};

function keyDetected(raw, key) {
  if (!raw) return false;
  if (key === "passed") return extractJsonBool(raw, "passed") !== null;
  if (key === "errors" || key === "phases" || key === "algorithm" || key === "flowchart") {
    return raw.includes(`"${key}"`) && (raw.includes("[") || raw.includes("{"));
  }
  const val = extractJsonString(raw, key);
  return val != null && val.length > 0;
}

/**
 * Detect which JSON sections have started arriving during streaming.
 */
export function detectStreamProgress(raw, variant = "default") {
  const items = PROGRESS_BY_VARIANT[variant] || [];
  return items.filter((item) => keyDetected(raw, item.key));
}
