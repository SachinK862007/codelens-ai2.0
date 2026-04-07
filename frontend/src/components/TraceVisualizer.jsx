import React, { useEffect, useMemo, useRef, useState } from "react";
import CodeBlock from "./CodeBlock.jsx";

const SPEEDS = [
  { id: 0.5, label: "0.5x" },
  { id: 1, label: "1x" },
  { id: 2, label: "2x" },
  { id: 3, label: "3x" }
];

function shallowDiff(prev, next) {
  const changed = new Set();
  const p = prev || {};
  const n = next || {};
  for (const k of new Set([...Object.keys(p), ...Object.keys(n)])) {
    if (String(p[k]) !== String(n[k])) changed.add(k);
  }
  return changed;
}

export default function TraceVisualizer({ language, code, input, onRunCorrectedCode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trace, setTrace] = useState([]);
  const [stdout, setStdout] = useState("");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [flashKeys, setFlashKeys] = useState([]);
  const timerRef = useRef(null);

  const lines = useMemo(() => (code || "").split("\n"), [code]);
  const step = trace[idx] || null;
  const executedLineSet = useMemo(() => {
    const set = new Set();
    for (let i = 0; i <= idx; i += 1) {
      const s = trace[i];
      if (s?.event === "line" && typeof s.line === "number" && s.line > 0) set.add(s.line);
    }
    return set;
  }, [trace, idx]);

  const currentLine = step?.line || 0;
  const currentVars = step?.vars || {};
  const prevVars = trace[idx - 1]?.vars || {};
  const changedKeys = useMemo(() => Array.from(shallowDiff(prevVars, currentVars)), [prevVars, currentVars]);

  useEffect(() => {
    if (!changedKeys.length) return;
    setFlashKeys(changedKeys);
    const t = window.setTimeout(() => setFlashKeys([]), 550);
    return () => window.clearTimeout(t);
  }, [changedKeys.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    const ms = Math.max(120, 650 / speed);
    timerRef.current = window.setInterval(() => {
      setIdx((prev) => {
        const next = Math.min(prev + 1, Math.max(0, trace.length - 1));
        if (next >= trace.length - 1) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          setPlaying(false);
        }
        return next;
      });
    }, ms);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, speed, trace.length]);

  const fetchTrace = async () => {
    if ((language || "").toLowerCase() !== "python") {
      setError("Visualizer currently supports Python traces only.");
      return;
    }
    setLoading(true);
    setError("");
    setTrace([]);
    setStdout("");
    setIdx(0);
    setPlaying(false);
    try {
      const res = await fetch("http://localhost:8000/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, input: input || "" })
      });
      const data = await res.json();
      const t = Array.isArray(data.trace) ? data.trace : [];
      setTrace(t);
      setStdout(data.stdout || "");
      if (t[0]?.event === "error") setIdx(0);
    } catch (e) {
      setError(e?.message || "Failed to fetch trace.");
    } finally {
      setLoading(false);
    }
  };

  const stepBack = () => setIdx((p) => Math.max(0, p - 1));
  const stepForward = () => setIdx((p) => Math.min(trace.length - 1, p + 1));

  const isError = step?.event === "error";

  return (
    <div className="traceviz">
      <div className="traceviz-header">
        <div>
          <div className="panel-title">Visual Debugger</div>
          <div className="panel-subtitle">
            PythonTutor-style step execution with timeline, variables, output, and stack frames.
          </div>
        </div>
        <div className="traceviz-actions">
          <button className="primary-button" type="button" onClick={fetchTrace} disabled={loading || !code.trim()}>
            {loading ? "Tracing..." : "Run Visual Trace"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          <div className="error-title">Trace error</div>
          <div className="error-body">{error}</div>
          <button className="ghost-button" type="button" onClick={fetchTrace} disabled={loading}>
            Retry
          </button>
        </div>
      ) : null}

      {isError ? (
        <div className="error-banner runtime" role="alert">
          <div className="error-title">
            {step.error_type || "RuntimeError"} {step.line ? `• Line ${step.line}` : ""}
          </div>
          <div className="error-body">{step.error_message || "Program error."}</div>
          {step.code ? (
            <div className="badline">
              <span className="badge mono">Problem line</span>
              <pre className="badline-pre">{step.code}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {trace.length ? (
        <div className="traceviz-controls">
          <div className="control-row">
            <button className="ghost-button" type="button" onClick={() => setPlaying((p) => !p)} disabled={loading}>
              {playing ? "Pause" : "Play"}
            </button>
            <button className="ghost-button" type="button" onClick={stepBack} disabled={loading || idx === 0}>
              Step Back
            </button>
            <button className="ghost-button" type="button" onClick={stepForward} disabled={loading || idx >= trace.length - 1}>
              Step Forward
            </button>
            <div className="speed">
              <span className="badge">Speed</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={loading}>
                {SPEEDS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="badge mono">
              Step {idx + 1}/{trace.length}
            </div>
          </div>
          <input
            className="scrubber"
            type="range"
            min={0}
            max={Math.max(0, trace.length - 1)}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            disabled={loading}
          />
        </div>
      ) : null}

      <div className="traceviz-panels">
        <div className="traceviz-code">
          <div className="section-label">Code</div>
          <div className="codepanel">
            {lines.map((ln, i) => {
              const lineNo = i + 1;
              const isCurrent = lineNo === currentLine;
              const isExecuted = executedLineSet.has(lineNo);
              const isProblem = isError && step?.line === lineNo;
              return (
                <div
                  key={`${lineNo}-${ln}`}
                  className={`codepanel-line ${isExecuted ? "executed" : ""} ${isCurrent ? "current" : ""} ${isProblem ? "problem" : ""}`}
                >
                  <div className="codepanel-gutter">
                    <span className="codepanel-arrow">{isCurrent ? "➜" : ""}</span>
                    <span className="codepanel-lineno">{lineNo}</span>
                  </div>
                  <div className="codepanel-text">{ln || " "}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="traceviz-vars">
          <div className="section-label">Variables</div>
          <div className="varpanel">
            <table className="var-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(currentVars).length ? (
                  Object.entries(currentVars).map(([k, v]) => (
                    <tr key={k} className={flashKeys.includes(k) ? "flash" : ""}>
                      <td className="mono">{k}</td>
                      <td className="mono">{String(v)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="muted">
                      No variables in scope yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {Array.isArray(step?.stack) && step.stack.length ? (
              <div className="stack">
                <div className="section-label">Stack frames</div>
                {step.stack.map((f, i) => (
                  <div className="stack-frame" key={`${f.func}-${i}`}>
                    <div className="stack-title">
                      <span className="badge mono">{f.func}()</span>
                      <span className="badge">Line {f.line}</span>
                    </div>
                    <div className="stack-locals">
                      {f.locals && Object.keys(f.locals).length ? (
                        Object.entries(f.locals).map(([k, v]) => (
                          <div className="stack-kv" key={`${i}-${k}`}>
                            <span className="mono">{k}</span>
                            <span className="mono">= {String(v)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="muted">No locals</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="traceviz-output">
        <div className="section-label">Output</div>
        <div className="outputpanel">
          <CodeBlock title="Console output so far" language="text" code={(step?.output ?? stdout ?? "").toString()} />
          {onRunCorrectedCode ? (
            <button className="ghost-button" type="button" onClick={onRunCorrectedCode}>
              Run this code
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

