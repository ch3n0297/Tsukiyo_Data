interface MetricCardProps {
  label: string;
  value?: string | number;
  delta?: string;
  deltaVariant?: "success" | "warning" | "muted";
  /** When true, shows "—" as value and omits delta */
  isComingSoon?: boolean;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaVariant = "muted",
  isComingSoon = false,
}: MetricCardProps) {
  const displayValue = isComingSoon ? "—" : value ?? "—";

  return (
    <div className="metric-card">
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value">{displayValue}</p>
      {!isComingSoon && delta ? (
        <p className={`metric-card__delta metric-card__delta--${deltaVariant}`}>
          {delta}
        </p>
      ) : null}
    </div>
  );
}
