import { useEffect } from "react";

export function useAutoRefresh(callback: () => void, intervalMs: number, enabled = true): void {
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
