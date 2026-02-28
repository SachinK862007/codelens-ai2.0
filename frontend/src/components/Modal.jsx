import React from "react";

export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop show" role="dialog" aria-modal="true">
      <div className="modal-card glass-card">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
