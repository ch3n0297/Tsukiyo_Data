import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Database } from "lucide-react";
import { MetricCard } from "../shared/MetricCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { PanelCard } from "../shared/PanelCard.js";
import { PageHeader } from "../layout/PageHeader.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { CTAButton } from "../shared/CTAButton.js";
import { useDashboardData } from "../../hooks/useDashboardData.js";
import { useAuth } from "../../contexts/AuthContext.js";
import type { AccountConfig } from "../../types/api.js";

const PLATFORMS = ["全部", "instagram", "facebook", "tiktok"] as const;
type PlatformFilter = (typeof PLATFORMS)[number];

const STATUS_PILL_MAP: Record<
  AccountConfig["refreshStatus"],
  { variant: "warning" | "success" | "error" | "muted"; label: string }
> = {
  running: { variant: "warning", label: "同步中" },
  success: { variant: "success", label: "成功" },
  error: { variant: "error", label: "失敗" },
  idle: { variant: "muted", label: "閒置" },
  queued: { variant: "warning", label: "排隊中" },
};

export function AccountListPage() {
  const { user } = useAuth();
  const { accounts, health } = useDashboardData({ enabled: Boolean(user) });
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("全部");

  const isAdmin = user?.role === "admin";

  const filtered = accounts.filter((a) => {
    const matchPlatform = platform === "全部" || a.platform === platform;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      a.clientName.toLowerCase().includes(q) ||
      a.accountId.toLowerCase().includes(q);
    return matchPlatform && matchSearch;
  });

  const activeCount = accounts.filter((a) => a.isActive).length;
  const errorCount = accounts.filter((a) => a.refreshStatus === "error").length;
  const lastUpdated = health
    ? new Date(health.now).toLocaleDateString("zh-TW")
    : null;

  // Empty state
  if (accounts.length === 0) {
    return (
      <>
        <PageHeader
          breadcrumb="ACCOUNT DIRECTORY"
          title="帳號列表"
          actions={
            <>
              {isAdmin ? (
                <CTAButton disabled title="功能開發中">+ 新增帳號</CTAButton>
              ) : null}
              <SecondaryButton disabled title="功能開發中">匯出清單</SecondaryButton>
            </>
          }
        />

        <div className="metric-row metric-row--4">
          <MetricCard label="TOTAL ACCOUNTS" value={0} />
          <MetricCard label="ACTIVE" value={0} />
          <MetricCard label="SYNC SUCCESS" value={0} />
          <MetricCard label="RECENT ERRORS" value={0} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "80px 40px",
          }}
        >
          <Database
            width={48}
            height={48}
            style={{ color: "var(--color-muted)" }}
            aria-hidden="true"
          />
          <p
            style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", margin: 0 }}
          >
            尚未接入任何帳號
          </p>
          <div
            className="panel-card"
            style={{ maxWidth: 380, width: "100%", textAlign: "left" }}
          >
            <p
              style={{ fontWeight: 600, marginTop: 0, marginBottom: 8, color: "var(--color-text)" }}
            >
              你可以先做什麼
            </p>
            <ul style={{ paddingLeft: 20, color: "var(--color-muted)", lineHeight: 1.8 }}>
              <li>確認是否已接受授權</li>
              <li>確認是否已被加入資料庫</li>
              <li>聯絡維護工程師</li>
            </ul>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb="ACCOUNT DIRECTORY"
        title="帳號列表"
        subtitle={`共 ${accounts.length} 個帳號`}
        actions={
          <>
            {isAdmin ? (
              <CTAButton disabled title="功能開發中">+ 新增帳號</CTAButton>
            ) : null}
            <SecondaryButton disabled title="功能開發中">匯出清單</SecondaryButton>
          </>
        }
      />

      <div className="metric-row metric-row--4">
        <MetricCard
          label="TOTAL ACCOUNTS"
          value={accounts.length}
          delta={`第 ${accounts.length} 個帳戶`}
          deltaVariant="muted"
        />
        <MetricCard
          label="ACTIVE"
          value={activeCount}
          delta={`${activeCount} 個帳戶的資料`}
          deltaVariant="muted"
        />
        <MetricCard
          label="SYNC SUCCESS"
          value={accounts.filter((a) => a.refreshStatus === "success").length}
          delta={lastUpdated ? `最後更新 ${lastUpdated}` : undefined}
          deltaVariant="muted"
        />
        <MetricCard
          label="RECENT ERRORS"
          value={errorCount}
          delta={errorCount > 0 ? `${errorCount} 個待修正` : "無錯誤"}
          deltaVariant={errorCount > 0 ? "warning" : "success"}
        />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                width={18}
                height={18}
                style={{
                  position: "absolute",
                  left: 12,
                  color: "var(--color-muted)",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              />
              <input
                className="form-field__input"
                style={{ paddingLeft: 40 }}
                placeholder="搜尋帳號名稱或 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid transparent",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: platform === p ? 500 : 400,
                    background: platform === p ? "var(--color-accent)" : "transparent",
                    color: platform === p ? "#0A0A0A" : "var(--color-muted)",
                  }}
                >
                  {p === "全部" ? "全部" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="panel-card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                background: "var(--color-panel-alt)",
                borderBottom: "1px solid var(--color-border)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                gap: 12,
              }}
            >
              <span style={{ flex: 2 }}>客戶名</span>
              <span style={{ width: 100 }}>平台</span>
              <span style={{ flex: 1 }}>帳號 ID</span>
              <span style={{ width: 100 }}>狀態</span>
              <span style={{ width: 160 }}>最後成功</span>
              <span style={{ width: 60 }}>管理</span>
            </div>
            {filtered.map((account) => {
              const pill = STATUS_PILL_MAP[account.refreshStatus];
              return (
                <div
                  key={account.id}
                  style={{
                    display: "flex",
                    padding: "14px 18px",
                    alignItems: "center",
                    gap: 12,
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>
                      {account.clientName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                      {account.accountId}
                    </div>
                  </div>
                  <div style={{ width: 100, fontSize: 14, color: "var(--color-text)" }}>
                    {account.platform}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: "var(--color-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {account.accountId}
                  </div>
                  <div style={{ width: 100 }}>
                    <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                  </div>
                  <div style={{ width: 160, fontSize: 13, color: "var(--color-muted)" }}>
                    {account.lastSuccessTime
                      ? new Date(account.lastSuccessTime).toLocaleString("zh-TW", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "尚未成功"}
                  </div>
                  <div style={{ width: 60 }}>
                    <Link
                      to={`/accounts/${account.platform}/${account.accountId}`}
                      style={{ fontSize: 13, color: "var(--color-accent)", textDecoration: "none" }}
                    >
                      管理
                    </Link>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--color-muted)" }}>
                無符合條件的帳號
              </div>
            ) : null}
          </div>
        </div>

        {/* Secondary Column */}
        <div className="content-columns__secondary">
          <PanelCard title="平台分布">
            {(["instagram", "facebook", "tiktok"] as const).map((p) => {
              const count = accounts.filter((a) => a.platform === p).length;
              const pct = accounts.length ? (count / accounts.length) * 100 : 0;
              const barColor =
                p === "instagram"
                  ? "var(--color-accent)"
                  : p === "facebook"
                    ? "var(--color-success)"
                    : "var(--color-warning)";
              return (
                <div key={p} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                      fontSize: 14,
                      color: "var(--color-text)",
                    }}
                  >
                    <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                    <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{count}</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: "var(--color-border)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: barColor,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </PanelCard>

          <PanelCard
            title="需要關注"
            action={
              <span
                style={{
                  fontSize: 12,
                  background: "var(--color-panel-alt)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: "2px 8px",
                }}
              >
                {accounts.filter((a) => a.refreshStatus === "error").length} 件
              </span>
            }
          >
            {accounts
              .filter((a) => a.refreshStatus === "error" || a.refreshStatus === "running")
              .slice(0, 3)
              .map((a) => {
                const pill = STATUS_PILL_MAP[a.refreshStatus];
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>
                        {a.accountId}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{a.clientName}</div>
                    </div>
                    <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                  </div>
                );
              })}
            {accounts.filter((a) => a.refreshStatus === "error").length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontSize: 14 }}>目前無需關注項目</p>
            ) : null}
          </PanelCard>
        </div>
      </div>
    </>
  );
}
