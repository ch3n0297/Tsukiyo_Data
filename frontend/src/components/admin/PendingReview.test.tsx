import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../contexts/AuthContext";
import type { AuthContextValue } from "../../contexts/AuthContext";
import type { PublicUser } from "../../types/api";
import { PendingReviewPage } from "./PendingReviewPage";

const ADMIN_USER: PublicUser = {
  id: "admin-1", email: "admin@example.com", displayName: "管理員", role: "admin",
  status: "active", approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const PENDING_USER_1: PublicUser = {
  id: "pending-1", email: "user1@example.com", displayName: "待審甲", role: "member",
  status: "pending", approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z",
};

const PENDING_USER_2: PublicUser = {
  id: "pending-2", email: "user2@example.com", displayName: "待審乙", role: "member",
  status: "pending", approvedAt: null, approvedBy: null, lastLoginAt: null,
  createdAt: "2026-04-02T00:00:00.000Z", updatedAt: "2026-04-02T00:00:00.000Z",
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

afterEach(() => { vi.restoreAllMocks(); });

function renderPendingReview(users: PublicUser[] = [PENDING_USER_1, PENDING_USER_2]) {
  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    if (url === "/api/v1/admin/pending-users") {
      return createJsonResponse(200, { users });
    }
    if (url === "/api/v1/admin/pending-users/pending-1/approve" && options.method === "POST") {
      return createJsonResponse(200, { system_message: "已核准。" });
    }
    if (url === "/api/v1/admin/pending-users/pending-1/reject" && options.method === "POST") {
      return createJsonResponse(200, { system_message: "已拒絕。" });
    }
    return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
  });

  vi.stubGlobal("fetch", fetchMock);

  render(
    <MemoryRouter initialEntries={["/admin/pending"]}>
      <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
        <PendingReviewPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return { fetchMock };
}

describe("PendingReviewPage", () => {
  test("renders 4 MetricCard labels", async () => {
    renderPendingReview();
    await waitFor(() => {
      expect(screen.getByText("PENDING")).toBeInTheDocument();
      expect(screen.getByText("REVIEWABLE")).toBeInTheDocument();
      expect(screen.getByText("APPROVED TODAY")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE MEMBERS")).toBeInTheDocument();
    });
  });

  test("APPROVED TODAY and ACTIVE MEMBERS show — (Coming Soon)", async () => {
    renderPendingReview();
    await screen.findByText("待審甲");
    const dashValues = screen.getAllByText("—");
    expect(dashValues.length).toBeGreaterThanOrEqual(2);
  });

  test("renders pending users list", async () => {
    renderPendingReview();
    await screen.findByText("待審甲");
    expect(screen.getByText("待審甲")).toBeInTheDocument();
    expect(screen.getByText("user1@example.com")).toBeInTheDocument();
    expect(screen.getByText("待審乙")).toBeInTheDocument();
  });

  test("renders 核准 and 拒絕 buttons for each pending user", async () => {
    renderPendingReview();
    await screen.findByText("待審甲");
    const approveButtons = screen.getAllByRole("button", { name: "核准" });
    const rejectButtons = screen.getAllByRole("button", { name: "拒絕" });
    expect(approveButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });

  test("approve button calls POST /admin/pending-users/:id/approve", async () => {
    const { fetchMock } = renderPendingReview();
    await screen.findByText("待審甲");

    fireEvent.click(screen.getAllByRole("button", { name: "核准" })[0]);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, opts]: [string, RequestInit]) =>
            url === "/api/v1/admin/pending-users/pending-1/approve" && opts?.method === "POST",
        ),
      ).toBe(true);
    });
  });

  test("reject button calls POST /admin/pending-users/:id/reject", async () => {
    const { fetchMock } = renderPendingReview();
    await screen.findByText("待審甲");

    fireEvent.click(screen.getAllByRole("button", { name: "拒絕" })[0]);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, opts]: [string, RequestInit]) =>
            url === "/api/v1/admin/pending-users/pending-1/reject" && opts?.method === "POST",
        ),
      ).toBe(true);
    });
  });

  test("shows empty state when no pending users", async () => {
    renderPendingReview([]);
    await screen.findByText("目前沒有待審申請");
  });

  test("shows error when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      createJsonResponse(500, { error: "ERR", system_message: "伺服器錯誤，請稍後再試。" }),
    ));

    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(ADMIN_USER)}>
          <PendingReviewPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await screen.findByText("伺服器錯誤，請稍後再試。");
  });
});
