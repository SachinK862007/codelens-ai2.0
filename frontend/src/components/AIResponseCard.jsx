import React, { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer.jsx";

/**
 * AIResponseCard — Premium fallback display for AI responses
 * that couldn't be parsed as structured JSON.
 *
 * Replaces the old "⚠️ AI responded in free-text format" warning
 * with a clean, professional card that blends seamlessly into the app.
 *
 * Features:
 * - AI avatar/header with gradient accent
 * - Formatted view (MarkdownRenderer) as default
 * - Source view toggle (for developers who want the raw text)
 * - Copy-to-clipboard
 * - Smooth entrance animation
 */
export default function AIResponseCard({ text, variant = "default" }) {
  const [viewMode, setViewMode] = useState("formatted"); // formatted | source
  const [copied, setCopied] = useState(false);

  if (!text || typeof text !== "string" || !text.trim()) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const variantConfig = {
    debugger: { icon: "🔍", label: "Debugger Analysis" },
    roadmap: { icon: "🗺️", label: "Roadmap Output" },
    practice: { icon: "📊", label: "Practice Feedback" },
    codewriter: { icon: "⌨️", label: "Code Writer Output" },
    default: { icon: "✨", label: "AI Response" },
  };

  const config = variantConfig[variant] || variantConfig.default;

  return (
    <div className="ai-response-card ai-result-enter">
      {/* Gradient accent bar */}
      <div className="ai-response-accent" />

      {/* Header */}
      <div className="ai-response-header">
        <div className="ai-response-identity">
          <div className="ai-response-avatar">
            <span className="ai-response-avatar-icon">{config.icon}</span>
          </div>
          <div className="ai-response-meta">
            <span className="ai-response-label">{config.label}</span>
            <span className="ai-response-sublabel">Powered by local AI</span>
          </div>
        </div>

        <div className="ai-response-actions">
          {/* View mode toggle */}
          <div className="ai-response-toggle">
            <button
              type="button"
              className={`ai-response-toggle-btn ${viewMode === "formatted" ? "active" : ""}`}
              onClick={() => setViewMode("formatted")}
            >
              📄 Formatted
            </button>
            <button
              type="button"
              className={`ai-response-toggle-btn ${viewMode === "source" ? "active" : ""}`}
              onClick={() => setViewMode("source")}
            >
              {"</>"} Source
            </button>
          </div>

          {/* Copy button */}
          <button
            type="button"
            className="ai-response-copy"
            onClick={handleCopy}
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ai-response-body">
        {viewMode === "formatted" ? (
          <MarkdownRenderer text={text} />
        ) : (
          <div className="ai-response-source">
            <pre className="ai-response-source-pre">{text}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
