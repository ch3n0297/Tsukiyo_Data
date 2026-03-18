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
});

test("renders dashboard data from read-only UI APIs and supports manual refresh", async () => {
  const fetchMock = vi.fn(async (url) => {
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
            clientName: "Test Client",
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
          clientName: "Test Client",
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

    return createJsonResponse(404, {
      error: "NOT_FOUND",
      system_message: `Unexpected request: ${url}`,
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  await screen.findByText("社群資料中台儀表板");
  await screen.findByText("服務狀態");
  await screen.findByText("Test Client · instagram");
  await screen.findByText("UI snapshot item");

  expect(screen.getByText(/安全邊界：/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "重新整理" }));

  await waitFor(() => {
    const healthCalls = fetchMock.mock.calls.filter(([url]) => url === "/health");
    expect(healthCalls.length).toBeGreaterThanOrEqual(2);
  });
});
