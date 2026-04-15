import type { ReactNode } from "react";

interface PanelCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Extra class names on the panel container */
  className?: string;
}

export function PanelCard({ title, action, children, className }: PanelCardProps) {
  const classNames = ["panel-card", className].filter(Boolean).join(" ");
  return (
    <div className={classNames}>
      {title || action ? (
        <div className="panel-card__header">
          {title ? <p className="panel-card__title">{title}</p> : null}
          {action ? <div className="panel-card__action">{action}</div> : null}
        </div>
      ) : null}
      <div className="panel-card__content">{children}</div>
    </div>
  );
}
