import { formatTimestamp } from "../../utils/formatters.js";

export function HeroHeader({ currentUser, isRefreshing, isSigningOut, lastUpdated, onLogout, onRefresh }) {
  return (
    <header className="hero panel">
      <div>
        <p className="eyebrow">營運儀表板</p>
        <h1>社群資料中台儀表板</h1>
        <p className="hero-copy">
          以目前 Node 服務直接提供的唯讀營運儀表板，用於查看系統健康狀態、帳號快照與最新同步結果。
        </p>
      </div>

      <div className="hero-actions">
        {currentUser ? <p className="muted">{`${currentUser.displayName} · ${currentUser.role}`}</p> : null}
        {currentUser ? (
          <>
            <button className="primary-action" disabled={isRefreshing} onClick={onRefresh} type="button">
              {isRefreshing ? "載入中..." : "重新整理"}
            </button>
            <button className="secondary-action" disabled={isSigningOut} onClick={onLogout} type="button">
              {isSigningOut ? "登出中..." : "登出"}
            </button>
          </>
        ) : null}
        <p className="muted">{lastUpdated ? `最後更新：${formatTimestamp(lastUpdated)}` : "尚未載入資料"}</p>
      </div>
    </header>
  );
}
