import type { ReactNode } from "react";

interface AuthLayoutProps {
  /** Big heading shown on the dark brand panel */
  pageTitle: string;
  /** Description text shown on the dark brand panel */
  pageDescription?: string;
  /** The form card content */
  children: ReactNode;
}

/** Two-column Auth layout.
 * Left: dark brand area — always #0A0A0A regardless of theme.
 * Right: form area — follows current theme.
 */
export function AuthLayout({ pageTitle, pageDescription, children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__brand">
        <div className="auth-layout__brand-top">
          <span className="auth-layout__brand-mark">T</span>
          <span className="auth-layout__brand-text">TSUKIYO</span>
        </div>

        <div className="auth-layout__brand-body">
          <h1 className="auth-layout__brand-title">{pageTitle}</h1>
          {pageDescription ? (
            <p className="auth-layout__brand-desc">{pageDescription}</p>
          ) : null}
        </div>

        {/* spacer to push brand body to vertical center */}
        <div />
      </div>

      <div className="auth-layout__form-area">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
