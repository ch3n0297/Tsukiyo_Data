import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../layout/AuthLayout.js";
import { CTAButton } from "../shared/CTAButton.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function LoginPage() {
  const { login, isSubmitting, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await login({ email, password });
    // After successful login, AuthContext user changes, App route guard redirects to /dashboard
  }

  // Watch for successful login via navigation (user will be set in context)
  // The route guard in App.tsx handles redirect when user becomes non-null.

  return (
    <AuthLayout
      pageTitle="登入資料中台"
      pageDescription="專屬數據中台，為你的決策提供可靠的資料基礎。"
    >
      <div className="auth-card__header">
        <h2 className="auth-card__title">歡迎回來</h2>
        <p className="auth-card__subtitle">使用您的 Email 與密碼登入。</p>
      </div>

      {error ? <div className="form-error" role="alert">{formatLoginError(error)}</div> : null}

      <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-field">
          <label className="form-field__label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="form-field__input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="login-password">密碼</label>
          <div className="form-field__input-wrapper">
            <input
              id="login-password"
              className="form-field__input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="至少 12 個字元"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="form-field__eye-toggle"
              aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff width={16} height={16} /> : <Eye width={16} height={16} />}
            </button>
          </div>
          <p className="form-field__hint">至少 12 個字元</p>
        </div>

        <CTAButton type="submit" fullWidth isLoading={isSubmitting}>
          登入
        </CTAButton>
      </form>

      <div className="auth-links">
        <Link className="auth-links__link" to="/forgot-password">忘記密碼</Link>
        <Link className="auth-links__link" to="/register">訪客申請</Link>
      </div>

      <p className="auth-footnote">如無登入資格，請聯絡系統管理員。</p>
    </AuthLayout>
  );
}

function formatLoginError(error: string): string {
  if (error.includes("401") || error.toLowerCase().includes("invalid") || error.toLowerCase().includes("incorrect")) {
    return "帳號或密碼錯誤。";
  }
  if (error.includes("403") && error.toLowerCase().includes("pending")) {
    return "帳號審核中，請聯絡管理員。";
  }
  if (error.includes("403")) {
    return error;
  }
  return error;
}
