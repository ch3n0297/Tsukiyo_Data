import { AccountFieldGrid } from "./AccountFieldGrid.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { GoogleConnectionPanel } from "./GoogleConnectionPanel.jsx";
import { LatestOutputTable } from "./LatestOutputTable.jsx";

function getTitle(selectedAccount, selectedAccountSummary) {
  const account = selectedAccount ?? selectedAccountSummary;

  if (!account) {
    return "帳號詳情";
  }

  return `${account.clientName} · ${account.platform} · ${account.accountId}`;
}

export function AccountDetailPanel({
  accounts,
  connectionMessage,
  currentUser,
  isLoading,
  isSubmittingConnection,
  onBackToOverview,
  onConnectGoogle,
  onDisconnectGoogle,
  selectedAccount,
  selectedAccountSummary,
}) {
  let content = null;

  if (accounts.length === 0) {
    content = <EmptyState message="目前沒有可顯示的帳號，請先確認資料設定或稍後重新整理。" />;
  } else if (isLoading && !selectedAccount) {
    content = <EmptyState message="帳號詳情載入中..." />;
  } else if (!selectedAccount) {
    content = <EmptyState message="無法載入所選帳號詳情，請稍後重新整理。" />;
  } else {
    content = (
      <>
        <AccountFieldGrid account={selectedAccount} />
        <GoogleConnectionPanel
          account={selectedAccount}
          currentUser={currentUser}
          isSubmitting={isSubmittingConnection}
          message={connectionMessage}
          onConnect={onConnectGoogle}
          onDisconnect={onDisconnectGoogle}
        />
        <LatestOutputTable latestOutput={selectedAccount.latestOutput} />
      </>
    );
  }

  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">選取帳號</p>
          <h2>{getTitle(selectedAccount, selectedAccountSummary)}</h2>
        </div>
        <button className="secondary-action" onClick={onBackToOverview} type="button">
          返回內容總覽
        </button>
      </div>

      {content}
    </section>
  );
}
