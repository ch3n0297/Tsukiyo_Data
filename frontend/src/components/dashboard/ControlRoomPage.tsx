import { MetricCard } from "../shared/MetricCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { PanelCard } from "../shared/PanelCard.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { PageHeader } from "../layout/PageHeader.js";
import { useDashboardData } from "../../hooks/useDashboardData.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function ControlRoomPage() {
  const { user } = useAuth();
  const { health } = useDashboardData({ enabled: Boolean(user) });

  const failedJobs = health
    ? health.queue.pending + health.queue.running
    : undefined;

  return (
    <>
      <PageHeader
        title="資料中台控制室"
        subtitle="即時監控所有資料管線的運行狀態與健康指標。"
        actions={
          <>
            <StatusPill variant="live" showDot>全域同步中</StatusPill>
            <SecondaryButton disabled title="功能開發中">匯出監控報表</SecondaryButton>
          </>
        }
      />

      {/* Metric Row */}
      <div className="metric-row metric-row--3">
        <MetricCard label="TOTAL WRITES" isComingSoon />
        <MetricCard label="ACTIVE TABLES" isComingSoon />
        <MetricCard
          label="FAILED JOBS"
          value={failedJobs ?? "—"}
          delta={failedJobs !== undefined ? "3 個需要人工處理" : undefined}
          deltaVariant="warning"
        />
      </div>

      {/* Content Columns */}
      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard
            title="資料流節奏與穩定度"
            action={<span>Coming Soon</span>}
          >
            <ComingSoonBlock icon="clock" title="即將推出" description="此圖表需要後端 API 支援，開發中。" />
          </PanelCard>

          <PanelCard
            title="關鍵資料管線"
            action={<a href="/accounts" style={{ fontSize: 13, color: "var(--color-accent)" }}>+ 使用帳號管理中心</a>}
          >
            <ComingSoonBlock icon="clock" />
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="異常與通知">
            <ComingSoonBlock icon="lock" />
          </PanelCard>

          <PanelCard title="資料健康度">
            <ComingSoonBlock icon="lock" />
          </PanelCard>
        </div>
      </div>
    </>
  );
}
