interface PageErrorBannerProps {
  message: string | undefined | null;
}

export function PageErrorBanner({ message }: PageErrorBannerProps) {
  if (!message) {
    return null;
  }

  return <section className="panel banner banner--error">資料載入失敗：{message}</section>;
}
