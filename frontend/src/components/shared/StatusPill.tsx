import type { ReactNode } from "react";

export type PillVariant = "live" | "success" | "warning" | "error" | "muted";

interface StatusPillProps {
  variant: PillVariant;
  children: ReactNode;
  /** Show animated dot indicator (typically for "live" variant) */
  showDot?: boolean;
}

export function StatusPill({ variant, children, showDot = false }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${variant}`}>
      {showDot ? <span className="status-pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
