import { useCallback, useEffect, useState } from "react";

// PUBLIC_INTERFACE
export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota/security errors
    }
  }, [key, value]);

  const set = useCallback((updater) => {
    setValue((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  return [value, set];
}
