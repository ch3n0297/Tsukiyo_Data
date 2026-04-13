import type { UiCapabilities } from "../../types/api";

const DEFAULT_REASON =
  "儀表板目前僅提供唯讀檢視；手動刷新與排程同步仍需透過簽章保護的伺服器 API 進行。";

interface SecurityBannerProps {
  capabilities: UiCapabilities | null;
}

export function SecurityBanner({ capabilities }: SecurityBannerProps) {
  return (
    <section className="panel banner banner--warning">
      <strong>安全邊界：</strong>
      {capabilities?.reason ?? DEFAULT_REASON}
    </section>
  );
}
