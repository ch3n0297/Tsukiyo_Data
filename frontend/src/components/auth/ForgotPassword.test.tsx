import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    authView: { mode: "forgot", resetToken: "" },
    error: "",
    forgotPassword: vi.fn(),
    isLoading: false,
    isSubmitting: false,
    login: vi.fn(),
    logout: vi.fn(),
    message: "",
    refreshSession: vi.fn(),
    register: vi.fn(),
    resetPassword: vi.fn(),
    switchMode: vi.fn(),
    user: null,
    ...overrides,
  } as AuthContextValue;
}

function renderForgot(auth: Partial<AuthContextValue> = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuth(auth)}>
        <ForgotPasswordPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("ForgotPasswordPage", () => {
  test("renders brand title and email form", () => {
    renderForgot();
    expect(screen.getByText("忘記密碼")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "送出重設指示" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "送出" })).toBeInTheDocument();
  });

  test("has links to login and register", () => {
    renderForgot();
    expect(screen.getByRole("link", { name: "返回登入" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "訪客申請" })).toHaveAttribute("href", "/register");
  });

  test("calls forgotPassword() with email on submit", async () => {
    const forgotPassword = vi.fn();
    renderForgot({ forgotPassword });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "送出" }).closest("form")!);

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith({ email: "user@example.com" });
    });
  });

  test("shows fixed success message after submit regardless of result", async () => {
    const forgotPassword = vi.fn().mockResolvedValue(undefined);
    renderForgot({ forgotPassword });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "any@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "送出" }).closest("form")!);

    // After submit, the fixed message must be shown (spec: always same message)
    await waitFor(() => {
      expect(screen.getByText("若此 Email 已註冊，重設連結已寄出。")).toBeInTheDocument();
    });
  });

  test("shows loading state while submitting", () => {
    renderForgot({ isSubmitting: true });
    expect(screen.getByRole("button", { name: "載入中..." })).toBeDisabled();
  });
});
