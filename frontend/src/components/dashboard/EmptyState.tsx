interface EmptyStateProps {
  compact?: boolean;
  message: string;
}

export function EmptyState({ compact = false, message }: EmptyStateProps) {
  return <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>{message}</div>;
}
