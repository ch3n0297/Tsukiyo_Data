import type { ReactNode } from "react";
import type { PublicUser } from "../../types/api.js";
import { Sidebar } from "./Sidebar.js";

interface AppShellProps {
  user: PublicUser;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * The main dashboard shell: Sidebar (280px fixed) + Main Content (flex: 1).
 * Used for all authenticated, non-auth routes.
 */
export function AppShell({ user, onLogout, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="main-content">{children}</main>
    </div>
  );
}
