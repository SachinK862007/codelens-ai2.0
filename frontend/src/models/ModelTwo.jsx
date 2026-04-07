import React, { useRef, useState } from "react";
import { streamClaudeJson } from "../lib/claudeStream.js";
import CodeBlock from "../components/CodeBlock.jsx";
import LineNumberedCodeBlock from "../components/LineNumberedCodeBlock.jsx";

const SYSTEM_PROMPT = `You are CodeLens.ai Smart Error Debugger.
Respond ONLY in JSON format with keys:
errors[], corrected_code, language, execution_output

errors[] must contain objects:
{
  "error_type": "SyntaxError|LogicError|RuntimeError|TypeError|...",
  "line_number": 14,
  "wrong_line": "...",
  "corrected_line": "...",
  "explanation": "..."
}

Rules:
- Detect the language and set "language".
- Provide the full corrected code in "corrected_code" (100% error-free).
- execution_output: expected output when running corrected_code with a reasonable sample input if needed.
- Never include markdown or backticks. JSON only.`;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function ModelTwo({ onSaveHistory, onRunInVisualizer }) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rawStream, setRawStream] = useState("");
  const [error, setError] = useState("");
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
    setRawStream("");
    setError("");

    const userText = `Language (user selected): ${language}

Code to debug:
${src}`.trim();

    let collected = "";
    try {
      await streamClaudeJson({
        system: SYSTEM_PROMPT,
        userText,
        signal: ac.signal,
        onDelta: (t) => {
          collected += t;
          setRawStream(collected);
          const parsed = safeJsonParse(collected);
          if (parsed) setResult(parsed);
        }
      });

      const parsed = safeJsonParse(collected);
      if (!parsed) throw new Error("AI did not return valid JSON. Retry.");

      setResult(parsed);
      onSaveHistory?.({
        title: "Smart Debugger",
        prompt: src.slice(0, 200),
        response: (parsed.corrected_code || "").slice(0, 200)
      });
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
          Paste or upload code. AI returns a structured error report + full corrected code.
        </div>
        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="python">Python</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <textarea
          className="code-area"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={14}
          placeholder="Paste your code here..."
          spellCheck={false}
        />
        <div className="field-row">
          <label>Or upload a file</label>
          <input type="file" onChange={handleFile} />
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
        {loading ? <div className="spinner">Streaming output…</div> : null}
        {!result && rawStream ? (
          <div className="output-card">
            <div className="section-label">Streaming JSON</div>
            <pre className="stream-pre">{rawStream}</pre>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-title">Report</div>
        {result ? (
          <div className="writer-output">
            <div className="writer-badges">
              <span className="badge">{result.language || language}</span>
              <span className="badge">Errors: {Array.isArray(result.errors) ? result.errors.length : 0}</span>
            </div>

            <div className="card">
              <div className="section-label">Errors</div>
              {Array.isArray(result.errors) && result.errors.length ? (
                <div className="steps-list" style={{ paddingLeft: 0 }}>
                  {result.errors.map((e, i) => (
                    <div className="card" key={`${i}-${e.line_number}`} style={{ marginTop: 10 }}>
                      <div className="writer-badges">
                        <span className="badge mono">{e.error_type || "Error"}</span>
                        <span className="badge">Line {e.line_number}</span>
                      </div>
                      <div className="diff-row" style={{ marginTop: 10 }}>
                        <div className="diff-cell bad">
                          <div className="section-label">Wrong line</div>
                          <pre className="badline-pre" style={{ color: "#7a1f1f", background: "transparent", border: "none" }}>
                            {e.wrong_line || ""}
                          </pre>
                        </div>
                        <div className="diff-cell good">
                          <div className="section-label">Corrected line</div>
                          <pre className="badline-pre" style={{ color: "#1f6f45", background: "transparent", border: "none" }}>
                            {e.corrected_line || ""}
                          </pre>
                        </div>
                      </div>
                      <div className="section-label">Explanation</div>
                      <p className="para">{e.explanation || ""}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No errors reported.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Full Corrected Code</div>
              <LineNumberedCodeBlock
                title="Full Corrected Code"
                languageLabel={result.language || language}
                code={result.corrected_code || ""}
              />
              <div className="button-row" style={{ marginTop: 10 }}>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onRunInVisualizer?.({ language: result.language || language, code: result.corrected_code || "" })}
                  disabled={!result.corrected_code}
                >
                  Run this code
                </button>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Execution Preview</div>
              <CodeBlock title="Expected output" language="text" code={result.execution_output || ""} />
            </div>
          </div>
        ) : (
          <div className="empty-state">Run analysis to see the structured report.</div>
        )}
      </div>
    </div>
  );
}
