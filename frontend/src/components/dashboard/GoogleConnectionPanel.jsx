import { formatTimestamp } from "../../utils/formatters.js";

function getStatusLabel(status) {
  if (status === "active") {
    return "已連線";
  }

  if (status === "reauthorization_required") {
    return "需要重新授權";
  }

  if (status === "revoked") {
    return "已解除";
  }

  if (status === "disabled") {
    return "系統未啟用";
  }

  return "尚未連線";
}

export function GoogleConnectionPanel({
  account,
  currentUser,
  isSubmitting,
  message,
  onConnect,
  onDisconnect,
}) {
  const connection = account?.googleConnection ?? null;
  const canManage = currentUser?.role === "admin" && account?.id;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Google Sheets</p>
          <h2>授權連線</h2>
        </div>
        <span className="count-chip">{getStatusLabel(connection?.status)}</span>
      </div>

      <dl className="detail-grid">
        <div className="detail-field">
          <dt>授權狀態</dt>
          <dd>{getStatusLabel(connection?.status)}</dd>
        </div>
        <div className="detail-field">
          <dt>授權帳號</dt>
          <dd>{connection?.authorizedEmail ?? "—"}</dd>
        </div>
        <div className="detail-field">
          <dt>Spreadsheet ID</dt>
          <dd>{connection?.allowedSpreadsheetId ?? account?.allowedSpreadsheetId ?? "—"}</dd>
        </div>
        <div className="detail-field">
          <dt>建立時間</dt>
          <dd>{formatTimestamp(connection?.connectedAt)}</dd>
        </div>
        <div className="detail-field">
          <dt>最近刷新 token</dt>
          <dd>{formatTimestamp(connection?.lastRefreshedAt)}</dd>
        </div>
        <div className="detail-field">
          <dt>最近錯誤代碼</dt>
          <dd>{connection?.lastErrorCode ?? "—"}</dd>
        </div>
      </dl>

      <p className="muted">
        每個帳號設定只能綁定一份獨立 Spreadsheet。系統只會對該份 Spreadsheet 執行同步，不會跨檔案寫入。
      </p>
      {message ? <section className="banner banner--success">{message}</section> : null}

      {canManage ? (
        <div className="inline-actions">
          <button
            className="primary-action"
            disabled={isSubmitting}
            onClick={() => onConnect(account.id)}
            type="button"
          >
            {connection?.status === "active" ? "重新授權 Google" : "連線 Google"}
          </button>
          {connection?.status === "active" || connection?.status === "reauthorization_required" ? (
            <button
              className="secondary-action"
              disabled={isSubmitting}
              onClick={() => onDisconnect(account.id)}
              type="button"
            >
              解除連線
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
