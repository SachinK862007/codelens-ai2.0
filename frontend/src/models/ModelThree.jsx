import React, { useRef, useState } from "react";
import { streamClaudeJson } from "../lib/claudeStream.js";

const SYSTEM_PROMPT = `You are CodeLens.ai Project Roadmap Generator.

Deeply analyze the user's description and produce a 100% unique, specific roadmap (not generic boilerplate).

Respond ONLY valid JSON (no markdown, no extra keys) in this exact shape:
{
  "project_title": "...",
  "project_description": "...",
  "recommended_tech_stack": ["..."],
  "recommended_apis": [{ "name": "...", "link": "https://..." , "why": "..." }],
  "research_references": [{ "title": "...", "where_to_find": "..." , "why_relevant": "..." }],
  "file_folder_structure": "tree as plain text",
  "phases": [
    { "name": "Phase 1", "estimated_time": "2-4 days", "tasks": ["..."] }
  ],
  "deployment": ["..."]
}

Rules:
- Use concrete versions: e.g. "React 18 + TypeScript", not "frontend framework".
- API links must be real official URLs.
- Phases must be detailed and tailored to the description.
- Never reuse cached output; regenerate fully every request.`;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function ModelThree({ onSaveHistory }) {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rawStream, setRawStream] = useState("");
  const [error, setError] = useState("");
  const [refineText, setRefineText] = useState("");
  const abortRef = useRef(null);

  const buildPlan = async ({ refine = false } = {}) => {
    const prompt = (idea || "").trim();
    if (!prompt) {
      setError("Describe your project first.");
      return;
    }

    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError("");
    setRawStream("");
    setResult(null);

    const context = refine && result ? JSON.stringify(result) : "";
    const refinePart = refine ? (refineText || "").trim() : "";

    const userText = refine
      ? `Original description:\n${prompt}\n\nPrevious roadmap JSON:\n${context}\n\nRefinement request:\n${refinePart}\n\nRegenerate the full roadmap JSON with improvements.`
      : `Project description:\n${prompt}\n\nGenerate the full roadmap JSON.`;

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
        title: refine ? "Roadmap refined" : "Roadmap generated",
        prompt: prompt.slice(0, 180),
        response: (parsed.project_title || "").slice(0, 180)
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Roadmap generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Project Roadmap Generator</div>
        <div className="panel-subtitle">
          Describe your project. Get a deeply tailored roadmap with stack, APIs, research, phases, and deployment.
        </div>
        <textarea
          className="code-area"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={10}
          placeholder="Describe your project in detail..."
          spellCheck={false}
          disabled={loading}
        />
        <div className="button-row">
          <button className="primary-button" onClick={() => buildPlan({ refine: false })} disabled={loading}>
            {loading ? "Building..." : "Generate Roadmap"}
          </button>
          <button className="ghost-button" type="button" onClick={() => buildPlan({ refine: true })} disabled={loading || !result}>
            Refine Roadmap
          </button>
        </div>

        <div className="field-row" style={{ marginTop: 12 }}>
          <label>Refine this roadmap</label>
          <input
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="Add constraints (timeline, budget, features) and ask for improvements..."
            spellCheck={false}
            disabled={loading || !result}
          />
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            <div className="error-title">Request failed</div>
            <div className="error-body">{error}</div>
            <button className="ghost-button" type="button" onClick={() => buildPlan({ refine: false })} disabled={loading}>
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
        <div className="panel-title">Roadmap</div>
        {result ? (
          <div className="writer-output">
            <div className="card">
              <div className="section-label">Project</div>
              <div className="hero-title" style={{ fontSize: 18, margin: "6px 0 0" }}>
                {result.project_title}
              </div>
              <p className="para">{result.project_description}</p>
            </div>

            <div className="card">
              <div className="section-label">Recommended Tech Stack</div>
              <ul className="steps-list">
                {(result.recommended_tech_stack || []).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <div className="section-label">Recommended APIs</div>
              {Array.isArray(result.recommended_apis) && result.recommended_apis.length ? (
                <ul className="steps-list">
                  {result.recommended_apis.map((a) => (
                    <li key={a.name + a.link}>
                      <strong>{a.name}</strong>{" "}
                      {a.link ? (
                        <a href={a.link} target="_blank" rel="noreferrer">
                          {a.link}
                        </a>
                      ) : null}
                      {a.why ? <div className="muted" style={{ marginTop: 4 }}>{a.why}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">APIs appear here.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Research papers / references</div>
              {Array.isArray(result.research_references) && result.research_references.length ? (
                <ul className="steps-list">
                  {result.research_references.map((r) => (
                    <li key={r.title}>
                      <strong>{r.title}</strong>
                      {r.where_to_find ? <div className="muted" style={{ marginTop: 4 }}>{r.where_to_find}</div> : null}
                      {r.why_relevant ? <div className="muted" style={{ marginTop: 4 }}>{r.why_relevant}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">References appear here.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">File/folder structure</div>
              <pre className="stream-pre" style={{ maxHeight: 320 }}>{result.file_folder_structure}</pre>
            </div>

            <div className="card">
              <div className="section-label">Build phases</div>
              {Array.isArray(result.phases) && result.phases.length ? (
                <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                  {result.phases.map((p) => (
                    <div className="card" key={p.name}>
                      <div className="writer-badges">
                        <span className="badge">{p.name}</span>
                        <span className="badge">ETA: {p.estimated_time}</span>
                      </div>
                      <ul className="steps-list">
                        {(p.tasks || []).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Phases appear here.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Hosting / deployment</div>
              <ul className="steps-list">
                {(result.deployment || []).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="empty-state">Generate a plan to see details.</div>
        )}
      </div>
    </div>
  );
}
