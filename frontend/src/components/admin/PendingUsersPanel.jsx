import { formatTimestamp } from "../../utils/formatters.js";
import { EmptyState } from "../dashboard/EmptyState.jsx";

export function PendingUsersPanel({
  error,
  isLoading,
  isSubmitting,
  onApprove,
  onReject,
  users,
}) {
  let content = null;

  if (isLoading) {
    content = <EmptyState compact message="待審使用者載入中..." />;
  } else if (users.length === 0) {
    content = <EmptyState compact message="目前沒有待審核的註冊申請。" />;
  } else {
    content = (
      <div className="pending-user-list">
        {users.map((user) => (
          <article className="pending-user-item" key={user.id}>
            <div className="pending-user-item__content">
              <strong>{user.displayName}</strong>
              <p className="muted">{user.email}</p>
              <p className="muted">申請時間：{formatTimestamp(user.createdAt)}</p>
            </div>

            <div className="pending-user-item__actions">
              <button
                className="primary-action"
                disabled={isSubmitting}
                onClick={() => onApprove(user.id)}
                type="button"
              >
                核准
              </button>
              <button
                className="secondary-action"
                disabled={isSubmitting}
                onClick={() => onReject(user.id)}
                type="button"
              >
                拒絕
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">管理員</p>
          <h2>待審註冊申請</h2>
        </div>
        <span className="count-chip">{`${users.length} 筆待審`}</span>
      </div>

      {error ? <section className="banner banner--error">{error}</section> : null}
      {content}
    </section>
  );
}
