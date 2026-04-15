import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { AccountDetailPage } from "./AccountDetailPage";

const ADMIN_USER: PublicUser = {
  id: "u1", email: "a@b.com", displayName: "管理員", role: "admin", status: "active",
  approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeAuth(user: PublicUser | null): AuthContextValue {
  return {
    authView: { mode: "login", resetToken: "" },
    error: "", forgotPassword: vi.fn(), isLoading: false, isSubmitting: false,
    login: vi.fn(), logout: vi.fn(), message: "", refreshSession: vi.fn(),
    register: vi.fn(), resetPassword: vi.fn(), switchMode: vi.fn(), user,
  } as AuthContextValue;
}

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" }, status,
  });
}

const ACCOUNT_DETAIL = {
  accountId: "demo-account",
  accountKey: "instagram:demo-account",
  clientName: "示範客戶",
  currentJobId: null,
  id: "instagram-demo-account",
  isActive: true,
  lastRequestTime: "2026-03-17T04:00:00.000Z",
  lastSuccessTime: "2026-03-17T05:00:00.000Z",
  latestOutput: {
    rowCount: 10,
    syncedAt: "2026-03-17T10:00:00.000Z",
    rows: [
      {
        content_id: "ig-post-001",
        caption: "測試貼文",
        published_at: "2026-03-17T10:00:00.000Z",
        views: 500,
        content_type: "reel",
        url: "https://instagram.com/p/ig-post-001",
      },
    ],
  },
  platform: "instagram",
  refreshDays: 7,
  refreshStatus: "success",
  sheetId: "sheet-abc",
  sheetRowKey: "instagram-demo-account",
  statusUpdatedAt: "2026-04-15T00:00:00.000Z",
  systemMessage: "最近一次同步成功。",
};

afterEach(() => { vi.restoreAllMocks(); });

function renderAccountDetail(platform = "instagram", accountId = "demo-account") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/health") return createJsonResponse(200, {
      now: "2026-04-15T00:00:00.000Z",
      queue: { concurrency: 2, pending: 0, running: 0 },
      scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
      status: "ok",
    });
    if (url === "/api/v1/ui/accounts") return createJsonResponse(200, {
      generatedAt: "2026-04-15T00:00:00.000Z",
      capabilities: { mode: "read-only", manualRefresh: false, scheduledSync: false, reason: "" },
      accounts: [ACCOUNT_DETAIL],
    });
    if (url === `/api/v1/ui/accounts/${platform}/${accountId}`) return createJsonResponse(200, {
      generatedAt: "2026-04-15T00:00:00.000Z",
      capabilities: { mode: "read-only", manualRefresh: false, scheduledSync: false, reason: "" },
      account: ACCOUNT_DETAIL,
    });
    return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
  }));

  return render(
    <MemoryRouter initialEntries={[`/accounts/${platform}/${accountId}`]}>
      <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
        <AccountDetailPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("AccountDetailPage", () => {
  test("renders 4 MetricCard labels", async () => {
    renderAccountDetail();
    await waitFor(() => {
      expect(screen.getByText("REFRESH STATUS")).toBeInTheDocument();
      expect(screen.getByText("REFRESH DAYS")).toBeInTheDocument();
      expect(screen.getByText("ROW COUNT")).toBeInTheDocument();
      expect(screen.getByText("LAST SUCCESS")).toBeInTheDocument();
    });
  });

  test("renders 帳號資訊 Card with key-value fields", async () => {
    renderAccountDetail();
    // Wait for the panel header to appear
    await screen.findByText("帳號資訊");
    await waitFor(() => {
      expect(screen.getByText("platform")).toBeInTheDocument();
      expect(screen.getByText("accountId")).toBeInTheDocument();
      expect(screen.getByText("clientName")).toBeInTheDocument();
      expect(screen.getByText("示範客戶")).toBeInTheDocument();
    });
  });

  test("renders 狀態快照 Card", async () => {
    renderAccountDetail();
    await screen.findByText("狀態快照");
    await waitFor(() => {
      expect(screen.getByText("refreshStatus")).toBeInTheDocument();
      expect(screen.getByText("lastSuccessTime")).toBeInTheDocument();
    });
  });

  test("renders 最新輸出 Card with output row data", async () => {
    renderAccountDetail();
    await screen.findByText("最新輸出");
    await waitFor(() => {
      expect(screen.getByText("ig-post-001")).toBeInTheDocument();
      expect(screen.getByText("測試貼文")).toBeInTheDocument();
    });
  });

  test("renders Coming Soon block for 最近一次工作", async () => {
    renderAccountDetail();
    await screen.findByText("最近一次工作");
    // The card should contain a Coming Soon block
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
  });

  test("breadcrumb shows ACCOUNT DETAIL", async () => {
    renderAccountDetail();
    await screen.findByText("ACCOUNT DETAIL");
  });

  test("← 返回列表 link goes to /accounts", async () => {
    renderAccountDetail();
    await screen.findByText("帳號資訊");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "← 返回列表" })).toHaveAttribute("href", "/accounts");
    });
  });

  test("admin sees 前往帳號設定 link", async () => {
    renderAccountDetail();
    await screen.findByText("帳號資訊");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "前往帳號設定" })).toBeInTheDocument();
    });
  });
});
