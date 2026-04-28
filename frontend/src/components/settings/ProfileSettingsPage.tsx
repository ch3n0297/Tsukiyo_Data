import { useEffect, useState } from "react";
import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { PanelCard } from "../shared/PanelCard.js";
import { CTAButton } from "../shared/CTAButton.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { PageHeader } from "../layout/PageHeader.js";
import { useAuth } from "../../contexts/AuthContext.js";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage not available (e.g. in test environment)
  }
}

export function ProfileSettingsPage() {
  const { user, logout, isSubmitting } = useAuth();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleThemeChange(next: Theme) {
    setTheme(next);
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const initial = user.displayName.charAt(0).toUpperCase();
  const now = new Date();

  return (
    <>
      <PageHeader
        breadcrumb="PERSONAL SETTINGS"
        title="個人設定"
        subtitle="在這裡管理個人偏好，不需離開 Dashboard。"
        actions={
          <>
            {isAdmin ? (
              <SecondaryButton disabled title="功能開發中">monitor workspace</SecondaryButton>
            ) : null}
            <SecondaryButton disabled title="功能開發中">備份設定</SecondaryButton>
          </>
        }
      />

      {/* 使用者資料 Card (全寬) */}
      <div
        className="panel-card"
        style={{ display: "flex", flexDirection: "row", gap: 24, padding: "28px 32px" }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#0A0A0A",
            flexShrink: 0,
          }}
        >
          {initial}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 24, fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
            {user.displayName}
          </p>
          <p style={{ fontSize: 14, color: "var(--color-muted)", margin: "4px 0 12px" }}>
            {user.email}
          </p>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              background: "var(--color-panel-alt)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-muted)",
            }}
          >
            {user.role}
          </span>

          {/* Info Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 16,
            }}
          >
            {(
              [
                ["今天日期", now.toLocaleDateString("zh-TW")],
                ["裝置名稱", "MacBook Pro · Chrome"],
                ["時間", now.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })],
                ["角色", user.role],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>{label}</p>
                <p style={{ fontSize: 14, color: "var(--color-text)", margin: "2px 0 0", fontWeight: 500 }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          {/* 介面偏好 Card */}
          <PanelCard title="介面偏好">
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["light", "dark"] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleThemeChange(t)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    background: theme === t ? "var(--color-accent-soft)" : "var(--color-panel-alt)",
                    border: `1px solid ${theme === t ? "var(--color-accent)" : "var(--color-border)"}`,
                    color: theme === t ? "var(--color-accent)" : "var(--color-muted)",
                  }}
                >
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 8px" }}>
              zh-TW, Asia/Taipei UTC+8
            </p>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
              介面偏好的設定只影響你一個人。
            </p>
          </PanelCard>

          {/* 通知偏好 Card */}
          <PanelCard title="通知偏好">
            <ComingSoonBlock icon="clock" />
          </PanelCard>

          {/* 帳號遷移 Card (admin only) */}
          {isAdmin ? (
            <PanelCard title="帳號遷移">
              <p style={{ fontSize: 14, color: "var(--color-muted)", margin: "0 0 12px" }}>
                你可以將此帳號的管理者身份轉交另一人。
              </p>
              <SecondaryButton disabled title="功能開發中">移交管理</SecondaryButton>
            </PanelCard>
          ) : null}
        </div>

        <div className="content-columns__secondary">
          {/* 帳號安全 Card */}
          <PanelCard title="帳號安全">
            <div
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border)",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--color-text)" }}>密碼</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted)",
                    letterSpacing: 3,
                  }}
                >
                  ••••••••
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-warning)", margin: "4px 0 0" }}>
                請定期更新密碼
              </p>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 16px" }}>
              下次全域登出：30 天後
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <CTAButton disabled title="功能開發中" fullWidth>
                修改密碼
              </CTAButton>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void logout()}
                style={{
                  padding: "10px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  border: "1px solid var(--color-error)",
                  color: "var(--color-error)",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  width: "100%",
                }}
              >
                登出所有裝置
              </button>
            </div>
          </PanelCard>

          {/* 目前 Session Card */}
          <PanelCard title="目前 Session">
            <ComingSoonBlock icon="clock" />
          </PanelCard>
        </div>
      </div>
    </>
  );
}
