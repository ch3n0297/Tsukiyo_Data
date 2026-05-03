import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  loginAsAdmin,
  sendJsonRequest,
  setupTestApp,
} from "../../backend/test-support/support.ts";

test("Supabase JWT signup sync creates pending user and blocks protected access until approved", async () => {
  const { auth, app, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-pending-1" })],
    fixtures: {
      "instagram--ig-auth-pending-1.json": { items: [] },
    },
  });

  try {
    auth.addUser({
      id: "22222222-2222-4222-8222-222222222222",
      email: "pending@example.com",
      displayName: "新成員",
      status: "pending",
    });
    const authorization = auth.authorizationFor("22222222-2222-4222-8222-222222222222");

    const register = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "新成員",
      },
      authorization,
    });

    assert.equal(register.response.status, 201);
    assert.equal(register.json.status, "pending");
    const authUser = auth.users.get("22222222-2222-4222-8222-222222222222");
    assert.equal(authUser?.app_metadata.status, "pending");
    assert.equal(authUser?.app_metadata.role, "member");

    const me = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/me",
      method: "GET",
      authorization,
    });
    assert.equal(me.response.status, 403);
    assert.equal(me.json.error, "USER_PENDING");

    const pendingUser = await app.services.userRepository.findById("22222222-2222-4222-8222-222222222222");
    assert.ok(pendingUser);
    assert.equal(pendingUser.email, "pending@example.com");
  } finally {
    await cleanup();
  }
});

test("signup sync rejects password and frontend-controlled identity fields", async () => {
  const { auth, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-reject-1" })],
    fixtures: {
      "instagram--ig-auth-reject-1.json": { items: [] },
    },
  });

  try {
    auth.addUser({
      id: "33333333-3333-4333-8333-333333333333",
      email: "reject@example.com",
      displayName: "惡意欄位",
      status: "pending",
    });
    const rejected = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "惡意欄位",
        email: "spoof@example.com",
        password: "ShouldNotReachBackend123!",
      },
      authorization: auth.authorizationFor("33333333-3333-4333-8333-333333333333"),
    });

    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.json.error, "VALIDATION_ERROR");
  } finally {
    await cleanup();
  }
});

test("Bearer JWT protects UI APIs and logout is a storage-free compatibility no-op", async () => {
  const { auth, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-ui-1" })],
    fixtures: {
      "instagram--ig-auth-ui-1.json": { items: [] },
    },
  });

  try {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/ui/accounts`);
    const unauthenticatedJson = await unauthenticated.json();
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticatedJson.error, "MISSING_JWT");

    const adminLogin = await loginAsAdmin(baseUrl, auth);
    assert.equal(adminLogin.response.status, 200);

    const protectedResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: adminLogin.headers,
    });
    assert.equal(protectedResponse.status, 200);

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: adminLogin.headers,
    });
    const logoutJson = await logout.json();
    assert.equal(logout.status, 200);
    assert.equal(logoutJson.system_message, "已成功登出。");
    assert.equal(logout.headers.get("set-cookie"), null);

    const afterLogout = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: adminLogin.headers,
    });
    assert.equal(afterLogout.status, 200);
  } finally {
    await cleanup();
  }
});

test("admin approval updates Supabase app metadata and pending list", async () => {
  const { auth, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-approve-1" })],
    fixtures: {
      "instagram--ig-auth-approve-1.json": { items: [] },
    },
  });

  try {
    auth.addUser({
      id: "44444444-4444-4444-8444-444444444444",
      email: "approve@example.com",
      displayName: "待核准",
      status: "pending",
    });
    await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: { display_name: "待核准" },
      authorization: auth.authorizationFor("44444444-4444-4444-8444-444444444444"),
    });

    const adminLogin = await loginAsAdmin(baseUrl, auth);
    const pendingUsers = await fetch(`${baseUrl}/api/v1/admin/pending-users`, {
      headers: adminLogin.headers,
    });
    const pendingUsersJson = await pendingUsers.json();
    assert.equal(pendingUsers.status, 200);
    assert.ok(pendingUsersJson.users.some((user) => user.id === "44444444-4444-4444-8444-444444444444"));

    const approve = await fetch(`${baseUrl}/api/v1/admin/pending-users/44444444-4444-4444-8444-444444444444/approve`, {
      method: "POST",
      headers: adminLogin.headers,
    });
    const approveJson = await approve.json();
    assert.equal(approve.status, 200);
    assert.equal(approveJson.user.status, "active");
    assert.equal(auth.users.get("44444444-4444-4444-8444-444444444444")?.app_metadata.status, "active");

    const resyncAfterApproval = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: { display_name: "待核准" },
      authorization: auth.authorizationFor("44444444-4444-4444-8444-444444444444"),
    });
    assert.equal(resyncAfterApproval.response.status, 409);
    assert.equal(resyncAfterApproval.json.error, "USER_STATUS_INVALID");
    assert.equal(auth.users.get("44444444-4444-4444-8444-444444444444")?.app_metadata.status, "active");
  } finally {
    await cleanup();
  }
});

test("legacy login and password reset endpoints are disabled", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-legacy-1" })],
    fixtures: {
      "instagram--ig-auth-legacy-1.json": { items: [] },
    },
  });

  try {
    for (const pathName of [
      "/api/v1/auth/login",
      "/api/v1/auth/forgot-password",
      "/api/v1/auth/reset-password",
    ]) {
      const response = await sendJsonRequest({
        baseUrl,
        pathName,
        body: {},
      });
      assert.equal(response.response.status, 410);
      assert.equal(response.json.error, "LEGACY_AUTH_REMOVED");
    }
  } finally {
    await cleanup();
  }
});
