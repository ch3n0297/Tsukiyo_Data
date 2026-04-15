import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../layout/AuthLayout.js";
import { CTAButton } from "../shared/CTAButton.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function ResetPasswordPage() {
  const { resetPassword, isSubmitting, error, authView } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  // If no token in URL, show error state
  const hasToken = Boolean(authView.resetToken);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await resetPassword({ password });
    setDone(true);
    void navigate("/login");
  }

  return (
    <AuthLayout
      pageTitle="設定新密碼"
      pageDescription="完成設定後，憑新密碼即可登入系統。"
    >
      <div className="auth-card__header">
        <h2 className="auth-card__title">重設密碼</h2>
        <p className="auth-card__subtitle">請輸入新密碼。</p>
      </div>

      {!hasToken ? (
        <div className="form-error" role="alert">
          重設連結無效或已過期，請重新申請。{" "}
          <Link className="auth-links__link" to="/forgot-password">重新申請</Link>
        </div>
      ) : null}

      {error ? <div className="form-error" role="alert">{error.includes("400") ? "重設連結無效或已過期，請重新申請。" : error}</div> : null}

      {hasToken && !done ? (
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="reset-password">新密碼</label>
            <div className="form-field__input-wrapper">
              <input
                id="reset-password"
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
            重設密碼
          </CTAButton>
        </form>
      ) : null}

      <div className="auth-links">
        <Link className="auth-links__link" to="/login">返回登入</Link>
        <Link className="auth-links__link" to="/register">訪客申請</Link>
      </div>

      <p className="auth-footnote">重設連結只能使用一次。</p>
    </AuthLayout>
  );
}
