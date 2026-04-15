import { ComingSoonBlock } from "../shared/ComingSoonBlock.js";
import { MetricCard } from "../shared/MetricCard.js";
import { PanelCard } from "../shared/PanelCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { SecondaryButton } from "../shared/SecondaryButton.js";
import { PageHeader } from "../layout/PageHeader.js";

export function UsersPage() {
  return (
    <>
      <PageHeader
        title="使用者管理"
        actions={
          <>
            <StatusPill variant="live">admin only</StatusPill>
            <SecondaryButton disabled title="功能開發中">設定欄位</SecondaryButton>
          </>
        }
      />

      <div className="metric-row metric-row--4">
        <MetricCard label="TOTAL USERS" isComingSoon />
        <MetricCard label="ADMINS" isComingSoon />
        <MetricCard label="MEMBERS" isComingSoon />
        <MetricCard label="PENDING" isComingSoon />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard title="使用者清單">
            <ComingSoonBlock icon="lock" />
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="角色與權限">
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <p
                style={{
                  fontWeight: 600,
                  color: "var(--color-text)",
                  margin: "0 0 6px",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Admin
              </p>
              <ul
                style={{
                  paddingLeft: 20,
                  color: "var(--color-muted)",
                  margin: "0 0 16px",
                }}
              >
                <li>可存取所有 Dashboard 畫面</li>
                <li>可審核 pending 使用者</li>
                <li>可管理使用者角色</li>
                <li>可存取系統設定</li>
              </ul>
              <p
                style={{
                  fontWeight: 600,
                  color: "var(--color-text)",
                  margin: "0 0 6px",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Member
              </p>
              <ul style={{ paddingLeft: 20, color: "var(--color-muted)", margin: 0 }}>
                <li>可存取 Dashboard、帳號列表、同步任務</li>
                <li>不可存取管理員畫面</li>
              </ul>
            </div>
          </PanelCard>
        </div>
      </div>
    </>
  );
}
