import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import { ResetPasswordPage } from "./ResetPasswordPage";

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    authView: { mode: "reset", resetToken: "" },
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

function renderReset(auth: Partial<AuthContextValue> = {}, initialPath = "/reset-password") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={makeAuth(auth)}>
        <ResetPasswordPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  test("shows error when no reset token is present in authView", () => {
    renderReset({ authView: { mode: "reset", resetToken: "" } });
    expect(screen.getByText(/重設連結無效或已過期/)).toBeInTheDocument();
    // Password form should not be shown
    expect(screen.queryByLabelText("新密碼")).not.toBeInTheDocument();
  });

  test("shows password form when token exists in authView", () => {
    renderReset({ authView: { mode: "reset", resetToken: "valid-token-abc" } });
    expect(screen.getByRole("heading", { name: "重設密碼" })).toBeInTheDocument();
    expect(screen.getByLabelText("新密碼")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重設密碼" })).toBeInTheDocument();
  });

  test("calls resetPassword() with password on submit", async () => {
    const resetPassword = vi.fn();
    renderReset({
      authView: { mode: "reset", resetToken: "valid-token-abc" },
      resetPassword,
    });

    fireEvent.change(screen.getByLabelText("新密碼"), {
      target: { value: "newpassword123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "重設密碼" }).closest("form")!);

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({ password: "newpassword123" });
    });
  });

  test("shows loading state while submitting", () => {
    renderReset({ authView: { mode: "reset", resetToken: "abc" }, isSubmitting: true });
    expect(screen.getByRole("button", { name: "載入中..." })).toBeDisabled();
  });

  test("shows error message for invalid/expired token (400 error)", () => {
    renderReset({
      authView: { mode: "reset", resetToken: "expired-token" },
      error: "400: reset link expired",
    });
    expect(screen.getByText(/重設連結無效或已過期/)).toBeInTheDocument();
  });

  test("has links to login and register", () => {
    renderReset({ authView: { mode: "reset", resetToken: "" } });
    expect(screen.getByRole("link", { name: "返回登入" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "訪客申請" })).toHaveAttribute("href", "/register");
  });

  test("brand title shows 設定新密碼", () => {
    renderReset({ authView: { mode: "reset", resetToken: "" } });
    expect(screen.getByText("設定新密碼")).toBeInTheDocument();
  });

  test("password field toggles visibility", () => {
    renderReset({ authView: { mode: "reset", resetToken: "abc" } });
    const input = screen.getByLabelText("新密碼");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "顯示密碼" }));
    expect(input).toHaveAttribute("type", "text");
  });
});
