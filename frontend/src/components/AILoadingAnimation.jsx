import React, { useEffect, useRef, useState } from "react";

const PHASE_CONFIGS = {
  default: {
    connecting: "Connecting to local AI",
    thinking: "Understanding your request",
    planning: "Planning the response",
    writing: "Composing output",
    streaming: "Delivering results",
    retrying: "Reconnecting"
  },
  debugger: {
    connecting: "Connecting to local AI",
    thinking: "Reading your code",
    planning: "Analyzing errors",
    writing: "Generating fixes",
    streaming: "Building report",
    retrying: "Reconnecting"
  },
  roadmap: {
    connecting: "Connecting to local AI",
    thinking: "Understanding your project",
    planning: "Designing roadmap",
    writing: "Structuring phases",
    streaming: "Assembling plan",
    retrying: "Reconnecting"
  },
  practice: {
    connecting: "Connecting to local AI",
    thinking: "Reading your solution",
    planning: "Evaluating logic",
    writing: "Preparing feedback",
    streaming: "Finalizing grade",
    retrying: "Reconnecting"
  },
  codewriter: {
    connecting: "Connecting to local AI",
    thinking: "Understanding requirements",
    planning: "Designing algorithm",
    writing: "Writing code",
    streaming: "Packaging output",
    retrying: "Reconnecting"
  }
};

const PHASE_ORDER = ["connecting", "thinking", "planning", "writing", "streaming"];

function PhaseIcon({ phaseId, active }) {
  const cls = `ai-phase-svg ${active ? "active" : ""}`;
  if (phaseId === "connecting") {
    return (
      <svg className={cls} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.9" />
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
    );
  }
  if (phaseId === "thinking") {
    return (
      <svg className={cls} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 8a4 4 0 1 1 8 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="6" cy="7" r="0.8" fill="currentColor" />
        <circle cx="10" cy="7" r="0.8" fill="currentColor" />
      </svg>
    );
  }
  if (phaseId === "planning") {
    return (
      <svg className={cls} viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5 6h6M5 8.5h4M5 11h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 12L8 4l5 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Professional multi-phase AI indicator (Claude / Gemini / Cursor style).
 */
export default function AILoadingAnimation({
  phase = "thinking",
  phaseLabel,
  variant = "default",
  streamProgress = []
}) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const labels = PHASE_CONFIGS[variant] || PHASE_CONFIGS.default;
  const label = phaseLabel || labels[phase] || labels.thinking;
  const currentIdx = PHASE_ORDER.indexOf(phase);
  const orbMode = phase === "planning" ? "planning" : phase === "streaming" || phase === "writing" ? "writing" : "thinking";

  const formatTime = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

  return (
    <div className="ai-thinking-container" role="status" aria-live="polite" aria-label={label}>
      <div className="ai-thinking-border" />
      <div className="ai-thinking-content">
        <div className="ai-thinking-phases">
          {PHASE_ORDER.slice(0, 4).map((p, i) => {
            const isActive = p === phase;
            const isCompleted = currentIdx > i || (phase === "streaming" && i < 4);
            const shortLabel = (labels[p] || p).split(" ").slice(0, 2).join(" ");
            return (
              <div
                key={p}
                className={`ai-phase-dot ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                title={labels[p]}
              >
                <span className="ai-phase-icon-wrap">
                  {isCompleted && !isActive ? (
                    <svg className="ai-phase-svg done" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 8.2L6.5 11.2L12.5 5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <PhaseIcon phaseId={p} active={isActive} />
                  )}
                </span>
                <span className="ai-phase-label">{shortLabel}</span>
              </div>
            );
          })}
        </div>

        <div className="ai-thinking-main">
          <div className={`ai-thinking-orb ai-orb-mode-${orbMode}`}>
            <div className="ai-thinking-orb-glow" />
            <div className="ai-thinking-orb-inner" />
            <div className="ai-thinking-orb-ring" />
            <div className="ai-thinking-orb-ring ring-2" />
            {orbMode === "planning" && <div className="ai-thinking-orb-pulse" />}
          </div>

          <div className="ai-thinking-info">
            <div className="ai-thinking-label">
              <span className="ai-thinking-text">{label}</span>
            </div>
            <div className="ai-thinking-meta">
              <span className="ai-thinking-elapsed">{formatTime(elapsed)}</span>
              <span className="ai-thinking-dots" aria-hidden="true">
                <span /><span /><span />
              </span>
            </div>
          </div>
        </div>

        {streamProgress.length > 0 && (
          <div className="ai-progress-checklist">
            <div className="ai-progress-label">Building your response</div>
            <div className="ai-progress-items">
              {streamProgress.map((item, i) => (
                <div key={item.key} className="ai-progress-item" style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="ai-progress-check" aria-hidden="true" />
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

export function AISkeletonLoader() {
  return (
    <div className="ai-skeleton" aria-hidden="true">
      <div className="ai-skeleton-header">
        <div className="ai-skeleton-badge" />
        <div className="ai-skeleton-badge short" />
      </div>
      <div className="ai-skeleton-line w75" />
      <div className="ai-skeleton-line w90" />
      <div className="ai-skeleton-block" />
      <div className="ai-skeleton-line w60" />
      <div className="ai-skeleton-line w80" />
      <div className="ai-skeleton-block short" />
    </div>
  );
}
