import { useCallback } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { MetricCard } from "../shared/MetricCard.js";
import { StatusPill } from "../shared/StatusPill.js";
import { PanelCard } from "../shared/PanelCard.js";
import { PageHeader } from "../layout/PageHeader.js";
import { usePendingUsers } from "../../hooks/usePendingUsers.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function PendingReviewPage() {
  const { user } = useAuth();
  const pendingUsers = usePendingUsers({ enabled: user?.role === "admin" });

  const handleApprove = useCallback(
    (userId: string) => {
      void pendingUsers.approve(userId);
    },
    [pendingUsers],
  );

  const handleReject = useCallback(
    (userId: string) => {
      void pendingUsers.reject(userId);
    },
    [pendingUsers],
  );

  const pendingCount = pendingUsers.users.filter((u) => u.status === "pending").length;
  const activeCount = pendingUsers.users.filter((u) => u.status === "active").length;

  return (
    <>
      <PageHeader
        breadcrumb="ADMIN REVIEW"
        title="待審註冊申請"
        actions={
          <>
            <StatusPill variant="live">admin only</StatusPill>
            <Link
              to="/accounts"
              style={{ fontSize: 13, color: "var(--color-muted)", textDecoration: "none" }}
            >
              跳出清單頁
            </Link>
          </>
        }
      />

      <div className="metric-row metric-row--4">
        <MetricCard
          label="PENDING"
          value={pendingCount}
          delta="待審中"
          deltaVariant="warning"
        />
        <MetricCard
          label="REVIEWABLE"
          value={activeCount}
          delta="已啟用帳號"
          deltaVariant="muted"
        />
        <MetricCard label="APPROVED TODAY" isComingSoon />
        <MetricCard label="ACTIVE MEMBERS" isComingSoon />
      </div>

      <div className="content-columns">
        <div className="content-columns__primary">
          <PanelCard
            title="待審清單"
            action={<span style={{ fontSize: 13 }}>{pendingCount} 件</span>}
          >
            {pendingUsers.isLoading ? (
              <p style={{ color: "var(--color-muted)" }}>載入中...</p>
            ) : pendingUsers.error ? (
              <p style={{ color: "var(--color-error)" }}>{pendingUsers.error}</p>
            ) : pendingUsers.users.filter((u) => u.status === "pending").length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  padding: "40px 0",
                  color: "var(--color-muted)",
                }}
              >
                <CheckCircle width={32} height={32} />
                <p style={{ margin: 0 }}>目前沒有待審申請</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingUsers.users
                  .filter((u) => u.status === "pending")
                  .map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 16,
                        background: "var(--color-panel-alt)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: 18,
                            fontWeight: 600,
                            color: "var(--color-text)",
                            margin: 0,
                          }}
                        >
                          {u.displayName}
                        </p>
                        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0 0" }}>
                          {u.email}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0" }}>
                          申請時間：{new Date(u.createdAt).toLocaleString("zh-TW", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          disabled={pendingUsers.isSubmitting}
                          onClick={() => handleApprove(u.id)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "var(--radius-md)",
                            border: "none",
                            cursor: pendingUsers.isSubmitting ? "not-allowed" : "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                            background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                            color: "var(--color-success)",
                          }}
                        >
                          核准
                        </button>
                        <button
                          type="button"
                          disabled={pendingUsers.isSubmitting}
                          onClick={() => handleReject(u.id)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "var(--radius-md)",
                            border: "none",
                            cursor: pendingUsers.isSubmitting ? "not-allowed" : "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                            background: "color-mix(in srgb, var(--color-error) 15%, transparent)",
                            color: "var(--color-error)",
                          }}
                        >
                          拒絕
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </PanelCard>
        </div>

        <div className="content-columns__secondary">
          <PanelCard title="審核原則">
            <ul
              style={{
                paddingLeft: 20,
                color: "var(--color-muted)",
                lineHeight: 1.9,
                fontSize: 14,
                margin: 0,
              }}
            >
              <li>申請者需為公司內部人員</li>
              <li>核准後帳號立即啟用</li>
              <li>拒絕後申請者無法重新申請同一 email</li>
            </ul>
            <div
              style={{
                marginTop: 16,
                padding: "10px 0",
                borderTop: "1px solid var(--color-border)",
                fontSize: 13,
                color: "var(--color-muted)",
              }}
            >
              最近處理記錄：<span style={{ fontStyle: "italic" }}>即將推出</span>
            </div>
          </PanelCard>
        </div>
      </div>
    </>
  );
}
