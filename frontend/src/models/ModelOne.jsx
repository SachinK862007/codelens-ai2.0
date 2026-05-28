import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import SimpleTerminal from "../components/SimpleTerminal.jsx";
import CodeWorkbench from "../components/CodeWorkbench.jsx";

const DEFAULT_CODE = `# Write your code here
name = input("Enter your name: ")
print(f"Hello, {name}! Welcome to Codelens.")`;

export default function ModelOne({ onSaveHistory, runnerPrefill }) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [result, setResult] = useState(null);
  const [algoOpen, setAlgoOpen] = useState(false);
  const flowchartRef = useRef(null);
  const simpleTerminalRef = useRef(null);

  useEffect(() => {
    if (!runnerPrefill?.code) return;
    if (typeof runnerPrefill.language === "string") setLanguage(runnerPrefill.language);
    setCode(runnerPrefill.code);
  }, [runnerPrefill?.ts]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "default" });
  }, []);

  useEffect(() => {
    if (!result?.flowchart || !flowchartRef.current) return;
    const id = `flow-${Date.now()}`;
    mermaid
      .render(id, result.flowchart)
      .then(({ svg }) => {
        flowchartRef.current.innerHTML = svg;
      })
      .catch(() => {
        flowchartRef.current.innerHTML = "<div>Unable to render flowchart.</div>";
      });
  }, [result]);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, intent, input: "mock input" })
      });
      const data = await response.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    }
  };

  const runCode = async () => {
    setLoading(true);
    setTerminalVisible(true);
    simpleTerminalRef.current?.run();
    await fetchAnalysis();
    setLoading(false);
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Code Runner</div>
        <div className="panel-subtitle">
          Run Python, C, or C++ locally and build intuitively.
        </div>
        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="python">Python</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <CodeWorkbench language={language} value={code} onChange={setCode} height={560} />
        <div className="field-row" style={{ marginTop: 10 }}>
          <label>Intent (optional — describe what the program should do)</label>
          <input
            placeholder="Describe the intended program..."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            spellCheck={false}
          />
        </div>
        <button className="primary-button" onClick={runCode} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Process Running..." : "Run in Terminal"}
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Interactive Terminal</div>
        <div className="panel-subtitle">
          Type directly into the console to interact with your program.
        </div>
        <div className="terminal-panel" style={{ flex: 1 }}>
          <SimpleTerminal
            ref={simpleTerminalRef}
            code={code}
            language={language}
            visible={terminalVisible}
            onVisibilityChange={setTerminalVisible}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Algorithm & Flowchart</div>
        <div className="panel-subtitle">
          Open the detailed algorithm steps and dynamic flowchart in a popup.
        </div>
        <button
          className="primary-button"
          onClick={() => setAlgoOpen(true)}
          disabled={!result}
          type="button"
        >
          Open Algorithm & Flowchart
        </button>
      </div>

      <div className={`modal-backdrop ${algoOpen ? "show" : ""}`}>
        <div className="modal-card glass-card">
          <div className="modal-header">
            <div className="modal-title">Algorithm & Flowchart</div>
            <button className="ghost-button" onClick={() => setAlgoOpen(false)} type="button">
              Close
            </button>
          </div>
          <div className="modal-body">
            {result ? (
              <div className="output-card">
                {result.algorithmSteps?.length ? (
                  <>
                    <div className="section-label">Algorithm Steps</div>
                    <ul className="steps-list">
                      {result.algorithmSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <div className="section-label">Flowchart</div>
                {result.flowchart ? (
                  <div className="flowchart-card" ref={flowchartRef} />
                ) : (
                  <div className="empty-state">Flowchart appears here.</div>
                )}
              </div>
            ) : (
              <div className="empty-state">Run your code to see algorithm info.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
