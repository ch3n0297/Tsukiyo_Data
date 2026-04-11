import test from "node:test";
import assert from "node:assert/strict";
import { GoogleSheetGateway } from "../../backend/src/adapters/sheets/google-sheet-gateway.js";
import { createLogger } from "../../backend/src/lib/logger.js";

function createJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

test("GoogleSheetGateway writes output rows to the bound spreadsheet while preserving local snapshots", async () => {
  const writtenSnapshots = [];
  const fetchCalls = [];
  const gateway = new GoogleSheetGateway({
    auditLogRepository: {
      async append() {},
    },
    clock: () => new Date("2026-03-24T02:00:00.000Z"),
    config: {
      googleOauthEnabled: true,
    },
    googleOauthService: {
      async getAuthorizedAccountContext() {
        return {
          accessToken: "access-token",
          connection: {
            id: "connection-1",
          },
          spreadsheetId: "sheet-123",
        };
      },
    },
    logger: createLogger({ silent: true }),
    sheetSnapshotRepository: {
      async upsertOutput(snapshot) {
        writtenSnapshots.push(snapshot);
      },
      async upsertStatus() {},
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push([url, options]);

      if (url === "https://sheets.googleapis.com/v4/spreadsheets/sheet-123?fields=spreadsheetId,sheets.properties.title") {
        return createJsonResponse(200, {
          spreadsheetId: "sheet-123",
          sheets: [],
        });
      }

      if (url === "https://sheets.googleapis.com/v4/spreadsheets/sheet-123:batchUpdate") {
        return createJsonResponse(200, {
          replies: [],
        });
      }

      if (url === "https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Output!A%3AN") {
        return createJsonResponse(200, {
          values: [
            [
              "sheet_row_key",
              "platform",
              "account_id",
              "content_id",
              "content_type",
              "published_at",
              "caption",
              "url",
              "views",
              "likes",
              "comments",
              "shares",
              "data_status",
              "synced_at",
            ],
            ["row-other", "instagram", "acct-other"],
          ],
        });
      }

      if (url === "https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Output!A%3AN:clear") {
        return createJsonResponse(200, {});
      }

      if (url === "https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Output!A%3AN?valueInputOption=RAW") {
        return createJsonResponse(200, {});
      }

      throw new Error(`Unexpected Google fetch URL: ${url}`);
    },
  });

  await gateway.writeOutput(
    {
      id: "instagram-acct-1",
      sheetId: "sheet-123",
      sheetRowKey: "row-1",
      platform: "instagram",
      accountId: "acct-1",
      googleConnectionId: "connection-1",
      allowedSpreadsheetId: "sheet-123",
      tenantKey: "tenant-a",
    },
    [
      {
        contentId: "ig-post-1",
        contentType: "reel",
        publishedAt: "2026-03-23T02:00:00.000Z",
        caption: "hello",
        url: "https://example.com/ig-post-1",
        views: 10,
        likes: 2,
        comments: 1,
        shares: 0,
        dataStatus: "fresh",
      },
    ],
  );

  assert.equal(writtenSnapshots.length, 1);
  assert.equal(writtenSnapshots[0].sheetId, "sheet-123");

  const writeCall = fetchCalls.find(([url]) =>
    url === "https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Output!A%3AN?valueInputOption=RAW",
  );
  assert.ok(writeCall);
  const body = JSON.parse(writeCall[1].body);
  assert.equal(body.values[1][0], "row-other");
  assert.equal(body.values[2][0], "row-1");
  assert.equal(body.values[2][3], "ig-post-1");
});
