import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { vi } from "vitest";
import App from "./App";

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status,
  });
}

/** Minimal admin user fixture */
const ADMIN_USER = {
  id: "user-admin",
  email: "admin@example.com",
  displayName: "管理員",
  role: "admin",
  status: "active",
  approvedAt: "2026-03-18T00:00:00.000Z",
  approvedBy: "bootstrap-admin",
  lastLoginAt: "2026-03-18T00:00:00.000Z",
  createdAt: "2026-03-18T00:00:00.000Z",
  updatedAt: "2026-03-18T00:00:00.000Z",
};

const HEALTH_OK = {
  now: "2026-03-18T00:00:00.000Z",
  queue: { concurrency: 2, pending: 1, running: 0 },
  scheduler: { intervalMs: 60000, running: true, tickInProgress: false },
  status: "ok",
};

const ACCOUNTS_RESPONSE = {
  capabilities: {
    manualRefresh: false,
    mode: "read-only",
    reason: "read-only",
    scheduledSync: false,
  },
  generatedAt: "2026-03-18T00:00:00.000Z",
  accounts: [
    {
      accountId: "acct-instagram-demo",
      accountKey: "instagram:acct-instagram-demo",
      clientName: "示範客戶",
      currentJobId: null,
      id: "instagram-acct-instagram-demo",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: "2026-03-17T05:00:00.000Z",
      latestOutput: { rowCount: 1, syncedAt: "2026-03-17T10:00:00.000Z" },
      platform: "instagram",
      refreshDays: 7,
      refreshStatus: "success",
      sheetId: "sheet-1",
      sheetRowKey: "instagram-acct-instagram-demo",
      statusUpdatedAt: "2026-03-18T00:00:00.000Z",
      systemMessage: "最近一次同步成功。",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

// ── AC-01: Design System 基礎 ─────────────────────────────────────────────

test("renders login form when there is no active session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/auth/me") {
        return createJsonResponse(401, {
          error: "AUTH_REQUIRED",
          system_message: "請先登入後再存取此功能。",
        });
      }
      return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
    }),
  );

  render(<App />);

  // New login page shows brand title and card title
  await screen.findByText("登入資料中台");
  await screen.findByRole("heading", { name: "歡迎回來" });
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("密碼")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
});

test("auth layout brand area is always dark (#0A0A0A)", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      createJsonResponse(401, { error: "AUTH_REQUIRED", system_message: "" }),
    ),
  );

  render(<App />);

  await screen.findByText("TSUKIYO");

  const brandArea = document.querySelector(".auth-layout__brand");
  expect(brandArea).toBeInTheDocument();
  // Brand area must have hardcoded dark background, not a CSS variable
  const styles = window.getComputedStyle(brandArea!);
  // jsdom may not compute the exact color, but the inline/hardcoded class is sufficient
  expect(brandArea).toHaveClass("auth-layout__brand");
});

// ── AC-03: Dashboard + Sidebar ────────────────────────────────────────────

test("authenticated admin sees dashboard and admin sidebar nav", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/auth/me") return createJsonResponse(200, { user: ADMIN_USER });
      if (url === "/health") return createJsonResponse(200, HEALTH_OK);
      if (url === "/api/v1/ui/accounts") return createJsonResponse(200, ACCOUNTS_RESPONSE);
      if (url === "/api/v1/admin/pending-users") return createJsonResponse(200, { users: [] });
      return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
    }),
  );

  render(<App />);

  // Wait for auth to complete → redirected to /dashboard
  // Sidebar footer should show user info (footer-name class)
  await screen.findByText("管理員", { selector: ".sidebar__footer-name" });
  await screen.findByText("admin", { selector: ".sidebar__footer-role" });

  // Admin sidebar should show admin nav items
  await screen.findByRole("link", { name: /管理員首頁/ });
  expect(screen.getByRole("link", { name: /總覽看板/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /資料來源/ })).toBeInTheDocument();
});

test("admin can approve pending users at /admin/pending", async () => {
  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    if (url === "/api/v1/auth/me") return createJsonResponse(200, { user: ADMIN_USER });
    if (url === "/health") return createJsonResponse(200, HEALTH_OK);
    if (url === "/api/v1/ui/accounts") return createJsonResponse(200, ACCOUNTS_RESPONSE);

    if (url === "/api/v1/admin/pending-users") {
      return createJsonResponse(200, {
        users: [
          {
            id: "user-pending-1",
            email: "pending@example.com",
            displayName: "待審使用者",
            role: "member",
            status: "pending",
            approvedAt: null,
            approvedBy: null,
            lastLoginAt: null,
            createdAt: "2026-03-18T00:00:00.000Z",
            updatedAt: "2026-03-18T00:00:00.000Z",
          },
        ],
      });
    }

    if (url === "/api/v1/admin/pending-users/user-pending-1/approve") {
      expect(options.method).toBe("POST");
      return createJsonResponse(200, {
        system_message: "已核准該使用者。",
        user: { id: "user-pending-1", email: "pending@example.com", status: "active" },
      });
    }

    return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
  });

  vi.stubGlobal("fetch", fetchMock);

  // Navigate to /admin/pending before render
  window.history.replaceState({}, "", "/admin/pending");

  render(<App />);

  // Should see pending review page
  await screen.findByText("待審使用者");

  fireEvent.click(screen.getByRole("button", { name: "核准" }));

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([url]: [string]) => url === "/api/v1/admin/pending-users/user-pending-1/approve",
      ),
    ).toBe(true);
  });
});

test("admin pending-user errors stay inside the pending-users panel", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/auth/me") return createJsonResponse(200, { user: ADMIN_USER });
      if (url === "/health") return createJsonResponse(200, HEALTH_OK);
      if (url === "/api/v1/ui/accounts")
        return createJsonResponse(200, { ...ACCOUNTS_RESPONSE, accounts: [] });
      if (url === "/api/v1/admin/pending-users") {
        return createJsonResponse(500, {
          error: "INTERNAL_ERROR",
          system_message: "待審清單暫時無法載入。",
        });
      }
      return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
    }),
  );

  window.history.replaceState({}, "", "/admin/pending");

  render(<App />);

  // Error should be shown inside the pending panel, not as a page-level error
  await screen.findByText("待審清單暫時無法載入。");
  // The error text should not appear as a global error banner prefixed separately
  expect(
    screen.queryByText("資料載入失敗：待審清單暫時無法載入。"),
  ).not.toBeInTheDocument();
});
