import React, { useMemo, useState } from "react";

const formatTimestamp = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function HistoryPanel({
  items,
  models,
  onClear,
  activeModelId,
  onSelectModel,
  variant = "sidebar"
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState("");

  const modelMap = useMemo(() => {
    const map = new Map();
    models.forEach((model) => map.set(model.id, model.name));
    return map;
  }, [models]);

  const filteredItems = items.filter((item) => {
    const needle = search.toLowerCase();
    return (
      item.modelName?.toLowerCase().includes(needle) ||
      item.title?.toLowerCase().includes(needle) ||
      item.prompt?.toLowerCase().includes(needle) ||
      item.response?.toLowerCase().includes(needle)
    );
  });

  return (
    <aside className={`history-panel glass-card ${variant}`}>
      <div className="history-header">
        <div>
          <div className="history-title">History</div>
          <div className="history-subtitle">Click any session to view details</div>
        </div>
        <button className="ghost-button" onClick={onClear} type="button">
          Clear All
        </button>
      </div>

      <div className="history-models">
        <div className="history-label">Quick switch</div>
        <div className="model-chips">
          {models.map((model) => (
            <button
              key={model.id}
              className={`chip ${activeModelId === model.id ? "active" : ""}`}
              onClick={() => onSelectModel(model.id)}
              type="button"
            >
              {model.name}
            </button>
          ))}
        </div>
      </div>

      <div className="history-search">
        <input
          placeholder="Search history..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="history-count">{filteredItems.length} sessions</div>
      </div>

      <div className="history-list timeline">
        {filteredItems.length === 0 && (
          <div className="empty-state">No sessions recorded yet.</div>
        )}
        {filteredItems.map((item) => (
          <div key={item.id} className="timeline-item">
            <div className="timeline-dot" />
            <button
              className="history-item"
              onClick={() => setSelectedItem(item)}
              type="button"
            >
              <div className="history-item-title">{item.modelName}</div>
              <div className="history-item-body">{item.title}</div>
              <div className="history-item-meta">
                {formatTimestamp(item.timestamp)}
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Detail popup - only shown when a specific item is clicked */}
      {selectedItem && (
        <div className="history-detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="history-detail-popup glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="history-detail-popup-header">
              <div className="history-detail-title">
                {modelMap.get(selectedItem.modelId) || selectedItem.modelName}
              </div>
              <button
                className="ghost-button"
                onClick={() => setSelectedItem(null)}
                type="button"
              >
                ✕ Close
              </button>
            </div>
            <div className="history-detail-popup-meta">
              {formatTimestamp(selectedItem.timestamp)}
            </div>
            <div className="history-detail-popup-body">
              <div className="history-detail-section">
                <div className="history-detail-label">Code / Prompt</div>
                <pre className="history-detail-code">{selectedItem.prompt || "No prompt stored."}</pre>
              </div>
              <div className="history-detail-section">
                <div className="history-detail-label">Output / Response</div>
                <pre className="history-detail-code">{selectedItem.response || "No response stored."}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
