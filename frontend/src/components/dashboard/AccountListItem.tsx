import { formatRefreshStatus, formatTimestamp } from "../../utils/formatters";
import type { AccountConfig } from "../../types/api";

interface AccountListItemProps {
  account: AccountConfig;
  isSelected: boolean;
  onSelect: (accountKey: string) => void;
}

export function AccountListItem({ account, isSelected, onSelect }: AccountListItemProps) {
  const latestOutputMessage = account.latestOutput
    ? `最新快照 ${formatTimestamp(account.latestOutput.syncedAt)} · ${account.latestOutput.rowCount} 筆資料`
    : `尚無輸出快照 · 最近成功 ${formatTimestamp(account.lastSuccessTime)}`;

  return (
    <button
      className={`account-item${isSelected ? " account-item--selected" : ""}`}
      onClick={() => onSelect(account.accountKey)}
      type="button"
    >
      <div className="account-item__top">
        <strong>{`${account.clientName} · ${account.platform}`}</strong>
        <span className={`status-pill status-pill--${account.refreshStatus}`}>
          {formatRefreshStatus(account.refreshStatus)}
        </span>
      </div>

      <p className="account-item__meta">{`${account.accountId} · 更新天數 ${account.refreshDays} 天`}</p>
      <p className="account-item__meta muted">{latestOutputMessage}</p>
      <p className="account-item__message">{account.systemMessage ?? "—"}</p>
    </button>
  );
}
