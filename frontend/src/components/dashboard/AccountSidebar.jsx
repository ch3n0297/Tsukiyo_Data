import { AccountListItem } from "./AccountListItem.jsx";
import { EmptyState } from "./EmptyState.jsx";

function buildSummary(accounts) {
  if (accounts.length === 0) {
    return "目前沒有帳號資料。";
  }

  const activeCount = accounts.filter((account) => account.isActive).length;
  const successCount = accounts.filter((account) => account.refreshStatus === "success").length;
  const errorCount = accounts.filter((account) => account.refreshStatus === "error").length;

  return `${activeCount} 個啟用中 · ${successCount} 個成功 · ${errorCount} 個失敗`;
}

export function AccountSidebar({
  accounts,
  allAccountCount,
  onSelectAccount,
  onSelectPlatform,
  platformOptions,
  selectedAccountKey,
  selectedPlatform,
}) {
  return (
    <aside className="panel sidebar-panel">
      <div className="panel-header panel-header--stacked">
        <div>
          <p className="eyebrow">帳號總覽</p>
          <h2>帳號列表</h2>
        </div>
        <span className="count-chip">
          {selectedPlatform === "all"
            ? `${allAccountCount} 個帳號`
            : `${accounts.length} / ${allAccountCount} 個帳號`}
        </span>
      </div>

      <p className="muted">{buildSummary(accounts)}</p>

      <div className="sidebar-section">
        <p className="sidebar-section__title">平台篩選</p>
        <div className="platform-filter-list" role="tablist" aria-label="平台篩選">
          <button
            className={`platform-filter${selectedPlatform === "all" ? " platform-filter--selected" : ""}`}
            onClick={() => onSelectPlatform("all")}
            type="button"
          >
            全部平台
          </button>
          {platformOptions.map((platform) => (
            <button
              className={`platform-filter${selectedPlatform === platform ? " platform-filter--selected" : ""}`}
              key={platform}
              onClick={() => onSelectPlatform(platform)}
              type="button"
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="account-list">
        {accounts.length === 0 ? (
          <EmptyState compact message="目前篩選條件下沒有帳號。" />
        ) : (
          accounts.map((account) => (
            <AccountListItem
              account={account}
              isSelected={account.accountKey === selectedAccountKey}
              key={account.accountKey}
              onSelect={onSelectAccount}
            />
          ))
        )}
      </div>
    </aside>
  );
}
