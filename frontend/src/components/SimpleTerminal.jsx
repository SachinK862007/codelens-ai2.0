/**
 * SimpleTerminal — interactive execution panel (WebSocket).
 * Styled to match CodeLens purple theme with a realistic console inside.
 */
import React, {
  useEffect, useRef, useState, useImperativeHandle, forwardRef
} from "react";

const WS_URL = "ws://localhost:8000";

const SimpleTerminal = forwardRef(function SimpleTerminal(
  { code, language, visible, onVisibilityChange, autoScroll = true },
  ref
) {
  const [lines, setLines] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [exitCode, setExitCode] = useState(null);

  const wsRef = useRef(null);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const statusRef = useRef("idle");

  const updateStatus = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  useEffect(() => {
    if (status === "running") inputRef.current?.focus();
  }, [status]);

  useEffect(() => () => wsRef.current?.close(), []);

  const appendLine = (text, type = "output") => {
    setLines((prev) => [...prev, { text, type }]);
  };

  const connectAndRun = () => {
    setLines([]);
    setInputValue("");
    setExitCode(null);
    updateStatus("running");

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "init", language, code }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") {
          const clean = (msg.data || "")
            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");
          if (clean) appendLine(clean, "output");
        } else if (msg.type === "exit") {
          const codeNum = msg.code ?? 0;
          setExitCode(codeNum);
          updateStatus("exited");
          appendLine(`\n[Process exited with code ${codeNum}]`, codeNum === 0 ? "success" : "error");
        }
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {
      appendLine(
        "Cannot connect to backend on port 8000.\nStart it with: cd backend && npm run dev",
        "error"
      );
      updateStatus("exited");
      setExitCode(1);
    };

    ws.onclose = () => {
      if (statusRef.current === "running") updateStatus("exited");
    };
  };

  useImperativeHandle(ref, () => ({
    run: connectAndRun,
    kill() {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "kill" }));
      }
    }
  }));

  const sendInput = () => {
    const val = inputValue.trim();
    if (!val || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "input", input: `${val}\n` }));
    appendLine(`> ${val}`, "stdin");
    setInputValue("");
  };

  if (!visible) return null;

  const isRunning = status === "running";
  const statusClass =
    isRunning ? "running" : exitCode === 0 ? "ok" : exitCode != null ? "fail" : "idle";

  const statusText =
    status === "idle" ? "Ready" : isRunning ? "Running" : `Exited (${exitCode ?? "?"})`;

  return (
    <div className="codelens-terminal">
      <div className="codelens-terminal-titlebar">
        <span className="codelens-terminal-title">
          Terminal <span className="codelens-terminal-lang">{language}</span>
        </span>
        <div className="codelens-terminal-actions">
          <span className={`codelens-terminal-status ${statusClass}`}>{statusText}</span>
          {isRunning && (
            <button
              type="button"
              className="codelens-terminal-btn"
              onClick={() => wsRef.current?.send(JSON.stringify({ type: "kill" }))}
            >
              Kill
            </button>
          )}
          <button
            type="button"
            className="codelens-terminal-close"
            onClick={() => onVisibilityChange?.(false)}
            title="Close terminal"
            aria-label="Close terminal"
          >
            ×
          </button>
        </div>
      </div>

      <div ref={outputRef} className="codelens-terminal-output">
        {lines.length === 0 && (
          <span className="codelens-terminal-placeholder">Output will appear here…</span>
        )}
        {lines.map((line, i) => (
          <span key={i} className={`codelens-terminal-line ${line.type}`}>
            {line.text}
          </span>
        ))}
      </div>

      <div className="codelens-terminal-inputrow">
        <span className="codelens-terminal-prompt">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          className="codelens-terminal-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendInput()}
          placeholder={isRunning ? "Type input and press Enter…" : "Run code first"}
          disabled={!isRunning}
        />
        <button
          type="button"
          className="codelens-terminal-send"
          onClick={sendInput}
          disabled={!isRunning || !inputValue.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
});

export default SimpleTerminal;
