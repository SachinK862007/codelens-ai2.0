import React from "react";
import Editor from "@monaco-editor/react";

/**
 * VS Code-style Monaco editor — same experience as Practice Arena.
 */
export default function CodeWorkbench({
  language = "python",
  value = "",
  onChange,
  height = 360,
  readOnly = false,
  className = ""
}) {
  const monacoLang = language === "cpp" ? "cpp" : language;

  return (
    <div className={`code-workbench ${className}`.trim()}>
      <Editor
        height={`${height}px`}
        language={monacoLang}
        value={value}
        onChange={(v) => onChange?.(v ?? "")}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          readOnly,
          padding: { top: 12, bottom: 12 },
          lineNumbers: "on",
          renderLineHighlight: "line",
          fontFamily: "Consolas, 'Courier New', monospace"
        }}
      />
    </div>
  );
}
