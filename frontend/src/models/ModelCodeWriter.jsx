import React, { useMemo, useRef, useState } from "react";
import CodeBlock from "../components/CodeBlock.jsx";
import FlowchartDiagram from "../components/FlowchartDiagram.jsx";
import { streamClaudeJson } from "../lib/claudeStream.js";

const LANGUAGES = [
  { id: "c", label: "C", icon: "C" },
  { id: "cpp", label: "C++", icon: "C++" },
  { id: "python", label: "Python", icon: "🐍" },
  { id: "html", label: "HTML", icon: "⌘" },
  { id: "css", label: "CSS", icon: "🎨" },
  { id: "javascript", label: "JavaScript", icon: "JS" },
  { id: "java", label: "Java", icon: "☕" },
  { id: "typescript", label: "TypeScript", icon: "TS" },
  { id: "rust", label: "Rust", icon: "🦀" },
  { id: "go", label: "Go", icon: "Go" },
  { id: "php", label: "PHP", icon: "PHP" },
  { id: "swift", label: "Swift", icon: "Swift" },
  { id: "kotlin", label: "Kotlin", icon: "K" }
];

const SYSTEM_PROMPT = `You are CodeLens.ai Code Writer.

Return ONLY valid JSON (no markdown, no extra keys, no prose outside JSON) in exactly this shape:
{
  "code": "...",
  "language": "...",
  "algorithm": ["step1", "step2"],
  "logic_explanation": "...",
  "flowchart": [
    { "id": "1", "label": "Start", "type": "start", "next": "2" }
  ],
  "time_complexity": "...",
  "space_complexity": "..."
}

Rules:
- "language" must match the requested language exactly.
- "algorithm" must be a list of clear, numbered-meaning steps (strings) in correct order.
- "flowchart" must be a single connected chain via "next" (linear), starting at id "1".
- Use type: start | process | condition | end.
- Keep "code" complete and runnable.
- Never include backticks in code fences.`;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function ModelCodeWriter({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [rawStream, setRawStream] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const langMeta = useMemo(
    () => LANGUAGES.find((l) => l.id === language) || LANGUAGES[0],
    [language]
  );

  const run = async ({ nextLanguage } = {}) => {
    const lang = nextLanguage || language;
    const prompt = (description || "").trim();
    if (!prompt) {
      setError("Describe what code you want first.");
      return;
    }

    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError("");
    setData(null);
    setRawStream("");

    const userText = `Language: ${lang}\n\nTask:\n${prompt}\n\nReturn the JSON only.`;
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
          if (parsed) setData(parsed);
        }
      });

      const finalParsed = safeJsonParse(collected);
      if (!finalParsed) {
        throw new Error("Model did not return valid JSON. Please retry.");
      }

      setData(finalParsed);
      onSaveHistory?.({
        title: "Code Writer",
        prompt: `${lang}: ${prompt}`.slice(0, 220),
        response: (finalParsed.code || "").slice(0, 220)
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => run();
  const onRegenerate = () => run();
  const onChangeLanguage = () => run({ nextLanguage: language });

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Code Writer</div>
        <div className="panel-subtitle">
          Describe what you want. Get code, algorithm steps, a flowchart, and complexity—streamed live.
        </div>

        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.icon} {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <label>Request</label>
          <textarea
            className="code-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="Describe what code you want..."
            spellCheck={false}
            disabled={loading}
          />
        </div>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={onSubmit} disabled={loading}>
            {loading ? "Generating..." : `Generate ${langMeta.label}`}
          </button>
          <button className="ghost-button" type="button" onClick={onRegenerate} disabled={loading || !description.trim()}>
            Regenerate
          </button>
          <button className="ghost-button" type="button" onClick={onChangeLanguage} disabled={loading || !description.trim()}>
            Change Language
          </button>
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            <div className="error-title">Request failed</div>
            <div className="error-body">{error}</div>
            <button className="ghost-button" type="button" onClick={() => run()} disabled={loading}>
              Retry
            </button>
          </div>
        ) : null}

        {loading ? <div className="spinner">Streaming output…</div> : null}

        {!data && rawStream ? (
          <div className="output-card">
            <div className="section-label">Streaming JSON</div>
            <pre className="stream-pre">{rawStream}</pre>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-title">Output</div>
        {data ? (
          <div className="writer-output">
            <div className="writer-badges">
              <span className="badge">{data.language || langMeta.label}</span>
              {data.time_complexity ? <span className="badge">Time: {data.time_complexity}</span> : null}
              {data.space_complexity ? <span className="badge">Space: {data.space_complexity}</span> : null}
            </div>

            <CodeBlock title="Generated Code" code={data.code || ""} language={data.language || language} />

            <div className="card">
              <div className="section-label">Algorithm</div>
              {Array.isArray(data.algorithm) && data.algorithm.length ? (
                <ol className="steps-list numbered">
                  {data.algorithm.map((s, idx) => (
                    <li key={`${idx}-${s}`}>{s}</li>
                  ))}
                </ol>
              ) : (
                <div className="empty-state">Algorithm steps appear here.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Logic Explanation</div>
              <p className="para">{data.logic_explanation || "Logic explanation appears here."}</p>
            </div>

            <div className="card">
              <div className="section-label">Flowchart</div>
              <FlowchartDiagram flowchart={data.flowchart} />
            </div>
          </div>
        ) : (
          <div className="empty-state">Generate code to see structured output.</div>
        )}
      </div>
    </div>
  );
}

