export const POLL_INTERVAL_MS = 15_000;

const STATUS_LABELS: Record<string, string> = {
  idle: "待命",
  queued: "待處理",
  running: "執行中",
  success: "成功",
  error: "失敗",
};

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDuration(ms: number | undefined | null): string {
  if (!Number.isFinite(ms) || (ms as number) <= 0) {
    return "未啟用";
  }

  const n = ms as number;

  if (n < 1000) {
    return `${n} 毫秒`;
  }

  const seconds = Math.round(n / 1000);

  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes} 分鐘`;
}

export function formatServiceStatus(status: string | null | undefined): string {
  if (status === "ok") {
    return "正常";
  }

  if (!status) {
    return "未知";
  }

  return status;
}

export function formatRefreshStatus(status: string | null | undefined): string {
  if (!status) {
    return "未知";
  }

  return STATUS_LABELS[status] ?? status;
}
