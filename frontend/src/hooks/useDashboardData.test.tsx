import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DASHBOARD_REFRESH_EVENT, useDashboardData } from "./useDashboardData";

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function DashboardHarness() {
  const { accounts } = useDashboardData({ enabled: true });
  return <p>accounts:{accounts.length}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("useDashboardData refreshes mounted state when the dashboard refresh event fires", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/health") {
      return createJsonResponse(200, {
        now: "2026-03-18T00:00:00.000Z",
        queue: { concurrency: 2, pending: 0, running: 0 },
        scheduler: { intervalMs: 60000, running: true, tickInProgress: false },
        status: "ok",
      });
    }

    if (url === "/api/v1/ui/accounts") {
      return createJsonResponse(200, {
        accounts: [
          {
            accountId: "acct-instagram-demo",
            accountKey: "instagram:acct-instagram-demo",
            clientName: "示範客戶",
            currentJobId: null,
            id: "instagram-acct-instagram-demo",
            isActive: true,
            lastRequestTime: null,
            lastSuccessTime: null,
            latestOutput: { rowCount: 0, syncedAt: null },
            platform: "instagram",
            refreshDays: 7,
            refreshStatus: "idle",
            sheetId: "sheet-1",
            sheetRowKey: "row-1",
            statusUpdatedAt: "2026-03-18T00:00:00.000Z",
            systemMessage: "",
          },
        ],
      });
    }

    return createJsonResponse(404, { error: "NOT_FOUND", system_message: `Unexpected: ${url}` });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<DashboardHarness />);

  await screen.findByText("accounts:1");
  expect(fetchMock).toHaveBeenCalledTimes(2);

  window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
