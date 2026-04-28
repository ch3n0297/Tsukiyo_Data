import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import { RegisterPage } from "./RegisterPage";

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    authView: { mode: "register", resetToken: "" },
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

function renderRegister(auth: Partial<AuthContextValue> = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuth(auth)}>
        <RegisterPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  test("renders brand title and three form fields", () => {
    renderRegister();
    expect(screen.getByText("申請內部帳號")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "建立帳號" })).toBeInTheDocument();
    expect(screen.getByLabelText("顯示名稱")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("密碼")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "送出申請" })).toBeInTheDocument();
  });

  test("has links to login and forgot-password", () => {
    renderRegister();
    expect(screen.getByRole("link", { name: "返回登入" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "忘記密碼" })).toHaveAttribute("href", "/forgot-password");
  });

  test("calls register() with displayName, email, password on submit", async () => {
    const register = vi.fn();
    renderRegister({ register });

    fireEvent.change(screen.getByLabelText("顯示名稱"), { target: { value: "王小明" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "password12345" } });
    fireEvent.submit(screen.getByRole("button", { name: "送出申請" }).closest("form")!);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        display_name: "王小明",
        email: "user@example.com",
        password: "password12345",
      });
    });
  });

  test("shows loading state while submitting", () => {
    renderRegister({ isSubmitting: true });
    expect(screen.getByRole("button", { name: "載入中..." })).toBeDisabled();
  });

  test("shows success message and hides form when message is set", () => {
    renderRegister({ message: "申請已送出，請等待管理員審核。" });
    expect(screen.getByText("申請已送出，請等待管理員審核。")).toBeInTheDocument();
    // Form should be hidden on success
    expect(screen.queryByRole("button", { name: "送出申請" })).not.toBeInTheDocument();
    // Both the success box and auth-links render a login link
    expect(screen.getAllByRole("link", { name: "返回登入" }).length).toBeGreaterThan(0);
  });

  test("shows error message on failure", () => {
    renderRegister({ error: "此 Email 已被使用。" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("此 Email 已被使用。")).toBeInTheDocument();
  });
});
