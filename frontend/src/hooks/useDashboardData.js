import { useCallback, useEffect, useRef, useState } from "react";
import { getHealth, listAccounts } from "../api/dashboardApi.js";

export function useDashboardData({ enabled }) {
  const abortControllerRef = useRef(null);
  const [health, setHealth] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [capabilities, setCapabilities] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      setHealth(null);
      setAccounts([]);
      setCapabilities(null);
      setError("");
      setIsLoading(false);
      setLastUpdated(null);
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setError("");

    try {
      const [nextHealth, nextSnapshot] = await Promise.all([
        getHealth({ signal: controller.signal }),
        listAccounts({ signal: controller.signal }),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      setHealth(nextHealth);
      setAccounts(Array.isArray(nextSnapshot.accounts) ? nextSnapshot.accounts : []);
      setCapabilities(nextSnapshot.capabilities ?? null);
      setLastUpdated(new Date().toISOString());
      setRefreshToken((value) => value + 1);
    } catch (requestError) {
      if (requestError.name === "AbortError") {
        return;
      }

      setError(requestError.message);

      if (!silent) {
        setHealth(null);
        setAccounts([]);
        setCapabilities(null);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      setHealth(null);
      setAccounts([]);
      setCapabilities(null);
      setError("");
      setIsLoading(false);
      setLastUpdated(null);
      return undefined;
    }

    void refreshDashboard();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, refreshDashboard]);

  return {
    accounts,
    capabilities,
    error,
    health,
    isLoading,
    lastUpdated,
    refreshDashboard,
    refreshToken,
  };
}
