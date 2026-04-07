import React, { useMemo, useState } from "react";

export default function LineNumberedCodeBlock({ code, languageLabel, title, highlight }) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => String(code || "").split("\n"), [code]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  const hl = typeof highlight === "number" ? highlight : null;

  return (
    <div className="codeblock">
      <div className="codeblock-header">
        <div className="codeblock-title">{title || "Code"}</div>
        <div className="codeblock-actions">
          {languageLabel ? <span className="badge mono">{languageLabel}</span> : null}
          <button className="ghost-button" type="button" onClick={onCopy} disabled={!code}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="lncode-pre">
        {lines.map((ln, i) => {
          const n = i + 1;
          const isHL = hl === n;
          return (
            <div key={`${n}-${ln}`} className={`lncode-line ${isHL ? "problem" : ""}`}>
              <span className="lncode-no">{n}</span>
              <span className="lncode-text">{ln || " "}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

