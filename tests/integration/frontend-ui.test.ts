import test from "node:test";
import assert from "node:assert/strict";
import {
  authHeaders,
  createAccount,
  loginAsAdmin,
  sendJsonRequest,
  sendSignedJson,
  setupTestApp,
} from "../../backend/test-support/support.ts";

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

  const { app, auth, cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const adminLogin = await loginAsAdmin(baseUrl, auth);
    assert.equal(adminLogin.response.status, 200);

    const queued = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        account_id: "ig-ui-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(queued.response.status, 202);
    await app.services.jobQueue.waitForIdle();

    const accountsResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: adminLogin.headers,
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

    const detailResponse = await fetch(`${baseUrl}/api/v1/ui/accounts/instagram/ig-ui-1`, {
      headers: adminLogin.headers,
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

test("ui read APIs scope accounts to the active JWT owner", async () => {
  const memberOwnerId = "22222222-2222-4222-8222-222222222222";
  const accounts = [
    {
      ...createAccount({
        platform: "instagram",
        accountId: "ig-owner-shared",
        clientName: "Admin Owner Account",
      }),
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    },
    {
      ...createAccount({
        platform: "instagram",
        accountId: "ig-member-only",
        clientName: "Member Owner Account",
      }),
      ownerUserId: memberOwnerId,
    },
  ];

  const { auth, cleanup, baseUrl } = await setupTestApp({
    accounts,
    fixtures: {
      "instagram--ig-owner-shared.json": { items: [] },
      "instagram--ig-member-only.json": { items: [] },
    },
  });

  try {
    auth.addUser({
      id: memberOwnerId,
      email: "member-owner@example.com",
      displayName: "成員擁有者",
      role: "member",
      status: "active",
    });

    const adminLogin = await loginAsAdmin(baseUrl, auth);
    assert.equal(adminLogin.response.status, 200);

    const memberHeaders = authHeaders(auth.authorizationFor(memberOwnerId));

    const adminAccounts = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: adminLogin.headers,
    });
    const adminJson = await adminAccounts.json();
    assert.equal(adminAccounts.status, 200);
    assert.deepEqual(
      adminJson.accounts.map((account) => account.accountId),
      ["ig-owner-shared"],
    );

    const memberAccounts = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: memberHeaders,
    });
    const memberJson = await memberAccounts.json();
    assert.equal(memberAccounts.status, 200);
    assert.deepEqual(
      memberJson.accounts.map((account) => account.accountId),
      ["ig-member-only"],
    );

    const crossOwnerDetail = await fetch(
      `${baseUrl}/api/v1/ui/accounts/instagram/ig-member-only`,
      { headers: adminLogin.headers },
    );
    const crossOwnerJson = await crossOwnerDetail.json();
    assert.equal(crossOwnerDetail.status, 404);
    assert.equal(crossOwnerJson.error, "ACCOUNT_NOT_FOUND");
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
        owner_user_id: "11111111-1111-4111-8111-111111111111",
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
    assert.equal(accountsJson.error, "MISSING_JWT");
  } finally {
    await cleanup();
  }
});

test("admin can review pending users through protected browser APIs", async () => {
  const { auth, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-1" })],
    fixtures: {
      "instagram--ig-auth-1.json": { items: [] },
    },
  });

  try {
    auth.addUser({
      id: "55555555-5555-4555-8555-555555555555",
      email: "member@example.com",
      displayName: "待審成員",
      status: "pending",
    });
    const register = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "待審成員",
      },
      authorization: auth.authorizationFor("55555555-5555-4555-8555-555555555555"),
    });
    assert.equal(register.response.status, 201);

    const adminLogin = await loginAsAdmin(baseUrl, auth);
    assert.equal(adminLogin.response.status, 200);

    const pendingBefore = await fetch(`${baseUrl}/api/v1/admin/pending-users`, {
      headers: adminLogin.headers,
    });
    const pendingBeforeJson = await pendingBefore.json();
    assert.equal(pendingBefore.status, 200);
    assert.equal(pendingBeforeJson.users.length, 1);

    const approve = await fetch(
      `${baseUrl}/api/v1/admin/pending-users/${pendingBeforeJson.users[0].id}/approve`,
      {
        method: "POST",
        headers: adminLogin.headers,
      },
    );
    const approveJson = await approve.json();
    assert.equal(approve.status, 200);
    assert.equal(approveJson.user.status, "active");

    const memberLogin = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/me",
      method: "GET",
      authorization: auth.authorizationFor("55555555-5555-4555-8555-555555555555"),
    });
    assert.equal(memberLogin.response.status, 200);
  } finally {
    await cleanup();
  }
});
