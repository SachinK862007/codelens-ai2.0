import React, { useEffect, useRef, useState } from "react";

/**
 * Phase configuration per model type.
 * Each model gets contextual phase labels.
 */
const PHASE_CONFIGS = {
  default: [
    { id: "connecting", icon: "🔗", label: "Connecting to AI..." },
    { id: "thinking", icon: "🧠", label: "Thinking..." },
    { id: "planning", icon: "📋", label: "Planning response..." },
    { id: "writing", icon: "✍️", label: "Writing..." },
    { id: "streaming", icon: "⚡", label: "Streaming response..." },
    { id: "retrying", icon: "🔄", label: "Retrying..." }
  ],
  debugger: [
    { id: "connecting", icon: "🔗", label: "Connecting to AI..." },
    { id: "thinking", icon: "🔍", label: "Scanning code..." },
    { id: "planning", icon: "🧪", label: "Analyzing errors..." },
    { id: "writing", icon: "🔧", label: "Generating fixes..." },
    { id: "streaming", icon: "⚡", label: "Streaming results..." },
    { id: "retrying", icon: "🔄", label: "Retrying..." }
  ],
  roadmap: [
    { id: "connecting", icon: "🔗", label: "Connecting to AI..." },
    { id: "thinking", icon: "💡", label: "Understanding project..." },
    { id: "planning", icon: "🗺️", label: "Designing roadmap..." },
    { id: "writing", icon: "📝", label: "Building phases..." },
    { id: "streaming", icon: "⚡", label: "Streaming roadmap..." },
    { id: "retrying", icon: "🔄", label: "Retrying..." }
  ],
  practice: [
    { id: "connecting", icon: "🔗", label: "Connecting to AI..." },
    { id: "thinking", icon: "🧠", label: "Reading your code..." },
    { id: "planning", icon: "⚖️", label: "Evaluating logic..." },
    { id: "writing", icon: "📊", label: "Generating feedback..." },
    { id: "streaming", icon: "⚡", label: "Streaming feedback..." },
    { id: "retrying", icon: "🔄", label: "Retrying..." }
  ],
  codewriter: [
    { id: "connecting", icon: "🔗", label: "Connecting to AI..." },
    { id: "thinking", icon: "💭", label: "Understanding request..." },
    { id: "planning", icon: "🏗️", label: "Designing algorithm..." },
    { id: "writing", icon: "⌨️", label: "Writing code..." },
    { id: "streaming", icon: "⚡", label: "Streaming code..." },
    { id: "retrying", icon: "🔄", label: "Retrying..." }
  ]
};

/**
 * Professional multi-phase AI loading animation.
 * Inspired by Claude, Gemini, and Cursor's thinking indicators.
 *
 * @param {string} props.phase - Current phase ID from the stream (connecting/thinking/writing/streaming)
 * @param {string} props.phaseLabel - Custom label from the backend (optional)
 * @param {string} props.variant - Model variant for contextual labels (debugger/roadmap/practice/codewriter)
 * @param {Array} props.streamProgress - Array of detected sections e.g. [{key:'code', label:'Code', icon:'💻'}]
 */
export default function AILoadingAnimation({
  phase = "thinking",
  phaseLabel,
  variant = "default",
  streamProgress = []
}) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Elapsed time counter
  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const config = PHASE_CONFIGS[variant] || PHASE_CONFIGS.default;
  const currentPhaseConfig = config.find(p => p.id === phase) || config[1]; // default to thinking
  const label = phaseLabel || currentPhaseConfig.label;
  const icon = currentPhaseConfig.icon;

  // Determine which phases are completed
  const phaseOrder = ["connecting", "thinking", "planning", "writing", "streaming"];
  const currentIdx = phaseOrder.indexOf(phase);

  const formatTime = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="ai-thinking-container">
      {/* Animated gradient border */}
      <div className="ai-thinking-border" />

      <div className="ai-thinking-content">
        {/* Phase progress dots */}
        <div className="ai-thinking-phases">
          {phaseOrder.slice(0, 4).map((p, i) => {
            const phaseConfig = config.find(c => c.id === p) || config[0];
            const isActive = p === phase;
            const isCompleted = i < currentIdx;
            return (
              <div
                key={p}
                className={`ai-phase-dot ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                title={phaseConfig.label}
              >
                <span className="ai-phase-icon">{isCompleted ? "✓" : phaseConfig.icon}</span>
                <span className="ai-phase-label">{phaseConfig.label.replace("...", "")}</span>
              </div>
            );
          })}
        </div>

        {/* Main thinking indicator */}
        <div className="ai-thinking-main">
          <div className="ai-thinking-orb">
            <div className="ai-thinking-orb-inner" />
            <div className="ai-thinking-orb-ring" />
            <div className="ai-thinking-orb-ring ring-2" />
          </div>

          <div className="ai-thinking-info">
            <div className="ai-thinking-label">
              <span className="ai-thinking-icon">{icon}</span>
              <span className="ai-thinking-text">{label}</span>
            </div>
            <div className="ai-thinking-meta">
              <span className="ai-thinking-elapsed">{formatTime(elapsed)}</span>
              <span className="ai-thinking-dots">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        </div>

        {/* Smart progress checklist (replaces raw stream preview) */}
        {streamProgress.length > 0 && (
          <div className="ai-progress-checklist">
            <div className="ai-progress-label">Building your response</div>
            <div className="ai-progress-items">
              {streamProgress.map((item, i) => (
                <div
                  key={item.key}
                  className="ai-progress-item"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <span className="ai-progress-check">✓</span>
                  <span className="ai-progress-icon">{item.icon}</span>
                  <span className="ai-progress-text">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Premium skeleton loader for the output panel while AI is generating.
 * Shows code-like shapes with staggered shimmer.
 */
export function AISkeletonLoader() {
  return (
    <div className="ai-skeleton">
      <div className="ai-skeleton-header">
        <div className="ai-skeleton-badge" />
        <div className="ai-skeleton-badge short" />
      </div>
      <div className="ai-skeleton-line w75" />
      <div className="ai-skeleton-line w90" />
      <div className="ai-skeleton-block" />
      <div className="ai-skeleton-line w60" />
      <div className="ai-skeleton-line w80" />
      <div className="ai-skeleton-line w45" />
      <div className="ai-skeleton-block short" />
      <div className="ai-skeleton-line w70" />
    </div>
  );
}
