import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { MetricCard } from "../shared/MetricCard.js";
import { PanelCard } from "../shared/PanelCard.js";
import { CTAButton } from "../shared/CTAButton.js";
import { PageHeader } from "../layout/PageHeader.js";

export function TokensSettingsPage() {
  return (
    <>
      <PageHeader
        title="帳號接入與權杖管理"
        subtitle="集中查看 Instagram / Meta 帳號接入、到期風險與重授權狀態。"
        actions={
          <>
            <span
              style={{
                fontSize: 12,
                padding: "6px 12px",
                background: "var(--color-panel-alt)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-muted)",
              }}
            >
              Meta / Instagram
            </span>
            <CTAButton disabled title="功能開發中">新增接入</CTAButton>
          </>
        }
      />

      <div className="metric-row metric-row--3">
        <MetricCard label="CONNECTED" isComingSoon />
        <MetricCard label="EXPIRING SOON" isComingSoon />
        <MetricCard label="SCOPE ISSUES" isComingSoon />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard title="權杖狀態表">
            <ComingSoonBlock icon="lock" />
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="待處理事項">
            <ComingSoonBlock icon="lock" />
          </PanelCard>

          <PanelCard title="接入要求">
            <ComingSoonBlock icon="lock" />
          </PanelCard>
        </div>
      </div>
    </>
  );
}
