import { formatRefreshStatus, formatTimestamp } from "../../utils/formatters";
import type { AccountConfig } from "../../types/api";

interface AccountFieldGridProps {
  account: AccountConfig;
}

export function AccountFieldGrid({ account }: AccountFieldGridProps) {
  const fields: [string, string][] = [
    ["客戶", account.clientName],
    ["平台", account.platform],
    ["帳號", account.accountId],
    ["預設更新天數", `${account.refreshDays} 天`],
    ["排程啟用", account.isActive ? "是" : "否"],
    ["目前狀態", formatRefreshStatus(account.refreshStatus)],
    ["系統訊息", account.systemMessage ?? "—"],
    ["最近請求時間", formatTimestamp(account.lastRequestTime)],
    ["最近成功時間", formatTimestamp(account.lastSuccessTime)],
    ["目前工作 ID", account.currentJobId ?? "—"],
    ["工作表 ID", account.sheetId ?? "—"],
    ["工作表列鍵值", account.sheetRowKey ?? "—"],
  ];

  return (
    <dl className="detail-grid">
      {fields.map(([label, value]) => (
        <div className="detail-field" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
