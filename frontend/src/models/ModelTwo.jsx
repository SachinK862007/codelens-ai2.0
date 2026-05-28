import React, { useRef, useState } from "react";
import { streamClaudeJson } from "../lib/claudeStream.js";
import { parseDebuggerResponse } from "../lib/debuggerParse.js";
import { detectStreamProgress } from "../lib/streamProgress.js";
import CodeWorkbench from "../components/CodeWorkbench.jsx";
import DebuggerReport from "../components/DebuggerReport.jsx";
import AILoadingAnimation, { AISkeletonLoader } from "../components/AILoadingAnimation.jsx";
import AIResponseCard from "../components/AIResponseCard.jsx";

const SYSTEM_PROMPT = `You are CodeLens.ai Smart Error Debugger.
Respond ONLY with a single valid JSON object. No markdown, no text before or after, no code fences.

Exact shape required:
{
  "errors": [
    {
      "error_type": "SyntaxError",
      "line_number": 5,
      "wrong_line": "the exact bad line",
      "corrected_line": "the fixed line",
      "explanation": "one sentence why"
    }
  ],
  "corrected_code": "full fixed program as one string with \\n for newlines",
  "language": "python",
  "execution_output": "sample output string with \\n for newlines"
}

Rules:
- You MUST find and list EVERY single error in the code — syntax, logic, runtime, and semantic. Do NOT stop after finding one or two. Scan the ENTIRE program.
- Each error gets its own separate object in the errors array. Never merge multiple errors into one.
- corrected_code must be the COMPLETE fixed program — never truncate it.
- All newlines inside string values MUST be escaped as \\n. Never use literal newlines inside JSON strings.
- All double quotes inside string values MUST be escaped as \\".
- execution_output must be a plain string, NOT an array or object.
- Never use backticks anywhere in the JSON.
- If the input is a terminal stack trace, deduce the original code and all fixes from it.`;

export default function ModelTwo({ onSaveHistory, onRunInVisualizer }) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("thinking");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [streamProgress, setStreamProgress] = useState([]);
  const [rawFallback, setRawFallback] = useState("");
  const abortRef = useRef(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCode(reader.result?.toString() ?? "");
    reader.readAsText(file);
  };

  const diagnose = async () => {
    const src = (code || "").trim();
    if (!src) {
      setError("Paste code first.");
      return;
    }
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setResult(null);
    setError("");
    setPhase("thinking");
    setPhaseLabel("");
    setStreamProgress([]);
    setRawFallback("");

    const userText = `Language (user selected): ${language}

Code to debug:
${src}`.trim();

    let collected = "";
    try {
      await streamClaudeJson({
        system: SYSTEM_PROMPT,
        userText,
        signal: ac.signal,
        onPhase: (p, label) => {
          setPhase(p);
          if (label) setPhaseLabel(label);
        },
        onDelta: (t) => {
          collected += t;
          setStreamProgress(detectStreamProgress(collected, "debugger"));
        }
      });

      const parsed = parseDebuggerResponse(collected, src);
      if (parsed) {
        setResult(parsed);
        onSaveHistory?.({
          title: "Smart Debugger",
          prompt: src.slice(0, 200),
          response: (parsed.corrected_code || "").slice(0, 200)
        });
      } else {
        setRawFallback(collected);
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Debug request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Smart Error Debugger</div>
        <div className="panel-subtitle">
          Paste or upload code (or terminal error output). AI returns a structured error report + full corrected code.
        </div>
        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}>
            <option value="python">Python</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <CodeWorkbench language={language} value={code} onChange={setCode} height={460} />
        <div className="field-row">
          <label>Or upload a file</label>
          <input type="file" onChange={handleFile} disabled={loading} />
        </div>
        <button className="primary-button" onClick={diagnose} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze & Fix"}
        </button>
        {error ? (
          <div className="error-banner" role="alert">
            <div className="error-title">Request failed</div>
            <div className="error-body">{error}</div>
            <button className="ghost-button" type="button" onClick={diagnose} disabled={loading}>
              Retry
            </button>
          </div>
        ) : null}

        {loading && (
          <AILoadingAnimation
            phase={phase}
            phaseLabel={phaseLabel}
            variant="debugger"
            streamProgress={streamProgress}
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Report</div>
        {loading ? (
          <AISkeletonLoader />
        ) : result ? (
          <DebuggerReport
            result={result}
            language={language}
            onRunInVisualizer={onRunInVisualizer}
          />
        ) : rawFallback ? (
          <AIResponseCard text={rawFallback} variant="debugger" />
        ) : (
          <div className="empty-state">Run analysis to see the structured report.</div>
        )}
      </div>
    </div>
  );
}
