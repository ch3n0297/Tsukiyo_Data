import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  sendSignedJson,
  setupTestApp,
} from "../../test-support/support.js";

function extractAssetPaths(html) {
  return [...new Set([...html.matchAll(/(?:href|src)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]))];
}

test("frontend dashboard assets are accessible without exposing protected write configuration", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-dashboard-1" })];
  const fixtures = {
    "instagram--ig-dashboard-1.json": { items: [] },
  };

  const { cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const htmlResponse = await fetch(`${baseUrl}/`);
    const html = await htmlResponse.text();
    const assetPaths = extractAssetPaths(html);
    let jsAssetContainsReadApi = false;

    assert.equal(htmlResponse.status, 200);
    assert.match(htmlResponse.headers.get("cache-control"), /no-cache/i);
    assert.match(htmlResponse.headers.get("content-type"), /text\/html/i);
    assert.match(html, /社群資料中台儀表板/);
    assert.match(html, /id="root"/);
    assert.ok(assetPaths.some((assetPath) => assetPath.endsWith(".js")));
    assert.ok(assetPaths.some((assetPath) => assetPath.endsWith(".css")));

    for (const assetPath of assetPaths) {
      const assetResponse = await fetch(`${baseUrl}${assetPath}`);
      const assetBody = await assetResponse.text();

      assert.equal(assetResponse.status, 200);
      assert.match(assetResponse.headers.get("cache-control"), /immutable/i);

      if (assetPath.endsWith(".js")) {
        assert.match(assetResponse.headers.get("content-type"), /javascript/i);
        jsAssetContainsReadApi ||= /api\/v1\/ui\/accounts/.test(assetBody);
        assert.doesNotMatch(assetBody, /local-dev-secret/);
        assert.doesNotMatch(assetBody, /refresh-jobs\/manual/);
        assert.doesNotMatch(assetBody, /internal\/scheduled-sync/);
      }

      if (assetPath.endsWith(".css")) {
        assert.match(assetResponse.headers.get("content-type"), /text\/css/i);
      }
    }

    assert.equal(jsAssetContainsReadApi, true);

    const fallbackResponse = await fetch(`${baseUrl}/dashboard`);
    const fallbackHtml = await fallbackResponse.text();

    assert.equal(fallbackResponse.status, 200);
    assert.match(fallbackResponse.headers.get("content-type"), /text\/html/i);
    assert.match(fallbackHtml, /id="root"/);
  } finally {
    await cleanup();
  }
});

test("ui read APIs expose aggregated account snapshots and latest output rows", async () => {
  const accounts = [
    createAccount({ platform: "instagram", accountId: "ig-ui-1" }),
    createAccount({ platform: "facebook", accountId: "fb-ui-1" }),
  ];
  const fixtures = {
    "instagram--ig-ui-1.json": {
      items: [
        {
          id: "ig-ui-post",
          media_type: "reel",
          caption: "UI snapshot item",
          permalink: "https://instagram.example.com/p/ig-ui-post",
          timestamp: "2026-03-17T10:00:00.000Z",
          metrics: { plays: 510, likes: 45, comments: 8, shares: 3 },
        },
      ],
    },
    "facebook--fb-ui-1.json": { items: [] },
  };

  const { app, cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const queued = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        platform: "instagram",
        account_id: "ig-ui-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(queued.response.status, 202);
    await app.services.jobQueue.waitForIdle();

    const accountsResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`);
    const accountsJson = await accountsResponse.json();

    assert.equal(accountsResponse.status, 200);
    assert.equal(accountsJson.capabilities.manualRefresh, false);
    assert.equal(accountsJson.capabilities.scheduledSync, false);
    assert.equal(accountsJson.accounts.length, 2);

    const instagramAccount = accountsJson.accounts.find(
      (account) => account.platform === "instagram" && account.accountId === "ig-ui-1",
    );
    assert.ok(instagramAccount);
    assert.equal(instagramAccount.refreshStatus, "success");
    assert.equal(instagramAccount.latestOutput.rowCount, 1);
    assert.ok(instagramAccount.latestOutput.syncedAt);

    const detailResponse = await fetch(`${baseUrl}/api/v1/ui/accounts/instagram/ig-ui-1`);
    const detailJson = await detailResponse.json();

    assert.equal(detailResponse.status, 200);
    assert.equal(detailJson.account.clientName, "Test Client");
    assert.equal(detailJson.account.latestOutput.rowCount, 1);
    assert.equal(detailJson.account.latestOutput.rows[0].content_id, "ig-ui-post");
    assert.equal(detailJson.account.latestOutput.rows[0].caption, "UI snapshot item");
  } finally {
    await cleanup();
  }
});

test("frontend does not bypass existing manual refresh protection", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-protected-1" })];
  const fixtures = {
    "instagram--ig-protected-1.json": { items: [] },
  };

  const { cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const response = await fetch(`${baseUrl}/api/v1/refresh-jobs/manual`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        platform: "instagram",
        account_id: "ig-protected-1",
        refresh_days: 7,
        request_source: "browser-ui",
      }),
    });
    const json = await response.json();

    assert.equal(response.status, 401);
    assert.equal(json.error, "AUTH_HEADERS_MISSING");

    const accountsResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`);
    const accountsJson = await accountsResponse.json();
    assert.equal(accountsResponse.status, 200);
    assert.equal(accountsJson.capabilities.manualRefresh, false);
  } finally {
    await cleanup();
  }
});
