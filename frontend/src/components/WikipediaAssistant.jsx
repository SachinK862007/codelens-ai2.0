import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function WikipediaAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [response, phase, isOpen]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse("");
    setPhase("Starting research...");

    try {
      const res = await fetch("http://localhost:8000/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
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
                // ignore parse error
              }
            }
          }
        }
      }
    } catch (e) {
      setResponse(`**Error:** ${e.message}`);
    } finally {
      setLoading(false);
      setPhase("");
    }
  };

  return (
    <div className="wiki-assistant-wrapper">
      <button
        className="wiki-assistant-toggle primary-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Ask Wikipedia AI"
      >
        {isOpen ? "✕ Close" : "🤖 Research AI"}
      </button>

      {isOpen && (
        <div className="wiki-assistant-panel glass-card">
          <div className="wiki-header">
            <div className="panel-title" style={{ fontSize: "16px", marginBottom: "4px" }}>Wikipedia AI</div>
            <div className="panel-subtitle" style={{ fontSize: "12px", marginBottom: 0 }}>Ask anything. I'll search and summarize it.</div>
          </div>
          
          <div className="wiki-messages">
            {response ? (
              <div className="wiki-markdown">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            ) : (
              <div className="wiki-empty" style={{ opacity: 0.7, fontSize: "14px" }}>
                {phase ? (
                  <span className="live-badge pulse" style={{ marginLeft: 0 }}>{phase}</span>
                ) : (
                  "What would you like to know?"
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSearch} className="wiki-input-form" style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <input
              type="text"
              placeholder="e.g., How does React work?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              autoFocus
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={loading || !query.trim()} className="primary-button">
              {loading ? "..." : "Ask"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
