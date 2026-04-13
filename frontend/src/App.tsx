import { useCallback } from "react";
import { PendingUsersPanel } from "./components/admin/PendingUsersPanel";
import { AuthScreen } from "./components/auth/AuthScreen";
import { AccountDetailPanel } from "./components/dashboard/AccountDetailPanel";
import { AccountSidebar } from "./components/dashboard/AccountSidebar";
import { HealthCardGrid } from "./components/dashboard/HealthCardGrid";
import { PageErrorBanner } from "./components/dashboard/PageErrorBanner";
import { SecurityBanner } from "./components/dashboard/SecurityBanner";
import { AppShell } from "./components/layout/AppShell";
import { HeroHeader } from "./components/layout/HeroHeader";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useAuthSession } from "./hooks/useAuthSession";
import { useDashboardData } from "./hooks/useDashboardData";
import { usePendingUsers } from "./hooks/usePendingUsers";
import { useSelectedAccount } from "./hooks/useSelectedAccount";
import { POLL_INTERVAL_MS } from "./utils/formatters";

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

  const handleApprovePendingUser = useCallback((userId: string) => {
    void pendingUsers.approve(userId);
  }, [pendingUsers]);

  const handleRejectPendingUser = useCallback((userId: string) => {
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
        message={authError || dashboardError || detailError}
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
