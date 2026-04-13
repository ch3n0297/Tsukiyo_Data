import {
  formatDuration,
  formatServiceStatus,
  formatTimestamp,
} from "../../utils/formatters";
import type { HealthResponse } from "../../types/api";

interface HealthCardGridProps {
  health: HealthResponse | null;
}

export function HealthCardGrid({ health }: HealthCardGridProps) {
  const cards = [
    {
      label: "服務狀態",
      tone: health?.status === "ok" ? "success" : "error",
      value: health ? formatServiceStatus(health.status) : "無法使用",
    },
    {
      label: "工作佇列",
      tone: "neutral",
      value: health ? `${health.queue.running} 執行中 / ${health.queue.pending} 等待中` : "—",
    },
    {
      label: "佇列並行上限",
      tone: "neutral",
      value: health ? String(health.queue.concurrency) : "—",
    },
    {
      label: "排程器",
      tone: health?.scheduler?.running ? "success" : "neutral",
      value: health ? (health.scheduler.running ? "運作中" : "已停止") : "—",
    },
    {
      label: "排程週期",
      tone: "neutral",
      value: health ? formatDuration(health.scheduler.intervalMs) : "—",
    },
    {
      label: "Tick 狀態",
      tone: health?.scheduler?.tickInProgress ? "warning" : "neutral",
      value: health ? (health.scheduler.tickInProgress ? "執行中" : "待命") : "—",
    },
    {
      label: "伺服器時間",
      tone: "neutral",
      value: health ? formatTimestamp(health.now) : "—",
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">系統總覽</p>
          <h2>服務狀態與主要系統資訊</h2>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <article className={`stat-card stat-card--${card.tone}`} key={card.label}>
            <p className="stat-card__label">{card.label}</p>
            <p className="stat-card__value">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
