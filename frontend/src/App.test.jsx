import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";

function createJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("renders login screen when there is no active session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === "/api/v1/auth/me") {
        return createJsonResponse(401, {
          error: "AUTH_REQUIRED",
          system_message: "請先登入後再存取此功能。",
        });
      }

      return createJsonResponse(404, {
        error: "NOT_FOUND",
        system_message: `Unexpected request: ${url}`,
      });
    }),
  );

  render(<App />);

  await screen.findByRole("heading", { name: "登入" });
  expect(screen.getByRole("button", { name: "註冊新帳號" })).toBeInTheDocument();
});

test("renders dashboard data for an authenticated admin and supports pending-user approval", async () => {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === "/api/v1/auth/me") {
      return createJsonResponse(200, {
        user: {
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
        },
      });
    }

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

    if (url === "/health") {
      return createJsonResponse(200, {
        now: "2026-03-18T00:00:00.000Z",
        queue: {
          concurrency: 2,
          pending: 1,
          running: 0,
        },
        scheduler: {
          intervalMs: 60000,
          running: true,
          tickInProgress: false,
        },
        status: "ok",
      });
    }

    if (url === "/api/v1/ui/accounts") {
      return createJsonResponse(200, {
        capabilities: {
          manualRefresh: false,
          mode: "read-only",
          reason:
            "儀表板目前僅提供唯讀檢視；手動刷新與排程同步仍需透過簽章保護的伺服器 API 進行。",
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
            latestOutput: {
              rowCount: 1,
              syncedAt: "2026-03-17T10:00:00.000Z",
            },
            platform: "instagram",
            refreshDays: 7,
            refreshStatus: "success",
            sheetId: "sheet-1",
            sheetRowKey: "instagram-acct-instagram-demo",
            statusUpdatedAt: "2026-03-18T00:00:00.000Z",
            systemMessage: "最近一次同步成功。",
          },
        ],
      });
    }

    if (url === "/api/v1/ui/accounts/instagram/acct-instagram-demo") {
      return createJsonResponse(200, {
        account: {
          accountId: "acct-instagram-demo",
          accountKey: "instagram:acct-instagram-demo",
          clientName: "示範客戶",
          currentJobId: null,
          id: "instagram-acct-instagram-demo",
          isActive: true,
          lastRequestTime: null,
          lastSuccessTime: "2026-03-17T05:00:00.000Z",
          latestOutput: {
            rowCount: 1,
            rows: [
              {
                caption: "UI snapshot item",
                comments: 8,
                content_id: "ig-ui-post",
                content_type: "reel",
                data_status: "active",
                likes: 45,
                published_at: "2026-03-17T10:00:00.000Z",
                shares: 3,
                url: "https://instagram.example.com/p/ig-ui-post",
                views: 510,
              },
            ],
            syncedAt: "2026-03-17T10:00:00.000Z",
          },
          platform: "instagram",
          refreshDays: 7,
          refreshStatus: "success",
          sheetId: "sheet-1",
          sheetRowKey: "instagram-acct-instagram-demo",
          statusUpdatedAt: "2026-03-18T00:00:00.000Z",
          systemMessage: "最近一次同步成功。",
        },
        capabilities: {
          manualRefresh: false,
          mode: "read-only",
          reason:
            "儀表板目前僅提供唯讀檢視；手動刷新與排程同步仍需透過簽章保護的伺服器 API 進行。",
          scheduledSync: false,
        },
        generatedAt: "2026-03-18T00:00:00.000Z",
      });
    }

    if (url === "/api/v1/admin/pending-users/user-pending-1/approve") {
      expect(options.method).toBe("POST");
      return createJsonResponse(200, {
        system_message: "已核准該使用者。",
        user: {
          id: "user-pending-1",
          email: "pending@example.com",
          displayName: "待審使用者",
          role: "member",
          status: "active",
        },
      });
    }

    return createJsonResponse(404, {
      error: "NOT_FOUND",
      system_message: `Unexpected request: ${url}`,
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  await screen.findByText("管理員 · admin");
  await screen.findByText("待審使用者");
  await screen.findByText("示範客戶 · instagram");
  await screen.findByText("UI snapshot item");

  fireEvent.click(screen.getByRole("button", { name: "核准" }));

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/v1/admin/pending-users/user-pending-1/approve"),
    ).toBe(true);
  });
});
