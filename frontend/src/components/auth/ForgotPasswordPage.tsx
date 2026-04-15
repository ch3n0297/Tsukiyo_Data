import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../layout/AuthLayout.js";
import { CTAButton } from "../shared/CTAButton.js";
import { useAuth } from "../../contexts/AuthContext.js";

export function ForgotPasswordPage() {
  const { forgotPassword, isSubmitting, error } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await forgotPassword({ email });
    // Per spec: always show the same message regardless of outcome
    setSent(true);
  }

  return (
    <AuthLayout
      pageTitle="忘記密碼"
      pageDescription="輸入 Email，我們會寄出重設連結。"
    >
      <div className="auth-card__header">
        <h2 className="auth-card__title">送出重設指示</h2>
        <p className="auth-card__subtitle">輸入 Email 即可收到重設連結。</p>
      </div>

      {error && !sent ? <div className="form-error" role="alert">網路錯誤，請稍後再試。</div> : null}

      {sent ? (
        <div className="form-success" role="status">
          若此 Email 已註冊，重設連結已寄出。
        </div>
      ) : (
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              className="form-field__input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <CTAButton type="submit" fullWidth isLoading={isSubmitting}>
            送出
          </CTAButton>
        </form>
      )}

      <div className="auth-links">
        <Link className="auth-links__link" to="/login">返回登入</Link>
        <Link className="auth-links__link" to="/register">訪客申請</Link>
      </div>

      <p className="auth-footnote">如果沒有收到信件，請確認是否為正確的帳號。</p>
    </AuthLayout>
  );
}
