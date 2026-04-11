import { useCallback, useEffect, useRef, useState } from "react";
import { getContentOverview, getHealth } from "../api/dashboardApi.js";

export function useDashboardData({ enabled, userRole } = {}) {
  const abortControllerRef = useRef(null);
  const [health, setHealth] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [platforms, setPlatforms] = useState([]);
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
      setPlatforms([]);
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
      const [nextHealth, nextOverview] = await Promise.all([
        userRole === "admin" ? getHealth({ signal: controller.signal }) : Promise.resolve(null),
        getContentOverview({ signal: controller.signal }),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      setHealth(nextHealth);
      setAccounts(Array.isArray(nextOverview.accounts) ? nextOverview.accounts : []);
      setPlatforms(Array.isArray(nextOverview.platforms) ? nextOverview.platforms : []);
      setCapabilities(nextOverview.capabilities ?? null);
      setLastUpdated(nextOverview.generatedAt ?? new Date().toISOString());
      setRefreshToken((value) => value + 1);
    } catch (requestError) {
      if (requestError.name === "AbortError") {
        return;
      }

      setError(requestError.message);

      if (!silent) {
        setHealth(null);
        setAccounts([]);
        setPlatforms([]);
        setCapabilities(null);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [enabled, userRole]);

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      setHealth(null);
      setAccounts([]);
      setPlatforms([]);
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
    platforms,
    refreshDashboard,
    refreshToken,
  };
}
