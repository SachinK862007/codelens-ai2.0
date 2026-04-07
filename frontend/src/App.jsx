import React, { useMemo, useState, useEffect } from "react";
import HistoryPanel from "./components/HistoryPanel.jsx";
import ModelSwitcher from "./components/ModelSwitcher.jsx";
import Modal from "./components/Modal.jsx";
import ModelOne from "./models/ModelOne.jsx";
import ModelTwo from "./models/ModelTwo.jsx";
import ModelThree from "./models/ModelThree.jsx";
import ModelFour from "./models/ModelFour.jsx";
import ModelCodeWriter from "./models/ModelCodeWriter.jsx";

const STORAGE_KEY = "codelens_history_v1";
const RUNNER_PREFILL_KEY = "codelens_runner_prefill_v1";

const MODEL_CONFIG = [
  { id: "model-1", name: "Codelens Code Runner" },
  { id: "model-2", name: "Codelens Debugger" },
  { id: "model-3", name: "Codelens Idea Builder" },
  { id: "model-4", name: "Codelens Learner" },
  { id: "code-writer", name: "Code Writer" }
];

export default function App() {
  const [activeModelId, setActiveModelId] = useState(MODEL_CONFIG[0].id);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runnerPrefill, setRunnerPrefill] = useState(() => {
    const raw = localStorage.getItem(RUNNER_PREFILL_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setHistoryItems(JSON.parse(raw));
      } catch {
        setHistoryItems([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyItems));
  }, [historyItems]);

  useEffect(() => {
    if (!runnerPrefill) return;
    localStorage.setItem(RUNNER_PREFILL_KEY, JSON.stringify(runnerPrefill));
  }, [runnerPrefill]);

  const runInVisualizer = ({ language, code }) => {
    setRunnerPrefill({ language, code, ts: Date.now() });
    setActiveModelId("model-1");
  };

  const activeModel = useMemo(
    () => MODEL_CONFIG.find((item) => item.id === activeModelId),
    [activeModelId]
  );

  const addHistoryEntry = (entry) => {
    setHistoryItems((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        modelId: activeModelId,
        modelName: activeModel?.name ?? "Codelens",
        timestamp: new Date().toISOString(),
        ...entry
      },
      ...prev
    ]);
  };

  const clearHistory = () => setHistoryItems([]);

  return (
    <div className="app-shell single">
      <main className="main-content">
        <header className="top-bar glass-card">
          <div className="brand hover-effect">
            <div className="brand-text-logo" aria-label="CodeLens.ai">
              <span className="brand-text-code">Code</span>
              <span className="brand-text-lens">Lens</span>
              <span className="brand-text-ai">.ai</span>
            </div>
          </div>
          <ModelSwitcher
            models={MODEL_CONFIG}
            activeModelId={activeModelId}
            onChange={setActiveModelId}
          />
        </header>

        <section className="hero glass-card">
          <div>
            <div className="hero-kicker">
              Local AI • No Docker • No Cost
              <span className="live-badge">
                Live <span className="live-dot" />
              </span>
            </div>
            <div className="hero-title">Build, debug, and learn fast</div>
            <div className="hero-subtitle">
              A Claude-inspired workspace designed for students. Run code,
              generate flowcharts, and unlock learning levels — all locally.
            </div>
            <div className="hero-actions">
              <button className="primary-button" type="button">
                Start with {activeModel?.name}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setHistoryOpen(true)}
              >
                View history
              </button>
            </div>
          </div>
        </section>

        <section className="model-panel glass-card">
          {activeModelId === "model-1" && (
            <ModelOne onSaveHistory={addHistoryEntry} runnerPrefill={runnerPrefill} />
          )}
          {activeModelId === "model-2" && (
            <ModelTwo onSaveHistory={addHistoryEntry} onRunInVisualizer={runInVisualizer} />
          )}
          {activeModelId === "model-3" && (
            <ModelThree onSaveHistory={addHistoryEntry} />
          )}
          {activeModelId === "model-4" && (
            <ModelFour onSaveHistory={addHistoryEntry} />
          )}
          {activeModelId === "code-writer" && (
            <ModelCodeWriter onSaveHistory={addHistoryEntry} />
          )}
        </section>
      </main>

      <Modal
        open={historyOpen}
        title="History Timeline"
        onClose={() => setHistoryOpen(false)}
      >
        <HistoryPanel
          variant="modal"
          items={historyItems}
          models={MODEL_CONFIG}
          onClear={clearHistory}
          activeModelId={activeModelId}
          onSelectModel={setActiveModelId}
        />
      </Modal>
    </div>
  );
}
