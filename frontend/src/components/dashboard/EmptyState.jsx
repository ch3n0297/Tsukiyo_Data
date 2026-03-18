export function EmptyState({ compact = false, message }) {
  return <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>{message}</div>;
}
