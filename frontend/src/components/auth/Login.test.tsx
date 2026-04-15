import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import { LoginPage } from "./LoginPage";

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    authView: { mode: "login", resetToken: "" },
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

function renderLogin(auth: Partial<AuthContextValue> = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuth(auth)}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  test("renders brand title and form fields", () => {
    renderLogin();
    expect(screen.getByText("登入資料中台")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "歡迎回來" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("密碼")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
  });

  test("has links to forgot-password and register", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "忘記密碼" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "訪客申請" })).toHaveAttribute("href", "/register");
  });

  test("calls login() with email and password on submit", async () => {
    const login = vi.fn();
    renderLogin({ login });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密碼"), {
      target: { value: "password12345" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "登入" }).closest("form")!);

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "password12345",
      });
    });
  });

  test("shows loading state while submitting", () => {
    renderLogin({ isSubmitting: true });
    const button = screen.getByRole("button", { name: "載入中..." });
    expect(button).toBeDisabled();
  });

  test("shows error message for generic login failure", () => {
    renderLogin({ error: "帳號或密碼錯誤。" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("帳號或密碼錯誤。")).toBeInTheDocument();
  });

  test("shows pending message for 403 pending error", () => {
    renderLogin({ error: "帳號審核中，請聯絡管理員。" });
    expect(screen.getByText("帳號審核中，請聯絡管理員。")).toBeInTheDocument();
  });

  test("password field toggles visibility", () => {
    renderLogin();
    const input = screen.getByLabelText("密碼");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "顯示密碼" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "隱藏密碼" }));
    expect(input).toHaveAttribute("type", "password");
  });
});
