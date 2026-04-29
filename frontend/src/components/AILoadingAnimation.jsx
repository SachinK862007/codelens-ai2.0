import React from "react";

/**
 * Professional AI loading animation — like Claude/Gemini thinking indicator.
 * Shows a pulsing icon, bouncing dots, and status text.
 */
export default function AILoadingAnimation({ message = "Analyzing your code...", subtext = "This may take a few seconds" }) {
  return (
    <div className="ai-loading-container">
      <div className="ai-loading-icon">
        <svg viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity="0.3" fill="#5a2ea6" stroke="none" />
          <path d="M20 12h2A10 10 0 0 0 12 2v2a8 8 0 0 1 8 8z">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
          </path>
        </svg>
      </div>
      <div className="ai-loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="ai-loading-text">{message}</div>
      <div className="ai-loading-subtext">{subtext}</div>
    </div>
  );
}

/**
 * Shimmer skeleton shown in the output panel while AI is generating.
 */
export function AISkeletonLoader() {
  return (
    <div className="ai-skeleton">
      <div className="ai-skeleton-line" />
      <div className="ai-skeleton-line" />
      <div className="ai-skeleton-block" />
      <div className="ai-skeleton-line" />
      <div className="ai-skeleton-line" />
      <div className="ai-skeleton-line" />
      <div className="ai-skeleton-block" />
    </div>
  );
}
