import { MetricCard } from "../shared/MetricCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { PanelCard } from "../shared/PanelCard.js";
import { CTAButton } from "../shared/CTAButton.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { PageHeader } from "../layout/PageHeader.js";
import { useDashboardData } from "../../hooks/useDashboardData.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function SyncJobsPage() {
  const { user } = useAuth();
  const { health } = useDashboardData({ enabled: Boolean(user) });

  const queuePending = health?.queue.pending ?? undefined;
  const queueRunning = health?.queue.running ?? undefined;

  return (
    <>
      <PageHeader
        breadcrumb="SYNC OPERATIONS"
        title="同步任務與刷新狀態"
        actions={
          <>
            <CTAButton disabled title="功能開發中">+ 指定任務觸發</CTAButton>
            <SecondaryButton disabled title="功能開發中">匯出任務記錄</SecondaryButton>
          </>
        }
      />

      <div className="metric-row metric-row--4">
        <MetricCard
          label="QUEUED"
          value={queuePending ?? "—"}
          delta={queuePending !== undefined ? "待處理任務" : undefined}
          deltaVariant="muted"
        />
        <MetricCard
          label="RUNNING"
          value={queueRunning ?? "—"}
          delta={queueRunning !== undefined ? "執行中任務" : undefined}
          deltaVariant="muted"
        />
        <MetricCard label="SUCCESS" isComingSoon />
        <MetricCard label="ERROR" isComingSoon />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard title="任務清單">
            <ComingSoonBlock icon="clock" />
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="佇列健康度">
            {health ? (
              <div>
                {(
                  [
                    ["待處理", `${health.queue.pending} 件`],
                    ["執行中", `${health.queue.running} 件`],
                    ["並行上限", `${health.queue.concurrency} 個`],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "var(--color-muted)" }}>{label}</span>
                    <span style={{ color: "var(--color-text)" }}>{value}</span>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: "var(--color-muted)" }}>排程器狀態</span>
                  <StatusPill variant={health.scheduler.running ? "success" : "warning"}>
                    {health.scheduler.running ? "執行中" : "已停止"}
                  </StatusPill>
                </div>
                <p style={{ fontSize: 14, color: "var(--color-text)", margin: "8px 0 0" }}>
                  每 {Math.round(health.scheduler.intervalMs / 60000)} 分鐘同步一次
                </p>
              </div>
            ) : (
              <p style={{ color: "var(--color-muted)", margin: 0 }}>載入中...</p>
            )}
          </PanelCard>

          <PanelCard title="錯誤原因分類">
            <ComingSoonBlock icon="clock" />
          </PanelCard>
        </div>
      </div>
    </>
  );
}
