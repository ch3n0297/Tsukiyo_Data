import { useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthContext } from "./contexts/AuthContext.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useAutoRefresh } from "./hooks/useAutoRefresh.js";
import { DASHBOARD_REFRESH_EVENT } from "./hooks/useDashboardData.js";
import { AppShell } from "./components/layout/AppShell.js";
import { LoginPage } from "./components/auth/LoginPage.js";
import { RegisterPage } from "./components/auth/RegisterPage.js";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage.js";
import { ControlRoomPage } from "./components/dashboard/ControlRoomPage.js";
import { AccountListPage } from "./components/dashboard/AccountListPage.js";
import { AccountDetailPage } from "./components/dashboard/AccountDetailPage.js";
import { SyncJobsPage } from "./components/dashboard/SyncJobsPage.js";
import { PendingReviewPage } from "./components/admin/PendingReviewPage.js";
import { UsersPage } from "./components/admin/UsersPage.js";
import { SchedulerPage } from "./components/admin/SchedulerPage.js";
import { TokensSettingsPage } from "./components/settings/TokensSettingsPage.js";
import { ProfileSettingsPage } from "./components/settings/ProfileSettingsPage.js";
import type { PublicUser } from "./types/api.js";

const POLL_INTERVAL_MS = 60_000;

/** Route guard: redirects to /login if user is null (unauthenticated). */
function AuthGuard({
  user,
  children,
}: {
  user: PublicUser | null;
  children: React.ReactNode;
}) {
  if (!user || user.status !== "active") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Route guard: redirects to /dashboard if user is not admin. */
function AdminGuard({
  user,
  children,
}: {
  user: PublicUser | null;
  children: React.ReactNode;
}) {
  if (!user || user.status !== "active") return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** The router content — needs auth state to be available via AuthContext. */
function AppRoutes() {
  const auth = useAuthSession();
  const { user, logout } = auth;
  const hasActiveUser = user?.status === "active";

  const handleAutoRefresh = useCallback(() => {
    window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
  }, []);

  useAutoRefresh(handleAutoRefresh, POLL_INTERVAL_MS, hasActiveUser);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  if (auth.isLoading) {
    return <div className="loading-screen">正在確認登入狀態...</div>;
  }

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        {/* ── Public auth routes ─────────────────────────────────── */}
        <Route
          path="/login"
          element={
            hasActiveUser ? <Navigate to="/dashboard" replace /> : <LoginPage />
          }
        />
        <Route
          path="/register"
          element={
            hasActiveUser ? <Navigate to="/dashboard" replace /> : <RegisterPage />
          }
        />
        <Route
          path="/forgot-password"
          element={
            hasActiveUser ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />
          }
        />
        <Route
          path="/reset-password"
          element={
            hasActiveUser ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />
          }
        />

        {/* ── Protected routes (requires session) ────────────────── */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <ControlRoomPage />
              </AppShell>
            </AuthGuard>
          }
        />
        <Route
          path="/accounts"
          element={
            <AuthGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <AccountListPage />
              </AppShell>
            </AuthGuard>
          }
        />
        <Route
          path="/accounts/:platform/:accountId"
          element={
            <AuthGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <AccountDetailPage />
              </AppShell>
            </AuthGuard>
          }
        />
        <Route
          path="/sync-jobs"
          element={
            <AuthGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <SyncJobsPage />
              </AppShell>
            </AuthGuard>
          }
        />

        {/* ── Admin-only routes ───────────────────────────────────── */}
        <Route
          path="/admin/pending"
          element={
            <AdminGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <PendingReviewPage />
              </AppShell>
            </AdminGuard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <UsersPage />
              </AppShell>
            </AdminGuard>
          }
        />
        <Route
          path="/admin/scheduler"
          element={
            <AdminGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <SchedulerPage />
              </AppShell>
            </AdminGuard>
          }
        />

        {/* ── Settings routes ─────────────────────────────────────── */}
        <Route
          path="/settings/tokens"
          element={
            <AdminGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <TokensSettingsPage />
              </AppShell>
            </AdminGuard>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <AuthGuard user={user}>
              <AppShell user={user!} onLogout={handleLogout}>
                <ProfileSettingsPage />
              </AppShell>
            </AuthGuard>
          }
        />

        {/* ── Catch-all redirect ──────────────────────────────────── */}
        <Route
          path="*"
          element={
            hasActiveUser ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </AuthContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
