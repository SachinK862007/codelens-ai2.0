import React from "react";

export default function ModelSwitcher({ models, activeModelId, onChange }) {
  return (
    <div className="model-switcher">
      <div className="model-switcher-label">Models</div>
      <div className="model-switcher-buttons">
        {models.map((model) => (
          <button
            key={model.id}
            className={`model-button ${
              activeModelId === model.id ? "active" : ""
            }`}
            onClick={() => onChange(model.id)}
            type="button"
          >
            {model.name}
          </button>
        ))}
      </div>
    </div>
  );
}
