import React, { useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import php from "highlight.js/lib/languages/php";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", c);
hljs.registerLanguage("php", php);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);

const normalizeLanguage = (value) => {
  const v = (value || "").toLowerCase();
  if (v === "c++" || v === "cpp") return "cpp";
  if (v === "js") return "javascript";
  if (v === "ts") return "typescript";
  if (v === "html") return "html";
  return v;
};

export default function CodeBlock({ code, language, title }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  const lang = useMemo(() => normalizeLanguage(language), [language]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.removeAttribute("data-highlighted");
    try {
      hljs.highlightElement(el);
    } catch {
      // ignore
    }
  }, [code, lang]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  return (
    <div className="codeblock">
      <div className="codeblock-header">
        <div className="codeblock-title">{title || "Code"}</div>
        <div className="codeblock-actions">
          <span className="badge mono">{lang || "text"}</span>
          <button className="ghost-button" type="button" onClick={onCopy} disabled={!code}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="codeblock-pre">
        <code ref={ref} className={`hljs language-${lang || "plaintext"}`}>
          {code || ""}
        </code>
      </pre>
    </div>
  );
}

