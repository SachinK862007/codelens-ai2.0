import React, { useMemo, useState, useEffect } from "react";

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
  const [selectedId, setSelectedId] = useState(null);
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

  const selectedItem = filteredItems.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selectedId && filteredItems.length) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  return (
    <aside className={`history-panel glass-card ${variant}`}>
      <div className="history-header">
        <div>
          <div className="history-title">History</div>
          <div className="history-subtitle">Local sessions</div>
        </div>
        <button className="ghost-button" onClick={onClear} type="button">
          Clear
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
          <div className="empty-state">No conversations yet.</div>
        )}
        {filteredItems.map((item) => (
          <div key={item.id} className="timeline-item">
            <div className="timeline-dot" />
            <button
              className={`history-item ${selectedId === item.id ? "active" : ""}`}
              onClick={() => setSelectedId(item.id)}
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

      <div className="history-detail">
        <div className="history-label">Selected session</div>
        {selectedItem ? (
          <div className="history-detail-card">
            <div className="history-detail-title">
              {modelMap.get(selectedItem.modelId) || selectedItem.modelName}
            </div>
            <div className="history-detail-meta">
              {formatTimestamp(selectedItem.timestamp)}
            </div>
            <div className="history-detail-section">
              <div className="history-detail-label">Prompt</div>
              <pre>{selectedItem.prompt || "No prompt stored."}</pre>
            </div>
            <div className="history-detail-section">
              <div className="history-detail-label">Response</div>
              <pre>{selectedItem.response || "No response stored."}</pre>
            </div>
          </div>
        ) : (
          <div className="empty-state">Select a history item to view it.</div>
        )}
      </div>
    </aside>
  );
}
