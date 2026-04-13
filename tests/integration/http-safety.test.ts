import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  sendSignedJson,
  setupTestApp,
} from "../../backend/test-support/support.ts";

test("manual refresh rejects oversized request bodies with 413", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-large-1" })];
  const fixtures = {
    "instagram--ig-large-1.json": { items: [] },
  };
  const { cleanup, baseUrl } = await setupTestApp({
    accounts,
    fixtures,
    overrides: {
      maxRequestBodyBytes: 64,
    },
  });

  try {
    const { response, json } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        platform: "instagram",
        account_id: "ig-large-1",
        refresh_days: 7,
        request_source: "apps-script",
        notes: "x".repeat(128),
      },
    });

    assert.equal(response.status, 413);
    assert.equal(json.error, "PAYLOAD_TOO_LARGE");
  } finally {
    await cleanup();
  }
});

test("request handler converts unexpected dispatch errors into 500 responses", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-health-1" })];
  const fixtures = {
    "instagram--ig-health-1.json": { items: [] },
  };
  const { app, cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  app.services.schedulerService.snapshot = () => {
    throw new Error("boom");
  };

  try {
    const response = await fetch(`${baseUrl}/health`);
    const json = await response.json();

    assert.equal(response.status, 500);
    assert.equal(json.error, "INTERNAL_ERROR");
  } finally {
    await cleanup();
  }
});

test("JSON API responses include X-Content-Type-Options nosniff header", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-header-1" })];
  const fixtures = {
    "instagram--ig-header-1.json": { items: [] },
  };
  const { cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
    assert.match(healthResponse.headers.get("content-type"), /application\/json/);

    const accountsResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`);
    assert.equal(accountsResponse.headers.get("x-content-type-options"), "nosniff");
    assert.match(accountsResponse.headers.get("content-type"), /application\/json/);

    const notFoundResponse = await fetch(`${baseUrl}/api/v1/unknown-route`);
    assert.equal(notFoundResponse.headers.get("x-content-type-options"), "nosniff");
  } finally {
    await cleanup();
  }
});
