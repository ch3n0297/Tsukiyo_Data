import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  Key,
  LogOut,
  User,
} from "lucide-react";
import type { PublicUser } from "../../types/api.js";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Admin-only nav items (after the divider)
const ADMIN_ITEMS: NavItem[] = [
  { label: "管理員首頁", to: "/admin/pending", icon: User },
  { label: "使用者管理", to: "/admin/users", icon: Users },
  { label: "系統設定", to: "/admin/scheduler", icon: Settings },
];

// Main nav items (all roles)
const MAIN_ITEMS: NavItem[] = [
  { label: "總覽看板", to: "/dashboard", icon: LayoutDashboard },
  { label: "資料來源", to: "/accounts", icon: Users },
  { label: "同步任務", to: "/sync-jobs", icon: Activity },
];

// Admin-only extra main items
const ADMIN_MAIN_ITEMS: NavItem[] = [
  { label: "帳號接入", to: "/settings/tokens", icon: Key },
];

interface SidebarProps {
  user: PublicUser;
  onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";

  const mainItems = isAdmin
    ? [...MAIN_ITEMS, ...ADMIN_MAIN_ITEMS]
    : MAIN_ITEMS;

  function handleLogout() {
    onLogout();
    // After logout, the route guard in App will redirect to /login
  }

  function handleProfileClick() {
    void navigate("/settings/profile");
  }

  return (
    <aside className="sidebar" aria-label="主導覽">
      <div className="sidebar__top">
        {/* Brand */}
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">T</span>
          <span className="sidebar__brand-text">TSUKIYO</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav" aria-label="主選單">
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__nav-item${isActive ? " sidebar__nav-item--active" : ""}`
              }
            >
              <item.icon className="sidebar__nav-icon" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {isAdmin ? (
            <>
              <div className="sidebar__nav-divider" />
              <span className="sidebar__nav-group-label">管理員</span>
              {ADMIN_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar__nav-item${isActive ? " sidebar__nav-item--active" : ""}`
                  }
                >
                  <item.icon className="sidebar__nav-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          ) : null}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar__footer">
        <p className="sidebar__footer-label">Desk owner</p>
        <p className="sidebar__footer-name">{user.displayName}</p>
        <p className="sidebar__footer-role">{user.role}</p>

        <div className="sidebar__footer-actions">
          <button
            type="button"
            className="sidebar__footer-action"
            onClick={handleProfileClick}
          >
            <User width={16} height={16} aria-hidden="true" />
            個人設定
          </button>
          <button
            type="button"
            className="sidebar__footer-action"
            onClick={handleLogout}
          >
            <LogOut width={16} height={16} aria-hidden="true" />
            登出
          </button>
        </div>
      </div>
    </aside>
  );
}
