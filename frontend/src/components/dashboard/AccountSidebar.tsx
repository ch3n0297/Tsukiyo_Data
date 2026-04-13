import { AccountListItem } from "./AccountListItem";
import { EmptyState } from "./EmptyState";
import type { AccountConfig } from "../../types/api";

interface AccountSidebarProps {
  accounts: AccountConfig[];
  onSelect: (accountKey: string) => void;
  selectedAccountKey: string | null;
}

function buildSummary(accounts: AccountConfig[]): string {
  if (accounts.length === 0) {
    return "目前沒有帳號資料。";
  }

  const activeCount = accounts.filter((account) => account.isActive).length;
  const successCount = accounts.filter((account) => account.refreshStatus === "success").length;
  const errorCount = accounts.filter((account) => account.refreshStatus === "error").length;

  return `${activeCount} 個啟用中 · ${successCount} 個成功 · ${errorCount} 個失敗`;
}

export function AccountSidebar({ accounts, onSelect, selectedAccountKey }: AccountSidebarProps) {
  return (
    <aside className="panel">
      <div className="panel-header panel-header--stacked">
        <div>
          <p className="eyebrow">帳號總覽</p>
          <h2>帳號列表</h2>
        </div>
        <span className="count-chip">{`${accounts.length} 個帳號`}</span>
      </div>

      <p className="muted">{buildSummary(accounts)}</p>

      <div aria-live="polite" className="account-list">
        {accounts.length === 0 ? (
          <EmptyState compact message="尚未找到帳號設定。" />
        ) : (
          accounts.map((account) => (
            <AccountListItem
              account={account}
              isSelected={account.accountKey === selectedAccountKey}
              key={account.accountKey}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}
