import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="ToastHost" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((t) => (
        <div key={t.id} className="Toast">
          <p className="ToastTitle">{t.title}</p>
          <p className="ToastText">{t.message}</p>
          <div className="NVButtonRow">
            <button className="NVButton NVButtonSecondary" type="button" onClick={() => onDismiss(t.id)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// PUBLIC_INTERFACE
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = { id, title: toast.title || "Info", message: toast.message || "" };

    setToasts((prev) => [next, ...prev].slice(0, 3));

    // Auto dismiss after a short delay for non-blocking UX.
    window.setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
