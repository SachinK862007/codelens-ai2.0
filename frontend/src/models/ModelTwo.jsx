import React, { useRef, useState } from "react";
import { streamClaudeJson } from "../lib/claudeStream.js";
import { parseDebuggerResponse } from "../lib/debuggerParse.js";
import { detectStreamProgress } from "../lib/streamProgress.js";
import CodeWorkbench from "../components/CodeWorkbench.jsx";
import DebuggerReport from "../components/DebuggerReport.jsx";
import AILoadingAnimation, { AISkeletonLoader } from "../components/AILoadingAnimation.jsx";
import AIResponseCard from "../components/AIResponseCard.jsx";

const SYSTEM_PROMPT = `You are CodeLens.ai Smart Error Debugger.
Respond ONLY with valid JSON (no markdown, no text before or after) using exactly these keys:
errors[], corrected_code, language, execution_output

Each error object must include:
error_type, line_number, wrong_line, corrected_line, explanation

Rules:
- The user may provide raw source code OR an error stack trace pasted from a terminal. If it's a stack trace, deduce the original code and the fixes required.
- List EVERY error you find (syntax, logic, runtime) as separate objects in errors[].
- corrected_code must be the complete fixed program as one string, stripped of any terminal error trace text.
- execution_output must be a single string (use \\n for newlines), NOT an array.
- Never use backticks. JSON only.`;

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
