import { useEffect, useRef } from "react";

// PUBLIC_INTERFACE
export function useInterval(callback, delayMs) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null || delayMs === undefined) return;

    const id = window.setInterval(() => {
      saved.current();
    }, delayMs);

    return () => window.clearInterval(id);
  }, [delayMs]);
}
