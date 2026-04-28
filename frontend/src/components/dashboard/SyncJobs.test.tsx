import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { SyncJobsPage } from "./SyncJobsPage";

const ADMIN_USER: PublicUser = {
  id: "u1", email: "a@b.com", displayName: "管理員", role: "admin", status: "active",
  approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeAuth(user: PublicUser): AuthContextValue {
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
  queue: { concurrency: 2, pending: 5, running: 2 },
  scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
  status: "ok",
};

afterEach(() => { vi.restoreAllMocks(); });

function renderSyncJobs(health = HEALTH_RESP) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/health") return createJsonResponse(200, health);
    if (url === "/api/v1/ui/accounts") return createJsonResponse(200, {
      generatedAt: "2026-04-15T00:00:00.000Z",
      capabilities: { mode: "read-only", manualRefresh: false, scheduledSync: false, reason: "" },
      accounts: [],
    });
    return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
  }));

  return render(
    <MemoryRouter initialEntries={["/sync-jobs"]}>
      <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
        <SyncJobsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("SyncJobsPage", () => {
  test("renders page title with breadcrumb", async () => {
    renderSyncJobs();
    await screen.findByText("SYNC OPERATIONS");
    expect(screen.getByText("同步任務與刷新狀態")).toBeInTheDocument();
  });

  test("renders 4 MetricCard labels", async () => {
    renderSyncJobs();
    await waitFor(() => {
      expect(screen.getByText("QUEUED")).toBeInTheDocument();
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
      expect(screen.getByText("SUCCESS")).toBeInTheDocument();
      expect(screen.getByText("ERROR")).toBeInTheDocument();
    });
  });

  test("QUEUED MetricCard shows queue.pending value from /health", async () => {
    renderSyncJobs(); // pending: 5
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  test("RUNNING MetricCard shows queue.running value from /health", async () => {
    renderSyncJobs(); // running: 2
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  test("SUCCESS and ERROR MetricCards show — (Coming Soon)", async () => {
    renderSyncJobs();
    await screen.findByText("QUEUED");
    const dashValues = screen.getAllByText("—");
    expect(dashValues.length).toBeGreaterThanOrEqual(2);
  });

  test("renders 佇列健康度 Card", async () => {
    renderSyncJobs();
    await screen.findByText("佇列健康度");
  });

  test("佇列健康度 shows scheduler status pill", async () => {
    renderSyncJobs();
    await screen.findByText("佇列健康度");
    await waitFor(() => {
      // "執行中" appears as a key-value label AND as a StatusPill
      expect(screen.getAllByText("執行中").length).toBeGreaterThanOrEqual(1);
    });
  });

  test("shows scheduler interval in 分鐘", async () => {
    renderSyncJobs(); // intervalMs: 60000 = 1 minute
    await screen.findByText("佇列健康度");
    await waitFor(() => {
      expect(screen.getByText("每 1 分鐘同步一次")).toBeInTheDocument();
    });
  });

  test("Tasks Table shows Coming Soon block", async () => {
    renderSyncJobs();
    await screen.findByText("任務清單");
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
  });
});
