import { useCallback, useEffect, useRef, useState } from "react";
import { getHealth, listAccounts } from "../api/dashboardApi";
import type { AccountConfig, HealthResponse, UiCapabilities } from "../types/api";

interface UseDashboardDataOptions {
  enabled?: boolean;
}

export const DASHBOARD_REFRESH_EVENT = "tsukiyo:dashboard-refresh";

export function useDashboardData({ enabled }: UseDashboardDataOptions = {}) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [capabilities, setCapabilities] = useState<UiCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshDashboard = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
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
      ]) as [HealthResponse, { accounts?: AccountConfig[]; capabilities?: UiCapabilities }];

      if (controller.signal.aborted) {
        return;
      }

      setHealth(nextHealth);
      setAccounts(Array.isArray(nextSnapshot.accounts) ? nextSnapshot.accounts : []);
      setCapabilities(nextSnapshot.capabilities ?? null);
      setLastUpdated(new Date().toISOString());
      setRefreshToken((value) => value + 1);
    } catch (requestError) {
      if ((requestError as Error).name === "AbortError") {
        return;
      }

      setError((requestError as Error).message);

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

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleExternalRefresh = () => {
      void refreshDashboard({ silent: true });
    };

    window.addEventListener(DASHBOARD_REFRESH_EVENT, handleExternalRefresh);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handleExternalRefresh);
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
