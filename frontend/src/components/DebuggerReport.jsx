import React, { useEffect, useRef, useState } from "react";
import LineNumberedCodeBlock from "./LineNumberedCodeBlock.jsx";
import SimpleTerminal from "./SimpleTerminal.jsx";
import { runCodeOnServer } from "../lib/codeRun.js";

/** Returns true if the code requires interactive stdin input */
function requiresInput(code, lang) {
  if (!code) return false;
  if (lang === "python") return /\binput\s*\(/.test(code);
  if (lang === "c") return /\bscanf\s*\(|\bfgets\s*\(|\bgetchar\s*\(/.test(code);
  if (lang === "cpp") return /\bcin\s*>>|\bgetline\s*\(/.test(code);
  return false;
}

export default function DebuggerReport({ result, language, onRunInVisualizer }) {
  const terminalRef = useRef(null);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [verified, setVerified] = useState(null);
  const [verifiedOutput, setVerifiedOutput] = useState("");
  const [verifying, setVerifying] = useState(false);

  const errors = Array.isArray(result?.errors) ? result.errors : [];
  const runLang = result?.language || language;
  const runnableCode = result?.corrected_code || "";
  const isInteractive = requiresInput(runnableCode, runLang);

  useEffect(() => {
    // Skip auto-verification for interactive programs — they need stdin
    if (!runnableCode.trim() || isInteractive) {
      setVerified(null);
      return;
    }

    let cancelled = false;
    setVerifying(true);

    runCodeOnServer(runLang, runnableCode, "")
      .then((data) => {
        if (cancelled || !data) return;
        setVerified({
          success: data.success,
          stdout: data.stdout || "",
          stderr: data.stderr || "",
          exitCode: data.exitCode
        });
        if (data.stdout) setVerifiedOutput(data.stdout);
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => { cancelled = true; };
  }, [runnableCode, runLang, isInteractive]);

  const runCorrected = () => {
    setTerminalVisible(true);
    terminalRef.current?.run?.();
  };

  const displayOutput = verifiedOutput || result?.execution_output || "";
  const aiEstimate = result?.ai_execution_output || "";

  return (
    <div className="writer-output ai-result-enter debugger-report">
      <div className="writer-badges">
        <span className="badge">{runLang}</span>
        <span className="badge">
          {errors.length} {errors.length === 1 ? "issue" : "issues"} found
        </span>
        {verified?.success ? <span className="badge ok-badge">Runs OK</span> : null}
        {verified && !verified.success ? <span className="badge fail-badge">Run failed</span> : null}
      </div>

      <div className="card">
        <div className="section-label">Issues</div>
        {errors.length ? (
          <div className="debugger-errors-list">
            {errors.map((e, i) => (
              <div className="debugger-error-card" key={`err-${i}-${e.line_number}`}>
                <div className="writer-badges">
                  <span className="badge mono error-type">{e.error_type || "Error"}</span>
                  <span className="badge">Line {e.line_number ?? "?"}</span>
                </div>
                {(e.wrong_line || e.corrected_line) ? (
                  <div className="diff-row">
                    {e.wrong_line ? (
                      <div className="diff-cell bad">
                        <div className="section-label">Before</div>
                        <pre className="diff-code-pre wrong">{e.wrong_line}</pre>
                      </div>
                    ) : null}
                    {e.corrected_line ? (
                      <div className="diff-cell good">
                        <div className="section-label">After</div>
                        <pre className="diff-code-pre good">{e.corrected_line}</pre>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {e.explanation ? (
                  <>
                    <div className="section-label">Why</div>
                    <p className="para">{e.explanation}</p>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No specific issues listed — see corrected code below.</div>
        )}
      </div>

      <div className="card">
        <div className="section-label">Corrected code (runnable)</div>
        <LineNumberedCodeBlock
          title="Full corrected program"
          languageLabel={runLang}
          code={runnableCode}
        />
        <div className="button-row" style={{ marginTop: 10 }}>
          <button
            className="primary-button"
            type="button"
            onClick={runCorrected}
            disabled={!runnableCode}
          >
            Run in terminal
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => onRunInVisualizer?.({ language: runLang, code: runnableCode })}
            disabled={!runnableCode}
          >
            Open in visualizer
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-label">
          {verifying ? "Verifying output…" : verified?.success ? "Verified output (from running your code)" : "Program output"}
        </div>
        {isInteractive ? (
          <div className="empty-state">This program needs user input — use the live terminal below to run it interactively.</div>
        ) : verified?.stderr && !verified.success ? (
          <pre className="debugger-run-error">{verified.stderr}</pre>
        ) : displayOutput ? (
          <pre className="debugger-expected-output">{displayOutput}</pre>
        ) : (
          <div className="empty-state">Run corrected code to see output.</div>
        )}
        {!isInteractive && aiEstimate && verified?.stdout && aiEstimate.trim() !== verified.stdout.trim() ? (
          <details className="debugger-ai-estimate">
            <summary>AI estimate (may differ from actual run)</summary>
            <pre className="debugger-expected-output muted">{aiEstimate}</pre>
          </details>
        ) : null}
      </div>

      <div className="card terminal-panel">
        <div className="section-label">Live terminal</div>
        <p className="panel-subtitle" style={{ marginTop: 0 }}>
          Interactive run — type input when your program asks for it.
        </p>
        <SimpleTerminal
          ref={terminalRef}
          code={runnableCode}
          language={runLang}
          visible={terminalVisible}
          onVisibilityChange={setTerminalVisible}
        />
      </div>
    </div>
  );
}
