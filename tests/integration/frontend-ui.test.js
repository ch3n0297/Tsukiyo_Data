import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  loginAsAdmin,
  sendJsonRequest,
  sendSignedJson,
  setupTestApp,
} from "../../backend/test-support/support.js";

test("backend no longer serves frontend assets after separation", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-dashboard-1" })];
  const fixtures = {
    "instagram--ig-dashboard-1.json": { items: [] },
  };

  const { cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const response = await fetch(`${baseUrl}/`);
    const text = await response.text();

    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/i);
    assert.match(text, /找不到對應的路由/);
  } finally {
    await cleanup();
  }
});

test("ui read APIs expose aggregated account snapshots, platform overviews, and latest output rows", async () => {
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
    const adminLogin = await loginAsAdmin(baseUrl);
    assert.equal(adminLogin.response.status, 200);
    assert.ok(adminLogin.cookie);

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

    const accountsResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
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

    const overviewResponse = await fetch(`${baseUrl}/api/v1/ui/content-overview`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const overviewJson = await overviewResponse.json();
    assert.equal(overviewResponse.status, 200);
    assert.equal(overviewJson.platforms.length, 2);
    assert.equal(overviewJson.platforms[0].platform, "facebook");
    assert.equal(overviewJson.platforms[1].platform, "instagram");
    assert.equal(overviewJson.platforms[1].contentCount, 1);
    assert.equal(overviewJson.platforms[1].previewItems[0].content_id, "ig-ui-post");
    assert.equal(overviewJson.platforms[1].previewItems[0].clientName, "Test Client");

    const detailResponse = await fetch(`${baseUrl}/api/v1/ui/accounts/instagram/ig-ui-1`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
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
    assert.equal(accountsResponse.status, 401);
    assert.equal(accountsJson.error, "AUTH_REQUIRED");
  } finally {
    await cleanup();
  }
});

test("content overview sorts items by views and limits previews to five rows per platform", async () => {
  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-overview-1" })],
    fixtures: {
      "instagram--ig-overview-1.json": {
        items: [
          {
            id: "ig-1",
            media_type: "reel",
            caption: "One",
            permalink: "https://instagram.example.com/p/ig-1",
            timestamp: "2026-03-10T10:00:00.000Z",
            metrics: { plays: 50, likes: 5, comments: 1, shares: 0 },
          },
          {
            id: "ig-2",
            media_type: "reel",
            caption: "Two",
            permalink: "https://instagram.example.com/p/ig-2",
            timestamp: "2026-03-11T10:00:00.000Z",
            metrics: { plays: 350, likes: 25, comments: 4, shares: 2 },
          },
          {
            id: "ig-3",
            media_type: "reel",
            caption: "Three",
            permalink: "https://instagram.example.com/p/ig-3",
            timestamp: "2026-03-12T10:00:00.000Z",
            metrics: { plays: 150, likes: 14, comments: 3, shares: 1 },
          },
          {
            id: "ig-4",
            media_type: "reel",
            caption: "Four",
            permalink: "https://instagram.example.com/p/ig-4",
            timestamp: "2026-03-13T10:00:00.000Z",
            metrics: { plays: 450, likes: 32, comments: 6, shares: 2 },
          },
          {
            id: "ig-5",
            media_type: "reel",
            caption: "Five",
            permalink: "https://instagram.example.com/p/ig-5",
            timestamp: "2026-03-14T10:00:00.000Z",
            metrics: { plays: 250, likes: 18, comments: 2, shares: 1 },
          },
          {
            id: "ig-6",
            media_type: "reel",
            caption: "Six",
            permalink: "https://instagram.example.com/p/ig-6",
            timestamp: "2026-03-15T10:00:00.000Z",
            metrics: { plays: 550, likes: 40, comments: 7, shares: 3 },
          },
        ],
      },
    },
  });

  try {
    const adminLogin = await loginAsAdmin(baseUrl);
    const queued = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        platform: "instagram",
        account_id: "ig-overview-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });
    assert.equal(queued.response.status, 202);
    await app.services.jobQueue.waitForIdle();

    const overviewResponse = await fetch(`${baseUrl}/api/v1/ui/content-overview`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const overviewJson = await overviewResponse.json();
    assert.equal(overviewResponse.status, 200);
    assert.equal(overviewJson.platforms.length, 1);
    assert.equal(overviewJson.platforms[0].previewItems.length, 5);
    assert.deepEqual(
      overviewJson.platforms[0].previewItems.map((item) => item.content_id),
      ["ig-6", "ig-4", "ig-2", "ig-5", "ig-3"],
    );
    assert.equal(overviewJson.platforms[0].items.length, 5);
  } finally {
    await cleanup();
  }
});

test("admin can review pending users through protected browser APIs", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-1" })],
    fixtures: {
      "instagram--ig-auth-1.json": { items: [] },
    },
  });

  try {
    const register = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "待審成員",
        email: "member@example.com",
        password: "MemberPassword123!",
      },
    });
    assert.equal(register.response.status, 201);

    const adminLogin = await loginAsAdmin(baseUrl);
    assert.equal(adminLogin.response.status, 200);

    const pendingBefore = await fetch(`${baseUrl}/api/v1/admin/pending-users`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const pendingBeforeJson = await pendingBefore.json();
    assert.equal(pendingBefore.status, 200);
    assert.equal(pendingBeforeJson.users.length, 1);

    const approve = await fetch(
      `${baseUrl}/api/v1/admin/pending-users/${pendingBeforeJson.users[0].id}/approve`,
      {
        method: "POST",
        headers: {
          cookie: adminLogin.cookie,
          origin: "http://127.0.0.1:5173",
        },
      },
    );
    const approveJson = await approve.json();
    assert.equal(approve.status, 200);
    assert.equal(approveJson.user.status, "active");

    // Member password login is blocked — members must use Google login.
    // Verify the approval succeeded but member can't login with password.
    const memberLogin = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/login",
      body: {
        email: "member@example.com",
        password: "MemberPassword123!",
      },
    });
    assert.equal(memberLogin.response.status, 403);
    assert.equal(memberLogin.json.error, "GOOGLE_LOGIN_REQUIRED");
  } finally {
    await cleanup();
  }
});
