import React, { useState } from "react";

export default function ModelTwo({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCode(reader.result?.toString() ?? "");
    reader.readAsText(file);
  };

  const diagnose = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("http://localhost:5050/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code })
      });
      const data = await response.json();
      setResult(data);
      onSaveHistory({
        title: data.success ? "Diagnosis complete" : "Diagnosis failed",
        prompt: code.slice(0, 200),
        response: data.summary || data.message
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
        <div className="panel-title">Error Analyzer</div>
        <div className="panel-subtitle">
          Paste or upload code. Codelens runs it locally and explains errors.
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
      </div>

      <div className="panel">
        <div className="panel-title">Guidance</div>
        {result ? (
          <div className="output-card">
            <div className={`status-pill ${result.success ? "ok" : "fail"}`}>
              {result.success ? "Found" : "Needs Fix"}
            </div>
            <div className="section-label">Summary</div>
            <p>{result.summary}</p>
            {result.steps?.length ? (
              <>
                <div className="section-label">Step-by-step</div>
                <ul className="steps-list">
                  {result.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {result.fixedCode && (
              <>
                <div className="section-label">Suggested Fix</div>
                <pre>{result.fixedCode}</pre>
              </>
            )}
          </div>
        ) : (
          <div className="empty-state">Run analysis to see guidance.</div>
        )}
      </div>
    </div>
  );
}
