import React, { useRef, useState } from "react";
import { streamClaudeJson } from "../lib/claudeStream.js";
import { parseRoadmapResponse } from "../lib/roadmapParse.js";
import { detectStreamProgress } from "../lib/streamProgress.js";
import AILoadingAnimation, { AISkeletonLoader } from "../components/AILoadingAnimation.jsx";
import AIResponseCard from "../components/AIResponseCard.jsx";
import FileTreeView from "../components/FileTreeView.jsx";

const SYSTEM_PROMPT = `You are CodeLens.ai Project Roadmap Generator.

Deeply analyze the user's description and produce a 100% unique, specific roadmap (not generic boilerplate).

Respond ONLY valid JSON (no markdown, no extra keys) in this exact shape:
{
  "project_title": "...",
  "project_description": "...",
  "recommended_tech_stack": ["..."],
  "recommended_apis": [{ "name": "...", "link": "https://..." , "why": "..." }],
  "research_references": [{ "title": "...", "where_to_find": "..." , "why_relevant": "..." }],
  "file_folder_structure": "multi-line plain text tree using ├── and │ characters, MUST escape newlines as \\n",
  "phases": [
    { "name": "Phase 1", "estimated_time": "2-4 days", "tasks": ["..."] }
  ],
  "deployment": ["..."]
}

Rules:
- Use concrete versions: e.g. "React 18 + TypeScript", not "frontend framework".
- API links must be real official URLs.
- Phases must be detailed and tailored to the description.
- The "file_folder_structure" MUST show ALL folders and files completely. Do NOT truncate, use "..." or skip any files. Be comprehensive.
- Never reuse cached output; regenerate fully every request.`;

export default function ModelThree({ onSaveHistory }) {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [refineText, setRefineText] = useState("");
  const [phase, setPhase] = useState("thinking");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [streamProgress, setStreamProgress] = useState([]);
  const [rawFallback, setRawFallback] = useState("");
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
    setResult(null);
    setPhase("thinking");
    setPhaseLabel("");
    setStreamProgress([]);
    setRawFallback("");

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
        onPhase: (p, label) => {
          setPhase(p);
          if (label) setPhaseLabel(label);
        },
        onDelta: (t) => {
          collected += t;
          setStreamProgress(detectStreamProgress(collected, "roadmap"));
        }
      });

      const parsed = parseRoadmapResponse(collected);
      if (parsed) {
        setResult(parsed);
        onSaveHistory?.({
          title: refine ? "Roadmap refined" : "Roadmap generated",
          prompt: prompt.slice(0, 180),
          response: (parsed.project_title || "").slice(0, 180)
        });
      } else {
        setRawFallback(collected);
      }
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

        {loading && (
          <AILoadingAnimation
            phase={phase}
            phaseLabel={phaseLabel}
            variant="roadmap"
            streamProgress={streamProgress}
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Roadmap</div>
        {loading ? (
          <AISkeletonLoader />
        ) : result ? (
          <div className="writer-output ai-result-enter">
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
                {(result.recommended_tech_stack || []).map((s, i) => (
                  <li key={i}>{typeof s === 'object' ? JSON.stringify(s) : s}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <div className="section-label">Recommended APIs</div>
              {Array.isArray(result.recommended_apis) && result.recommended_apis.length ? (
                <ul className="steps-list">
                  {result.recommended_apis.map((a, i) => (
                    <li key={i}>
                      <strong>{a.name || "API"}</strong>{" "}
                      {a.link && typeof a.link === "string" ? (
                        <a href={a.link} target="_blank" rel="noreferrer">
                          {a.link}
                        </a>
                      ) : null}
                      {a.why ? <div className="muted" style={{ marginTop: 4 }}>{typeof a.why === 'object' ? JSON.stringify(a.why) : a.why}</div> : null}
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
                  {result.research_references.map((r, i) => (
                    <li key={i}>
                      <strong>{r.title || "Reference"}</strong>
                      {r.where_to_find ? <div className="muted" style={{ marginTop: 4 }}>{typeof r.where_to_find === 'object' ? JSON.stringify(r.where_to_find) : r.where_to_find}</div> : null}
                      {r.why_relevant ? <div className="muted" style={{ marginTop: 4 }}>{typeof r.why_relevant === 'object' ? JSON.stringify(r.why_relevant) : r.why_relevant}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">References appear here.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">File / folder structure</div>
              <FileTreeView structure={result.file_folder_structure} />
            </div>

            <div className="card">
              <div className="section-label">Build phases</div>
              {Array.isArray(result.phases) && result.phases.length ? (
                <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                  {result.phases.map((p, i) => (
                    <div className="card" key={i}>
                      <div className="writer-badges">
                        <span className="badge">{p.name || `Phase ${i+1}`}</span>
                        <span className="badge">ETA: {p.estimated_time || "N/A"}</span>
                      </div>
                      <ul className="steps-list">
                        {(p.tasks || []).map((t, j) => (
                          <li key={j}>{typeof t === 'object' ? JSON.stringify(t) : t}</li>
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
                {(result.deployment || []).map((d, i) => (
                  <li key={i}>{typeof d === 'object' ? JSON.stringify(d) : d}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : rawFallback ? (
          <AIResponseCard text={rawFallback} variant="roadmap" />
        ) : (
          <div className="empty-state">Generate a plan to see details.</div>
        )}
      </div>
    </div>
  );
}
