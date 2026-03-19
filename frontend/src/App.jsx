import { useCallback } from "react";
import { PendingUsersPanel } from "./components/admin/PendingUsersPanel.jsx";
import { AuthScreen } from "./components/auth/AuthScreen.jsx";
import { AccountDetailPanel } from "./components/dashboard/AccountDetailPanel.jsx";
import { AccountSidebar } from "./components/dashboard/AccountSidebar.jsx";
import { HealthCardGrid } from "./components/dashboard/HealthCardGrid.jsx";
import { PageErrorBanner } from "./components/dashboard/PageErrorBanner.jsx";
import { SecurityBanner } from "./components/dashboard/SecurityBanner.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { HeroHeader } from "./components/layout/HeroHeader.jsx";
import { useAutoRefresh } from "./hooks/useAutoRefresh.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { usePendingUsers } from "./hooks/usePendingUsers.js";
import { useSelectedAccount } from "./hooks/useSelectedAccount.js";
import { POLL_INTERVAL_MS } from "./utils/formatters.js";

export default function App() {
  const {
    authView,
    error: authError,
    forgotPassword,
    isLoading: isAuthLoading,
    isSubmitting: isAuthSubmitting,
    login,
    logout,
    message: authMessage,
    register,
    resetPassword,
    switchMode,
    user,
  } = useAuthSession();
  const {
    accounts,
    capabilities,
    error: dashboardError,
    health,
    isLoading,
    lastUpdated,
    refreshDashboard,
    refreshToken,
  } = useDashboardData({ enabled: Boolean(user) });
  const {
    detailError,
    isDetailLoading,
    selectAccount,
    selectedAccount,
    selectedAccountKey,
    selectedSummary,
  } = useSelectedAccount(accounts, refreshToken, Boolean(user));
  const pendingUsers = usePendingUsers({
    enabled: user?.role === "admin",
  });

  const handleRefresh = useCallback(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const handleApprovePendingUser = useCallback((userId) => {
    void pendingUsers.approve(userId);
  }, [pendingUsers]);

  const handleRejectPendingUser = useCallback((userId) => {
    void pendingUsers.reject(userId);
  }, [pendingUsers]);

  const handleAutoRefresh = useCallback(() => {
    void refreshDashboard({ silent: true });
  }, [refreshDashboard]);

  useAutoRefresh(handleAutoRefresh, POLL_INTERVAL_MS, Boolean(user));

  if (isAuthLoading) {
    return (
      <AppShell>
        <HeroHeader currentUser={null} isRefreshing={false} isSigningOut={false} lastUpdated={null} />
        <section className="panel auth-panel">
          <p className="muted">正在確認登入狀態...</p>
        </section>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <HeroHeader currentUser={null} isRefreshing={false} isSigningOut={false} lastUpdated={null} />
        <AuthScreen
          authView={authView}
          error={authError}
          isSubmitting={isAuthSubmitting}
          login={login}
          message={authMessage}
          register={register}
          requestPasswordReset={forgotPassword}
          resetPassword={resetPassword}
          switchMode={switchMode}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <HeroHeader
        currentUser={user}
        isRefreshing={isLoading}
        isSigningOut={isAuthSubmitting}
        lastUpdated={lastUpdated}
        onLogout={() => void logout()}
        onRefresh={handleRefresh}
      />
      <SecurityBanner capabilities={capabilities} />
      <PageErrorBanner
        message={authError || pendingUsers.error || dashboardError || detailError}
      />
      {user.role === "admin" ? (
        <PendingUsersPanel
          error={pendingUsers.error}
          isLoading={pendingUsers.isLoading}
          isSubmitting={pendingUsers.isSubmitting}
          onApprove={handleApprovePendingUser}
          onReject={handleRejectPendingUser}
          users={pendingUsers.users}
        />
      ) : null}
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
