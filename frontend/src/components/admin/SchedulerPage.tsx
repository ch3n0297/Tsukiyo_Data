import { MetricCard } from "../shared/MetricCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { PanelCard } from "../shared/PanelCard.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { PageHeader } from "../layout/PageHeader.js";
import { useDashboardData } from "../../hooks/useDashboardData.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function SchedulerPage() {
  const { user } = useAuth();
  const { health } = useDashboardData({ enabled: Boolean(user) });

  const scheduler = health?.scheduler;
  const queue = health?.queue;

  return (
    <>
      <PageHeader
        title="排程與系統設定"
        actions={
          <>
            <SecondaryButton disabled title="功能開發中">系統設定</SecondaryButton>
            <SecondaryButton disabled title="功能開發中">排程設定</SecondaryButton>
          </>
        }
      />

      <div className="metric-row metric-row--4">
        <MetricCard
          label="SCHEDULER"
          value={scheduler ? (scheduler.running ? "執行中" : "已停止") : "—"}
          deltaVariant={scheduler?.running ? "success" : "warning"}
        />
        <MetricCard
          label="INTERVAL"
          value={scheduler ? `${Math.round(scheduler.intervalMs / 60000)} 分鐘` : "—"}
        />
        <MetricCard
          label="CONCURRENCY"
          value={queue ? `${queue.concurrency} 個並行` : "—"}
        />
        <MetricCard
          label="TICK"
          value={scheduler ? (scheduler.tickInProgress ? "執行中" : "待命") : "—"}
        />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard
            title="排程器概況"
            action={
              health ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {new Date(health.now).toISOString()}
                </span>
              ) : undefined
            }
          >
            {health ? (
              <div>
                {(
                  [
                    [
                      "intervalMs",
                      `每 ${Math.round(health.scheduler.intervalMs / 60000)} 分鐘`,
                    ],
                    [
                      "tickInProgress",
                      <StatusPill
                        key="tick"
                        variant={health.scheduler.tickInProgress ? "warning" : "muted"}
                      >
                        {health.scheduler.tickInProgress ? "執行中" : "閒置"}
                      </StatusPill>,
                    ],
                    ["now", health.now],
                  ] as [string, React.ReactNode][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "var(--color-muted)", fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "var(--color-text)", fontFamily: label === "now" ? "var(--font-mono)" : undefined }}>
                      {value}
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 16 }}>
                  <SecondaryButton disabled title="功能開發中">
                    {health.scheduler.running ? "停止排程" : "啟動排程"}
                  </SecondaryButton>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--color-muted)", margin: 0 }}>載入中...</p>
            )}
          </PanelCard>

          <PanelCard title="保護規則">
            <ComingSoonBlock icon="lock" />
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="設定影響說明">
            <ul
              style={{
                paddingLeft: 20,
                color: "var(--color-muted)",
                lineHeight: 1.9,
                fontSize: 14,
                margin: 0,
              }}
            >
              <li>調整 interval 會影響資料新鮮度</li>
              <li>降低 concurrency 可減輕 API 壓力</li>
              <li>正式環境建議值：interval ≥ 30 分鐘，concurrency ≤ 3</li>
              <li>修改前請確認無 running 任務</li>
            </ul>
          </PanelCard>
        </div>
      </div>
    </>
  );
}
