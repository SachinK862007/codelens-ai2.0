import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function ModelGitReview({ onSaveHistory }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const responseRef = useRef(null);

  const handleReview = async () => {
    if (!repoUrl.trim() || loading) return;

    setLoading(true);
    setResponse("");
    setPhase("Starting review...");

    try {
      const res = await fetch("http://localhost:8000/api/git-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const nl = buffer.indexOf("\n\n");
          if (nl === -1) break;
          const chunk = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);

          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr === "[DONE]") continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.type === "phase") {
                  setPhase(data.label);
                } else if (data.type === "delta" && data.text) {
                  setResponse((prev) => prev + data.text);
                  setPhase("");
                } else if (data.type === "error") {
                  setResponse((prev) => prev + `\n\n**Error:** ${data.error}`);
                  setPhase("");
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      }

      onSaveHistory?.({
        task: `Reviewed repo: ${repoUrl}`,
        details: "Generated comprehensive code review and feedback."
      });

    } catch (e) {
      setResponse(`**Error:** ${e.message}`);
    } finally {
      setLoading(false);
      setPhase("");
    }
  };

  return (
    <div className="model-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="panel">
        <div className="panel-title">Git Review</div>
        <div className="panel-subtitle">
          Enter a public GitHub repository URL to get an instant AI review of the architecture, tech stack, and code quality.
        </div>
        <div className="field-row">
          <label>GitHub Repository URL</label>
          <input
            placeholder="https://github.com/facebook/react"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="primary-button" onClick={handleReview} disabled={loading || !repoUrl.trim()} style={{ marginTop: 8 }}>
          {loading ? "Analyzing Repository..." : "Generate Review"}
        </button>
      </div>

      <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="panel-title">Review Output</div>
        <div className="panel-subtitle">
          AI insights and constructive feedback.
        </div>
        <div style={{ flex: 1, padding: "20px", background: "rgba(27, 18, 51, 0.95)", overflowY: "auto", borderRadius: "12px", border: "1px solid rgba(140, 110, 200, 0.22)" }} ref={responseRef}>
          {response ? (
            <div className="markdown-body" style={{ color: "#f6efff" }}>
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          ) : (
            <div className="empty-state" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8c78aa" }}>
              {phase ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <div className="ai-thinking-orb">
                    <div className="ai-thinking-orb-glow"></div>
                    <div className="ai-thinking-orb-inner"></div>
                    <div className="ai-thinking-orb-ring"></div>
                  </div>
                  <span className="live-badge pulse">{phase}</span>
                </div>
              ) : (
                "Waiting for repository analysis..."
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
