import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  loginAsAdmin,
  readSessionCookie,
  sendJsonRequest,
  setupTestApp,
} from "../../backend/test-support/support.js";

function createMockGoogleFetch({ sub = "google-sub-123", email = "user@example.com", name = "Test User" } = {}) {
  return async (url, options) => {
    const urlString = typeof url === "string" ? url : url.toString();

    if (urlString.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (urlString.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return new Response(
        JSON.stringify({ sub, email, name }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response("Not Found", { status: 404 });
  };
}

const GOOGLE_LOGIN_OVERRIDES = {
  googleClientId: "test-client-id",
  googleClientSecret: "test-client-secret",
  googleLoginRedirectUri: "http://localhost:3000/api/v1/auth/google/callback",
  googleTokenEncryptionKey: "test-encryption-key-for-google-tokens",
};

test("Google login start returns authorization URL when enabled", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-1" })],
    fixtures: { "instagram--ig-gl-1.json": { items: [] } },
    overrides: GOOGLE_LOGIN_OVERRIDES,
  });

  try {
    const result = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/google/start",
      body: { redirect_to: "/" },
    });

    assert.equal(result.response.status, 200);
    assert.ok(result.json.authorization_url);
    assert.ok(result.json.authorization_url.includes("accounts.google.com"));
    assert.ok(result.json.authorization_url.includes("test-client-id"));
    assert.ok(result.json.authorization_url.includes("openid"));
  } finally {
    await cleanup();
  }
});

test("Google login start returns 503 when Google login is disabled", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-2" })],
    fixtures: { "instagram--ig-gl-2.json": { items: [] } },
  });

  try {
    const result = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/google/start",
      body: { redirect_to: "/" },
    });

    assert.equal(result.response.status, 503);
    assert.equal(result.json.error, "GOOGLE_LOGIN_DISABLED");
  } finally {
    await cleanup();
  }
});

test("Google login callback creates new user and redirects with session", async () => {
  const mockFetch = createMockGoogleFetch();

  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-3", tenantKey: "tenant-demo" })],
    fixtures: { "instagram--ig-gl-3.json": { items: [] } },
    overrides: {
      ...GOOGLE_LOGIN_OVERRIDES,
      googleFetchImpl: mockFetch,
    },
  });

  try {
    // Set up default tenant for Google login
    await app.services.googleLoginSettingsRepository.saveSettings({
      id: "google-login-settings",
      defaultTenantKey: "tenant-demo",
      rules: [],
    });

    // First create an oauth state to simulate the flow
    const startResult = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/google/start",
      body: { redirect_to: "/" },
    });

    assert.equal(startResult.response.status, 200);

    // Extract the state from the authorization URL
    const authUrl = new URL(startResult.json.authorization_url);
    const stateParam = authUrl.searchParams.get("state");
    assert.ok(stateParam);

    // Simulate the callback
    const callbackResponse = await fetch(
      `${baseUrl}/api/v1/auth/google/callback?code=mock-auth-code&state=${stateParam}`,
      { redirect: "manual" },
    );

    assert.equal(callbackResponse.status, 302);
    const location = callbackResponse.headers.get("location");
    assert.ok(location);
    assert.ok(location.includes("auth=google"));
    assert.ok(location.includes("auth_status=success"));

    // Should have set a session cookie
    const sessionCookie = readSessionCookie(callbackResponse);
    assert.ok(sessionCookie);

    // Verify user was created
    const users = await app.services.userRepository.listAll();
    const googleUser = users.find((u) => u.email === "user@example.com");
    assert.ok(googleUser);
    assert.equal(googleUser.status, "active");
    assert.deepEqual(googleUser.authMethods, ["google"]);
    assert.equal(googleUser.googleSub, "google-sub-123");
    assert.equal(googleUser.tenantKey, "tenant-demo");

    // Session should be valid - can access /me
    const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: sessionCookie },
    });
    const meJson = await meResponse.json();
    assert.equal(meResponse.status, 200);
    assert.equal(meJson.user.email, "user@example.com");
  } finally {
    await cleanup();
  }
});

test("Google login callback links existing user by email", async () => {
  const mockFetch = createMockGoogleFetch({ email: "admin@example.com" });

  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-4", tenantKey: "tenant-demo" })],
    fixtures: { "instagram--ig-gl-4.json": { items: [] } },
    overrides: {
      ...GOOGLE_LOGIN_OVERRIDES,
      googleFetchImpl: mockFetch,
    },
  });

  try {
    await app.services.googleLoginSettingsRepository.saveSettings({
      id: "google-login-settings",
      defaultTenantKey: "tenant-demo",
      rules: [],
    });

    const startResult = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/google/start",
      body: { redirect_to: "/" },
    });

    const authUrl = new URL(startResult.json.authorization_url);
    const stateParam = authUrl.searchParams.get("state");

    const callbackResponse = await fetch(
      `${baseUrl}/api/v1/auth/google/callback?code=mock-auth-code&state=${stateParam}`,
      { redirect: "manual" },
    );

    assert.equal(callbackResponse.status, 302);
    const location = callbackResponse.headers.get("location");
    assert.ok(location.includes("auth_status=success"));

    // Admin user should now have Google linked
    const users = await app.services.userRepository.listAll();
    const adminUser = users.find((u) => u.email === "admin@example.com");
    assert.ok(adminUser);
    assert.ok(adminUser.authMethods.includes("google"));
    assert.equal(adminUser.googleSub, "google-sub-123");
  } finally {
    await cleanup();
  }
});

test("Google login callback with invalid state redirects with error", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-5" })],
    fixtures: { "instagram--ig-gl-5.json": { items: [] } },
    overrides: GOOGLE_LOGIN_OVERRIDES,
  });

  try {
    const callbackResponse = await fetch(
      `${baseUrl}/api/v1/auth/google/callback?code=mock-auth-code&state=invalid-state-id`,
      { redirect: "manual" },
    );

    assert.equal(callbackResponse.status, 302);
    const location = callbackResponse.headers.get("location");
    assert.ok(location.includes("auth_status=error"));
  } finally {
    await cleanup();
  }
});

test("Admin can still login with email and password", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-6" })],
    fixtures: { "instagram--ig-gl-6.json": { items: [] } },
    overrides: GOOGLE_LOGIN_OVERRIDES,
  });

  try {
    const result = await loginAsAdmin(baseUrl);
    assert.equal(result.response.status, 200);
    assert.ok(result.cookie);
    assert.equal(result.json.user.role, "admin");
  } finally {
    await cleanup();
  }
});

test("Google login start rejects untrusted origins", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [createAccount({ platform: "instagram", accountId: "ig-gl-7" })],
    fixtures: { "instagram--ig-gl-7.json": { items: [] } },
    overrides: GOOGLE_LOGIN_OVERRIDES,
  });

  try {
    const result = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/auth/google/start",
      body: { redirect_to: "/" },
      origin: "https://evil.example.com",
    });

    assert.equal(result.response.status, 403);
    assert.equal(result.json.error, "UNTRUSTED_ORIGIN");
  } finally {
    await cleanup();
  }
});
