import React, { useEffect } from "react";

/**
 * Lightweight accessible modal.
 * - Closes on Escape
 * - Closes when clicking backdrop
 */
// PUBLIC_INTERFACE
export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="ModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ModalPanel">
        <div className="ModalHeader">
          <h2 className="NVTitle">{title}</h2>
          <p className="NVSubtitle">Press Escape to close.</p>
        </div>
        <div className="ModalBody">{children}</div>
      </div>
    </div>
  );
}
