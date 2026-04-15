import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { AccountListPage } from "./AccountListPage";

const ADMIN_USER: PublicUser = {
  id: "u1", email: "a@b.com", displayName: "管理員", role: "admin", status: "active",
  approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const MEMBER_USER: PublicUser = { ...ADMIN_USER, id: "u2", role: "member" };

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

const HEALTH_RESP = {
  now: "2026-04-15T00:00:00.000Z",
  queue: { concurrency: 2, pending: 0, running: 0 },
  scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
  status: "ok",
};

const ACCOUNT_BASE = {
  accountKey: "instagram:demo-account",
  clientName: "示範客戶",
  currentJobId: null,
  id: "instagram-demo-account",
  isActive: true,
  lastRequestTime: null,
  lastSuccessTime: "2026-03-17T05:00:00.000Z",
  latestOutput: { rowCount: 10, syncedAt: "2026-03-17T10:00:00.000Z" },
  platform: "instagram" as const,
  refreshDays: 7,
  sheetId: "sheet-1",
  sheetRowKey: "instagram-demo-account",
  statusUpdatedAt: "2026-04-15T00:00:00.000Z",
  systemMessage: "成功同步。",
};

afterEach(() => { vi.restoreAllMocks(); });

function renderAccountList(user: PublicUser = ADMIN_USER, accounts = [{ ...ACCOUNT_BASE, accountId: "demo-account", refreshStatus: "success" as const }]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/health") return createJsonResponse(200, HEALTH_RESP);
    if (url === "/api/v1/ui/accounts") return createJsonResponse(200, {
      generatedAt: "2026-04-15T00:00:00.000Z",
      capabilities: { mode: "read-only", manualRefresh: false, scheduledSync: false, reason: "" },
      accounts,
    });
    return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
  }));

  return render(
    <MemoryRouter initialEntries={["/accounts"]}>
      <AuthContext.Provider value={makeAuth(user)}>
        <AccountListPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("AccountListPage — with accounts", () => {
  test("renders 4 MetricCard labels", async () => {
    renderAccountList();
    await waitFor(() => {
      expect(screen.getByText("TOTAL ACCOUNTS")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      expect(screen.getByText("SYNC SUCCESS")).toBeInTheDocument();
      expect(screen.getByText("RECENT ERRORS")).toBeInTheDocument();
    });
  });

  test("renders account clientName in table", async () => {
    renderAccountList();
    await screen.findByText("示範客戶");
  });

  test("shows 管理 link to account detail", async () => {
    renderAccountList();
    const link = await screen.findByRole("link", { name: "管理" });
    expect(link).toHaveAttribute("href", "/accounts/instagram/demo-account");
  });

  test("refreshStatus success → success pill with 成功 text", async () => {
    renderAccountList(ADMIN_USER, [{ ...ACCOUNT_BASE, accountId: "a1", refreshStatus: "success" as const }]);
    await screen.findByText("成功");
    expect(screen.getByText("成功")).toHaveClass("status-pill--success");
  });

  test("refreshStatus running → warning pill with 同步中 text", async () => {
    // running accounts appear in both table AND 需要關注 Card
    renderAccountList(ADMIN_USER, [{ ...ACCOUNT_BASE, accountId: "a1", refreshStatus: "running" as const }]);
    const pills = await screen.findAllByText("同步中");
    expect(pills.length).toBeGreaterThan(0);
    expect(pills[0]).toHaveClass("status-pill--warning");
  });

  test("refreshStatus error → error pill with 失敗 text", async () => {
    // error accounts appear in both table AND 需要關注 Card
    renderAccountList(ADMIN_USER, [{ ...ACCOUNT_BASE, accountId: "a1", refreshStatus: "error" as const }]);
    const pills = await screen.findAllByText("失敗");
    expect(pills.length).toBeGreaterThan(0);
    expect(pills[0]).toHaveClass("status-pill--error");
  });

  test("refreshStatus idle → muted pill with 閒置 text", async () => {
    renderAccountList(ADMIN_USER, [{ ...ACCOUNT_BASE, accountId: "a1", refreshStatus: "idle" as const }]);
    await screen.findByText("閒置");
    expect(screen.getByText("閒置")).toHaveClass("status-pill--muted");
  });

  test("search filter hides non-matching accounts", async () => {
    // Different `id` fields to avoid duplicate React key warning
    renderAccountList(ADMIN_USER, [
      { ...ACCOUNT_BASE, id: "instagram-a1", accountKey: "instagram:a1", accountId: "a1", clientName: "Alpha Corp", refreshStatus: "success" as const },
      { ...ACCOUNT_BASE, id: "instagram-a2", accountKey: "instagram:a2", accountId: "a2", clientName: "Beta LLC", refreshStatus: "idle" as const },
    ]);

    await screen.findByText("Alpha Corp");

    const searchInput = screen.getByPlaceholderText("搜尋帳號名稱或 ID...");
    fireEvent.change(searchInput, { target: { value: "Alpha" } });

    await waitFor(() => {
      expect(screen.queryByText("Beta LLC")).not.toBeInTheDocument();
      expect(screen.getByText("Alpha Corp")).toBeInTheDocument();
    });
  });

  test("admin sees + 新增帳號 button (disabled)", async () => {
    renderAccountList(ADMIN_USER);
    await screen.findByText("TOTAL ACCOUNTS");
    expect(screen.getByRole("button", { name: "+ 新增帳號" })).toBeDisabled();
  });

  test("member does not see + 新增帳號 button", async () => {
    renderAccountList(MEMBER_USER);
    await screen.findByText("TOTAL ACCOUNTS");
    expect(screen.queryByRole("button", { name: "+ 新增帳號" })).not.toBeInTheDocument();
  });
});

describe("AccountListPage — empty state", () => {
  test("shows empty state message when no accounts", async () => {
    renderAccountList(ADMIN_USER, []);
    await screen.findByText("尚未接入任何帳號");
  });

  test("shows all MetricCards as 0 in empty state", async () => {
    renderAccountList(ADMIN_USER, []);
    await screen.findByText("尚未接入任何帳號");
    // All 4 metric cards should show 0
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(4);
  });
});
