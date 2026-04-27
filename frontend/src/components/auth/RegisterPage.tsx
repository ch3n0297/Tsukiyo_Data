import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../layout/AuthLayout.js";
import { CTAButton } from "../shared/CTAButton.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function RegisterPage() {
  const { register, isSubmitting, error, message } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await register({ display_name: displayName, email, password });
  }

  return (
    <AuthLayout
      pageTitle="申請內部帳號"
      pageDescription="送出申請後，需通過管理員審核才能登入。"
    >
      <div className="auth-card__header">
        <h2 className="auth-card__title">建立帳號</h2>
        <p className="auth-card__subtitle">填寫基本資料後送出申請。</p>
      </div>

      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {message ? (
        <div className="form-success" role="status">
          {message}
          <br />
          <Link className="auth-links__link" to="/login" style={{ display: "inline-block", marginTop: 8 }}>返回登入</Link>
        </div>
      ) : null}

      {!message ? (
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="reg-name">顯示名稱</label>
            <input
              id="reg-name"
              className="form-field__input"
              type="text"
              autoComplete="name"
              placeholder="例如：王小明"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
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
            <label className="form-field__label" htmlFor="reg-password">密碼</label>
            <div className="form-field__input-wrapper">
              <input
                id="reg-password"
                className="form-field__input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
            送出申請
          </CTAButton>
        </form>
      ) : null}

      <div className="auth-links">
        <Link className="auth-links__link" to="/login">返回登入</Link>
        <Link className="auth-links__link" to="/forgot-password">忘記密碼</Link>
      </div>
    </AuthLayout>
  );
}
