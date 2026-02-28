import React, { useMemo, useState, useEffect, useRef } from "react";
import mermaid from "mermaid";

const DEFAULT_CODE = `# Write your code here
print("Hello, Codelens!")`;

export default function ModelOne({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [intent, setIntent] = useState("");
  const [stdin, setStdin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeLine, setActiveLine] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const flowchartRef = useRef(null);
  const [algoOpen, setAlgoOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const codeLines = useMemo(() => code.split("\n"), [code]);

  useEffect(() => {
    if (!result?.steps?.length) return undefined;
    let index = 0;
    setActiveLine(0);
    const timer = setInterval(() => {
      index += 1;
      setActiveLine(index);
      if (index >= result.steps.length - 1) {
        clearInterval(timer);
      }
    }, 600);
    return () => clearInterval(timer);
  }, [result]);

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
        flowchartRef.current.innerHTML =
          "<div>Unable to render flowchart.</div>";
      });
  }, [result]);

  const runCode = async () => {
    setLoading(true);
    setResult(null);
    setVideoUrl("");
    setVideoStatus("");
    try {
      const response = await fetch("http://localhost:5050/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, intent, input: stdin })
      });
      const data = await response.json();
      setResult(data);
      onSaveHistory({
        title: data.success ? "Code executed" : "Run failed",
        prompt: code,
        response: data.message || data.stderr || data.stdout
      });
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to reach local backend. Is it running?"
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePlaybackVideo = async () => {
    if (!result) {
      setVideoStatus("Run the code first to generate a detailed video.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setVideoStatus("Video recording is not supported in this browser.");
      return;
    }
    setVideoStatus("Recording playback video...");
    setVideoUrl("");
    const width = 720;
    const height = 420;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setVideoStatus("Canvas not supported.");
      return;
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const drawFrame = (lineIndex) => {
      ctx.fillStyle = "#f7efff";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#2c1b4f";
      ctx.font = "16px Consolas, monospace";
      ctx.fillText("Codelens Execution Playback", 16, 28);

      const startY = 60;
      const lineHeight = 20;
      const windowSize = 14;
      const startIndex = Math.max(0, lineIndex - Math.floor(windowSize / 2));
      const visible = codeLines.slice(startIndex, startIndex + windowSize);

      visible.forEach((line, idx) => {
        const y = startY + idx * lineHeight;
        const actualIndex = startIndex + idx;
        if (actualIndex === lineIndex) {
          ctx.fillStyle = "rgba(202, 175, 255, 0.8)";
          ctx.fillRect(12, y - 14, width - 24, lineHeight);
          ctx.fillStyle = "#2c1b4f";
        } else {
          ctx.fillStyle = "#3f2a66";
        }
        ctx.fillText(`${actualIndex + 1}. ${line || " "}`, 20, y);
      });

      const outputBoxY = height - 90;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillRect(12, outputBoxY, width - 24, 70);
      ctx.fillStyle = "#2c1b4f";
      ctx.font = "14px Consolas, monospace";
      ctx.fillText("Output:", 20, outputBoxY + 20);
      ctx.fillText(
        (result.stdout || result.stderr || result.message || "").slice(0, 60),
        20,
        outputBoxY + 44
      );
    };

    recorder.start();
    for (let index = 0; index < codeLines.length; index += 1) {
      drawFrame(index);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
    recorder.stop();

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setVideoStatus("Video ready.");
    };
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Code Runner</div>
        <div className="panel-subtitle">
          Run Python, C, or C++ locally and see step-by-step execution.
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
          spellCheck={false}
        />
        <div className="field-row">
          <label>What do you want the program to do if it fails?</label>
          <input
            placeholder="Describe the intended program..."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="field-row">
          <label>Program input (stdin)</label>
          <textarea
            className="code-area"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={4}
            placeholder="Example: 2 3"
            spellCheck={false}
          />
        </div>
        <button className="primary-button" onClick={runCode} disabled={loading}>
          {loading ? "Running..." : "Run Code"}
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Output</div>
        {result ? (
          <div className="output-card terminal-card">
            <div className={`status-pill ${result.success ? "ok" : "fail"}`}>
              {result.success ? "Success" : "Error"}
            </div>
            <div className="terminal-line">
              <span className="terminal-prompt">$</span> run {language}
            </div>
            {stdin && (
              <pre className="terminal-stdin">
                {stdin}
              </pre>
            )}
            <pre className="terminal-output">
              {result.stdout || result.stderr || result.message}
            </pre>
            {result.generatedCode && (
              <>
                <div className="section-label">Suggested Code</div>
                <pre>{result.generatedCode}</pre>
              </>
            )}
          </div>
        ) : (
          <div className="empty-state">Run your code to see output.</div>
        )}
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

      <div className="panel">
        <div className="panel-title">Step-by-step Video</div>
        <div className="code-playback">
          {codeLines.map((line, index) => (
            <div
              key={`${index}-${line}`}
              className={`code-line ${activeLine === index ? "active" : ""}`}
            >
              <span className="line-number">{index + 1}</span>
              <span className="line-content">{line || " "}</span>
            </div>
          ))}
        </div>
        <div className="video-controls">
          <button
            className="primary-button"
            onClick={generatePlaybackVideo}
            disabled={!codeLines.length}
            type="button"
          >
            Generate Step-by-step Video
          </button>
          {videoStatus && <div className="video-status">{videoStatus}</div>}
          <button
            className="ghost-button"
            type="button"
            onClick={() => setVideoOpen(true)}
            disabled={!videoUrl}
          >
            Open Video Popup
          </button>
        </div>
      </div>

      <div className={`modal-backdrop ${algoOpen ? "show" : ""}`}>
        <div className="modal-card glass-card">
          <div className="modal-header">
            <div className="modal-title">Algorithm & Flowchart</div>
            <button
              className="ghost-button"
              onClick={() => setAlgoOpen(false)}
              type="button"
            >
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
              <div className="empty-state">
                Run your code to see algorithm info.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`modal-backdrop ${videoOpen ? "show" : ""}`}>
        <div className="modal-card glass-card">
          <div className="modal-header">
            <div className="modal-title">Step-by-step Video</div>
            <button
              className="ghost-button"
              onClick={() => setVideoOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="modal-body">
            {videoUrl ? (
              <div className="video-preview">
                <video src={videoUrl} controls width="100%" />
                <a
                  className="ghost-button"
                  href={videoUrl}
                  download="codelens.webm"
                >
                  Download Video
                </a>
              </div>
            ) : (
              <div className="empty-state">Generate the video first.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
