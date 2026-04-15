import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { ControlRoomPage } from "./ControlRoomPage";

const ADMIN_USER: PublicUser = {
  id: "u1",
  email: "admin@example.com",
  displayName: "管理員",
  role: "admin",
  status: "active",
  approvedAt: null,
  approvedBy: null,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeAuth(user: PublicUser | null = ADMIN_USER): AuthContextValue {
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
    user,
  } as AuthContextValue;
}

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

function renderControlRoom(user: PublicUser | null = ADMIN_USER) {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthContext.Provider value={makeAuth(user)}>
        <ControlRoomPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("ControlRoomPage", () => {
  test("renders page title and subtitle", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(200, {
      now: "2026-04-15T00:00:00.000Z",
      queue: { concurrency: 2, pending: 0, running: 0 },
      scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
      status: "ok",
    })));

    renderControlRoom();
    await screen.findByText("資料中台控制室");
  });

  test("renders 3 MetricCards with correct labels", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(200, {
      now: "2026-04-15T00:00:00.000Z",
      queue: { concurrency: 2, pending: 3, running: 1 },
      scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
      status: "ok",
    })));

    renderControlRoom();

    await waitFor(() => {
      expect(screen.getByText("TOTAL WRITES")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE TABLES")).toBeInTheDocument();
      expect(screen.getByText("FAILED JOBS")).toBeInTheDocument();
    });
  });

  test("shows — for Coming Soon MetricCards (TOTAL WRITES, ACTIVE TABLES)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(200, {
      now: "2026-04-15T00:00:00.000Z",
      queue: { concurrency: 2, pending: 0, running: 0 },
      scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
      status: "ok",
    })));

    renderControlRoom();

    await screen.findByText("TOTAL WRITES");
    // Coming Soon MetricCards show "—" as value
    const dashValues = screen.getAllByText("—");
    expect(dashValues.length).toBeGreaterThanOrEqual(2);
  });

  test("renders Coming Soon blocks for chart and pipeline cards", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(200, {
      now: "2026-04-15T00:00:00.000Z",
      queue: { concurrency: 2, pending: 0, running: 0 },
      scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
      status: "ok",
    })));

    renderControlRoom();

    await screen.findByText("資料中台控制室");
    // Multiple Coming Soon blocks should be present
    const comingSoonBadges = screen.getAllByText("Coming Soon");
    expect(comingSoonBadges.length).toBeGreaterThan(0);
  });

  test("renders Live pill in page header actions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(200, {
      now: "2026-04-15T00:00:00.000Z",
      queue: { concurrency: 2, pending: 0, running: 0 },
      scheduler: { running: true, intervalMs: 60000, tickInProgress: false },
      status: "ok",
    })));

    renderControlRoom();
    await screen.findByText("全域同步中");
    expect(screen.getByText("全域同步中")).toBeInTheDocument();
  });
});
