import React, { useMemo, useState } from "react";

const LEVELS = [
  {
    id: 1,
    title: "Hello World",
    prompt: "Write a program that prints Hello World."
  },
  {
    id: 2,
    title: "Sum of Two Numbers",
    prompt: "Read two numbers and print their sum."
  },
  {
    id: 3,
    title: "Multiplication",
    prompt: "Read two numbers and print their product."
  },
  {
    id: 4,
    title: "Triangle Area",
    prompt: "Read base and height, then print the area of a triangle."
  },
  {
    id: 5,
    title: "Mini Project",
    prompt:
      "Build a small program using the learned concepts. Example: simple menu app."
  }
];

export default function ModelFour({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [levelIndex, setLevelIndex] = useState(0);
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const level = useMemo(() => LEVELS[levelIndex], [levelIndex]);

  const submitLevel = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("http://localhost:8000/api/levels/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelId: level.id,
          language,
          code
        })
      });
      const data = await response.json();
      setResult(data);
      onSaveHistory({
        title: data.passed ? `Level ${level.id} passed` : "Level attempt",
        prompt: code.slice(0, 160),
        response: data.message
      });
      if (data.passed && levelIndex < LEVELS.length - 1) {
        setLevelIndex((prev) => prev + 1);
        setCode("");
      }
    } catch (error) {
      setResult({
        passed: false,
        message: "Failed to reach local backend. Is it running?"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Learning Levels</div>
        <div className="panel-subtitle">
          Progress through 5 levels. Complete each one to unlock the next.
        </div>
        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="python">Python</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <div className="level-card">
          <div className="level-title">
            Level {level.id}: {level.title}
          </div>
          <div className="level-prompt">{level.prompt}</div>
        </div>
        <textarea
          className="code-area"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={10}
          placeholder="Write your solution here..."
          spellCheck={false}
        />
        <button className="primary-button" onClick={submitLevel} disabled={loading}>
          {loading ? "Checking..." : "Submit Level"}
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Progress</div>
        <div className="level-progress">
          {LEVELS.map((item, index) => (
            <div
              key={item.id}
              className={`progress-step ${index < levelIndex ? "done" : index === levelIndex ? "active" : ""
                }`}
            >
              <div className="step-number">{item.id}</div>
              <div className="step-title">{item.title}</div>
            </div>
          ))}
        </div>
        {result ? (
          <div className="output-card">
            <div className={`status-pill ${result.passed ? "ok" : "fail"}`}>
              {result.passed ? "Passed" : "Try Again"}
            </div>
            <p>{result.message}</p>
            {result.hint && <p className="hint">{result.hint}</p>}
          </div>
        ) : (
          <div className="empty-state">Submit a level to get feedback.</div>
        )}
      </div>
    </div>
  );
}
