/**
 * SimpleTerminal — lightweight execution panel.
 * Connects over WebSocket to the backend for live code execution.
 * No xterm.js, no fancy libs — just a clean, fast terminal.
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
  const [status, setStatus] = useState("idle"); // idle | running | exited
  const [exitCode, setExitCode] = useState(null);

  const wsRef = useRef(null);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  // keep a mutable copy of status for ws callbacks
  const statusRef = useRef("idle");

  const updateStatus = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Auto-scroll to bottom whenever new output arrives
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Focus input when running starts
  useEffect(() => {
    if (status === "running") inputRef.current?.focus();
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const appendLine = (text, type = "output") => {
    setLines((prev) => [...prev, { text, type }]);
  };

  const connectAndRun = () => {
    // Reset state
    setLines([]);
    setInputValue("");
    setExitCode(null);
    updateStatus("running");

    // Close any previous connection
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
          // Strip ANSI codes
          const clean = (msg.data || "")
            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");
          if (clean) appendLine(clean, "output");
        } else if (msg.type === "exit") {
          const code = msg.code ?? 0;
          setExitCode(code);
          updateStatus("exited");
          appendLine(`\n[Process exited with code ${code}]`, code === 0 ? "success" : "error");
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = () => {
      appendLine(
        "ERROR: Cannot connect to backend on port 8000.\nMake sure the backend is running: cd backend && node server.js",
        "error"
      );
      updateStatus("exited");
      setExitCode(1);
    };

    ws.onclose = () => {
      if (statusRef.current === "running") {
        updateStatus("exited");
      }
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
    wsRef.current.send(JSON.stringify({ type: "input", input: val + "\n" }));
    appendLine(`> ${val}`, "stdin");
    setInputValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendInput();
  };

  if (!visible) return null;

  const isRunning = status === "running";
  const statusText = status === "idle"
    ? "Ready"
    : isRunning
    ? "● Running"
    : `Exited (${exitCode ?? "?"})`;

  return (
    <div style={{
      marginTop: 12,
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: 13,
      border: "1px solid #333",
      borderRadius: 6,
      overflow: "hidden",
      background: "#0d0d0d",
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#1a1a1a",
        padding: "5px 10px",
        borderBottom: "1px solid #333",
        userSelect: "none",
      }}>
        <span style={{ color: "#aaa", fontSize: 12 }}>
          Terminal — <span style={{ color: "#888" }}>{language}</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            color: isRunning ? "#6f6" : exitCode === 0 ? "#6f6" : exitCode != null ? "#f66" : "#aaa",
            fontSize: 11
          }}>
            {statusText}
          </span>
          {isRunning && (
            <button
              type="button"
              onClick={() => wsRef.current?.send(JSON.stringify({ type: "kill" }))}
              style={{
                background: "transparent",
                border: "1px solid #666",
                color: "#ccc",
                padding: "1px 8px",
                fontSize: 11,
                cursor: "pointer",
                borderRadius: 3,
              }}
            >
              Kill
            </button>
          )}
          <button
            type="button"
            onClick={() => onVisibilityChange?.(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#666",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              padding: "0 2px",
            }}
            title="Close terminal"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        style={{
          background: "#0d0d0d",
          minHeight: 200,
          maxHeight: 360,
          overflowY: "auto",
          padding: "8px 12px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.55,
          color: "#ddd",
        }}
      >
        {lines.length === 0 && (
          <span style={{ color: "#555" }}>Output will appear here…</span>
        )}
        {lines.map((line, i) => (
          <span
            key={i}
            style={{
              color:
                line.type === "error" ? "#f77"
                : line.type === "success" ? "#6f6"
                : line.type === "stdin" ? "#7bf"
                : "#ddd",
              display: "block",
            }}
          >
            {line.text}
          </span>
        ))}
      </div>

      {/* Stdin input row */}
      <div style={{
        display: "flex",
        borderTop: "1px solid #222",
        background: "#111",
      }}>
        <span style={{
          color: "#4a4",
          padding: "6px 10px",
          background: "#1a1a1a",
          borderRight: "1px solid #262626",
          fontSize: 12,
          userSelect: "none",
        }}>
          &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? "Type input and press Enter…" : "Run code first"}
          disabled={!isRunning}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#ccc",
            fontFamily: "Consolas, 'Courier New', monospace",
            fontSize: 13,
            padding: "6px 8px",
          }}
        />
        <button
          type="button"
          onClick={sendInput}
          disabled={!isRunning || !inputValue.trim()}
          style={{
            background: "#1a1a1a",
            border: "none",
            borderLeft: "1px solid #262626",
            color: isRunning && inputValue.trim() ? "#aaa" : "#444",
            padding: "6px 14px",
            fontSize: 12,
            cursor: isRunning ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
});

export default SimpleTerminal;
