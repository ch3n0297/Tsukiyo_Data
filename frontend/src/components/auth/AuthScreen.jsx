import { useEffect, useState } from "react";

function PrimaryButton({ children, disabled, type = "submit", onClick }) {
  return (
    <button className="primary-action" disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8, verticalAlign: "middle" }}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthScreen({
  authView,
  error,
  isSubmitting,
  login,
  loginWithGoogle,
  message,
  switchMode,
}) {
  const [showAdminLogin, setShowAdminLogin] = useState(authView.mode === "admin-password");
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    setForm({ email: "", password: "" });
  }, [showAdminLogin]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    await login({ email: form.email, password: form.password });
  };

  return (
    <section className="auth-layout">
      <section className="panel auth-panel">
        <div className="panel-header panel-header--stacked">
          <div>
            <p className="eyebrow">身份驗證</p>
            <h2>{showAdminLogin ? "管理員密碼登入" : "登入"}</h2>
          </div>
          <p className="muted">
            {showAdminLogin
              ? "以管理員 Email 與密碼登入系統。"
              : "使用 Google 帳號登入即可查看受保護的社群資料中台儀表板。"}
          </p>
        </div>

        {message ? <section className="banner banner--success">{message}</section> : null}
        {error ? <section className="banner banner--error">{error}</section> : null}

        {showAdminLogin ? (
          <form className="auth-form" onSubmit={(event) => void handleAdminLogin(event)}>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={handleChange}
                placeholder="admin@example.com"
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="field">
              <span>密碼</span>
              <input
                autoComplete="current-password"
                name="password"
                onChange={handleChange}
                placeholder="至少 12 個字元"
                required
                type="password"
                value={form.password}
              />
            </label>

            <PrimaryButton disabled={isSubmitting}>
              {isSubmitting ? "處理中..." : "登入"}
            </PrimaryButton>
          </form>
        ) : (
          <div className="auth-form">
            <PrimaryButton
              disabled={isSubmitting}
              onClick={() => void loginWithGoogle()}
              type="button"
            >
              <GoogleIcon />
              {isSubmitting ? "正在跳轉至 Google..." : "以 Google 帳號登入"}
            </PrimaryButton>
          </div>
        )}

        <div className="auth-links">
          {showAdminLogin ? (
            <button
              className="text-action"
              onClick={() => setShowAdminLogin(false)}
              type="button"
            >
              返回 Google 登入
            </button>
          ) : (
            <button
              className="text-action"
              onClick={() => setShowAdminLogin(true)}
              type="button"
            >
              管理員密碼登入
            </button>
          )}
        </div>
      </section>

      <section className="panel auth-panel auth-panel--secondary">
        <div className="panel-header panel-header--stacked">
          <div>
            <p className="eyebrow">登入說明</p>
            <h2>系統認證方式</h2>
          </div>
        </div>

        <ul className="auth-notes">
          <li>本系統使用 Google 帳號登入，首次登入將自動建立帳號。</li>
          <li>登入後以 HttpOnly Cookie 維持 session，無需額外管理密碼。</li>
          <li>管理員可使用 Email/密碼作為備援登入方式。</li>
          <li>Google Sheet 與 Apps Script 的既有簽章流程不受影響。</li>
        </ul>
      </section>
    </section>
  );
}
