import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MetricCard } from "../shared/MetricCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { PanelCard } from "../shared/PanelCard.js";
import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { PageHeader } from "../layout/PageHeader.js";
import { useSelectedAccount } from "../../hooks/useSelectedAccount.js";
import { useDashboardData } from "../../hooks/useDashboardData.js";
import { useAuth } from "../../contexts/AuthContext.js";
import type { AccountConfig } from "../../types/api.js";

const STATUS_LABEL: Record<AccountConfig["refreshStatus"], string> = {
  running: "同步中",
  success: "成功",
  error: "失敗",
  idle: "閒置",
  queued: "排隊中",
};

const STATUS_PILL_VARIANT: Record<
  AccountConfig["refreshStatus"],
  "warning" | "success" | "error" | "muted" | "live"
> = {
  running: "live",
  success: "success",
  error: "error",
  idle: "muted",
  queued: "warning",
};

export function AccountDetailPage() {
  const { platform, accountId } = useParams<{ platform: string; accountId: string }>();
  const { user } = useAuth();
  const { accounts, capabilities, refreshToken } = useDashboardData({ enabled: Boolean(user) });
  const { selectedAccount, isDetailLoading, selectAccount } = useSelectedAccount(
    accounts,
    refreshToken,
    Boolean(user),
  );

  // Sync URL params to selected account
  useEffect(() => {
    if (!platform || !accountId || accounts.length === 0) return;
    const found = accounts.find(
      (a) => a.platform === platform && a.accountId === accountId,
    );
    if (found) {
      selectAccount(found.accountKey);
    }
  }, [accounts, platform, accountId, selectAccount]);

  if (isDetailLoading) {
    return (
      <div style={{ color: "var(--color-muted)", padding: 24 }}>載入帳號詳情...</div>
    );
  }

  if (!selectedAccount) {
    return (
      <div style={{ color: "var(--color-muted)", padding: 24 }}>
        找不到帳號：{platform} / {accountId}
      </div>
    );
  }

  const a = selectedAccount;
  const pillVariant = STATUS_PILL_VARIANT[a.refreshStatus];
  const canRefresh = capabilities?.manualRefresh ?? false;
  const isAdmin = user?.role === "admin";

  return (
    <>
      <PageHeader
        breadcrumb="ACCOUNT DETAIL"
        title={`${a.clientName} · ${a.platform} · ${a.accountId}`}
        actions={
          <>
            <StatusPill variant={pillVariant} showDot={pillVariant === "live"}>
              {STATUS_LABEL[a.refreshStatus]}
            </StatusPill>
            <SecondaryButton disabled={!canRefresh} title={canRefresh ? undefined : "唯讀模式"}>
              重新整理
            </SecondaryButton>
            {isAdmin ? (
              <Link
                to="/settings/tokens"
                style={{ fontSize: 13, color: "var(--color-accent)", textDecoration: "none" }}
              >
                前往帳號設定
              </Link>
            ) : null}
          </>
        }
      />

      <div className="metric-row metric-row--4">
        <MetricCard
          label="REFRESH STATUS"
          value={STATUS_LABEL[a.refreshStatus]}
        />
        <MetricCard
          label="REFRESH DAYS"
          value={`${a.refreshDays} 天`}
        />
        <MetricCard
          label="ROW COUNT"
          value={a.latestOutput ? `${a.latestOutput.rowCount} 列` : "—"}
        />
        <MetricCard
          label="LAST SUCCESS"
          value={
            a.lastSuccessTime
              ? new Date(a.lastSuccessTime).toLocaleString("zh-TW", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
        />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard
            title="帳號資訊"
            action={
              <Link
                to="/accounts"
                style={{ fontSize: 13, color: "var(--color-muted)", textDecoration: "none" }}
              >
                ← 返回列表
              </Link>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              {(
                [
                  ["platform", a.platform],
                  ["accountId", a.accountId],
                  ["clientName", a.clientName],
                  ["sheetId", a.sheetId],
                  ["marketing-sheet", a.sheetRowKey],
                  ["sheetProxy", a.accountKey],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--color-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      margin: "0 0 4px",
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--color-text)",
                      margin: 0,
                      wordBreak: "break-all",
                    }}
                  >
                    {value || "—"}
                  </p>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard
            title="最新輸出"
            action={
              a.latestOutput?.syncedAt
                ? `syncedAt: ${new Date(a.latestOutput.syncedAt).toLocaleString("zh-TW", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : undefined
            }
          >
            {a.latestOutput && a.latestOutput.rows && a.latestOutput.rows.length > 0 ? (
              <div style={{ overflowY: "auto", maxHeight: 320 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--color-panel-alt)" }}>
                      {["content_id", "標題", "發布時間", "觀看數", "類型", "來源"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            color: "var(--color-muted)",
                            fontWeight: 500,
                            fontSize: 12,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            borderBottom: "1px solid var(--color-border)",
                            position: "sticky",
                            top: 0,
                            background: "var(--color-panel-alt)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.latestOutput.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            color: "var(--color-muted)",
                          }}
                        >
                          {String(row.content_id ?? "")}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--color-text)" }}>
                          {String(row.caption ?? "")}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            color: "var(--color-muted)",
                            fontSize: 12,
                          }}
                        >
                          {String(row.published_at ?? "")}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--color-text)" }}>
                          {String(row.views ?? "")}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--color-muted)" }}>
                          {String(row.content_type ?? "")}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--color-muted)" }}>
                          {String(row.url ?? "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--color-muted)", margin: 0 }}>尚無輸出資料</p>
            )}
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="狀態快照">
            {(
              [
                [
                  "refreshStatus",
                  <StatusPill key="s" variant={pillVariant}>
                    {STATUS_LABEL[a.refreshStatus]}
                  </StatusPill>,
                ],
                [
                  "lastRequestTime",
                  a.lastRequestTime
                    ? new Date(a.lastRequestTime).toLocaleString("zh-TW")
                    : "—",
                ],
                [
                  "lastSuccessTime",
                  a.lastSuccessTime
                    ? new Date(a.lastSuccessTime).toLocaleString("zh-TW")
                    : "—",
                ],
                [
                  "statusUpdatedAt",
                  a.statusUpdatedAt
                    ? new Date(a.statusUpdatedAt).toLocaleString("zh-TW")
                    : "—",
                ],
                ...(a.systemMessage
                  ? [["systemMessage", a.systemMessage] as [string, string]]
                  : []),
              ] as [string, React.ReactNode][]
            ).map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: 14,
                }}
              >
                <span style={{ color: "var(--color-muted)", fontWeight: 500 }}>{label}</span>
                <span style={{ color: "var(--color-text)" }}>{value}</span>
              </div>
            ))}
          </PanelCard>

          <PanelCard title="最近一次工作">
            <ComingSoonBlock icon="clock" />
          </PanelCard>
        </div>
      </div>
    </>
  );
}
