import type { ReactNode } from "react";

interface PageHeaderProps {
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__left">
        {breadcrumb ? (
          <p className="page-header__breadcrumb">{breadcrumb}</p>
        ) : null}
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? (
          <p className="page-header__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="page-header__actions">{actions}</div>
      ) : null}
    </header>
  );
}
