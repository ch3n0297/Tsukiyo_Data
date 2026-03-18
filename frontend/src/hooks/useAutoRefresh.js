import { useEffect } from "react";

export function useAutoRefresh(callback, intervalMs, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handle = window.setInterval(() => {
      callback();
    }, intervalMs);

    return () => {
      window.clearInterval(handle);
    };
  }, [callback, enabled, intervalMs]);
}
