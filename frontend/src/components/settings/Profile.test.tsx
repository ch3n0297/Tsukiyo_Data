import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { ProfileSettingsPage } from "./ProfileSettingsPage";
import { TokensSettingsPage } from "./TokensSettingsPage";

const ADMIN_USER: PublicUser = {
  id: "u1", email: "admin@example.com", displayName: "系統管理員", role: "admin",
  status: "active", approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const MEMBER_USER: PublicUser = {
  ...ADMIN_USER, id: "u2", email: "member@example.com",
  displayName: "一般成員", role: "member",
};

function makeAuth(user: PublicUser, logout = vi.fn()): AuthContextValue {
  return {
    authView: { mode: "login", resetToken: "" },
    error: "", forgotPassword: vi.fn(), isLoading: false, isSubmitting: false,
    login: vi.fn(), logout, message: "", refreshSession: vi.fn(),
    register: vi.fn(), resetPassword: vi.fn(), switchMode: vi.fn(), user,
  } as AuthContextValue;
}

function renderProfile(user: PublicUser = ADMIN_USER, logout = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/settings/profile"]}>
      <AuthContext.Provider value={makeAuth(user, logout)}>
        <ProfileSettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

// jsdom may not provide a fully functional localStorage in all environments.
// Create a simple in-memory localStorage stub for tests.
let _storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => _storage[key] ?? null,
  setItem: (key: string, value: string) => { _storage[key] = value; },
  removeItem: (key: string) => { delete _storage[key]; },
  clear: () => { _storage = {}; },
};

beforeEach(() => {
  _storage = {};
  vi.stubGlobal("localStorage", localStorageMock);
  document.documentElement.setAttribute("data-theme", "dark");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.setAttribute("data-theme", "dark");
});

describe("ProfileSettingsPage — 使用者資料 Card", () => {
  test("renders displayName and email", () => {
    renderProfile();
    expect(screen.getByText("系統管理員")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  test("renders role badge", () => {
    renderProfile();
    // Role badge shows 'admin'
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
  });

  test("renders avatar with first letter of displayName", () => {
    renderProfile();
    // Avatar fallback shows first letter uppercased
    expect(screen.getByText("系")).toBeInTheDocument();
  });

  test("renders breadcrumb PERSONAL SETTINGS", () => {
    renderProfile();
    expect(screen.getByText("PERSONAL SETTINGS")).toBeInTheDocument();
  });
});

describe("ProfileSettingsPage — 介面偏好（theme toggle）", () => {
  beforeEach(() => {
    // Reset to dark theme before each theme test
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  });

  test("renders Light and Dark theme buttons", () => {
    renderProfile();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  test("clicking Light sets data-theme to light on documentElement", async () => {
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  test("clicking Dark sets data-theme to dark on documentElement", async () => {
    // Start with light
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");

    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  test("theme choice is persisted to localStorage", async () => {
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("light");
    });
  });
});

describe("ProfileSettingsPage — 帳號安全 Card", () => {
  test("renders 帳號安全 panel title", () => {
    renderProfile();
    expect(screen.getByText("帳號安全")).toBeInTheDocument();
  });

  test("renders 登出所有裝置 button", () => {
    renderProfile();
    expect(screen.getByRole("button", { name: "登出所有裝置" })).toBeInTheDocument();
  });

  test("clicking 登出所有裝置 calls logout", async () => {
    const logout = vi.fn();
    renderProfile(ADMIN_USER, logout);
    fireEvent.click(screen.getByRole("button", { name: "登出所有裝置" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });
});

describe("ProfileSettingsPage — admin-only cards", () => {
  test("admin sees 帳號遷移 Card", () => {
    renderProfile(ADMIN_USER);
    expect(screen.getByText("帳號遷移")).toBeInTheDocument();
  });

  test("member does not see 帳號遷移 Card", () => {
    renderProfile(MEMBER_USER);
    expect(screen.queryByText("帳號遷移")).not.toBeInTheDocument();
  });
});

describe("TokensSettingsPage — Coming Soon", () => {
  test("renders page title 帳號接入與權杖管理", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <TokensSettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText("帳號接入與權杖管理")).toBeInTheDocument();
  });

  test("shows 3 Coming Soon MetricCards with — value", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <TokensSettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    // All 3 MetricCards are Coming Soon → show "—"
    const dashValues = screen.getAllByText("—");
    expect(dashValues.length).toBeGreaterThanOrEqual(3);
  });

  test("shows Coming Soon blocks for all content cards", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <TokensSettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
  });
});
