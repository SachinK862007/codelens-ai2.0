/**
 * SimpleTerminal — interactive execution panel (WebSocket).
 * Now using xterm.js to match the VS Code integrated terminal experience!
 */
import React, {
  useEffect, useRef, useState, useImperativeHandle, forwardRef
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

const WS_URL = "ws://localhost:8000";

const SimpleTerminal = forwardRef(function SimpleTerminal(
  { code, language, visible, onVisibilityChange, autoScroll = true, initialStdin = "" },
  ref
) {
  const [status, setStatus] = useState("idle");
  const [exitCode, setExitCode] = useState(null);

  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const statusRef = useRef("idle");

  const updateStatus = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Consolas", "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1b1233',
        foreground: '#f6efff',
        cursor: '#9ef1c2'
      }
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    
    term.open(terminalRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    term.writeln('\x1b[35mTerminal initialized. Ready.\x1b[0m');

    // Handle user input
    term.onData(data => {
      if (wsRef.current?.readyState === WebSocket.OPEN && statusRef.current === "running") {
        const payload = data === '\r' ? '\n' : data;
        wsRef.current.send(JSON.stringify({ type: "input", input: payload }));
        
        // Basic Local Echo (since we lack a PTY on the backend)
        const char = data;
        if (char === '\r') {
          term.write('\r\n');
        } else if (char === '\x7F') { // Backspace
          term.write('\b \b');
        } else {
          term.write(char);
        }
      }
    });

    const handleResize = () => fit.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // Fit terminal when it becomes visible
  useEffect(() => {
    if (visible && fitAddon.current) {
      setTimeout(() => fitAddon.current.fit(), 50);
    }
  }, [visible]);

  useEffect(() => () => wsRef.current?.close(), []);

  const connectAndRun = () => {
    setExitCode(null);
    updateStatus("running");

    if (termInstance.current) {
      termInstance.current.clear();
      termInstance.current.writeln('\x1b[36mStarting process...\x1b[0m');
    }

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
            termInstance.current?.writeln(`\x1b[33m> [Sample Input Provided]\x1b[0m`);
          }
        }, 300);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") {
          // Normalize line endings for xterm
          const clean = (msg.data || "").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
          termInstance.current?.write(clean);
        } else if (msg.type === "exit") {
          const codeNum = msg.code ?? 0;
          setExitCode(codeNum);
          updateStatus("exited");
          termInstance.current?.writeln(`\r\n\x1b[35m[Process exited with code ${codeNum}]\x1b[0m`);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      termInstance.current?.writeln("\r\n\x1b[31mCannot connect to backend on port 8000.\x1b[0m");
      termInstance.current?.writeln("Start it with: cd backend && npm run dev\r\n");
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

  if (!visible) return null;

  const isRunning = status === "running";
  const statusClass =
    isRunning ? "running" : exitCode === 0 ? "ok" : exitCode != null ? "fail" : "idle";

  const statusText =
    status === "idle" ? "Ready" : isRunning ? "Running" : `Exited (${exitCode ?? "?"})`;

  return (
    <div className="codelens-terminal" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
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

      <div 
        ref={terminalRef} 
        style={{ flex: 1, padding: '8px', background: '#1b1233', overflow: 'hidden' }}
      ></div>
    </div>
  );
});

export default SimpleTerminal;
