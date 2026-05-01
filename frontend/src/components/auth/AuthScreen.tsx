import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthView {
  mode: AuthMode;
  resetToken: string;
}

interface FormState {
  displayName?: string;
  email?: string;
  password?: string;
}

function buildInitialState(mode: AuthMode): FormState {
  if (mode === "register") {
    return {
      displayName: "",
      email: "",
      password: "",
    };
  }

  return {
    email: "",
    password: "",
  };
}

function getTitle(mode: AuthMode): string {
  if (mode === "register") {
    return "建立帳號";
  }

  if (mode === "forgot") {
    return "忘記密碼";
  }

  if (mode === "reset") {
    return "重設密碼";
  }

  return "登入";
}

function getDescription(mode: AuthMode): string {
  if (mode === "register") {
    return "送出註冊申請後，需等待管理員核准才能登入查看儀表板。";
  }

  if (mode === "forgot") {
    return "輸入 email 後，系統會寄出 Supabase 密碼重設指示。";
  }

  if (mode === "reset") {
    return "請輸入新的密碼完成重設，完成後需重新登入。";
  }

  return "登入後即可查看受保護的社群資料中台儀表板。";
}

interface PrimaryButtonProps {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button" | "reset";
}

function PrimaryButton({ children, disabled, type = "submit" }: PrimaryButtonProps) {
  return (
    <button className="primary-action" disabled={disabled} type={type}>
      {children}
    </button>
  );
}

interface AuthScreenProps {
  authView: AuthView;
  error: string;
  isSubmitting: boolean;
  login: (payload: unknown) => Promise<void>;
  message: string;
  register: (payload: unknown) => Promise<void>;
  requestPasswordReset: (payload: unknown) => Promise<void>;
  resetPassword: (payload: { password: string }) => Promise<void>;
  switchMode: (mode: AuthMode) => void;
}

export function AuthScreen({
  authView,
  error,
  isSubmitting,
  login,
  message,
  register,
  requestPasswordReset,
  resetPassword,
  switchMode,
}: AuthScreenProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(authView.mode));

  useEffect(() => {
    setForm(buildInitialState(authView.mode));
  }, [authView.mode]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authView.mode === "register") {
      await register({
        display_name: form.displayName,
        email: form.email,
        password: form.password,
      });
      return;
    }

    if (authView.mode === "forgot") {
      await requestPasswordReset({
        email: form.email,
      });
      return;
    }

    if (authView.mode === "reset") {
      await resetPassword({
        password: form.password ?? "",
      });
      return;
    }

    await login({
      email: form.email,
      password: form.password,
    });
  };

  return (
    <section className="auth-layout">
      <section className="panel auth-panel">
        <div className="panel-header panel-header--stacked">
          <div>
            <p className="eyebrow">身份驗證</p>
            <h2>{getTitle(authView.mode)}</h2>
          </div>
          <p className="muted">{getDescription(authView.mode)}</p>
        </div>

        {message ? <section className="banner banner--success">{message}</section> : null}
        {error ? <section className="banner banner--error">{error}</section> : null}

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          {authView.mode === "register" ? (
            <label className="field">
              <span>顯示名稱</span>
              <input
                autoComplete="name"
                name="displayName"
                onChange={handleChange}
                placeholder="例如：王小明"
                required
                value={form.displayName ?? ""}
              />
            </label>
          ) : null}

          {authView.mode !== "reset" ? (
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={handleChange}
                placeholder="you@example.com"
                required
                type="email"
                value={form.email ?? ""}
              />
            </label>
          ) : null}

          <label className="field">
            <span>{authView.mode === "reset" ? "新密碼" : "密碼"}</span>
            <input
              autoComplete={authView.mode === "reset" ? "new-password" : "current-password"}
              name="password"
              onChange={handleChange}
              placeholder="至少 12 個字元"
              required={authView.mode !== "forgot"}
              type="password"
              value={form.password ?? ""}
            />
          </label>

          <PrimaryButton disabled={isSubmitting}>
            {isSubmitting ? "處理中..." : authView.mode === "register"
              ? "送出註冊申請"
              : authView.mode === "forgot"
                ? "送出重設指示"
                : authView.mode === "reset"
                  ? "重設密碼"
                  : "登入"}
          </PrimaryButton>
        </form>

        <div className="auth-links">
          {authView.mode !== "login" ? (
            <button className="text-action" onClick={() => switchMode("login")} type="button">
              返回登入
            </button>
          ) : null}
          {authView.mode !== "register" ? (
            <button className="text-action" onClick={() => switchMode("register")} type="button">
              註冊新帳號
            </button>
          ) : null}
          {authView.mode !== "forgot" && authView.mode !== "reset" ? (
            <button className="text-action" onClick={() => switchMode("forgot")} type="button">
              忘記密碼
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel auth-panel auth-panel--secondary">
        <div className="panel-header panel-header--stacked">
          <div>
            <p className="eyebrow">首版規則</p>
            <h2>登入系統說明</h2>
          </div>
        </div>

        <ul className="auth-notes">
          <li>本系統採 Supabase Auth 管理登入與 session。</li>
          <li>新帳號註冊後會先進入待審狀態，需由管理員核准後才可登入。</li>
          <li>忘記密碼流程使用 Supabase Auth 重設郵件。</li>
          <li>Google Sheet 與 Apps Script 的既有簽章流程不受這套登入系統影響。</li>
        </ul>
      </section>
    </section>
  );
}
