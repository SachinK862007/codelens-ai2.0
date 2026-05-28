/**
 * SimpleTerminal — interactive execution panel (WebSocket).
 * Styled to match CodeLens purple theme with a realistic console inside.
 */
import React, {
  useEffect, useRef, useState, useImperativeHandle, forwardRef
} from "react";

const WS_URL = "ws://localhost:8000";

const SimpleTerminal = forwardRef(function SimpleTerminal(
  { code, language, visible, onVisibilityChange, autoScroll = true, initialStdin = "" },
  ref
) {
  const [output, setOutput] = useState("");
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
  }, [output, autoScroll]);

  useEffect(() => {
    if (status === "running") inputRef.current?.focus();
  }, [status]);

  useEffect(() => () => wsRef.current?.close(), []);

  const appendText = (text) => setOutput((prev) => prev + text);

  const connectAndRun = () => {
    setOutput("");
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
      if (initialStdin && initialStdin.trim()) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "input", input: initialStdin.trim() + "\n" }));
            appendText(`> [Sample Input Provided]\n`);
          }
        }, 300);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") {
          const clean = (msg.data || "")
            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "") // strip ANSI
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");
          appendText(clean);
        } else if (msg.type === "exit") {
          const codeNum = msg.code ?? 0;
          setExitCode(codeNum);
          updateStatus("exited");
          appendText(`\n[Process exited with code ${codeNum}]\n`);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      appendText("Cannot connect to backend on port 8000.\nStart it with: cd backend && npm run dev\n");
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
    appendText(`> ${val}\n`);
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
        {output ? (
          <pre className="codelens-terminal-pre">{output}</pre>
        ) : (
          <span className="codelens-terminal-placeholder">Output will appear here…</span>
        )}
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
