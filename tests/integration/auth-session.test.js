import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  loginAsAdmin,
  readStoreFile,
  sendJsonRequest,
  setupTestApp,
} from "../../backend/test-support/support.js";

test("registration creates a pending user and blocks login until approved", async () => {
  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-pending-1" })],
    fixtures: {
      "instagram--ig-auth-pending-1.json": { items: [] },
    },
  });

  try {
    const register = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "新成員",
        email: "pending@example.com",
        password: "PendingPassword123!",
      },
    });

    assert.equal(register.response.status, 201);
    assert.equal(register.json.status, "pending");

    const login = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/login",
      body: {
        email: "pending@example.com",
        password: "PendingPassword123!",
      },
    });

    assert.equal(login.response.status, 403);
    assert.equal(login.json.error, "USER_PENDING");

    const users = await app.services.userRepository.listAll();
    const pendingUser = users.find((user) => user.email === "pending@example.com");
    assert.ok(pendingUser);
    assert.equal(pendingUser.status, "pending");
  } finally {
    await cleanup();
  }
});

test("authenticated sessions protect UI APIs and can be logged out", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-ui-1" })],
    fixtures: {
      "instagram--ig-auth-ui-1.json": { items: [] },
    },
  });

  try {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/ui/accounts`);
    const unauthenticatedJson = await unauthenticated.json();
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticatedJson.error, "AUTH_REQUIRED");

    const login = await loginAsAdmin(baseUrl);
    assert.equal(login.response.status, 200);
    assert.ok(login.cookie);

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        cookie: login.cookie,
      },
    });
    const meJson = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meJson.user.role, "admin");

    const protectedResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: {
        cookie: login.cookie,
      },
    });
    assert.equal(protectedResponse.status, 200);

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        cookie: login.cookie,
        origin: "http://127.0.0.1:5173",
      },
    });
    const logoutJson = await logout.json();
    assert.equal(logout.status, 200);
    assert.equal(logoutJson.system_message, "已成功登出。");
    assert.ok(logout.headers.get("set-cookie"));

    const afterLogout = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: {
        cookie: login.cookie,
      },
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await cleanup();
  }
});

test("forgot-password writes a reset link to outbox and reset invalidates old password", async () => {
  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-reset-1" })],
    fixtures: {
      "instagram--ig-auth-reset-1.json": { items: [] },
    },
  });

  try {
    const adminLogin = await loginAsAdmin(baseUrl);
    const register = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "重設成員",
        email: "reset@example.com",
        password: "ResetPassword123!",
      },
    });
    assert.equal(register.response.status, 201);

    const pendingUsers = await fetch(`${baseUrl}/api/v1/admin/pending-users`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const pendingUsersJson = await pendingUsers.json();
    assert.equal(pendingUsers.status, 200);
    const targetUser = pendingUsersJson.users.find((user) => user.email === "reset@example.com");
    assert.ok(targetUser);

    const approve = await fetch(`${baseUrl}/api/v1/admin/pending-users/${targetUser.id}/approve`, {
      method: "POST",
      headers: {
        cookie: adminLogin.cookie,
        origin: "http://127.0.0.1:5173",
      },
    });
    const approveJson = await approve.json();
    assert.equal(approve.status, 200);
    assert.equal(approveJson.user.id, targetUser.id);
    assert.equal(approveJson.user.status, "active");

    const forgot = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/forgot-password",
      body: {
        email: "reset@example.com",
      },
    });
    assert.equal(forgot.response.status, 200);

    const outboxMessages = await readStoreFile(app, "outbox-messages.json");
    const resetMessage = outboxMessages.find((message) => message.type === "password-reset");
    assert.ok(resetMessage);

    const resetUrl = new URL(
      resetMessage.body.replace(/^.*(https?:\/\/[^\s]+).*$/, "$1"),
    );
    const token = resetUrl.searchParams.get("token");
    assert.ok(token);

    const reset = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/reset-password",
      body: {
        token,
        password: "ResetPassword456!",
      },
    });
    assert.equal(reset.response.status, 200);

    // Old password is invalid after reset (401), new password is valid but
    // member password login is blocked (403 GOOGLE_LOGIN_REQUIRED).
    const oldLogin = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/login",
      body: {
        email: "reset@example.com",
        password: "ResetPassword123!",
      },
    });
    assert.equal(oldLogin.response.status, 401);
    assert.equal(oldLogin.json.error, "LOGIN_FAILED");

    const newLogin = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/login",
      body: {
        email: "reset@example.com",
        password: "ResetPassword456!",
      },
    });
    assert.equal(newLogin.response.status, 403);
    assert.equal(newLogin.json.error, "GOOGLE_LOGIN_REQUIRED");
  } finally {
    await cleanup();
  }
});

test("admin approval rejects requests from an untrusted origin", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-auth-origin-1" })],
    fixtures: {
      "instagram--ig-auth-origin-1.json": { items: [] },
    },
  });

  try {
    const register = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/register",
      body: {
        display_name: "跨站待審",
        email: "origin-check@example.com",
        password: "OriginPassword123!",
      },
    });
    assert.equal(register.response.status, 201);

    const adminLogin = await loginAsAdmin(baseUrl);
    const pendingUsers = await fetch(`${baseUrl}/api/v1/admin/pending-users`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const pendingUsersJson = await pendingUsers.json();
    const targetUser = pendingUsersJson.users.find((user) => user.email === "origin-check@example.com");
    assert.ok(targetUser);

    const approve = await fetch(`${baseUrl}/api/v1/admin/pending-users/${targetUser.id}/approve`, {
      method: "POST",
      headers: {
        cookie: adminLogin.cookie,
        origin: "https://evil.example.com",
      },
    });
    const approveJson = await approve.json();
    assert.equal(approve.status, 403);
    assert.equal(approveJson.error, "UNTRUSTED_ORIGIN");

    const stillPending = await fetch(`${baseUrl}/api/v1/admin/pending-users`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const stillPendingJson = await stillPending.json();
    assert.ok(stillPendingJson.users.some((user) => user.id === targetUser.id));
  } finally {
    await cleanup();
  }
});
