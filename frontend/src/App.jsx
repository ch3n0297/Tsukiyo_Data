import { useCallback, useEffect, useState } from "react";
import {
  disconnectGoogleConnection,
  startGoogleAuthorization,
} from "./api/googleIntegrationApi.js";
import { PendingUsersPanel } from "./components/admin/PendingUsersPanel.jsx";
import { AuthScreen } from "./components/auth/AuthScreen.jsx";
import { AccountDetailPanel } from "./components/dashboard/AccountDetailPanel.jsx";
import { AccountSidebar } from "./components/dashboard/AccountSidebar.jsx";
import { ContentOverviewPanel } from "./components/dashboard/ContentOverviewPanel.jsx";
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
    isLoading: isAuthLoading,
    isSubmitting: isAuthSubmitting,
    login,
    loginWithGoogle,
    logout,
    message: authMessage,
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
    platforms,
    refreshDashboard,
    refreshToken,
  } = useDashboardData({
    enabled: Boolean(user),
    userRole: user?.role,
  });
  const {
    clearSelectedAccount,
    detailError,
    filteredAccounts,
    isDetailLoading,
    platformOptions,
    selectAccount,
    selectPlatform,
    selectedAccount,
    selectedAccountKey,
    selectedPlatform,
    selectedSummary,
  } = useSelectedAccount(accounts, refreshToken, Boolean(user));
  const pendingUsers = usePendingUsers({
    enabled: user?.role === "admin",
  });
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [integrationError, setIntegrationError] = useState("");
  const [isSubmittingConnection, setIsSubmittingConnection] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("integration") !== "google") {
      return;
    }

    const nextMessage = params.get("integration_message") ?? "";
    const status = params.get("integration_status");

    if (status === "success") {
      setIntegrationMessage(nextMessage);
      setIntegrationError("");
    } else {
      setIntegrationMessage("");
      setIntegrationError(nextMessage);
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

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

  const handleConnectGoogle = useCallback(async (accountConfigId) => {
    setIsSubmittingConnection(true);
    setIntegrationMessage("");
    setIntegrationError("");

    try {
      const response = await startGoogleAuthorization(accountConfigId, window.location.pathname);
      window.location.assign(response.authorization_url);
    } catch (requestError) {
      setIntegrationError(requestError.message);
    } finally {
      setIsSubmittingConnection(false);
    }
  }, []);

  const handleDisconnectGoogle = useCallback(async (accountConfigId) => {
    setIsSubmittingConnection(true);
    setIntegrationMessage("");
    setIntegrationError("");

    try {
      const response = await disconnectGoogleConnection(accountConfigId);
      setIntegrationMessage(response.system_message ?? "Google 授權連線已解除。");
      await refreshDashboard();
    } catch (requestError) {
      setIntegrationError(requestError.message);
    } finally {
      setIsSubmittingConnection(false);
    }
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
          loginWithGoogle={loginWithGoogle}
          message={authMessage}
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
      {integrationMessage ? <section className="panel banner banner--success">{integrationMessage}</section> : null}
      <PageErrorBanner
        message={integrationError || authError || dashboardError || detailError}
      />
      {user.role === "admin" ? (
        <section className="admin-panel-stack">
          <HealthCardGrid health={health} />
          <PendingUsersPanel
            error={pendingUsers.error}
            isLoading={pendingUsers.isLoading}
            isSubmitting={pendingUsers.isSubmitting}
            onApprove={handleApprovePendingUser}
            onReject={handleRejectPendingUser}
            users={pendingUsers.users}
          />
        </section>
      ) : null}

      <section className="workspace-grid">
        <AccountSidebar
          accounts={filteredAccounts}
          allAccountCount={accounts.length}
          onSelectAccount={selectAccount}
          onSelectPlatform={selectPlatform}
          platformOptions={platformOptions}
          selectedAccountKey={selectedAccountKey}
          selectedPlatform={selectedPlatform}
        />
        {selectedSummary ? (
          <AccountDetailPanel
            accounts={accounts}
            connectionMessage={integrationMessage}
            currentUser={user}
            isLoading={isDetailLoading}
            isSubmittingConnection={isSubmittingConnection}
            onBackToOverview={clearSelectedAccount}
            onConnectGoogle={handleConnectGoogle}
            onDisconnectGoogle={handleDisconnectGoogle}
            selectedAccount={selectedAccount}
            selectedAccountSummary={selectedSummary}
          />
        ) : (
          <ContentOverviewPanel
            onSelectAccount={selectAccount}
            onSelectPlatform={selectPlatform}
            platforms={platforms}
            selectedPlatform={selectedPlatform}
          />
        )}
      </section>
    </AppShell>
  );
}
