import type { ReactNode } from "react";

interface DataTableRowProps {
  variant?: "active" | "normal";
  children: ReactNode;
  onClick?: () => void;
}

export function DataTableRow({
  variant = "normal",
  children,
  onClick,
}: DataTableRowProps) {
  return (
    <div
      className={`table-row table-row--${variant}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      {children}
    </div>
  );
}
