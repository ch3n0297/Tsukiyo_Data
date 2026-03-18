import { useCallback } from "react";
import { AccountDetailPanel } from "./components/dashboard/AccountDetailPanel.jsx";
import { AccountSidebar } from "./components/dashboard/AccountSidebar.jsx";
import { HealthCardGrid } from "./components/dashboard/HealthCardGrid.jsx";
import { PageErrorBanner } from "./components/dashboard/PageErrorBanner.jsx";
import { SecurityBanner } from "./components/dashboard/SecurityBanner.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { HeroHeader } from "./components/layout/HeroHeader.jsx";
import { useAutoRefresh } from "./hooks/useAutoRefresh.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { useSelectedAccount } from "./hooks/useSelectedAccount.js";
import { POLL_INTERVAL_MS } from "./utils/formatters.js";

export default function App() {
  const {
    accounts,
    capabilities,
    error: dashboardError,
    health,
    isLoading,
    lastUpdated,
    refreshDashboard,
    refreshToken,
  } = useDashboardData();
  const {
    detailError,
    isDetailLoading,
    selectAccount,
    selectedAccount,
    selectedAccountKey,
    selectedSummary,
  } = useSelectedAccount(accounts, refreshToken);

  const handleRefresh = useCallback(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const handleAutoRefresh = useCallback(() => {
    void refreshDashboard({ silent: true });
  }, [refreshDashboard]);

  useAutoRefresh(handleAutoRefresh, POLL_INTERVAL_MS);

  return (
    <AppShell>
      <HeroHeader isRefreshing={isLoading} lastUpdated={lastUpdated} onRefresh={handleRefresh} />
      <SecurityBanner capabilities={capabilities} />
      <PageErrorBanner message={dashboardError || detailError} />
      <HealthCardGrid health={health} />

      <section className="workspace-grid">
        <AccountSidebar
          accounts={accounts}
          onSelect={selectAccount}
          selectedAccountKey={selectedAccountKey}
        />
        <AccountDetailPanel
          accounts={accounts}
          isLoading={isDetailLoading}
          selectedAccount={selectedAccount}
          selectedAccountSummary={selectedSummary}
        />
      </section>
    </AppShell>
  );
}
