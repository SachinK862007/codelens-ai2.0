import React, { useState } from "react";

export default function ModelThree({ onSaveHistory }) {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const buildPlan = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("http://localhost:5050/api/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea })
      });
      const data = await response.json();
      setResult(data);
      onSaveHistory({
        title: "Idea mapped",
        prompt: idea.slice(0, 160),
        response: data.summary
      });
    } catch (error) {
      setResult({
        success: false,
        summary: "Failed to reach local backend. Is it running?"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Idea to Project Guide</div>
        <div className="panel-subtitle">
          Describe your idea. Codelens maps the problem, solution, and stack.
        </div>
        <textarea
          className="code-area"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={10}
          placeholder="Describe your idea in detail..."
          spellCheck={false}
        />
        <button className="primary-button" onClick={buildPlan} disabled={loading}>
          {loading ? "Building..." : "Generate Plan"}
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Project Blueprint</div>
        {result ? (
          <div className="output-card">
            <div className="section-label">Summary</div>
            <p>{result.summary}</p>
            <div className="section-label">Problem</div>
            <p>{result.problem}</p>
            <div className="section-label">Proposed Solution</div>
            <p>{result.solution}</p>
            <div className="section-label">Resources</div>
            <ul className="steps-list">
              {result.resources?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-label">API Keys & Tools</div>
            <ul className="steps-list">
              {result.apis?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-label">Research Papers / References</div>
            <ul className="steps-list">
              {result.references?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-label">Recommended Stack</div>
            <ul className="steps-list">
              {result.stack?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-label">Step-by-step Guidance</div>
            <ul className="steps-list">
              {result.steps?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-label">Suggested File Structure</div>
            <pre>{result.fileTree}</pre>
          </div>
        ) : (
          <div className="empty-state">Generate a plan to see details.</div>
        )}
      </div>
    </div>
  );
}
