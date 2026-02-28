import React, { useMemo, useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

const DEFAULT_CODE = `# Write your code here
name = input("Enter your name: ")
print(f"Hello, {name}! Welcome to Codelens.")`;

export default function ModelOne({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeLine, setActiveLine] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const flowchartRef = useRef(null);
  const [algoOpen, setAlgoOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);

  const codeLines = useMemo(() => code.split("\n"), [code]);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new Terminal({
        theme: {
          background: '#201532',
          foreground: '#f6efff',
          cursor: '#d9c7ff',
          selectionBackground: 'rgba(217, 199, 255, 0.3)'
        },
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: 13,
        cursorBlink: true,
        convertEol: true
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.onData(data => {
        // Echo to terminal
        term.write(data);
        let payload = data;
        if (data === '\r') {
          term.write('\n');
          payload = '\n';
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', input: payload }));
        }
      });

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

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

  const fetchAnalysis = async () => {
    try {
      // Re-use logic to just fetch the flowchart mapping behind the scenes
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
    setVideoUrl("");
    setVideoStatus("");

    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
      xtermRef.current.focus();
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    fetchAnalysis(); // Generates background flowchart for the modal

    const ws = new WebSocket("ws://localhost:8000");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "init", language, code }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "output") {
        xtermRef.current?.write(msg.data);
      } else if (msg.type === "exit") {
        setLoading(false);
        ws.close();
        onSaveHistory({
          title: "Interactive execution",
          prompt: code,
          response: `Process exited with code ${msg.code}`
        });
      }
    };

    ws.onerror = () => {
      xtermRef.current?.write("\r\n\x1b[31mFailed to connect to Local Execution Engine.\x1b[0m\r\n");
      setLoading(false);
    };
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
    setVideoStatus("Tracing program execution...");
    setVideoUrl("");

    // 1. Fetch the real execution trace from the backend
    let traceData = [];
    let traceStdout = "";
    try {
      const traceRes = await fetch("http://localhost:8000/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, input: "" }),
      });
      const traceJson = await traceRes.json();
      traceData = traceJson.trace || [];
      traceStdout = traceJson.stdout || result.stdout || "";
    } catch {
      // Fallback: build simple sequential trace
      const fallbackLines = code.split("\n");
      traceData = fallbackLines.map((line, i) => ({
        line: i + 1, event: "line", code: line, vars: {}, output: "", func: ""
      }));
      traceStdout = result.stdout || "";
    }

    if (traceData.length === 0) {
      setVideoStatus("No trace data captured. Run the code first.");
      return;
    }

    setVideoStatus("Rendering Trace Animation...");

    const width = 900;
    const height = 560;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) { setVideoStatus("Canvas not supported."); return; }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const sourceLines = code.split("\n");
    const totalSteps = traceData.length;
    const timePerStep = 900;
    const totalDuration = totalSteps * timePerStep + 2500;
    const startTime = performance.now();
    let animationFrameId;

    // Particles
    const particles = Array.from({ length: 20 }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      r: 1 + Math.random() * 2.5, speed: 0.12 + Math.random() * 0.35,
      opacity: 0.12 + Math.random() * 0.2
    }));

    // Track visited lines for green checkmarks
    const visitedLines = new Set();

    const renderFrame = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      // BG
      ctx.fillStyle = "#0c0818";
      ctx.fillRect(0, 0, width, height);

      // Particles
      particles.forEach(p => {
        p.y -= p.speed;
        if (p.y < 0) { p.y = height; p.x = Math.random() * width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(109, 47, 245, ${p.opacity})`;
        ctx.fill();
      });

      // Title bar
      ctx.fillStyle = "#14102a";
      ctx.fillRect(0, 0, width, 44);
      ctx.fillStyle = "#d9c7ff";
      ctx.font = "bold 15px 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("▶  Codelens — Dynamic Execution Trace", 14, 28);
      ctx.fillStyle = "#6a5a8a";
      ctx.font = "12px 'Segoe UI', sans-serif";
      ctx.fillText(`${language.toUpperCase()} • ${totalSteps} steps traced`, width - 200, 28);

      // Progress bar
      ctx.fillStyle = "#1e1636";
      ctx.fillRect(0, 44, width, 3);
      const barGrad = ctx.createLinearGradient(0, 44, width * progress, 47);
      barGrad.addColorStop(0, "#6d2ff5");
      barGrad.addColorStop(1, "#9ef1c2");
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, 44, width * progress, 3);

      // Current step
      const introTime = 600;
      const traceElapsed = Math.max(0, elapsed - introTime);
      const stepIdx = Math.min(Math.floor(traceElapsed / timePerStep), totalSteps - 1);
      const stepProgress = (traceElapsed % timePerStep) / timePerStep;
      const currentStep = traceData[stepIdx];
      const currentLine = currentStep ? currentStep.line - 1 : 0;

      // Mark visited
      for (let s = 0; s <= stepIdx; s++) {
        if (traceData[s]) visitedLines.add(traceData[s].line);
      }

      // === LEFT: Source Code ===
      const cX = 14, cY = 62, lh = 20, cW = 420;
      ctx.fillStyle = "#110d22";
      ctx.fillRect(cX - 4, cY - 6, cW, height - cY - 110);
      ctx.strokeStyle = "#2e2350"; ctx.lineWidth = 1;
      ctx.strokeRect(cX - 4, cY - 6, cW, height - cY - 110);
      ctx.fillStyle = "#7a60a8"; ctx.font = "bold 10px 'Segoe UI'";
      ctx.fillText("SOURCE CODE", cX + 2, cY + 3);

      const cStartY = cY + 18;
      const maxVis = 16;
      const scroll = Math.max(0, currentLine - Math.floor(maxVis / 2));

      for (let i = 0; i < Math.min(maxVis, sourceLines.length); i++) {
        const li = scroll + i;
        if (li >= sourceLines.length) break;
        const y = cStartY + i * lh;

        if (elapsed > introTime && li === currentLine) {
          ctx.fillStyle = "rgba(109, 47, 245, 0.22)";
          ctx.fillRect(cX, y - 13, cW - 10, lh);
          ctx.fillStyle = "#6d2ff5";
          ctx.fillRect(cX, y - 13, 3, lh);
          ctx.font = "bold 11px Consolas"; ctx.fillStyle = "#6d2ff5";
          ctx.fillText(`${li + 1}`, cX + 8, y);
          ctx.font = "12px Consolas"; ctx.fillStyle = "#f6efff";
          ctx.fillText(sourceLines[li].slice(0, 48) || " ", cX + 36, y);
        } else if (visitedLines.has(li + 1)) {
          ctx.font = "11px Consolas"; ctx.fillStyle = "#3f6a50";
          ctx.fillText(`${li + 1}`, cX + 8, y);
          ctx.fillStyle = "#6aad7a"; ctx.font = "12px Consolas";
          ctx.fillText(sourceLines[li].slice(0, 48) || " ", cX + 36, y);
          ctx.fillStyle = "#9ef1c2"; ctx.font = "10px sans-serif";
          ctx.fillText("✓", cX + cW - 20, y);
        } else {
          ctx.font = "11px Consolas"; ctx.fillStyle = "#3e3560";
          ctx.fillText(`${li + 1}`, cX + 8, y);
          ctx.fillStyle = "#5a4d7a"; ctx.font = "12px Consolas";
          ctx.fillText(sourceLines[li].slice(0, 48) || " ", cX + 36, y);
        }
      }

      // === RIGHT TOP: Step Info ===
      const rX = cX + cW + 14, rW = width - rX - 14;
      ctx.fillStyle = "#110d22";
      ctx.fillRect(rX - 4, cY - 6, rW + 8, 110);
      ctx.strokeStyle = "#2e2350";
      ctx.strokeRect(rX - 4, cY - 6, rW + 8, 110);
      ctx.fillStyle = "#7a60a8"; ctx.font = "bold 10px 'Segoe UI'";
      ctx.fillText("EXECUTION STEP", rX + 2, cY + 3);

      if (elapsed > introTime && currentStep) {
        ctx.fillStyle = "#d9c7ff"; ctx.font = "bold 24px 'Segoe UI'";
        ctx.fillText(`Step ${stepIdx + 1}`, rX + 6, cY + 36);
        ctx.fillStyle = "#5a4d7a"; ctx.font = "12px 'Segoe UI'";
        ctx.fillText(`of ${totalSteps}`, rX + 6 + ctx.measureText(`Step ${stepIdx + 1} `).width, cY + 36);

        // Event badge
        let evtLabel = currentStep.event === "call" ? "⚡ CALL" :
          currentStep.event === "return" ? "↩ RETURN" : "→ LINE";
        let evtColor = currentStep.event === "call" ? "#f5a623" :
          currentStep.event === "return" ? "#43d9db" : "#6d2ff5";
        ctx.fillStyle = evtColor;
        ctx.font = "bold 11px Consolas";
        ctx.fillText(evtLabel, rX + 6, cY + 58);

        if (currentStep.func) {
          ctx.fillStyle = "#c4a0ff"; ctx.font = "12px 'Segoe UI'";
          ctx.fillText(`fn: ${currentStep.func}()`, rX + 80, cY + 58);
        }

        // Pulse
        const ps = 5 + Math.sin(elapsed / 180) * 2.5;
        ctx.beginPath();
        ctx.arc(rX + 12, cY + 80, ps, 0, Math.PI * 2);
        ctx.fillStyle = stepProgress < 0.5 ? "#6d2ff5" : "#9ef1c2";
        ctx.fill();
        ctx.fillStyle = "#f6efff"; ctx.font = "11px Consolas";
        ctx.fillText(stepProgress < 0.5 ? "Executing..." : "Done", rX + 26, cY + 84);

        if (currentStep.event === "return" && currentStep.returnVal) {
          ctx.fillStyle = "#43d9db"; ctx.font = "11px Consolas";
          ctx.fillText(`returned: ${currentStep.returnVal}`, rX + 6, cY + 100);
        }
      }

      // === RIGHT MID: Variables ===
      const vY = cY + 118;
      ctx.fillStyle = "#110d22";
      ctx.fillRect(rX - 4, vY - 4, rW + 8, height - vY - 110);
      ctx.strokeStyle = "#2e2350";
      ctx.strokeRect(rX - 4, vY - 4, rW + 8, height - vY - 110);
      ctx.fillStyle = "#7a60a8"; ctx.font = "bold 10px 'Segoe UI'";
      ctx.fillText("VARIABLES", rX + 2, vY + 8);

      if (elapsed > introTime && currentStep && currentStep.vars) {
        const vars = Object.entries(currentStep.vars);
        const maxVars = 8;
        vars.slice(0, maxVars).forEach(([key, val], idx) => {
          const vy = vY + 24 + idx * 18;
          ctx.fillStyle = "#c4a0ff"; ctx.font = "bold 11px Consolas";
          ctx.fillText(key, rX + 6, vy);
          ctx.fillStyle = "#9ef1c2"; ctx.font = "11px Consolas";
          ctx.fillText(`= ${String(val).slice(0, 28)}`, rX + 6 + ctx.measureText(key + "  ").width, vy);
        });
        if (vars.length === 0) {
          ctx.fillStyle = "#5a4d7a"; ctx.font = "11px 'Segoe UI'";
          ctx.fillText("No variables in scope", rX + 6, vY + 28);
        }
      }

      // === BOTTOM: Console Output ===
      const oY = height - 100;
      ctx.fillStyle = "#0a0614";
      ctx.fillRect(cX - 4, oY - 6, width - 24, 94);
      ctx.strokeStyle = "#2e2350";
      ctx.strokeRect(cX - 4, oY - 6, width - 24, 94);
      ctx.fillStyle = "#7a60a8"; ctx.font = "bold 10px 'Segoe UI'";
      ctx.fillText("CONSOLE OUTPUT", cX + 2, oY + 4);

      // Show output from the current trace step
      const currentOutput = currentStep ? (currentStep.output || "") : "";
      const oLines = currentOutput.split("\n").filter(Boolean).slice(-3);
      ctx.fillStyle = "#9ef1c2"; ctx.font = "12px Consolas";
      oLines.forEach((ol, idx) => {
        ctx.fillText("❯ " + ol.slice(0, 80), cX + 6, oY + 24 + idx * 18);
      });

      // Blinking cursor
      if (progress < 0.93 && Math.floor(elapsed / 500) % 2 === 0) {
        const cI = Math.min(oLines.length, 2);
        const cx2 = cX + 18 + (oLines[oLines.length - 1]?.length || 0) * 7.2;
        ctx.fillStyle = "#9ef1c2"; ctx.fillRect(cx2, oY + 14 + cI * 18, 7, 13);
      }

      // Outro
      if (progress >= 0.93) {
        ctx.fillStyle = "rgba(12, 8, 24, 0.65)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#9ef1c2"; ctx.font = "bold 24px 'Segoe UI'"; ctx.textAlign = "center";
        ctx.fillText("✓ Execution Complete", width / 2, height / 2 - 16);
        ctx.fillStyle = "#d9c7ff"; ctx.font = "15px 'Segoe UI'";
        ctx.fillText(`${totalSteps} steps traced • ${sourceLines.length} lines • ${Object.keys(traceData[totalSteps - 1]?.vars || {}).length} variables`, width / 2, height / 2 + 16);
        ctx.textAlign = "left";
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(renderFrame);
      } else {
        recorder.stop();
      }
    };

    recorder.start();
    animationFrameId = requestAnimationFrame(renderFrame);

    recorder.onstop = () => {
      cancelAnimationFrame(animationFrameId);
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
        <button className="primary-button" onClick={runCode} disabled={loading}>
          {loading ? "Process Running..." : "Run in Terminal"}
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Interactive Terminal</div>
        <div className="panel-subtitle">
          Type directly into the console to interact with your program!
        </div>
        <div className="output-card terminal-card" style={{ padding: '8px' }}>
          <div ref={terminalRef} style={{ width: '100%', height: '340px' }} />
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
