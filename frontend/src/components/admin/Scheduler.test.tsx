import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { SchedulerPage } from "./SchedulerPage";
import { UsersPage } from "./UsersPage";

const ADMIN_USER: PublicUser = {
  id: "admin-1", email: "admin@example.com", displayName: "管理員", role: "admin",
  status: "active", approvedAt: null, approvedBy: null, lastLoginAt: null,
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

const HEALTH_RUNNING = {
  now: "2026-04-15T10:00:00.000Z",
  queue: { concurrency: 3, pending: 2, running: 1 },
  scheduler: { running: true, intervalMs: 1800000, tickInProgress: false },
  status: "ok",
};

const HEALTH_STOPPED = {
  now: "2026-04-15T10:00:00.000Z",
  queue: { concurrency: 2, pending: 0, running: 0 },
  scheduler: { running: false, intervalMs: 3600000, tickInProgress: false },
  status: "ok",
};

afterEach(() => { vi.restoreAllMocks(); });

function renderScheduler(health = HEALTH_RUNNING) {
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
    <MemoryRouter initialEntries={["/admin/scheduler"]}>
      <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
        <SchedulerPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("SchedulerPage — MetricCards from /health", () => {
  test("renders 4 MetricCard labels", async () => {
    renderScheduler();
    await waitFor(() => {
      expect(screen.getByText("SCHEDULER")).toBeInTheDocument();
      expect(screen.getByText("INTERVAL")).toBeInTheDocument();
      expect(screen.getByText("CONCURRENCY")).toBeInTheDocument();
      expect(screen.getByText("TICK")).toBeInTheDocument();
    });
  });

  test("SCHEDULER shows 執行中 when scheduler.running is true", async () => {
    renderScheduler(HEALTH_RUNNING);
    await waitFor(() => {
      expect(screen.getAllByText("執行中").length).toBeGreaterThan(0);
    });
  });

  test("SCHEDULER shows 已停止 when scheduler.running is false", async () => {
    renderScheduler(HEALTH_STOPPED);
    await waitFor(() => {
      expect(screen.getAllByText("已停止").length).toBeGreaterThan(0);
    });
  });

  test("INTERVAL shows intervalMs converted to minutes", async () => {
    renderScheduler(HEALTH_RUNNING); // intervalMs: 1800000 = 30 minutes
    await waitFor(() => {
      expect(screen.getAllByText("30 分鐘").length).toBeGreaterThan(0);
    });
  });

  test("CONCURRENCY shows queue.concurrency value", async () => {
    renderScheduler(HEALTH_RUNNING); // concurrency: 3
    await waitFor(() => {
      expect(screen.getByText("3 個並行")).toBeInTheDocument();
    });
  });
});

describe("SchedulerPage — 排程器概況 Card", () => {
  test("renders 排程器概況 panel header", async () => {
    renderScheduler();
    await screen.findByText("排程器概況");
  });

  test("shows now timestamp in panel (appears in header + content)", async () => {
    renderScheduler();
    await screen.findByText("排程器概況");
    await waitFor(() => {
      // Timestamp appears in both panel header action and content row
      expect(screen.getAllByText("2026-04-15T10:00:00.000Z").length).toBeGreaterThan(0);
    });
  });

  test("renders Coming Soon block for 保護規則 Card", async () => {
    renderScheduler();
    await screen.findByText("保護規則");
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
  });
});

describe("UsersPage — Coming Soon", () => {
  test("renders 使用者管理 title", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <UsersPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "使用者管理" })).toBeInTheDocument();
  });

  test("shows 4 Coming Soon MetricCards with — value", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <UsersPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  test("shows Coming Soon block for 使用者清單 Table", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <UsersPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
  });
});
