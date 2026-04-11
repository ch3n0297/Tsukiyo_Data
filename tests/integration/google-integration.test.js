import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "../../backend/src/services/user-auth-service.js";
import {
  createAccount,
  loginAsAdmin,
  readStoreFile,
  sendJsonRequest,
  setupTestApp,
} from "../../backend/test-support/support.js";

function createJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

test("admin can connect and disconnect a Google Spreadsheet binding for an account config", async () => {
  const googleFetchCalls = [];
  const { cleanup, baseUrl, app } = await setupTestApp({
    accounts: [
      createAccount({
        platform: "instagram",
        accountId: "ig-google-1",
        sheetId: "spreadsheet-123",
      }),
    ],
    fixtures: {
      "instagram--ig-google-1.json": { items: [] },
    },
    overrides: {
      googleClientId: "client-id",
      googleClientSecret: "client-secret",
      googleRedirectUri: "http://127.0.0.1:3000/api/v1/integrations/google/callback",
      googleTokenEncryptionKey: "test-google-token-secret",
      publicAppOrigin: "http://127.0.0.1:5173",
      googleFetchImpl: async (url, options = {}) => {
        googleFetchCalls.push([url, options]);

        if (url === "https://oauth2.googleapis.com/token") {
          return createJsonResponse(200, {
            access_token: "google-access-token",
            expires_in: 3600,
            refresh_token: "google-refresh-token",
            scope: "openid email profile https://www.googleapis.com/auth/drive.file",
            token_type: "Bearer",
          });
        }

        if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
          return createJsonResponse(200, {
            sub: "google-user-1",
            email: "ops@example.com",
            email_verified: true,
            name: "Ops User",
          });
        }

        if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/spreadsheet-123?fields=spreadsheetId,properties.title,sheets.properties.title")) {
          return createJsonResponse(200, {
            spreadsheetId: "spreadsheet-123",
            properties: {
              title: "Client Spreadsheet",
            },
            sheets: [],
          });
        }

        if (url === "https://oauth2.googleapis.com/revoke") {
          return createJsonResponse(200, {});
        }

        throw new Error(`Unexpected Google fetch URL: ${url}`);
      },
    },
  });

  try {
    const adminLogin = await loginAsAdmin(baseUrl);
    const accountId = "instagram-ig-google-1";
    const startResponse = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/integrations/google/start",
      body: {
        account_config_id: accountId,
        redirect_to: "/",
      },
      cookie: adminLogin.cookie,
    });

    assert.equal(startResponse.response.status, 200);
    const authorizationUrl = new URL(startResponse.json.authorization_url);
    assert.equal(authorizationUrl.origin, "https://accounts.google.com");
    assert.equal(authorizationUrl.searchParams.get("client_id"), "client-id");
    const state = authorizationUrl.searchParams.get("state");
    assert.ok(state);

    const callbackResponse = await fetch(
      `${baseUrl}/api/v1/integrations/google/callback?code=test-code&state=${encodeURIComponent(state)}`,
      {
        headers: {
          cookie: adminLogin.cookie,
        },
        redirect: "manual",
      },
    );

    assert.equal(callbackResponse.status, 302);
    const callbackRedirect = new URL(callbackResponse.headers.get("location"));
    assert.equal(callbackRedirect.origin, "http://127.0.0.1:5173");
    assert.equal(callbackRedirect.searchParams.get("integration_status"), "success");

    const connectionStatus = await fetch(
      `${baseUrl}/api/v1/integrations/google/connections/${encodeURIComponent(accountId)}`,
      {
        headers: {
          cookie: adminLogin.cookie,
        },
      },
    );
    const connectionStatusJson = await connectionStatus.json();
    assert.equal(connectionStatus.status, 200);
    assert.equal(connectionStatusJson.connection.status, "active");
    assert.equal(connectionStatusJson.connection.authorizedEmail, "ops@example.com");

    const uiDetail = await fetch(`${baseUrl}/api/v1/ui/accounts/instagram/ig-google-1`, {
      headers: {
        cookie: adminLogin.cookie,
      },
    });
    const uiDetailJson = await uiDetail.json();
    assert.equal(uiDetail.status, 200);
    assert.equal(uiDetailJson.account.googleConnection.status, "active");
    assert.equal(uiDetailJson.account.allowedSpreadsheetId, "spreadsheet-123");

    const storedConnections = await readStoreFile(app, "google-connections.json");
    assert.equal(storedConnections.length, 1);
    assert.equal(storedConnections[0].authorizedEmail, "ops@example.com");
    assert.notEqual(storedConnections[0].refreshTokenEncrypted, "google-refresh-token");

    const disconnect = await sendJsonRequest({
      baseUrl,
      pathName: `/api/v1/integrations/google/connections/${encodeURIComponent(accountId)}/disconnect`,
      cookie: adminLogin.cookie,
    });
    assert.equal(disconnect.response.status, 200);

    const updatedConnections = await readStoreFile(app, "google-connections.json");
    assert.equal(updatedConnections[0].status, "revoked");
    assert.equal(updatedConnections[0].refreshTokenEncrypted, null);

    const storedAccounts = await readStoreFile(app, "account-configs.json");
    assert.equal(storedAccounts[0].googleConnectionId, null);
    assert.ok(googleFetchCalls.some(([url]) => url === "https://oauth2.googleapis.com/revoke"));
  } finally {
    await cleanup();
  }
});

test("google authorization start rejects untrusted origins and callback redirect stays app-relative", async () => {
  const { cleanup, baseUrl } = await setupTestApp({
    accounts: [
      createAccount({
        platform: "instagram",
        accountId: "ig-google-redirect-1",
        sheetId: "spreadsheet-123",
      }),
    ],
    fixtures: {
      "instagram--ig-google-redirect-1.json": { items: [] },
    },
    overrides: {
      googleClientId: "client-id",
      googleClientSecret: "client-secret",
      googleRedirectUri: "http://127.0.0.1:3000/api/v1/integrations/google/callback",
      googleTokenEncryptionKey: "test-google-token-secret",
      publicAppOrigin: "http://127.0.0.1:5173",
      googleFetchImpl: async (url) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return createJsonResponse(200, {
            access_token: "google-access-token",
            expires_in: 3600,
            refresh_token: "google-refresh-token",
            scope: "openid email profile https://www.googleapis.com/auth/drive.file",
            token_type: "Bearer",
          });
        }

        if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
          return createJsonResponse(200, {
            sub: "google-user-1",
            email: "ops@example.com",
            email_verified: true,
            name: "Ops User",
          });
        }

        if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/spreadsheet-123?fields=spreadsheetId,properties.title,sheets.properties.title")) {
          return createJsonResponse(200, {
            spreadsheetId: "spreadsheet-123",
            properties: {
              title: "Client Spreadsheet",
            },
            sheets: [],
          });
        }

        if (url === "https://oauth2.googleapis.com/revoke") {
          return createJsonResponse(200, {});
        }

        throw new Error(`Unexpected Google fetch URL: ${url}`);
      },
    },
  });

  try {
    const adminLogin = await loginAsAdmin(baseUrl);
    const accountId = "instagram-ig-google-redirect-1";

    const untrustedStart = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/integrations/google/start",
      body: {
        account_config_id: accountId,
        redirect_to: "https://evil.example.com/pwn",
      },
      cookie: adminLogin.cookie,
      origin: "https://evil.example.com",
    });
    assert.equal(untrustedStart.response.status, 403);
    assert.equal(untrustedStart.json.error, "UNTRUSTED_ORIGIN");

    const startResponse = await sendJsonRequest({
      baseUrl,
      pathName: "/api/v1/integrations/google/start",
      body: {
        account_config_id: accountId,
        redirect_to: "https://evil.example.com/pwn",
      },
      cookie: adminLogin.cookie,
    });
    assert.equal(startResponse.response.status, 200);
    const authorizationUrl = new URL(startResponse.json.authorization_url);
    const state = authorizationUrl.searchParams.get("state");
    assert.ok(state);

    const callbackResponse = await fetch(
      `${baseUrl}/api/v1/integrations/google/callback?code=test-code&state=${encodeURIComponent(state)}`,
      {
        headers: {
          cookie: adminLogin.cookie,
        },
        redirect: "manual",
      },
    );
    assert.equal(callbackResponse.status, 302);
    const callbackRedirect = new URL(callbackResponse.headers.get("location"));
    assert.equal(callbackRedirect.origin, "http://127.0.0.1:5173");
    assert.equal(callbackRedirect.pathname, "/");
    assert.equal(callbackRedirect.searchParams.get("integration_status"), "success");
  } finally {
    await cleanup();
  }
});

test("member dashboard access is filtered by tenant key", async () => {
  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts: [
      createAccount({
        clientName: "Tenant A",
        platform: "instagram",
        accountId: "ig-tenant-a",
        tenantKey: "tenant-a",
      }),
      createAccount({
        clientName: "Tenant B",
        platform: "facebook",
        accountId: "fb-tenant-b",
        tenantKey: "tenant-b",
      }),
    ],
    fixtures: {
      "instagram--ig-tenant-a.json": { items: [] },
      "facebook--fb-tenant-b.json": { items: [] },
    },
  });

  try {
    const now = "2026-03-24T02:00:00.000Z";
    await app.services.userRepository.create({
      id: "member-tenant-a",
      email: "member@example.com",
      displayName: "Tenant A Member",
      passwordHash: await hashPassword("MemberPassword123!"),
      role: "member",
      status: "active",
      tenantKey: "tenant-a",
      approvedAt: now,
      approvedBy: "admin@example.com",
      rejectedAt: null,
      rejectedBy: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Member must use session directly because password login is restricted to admin
    const memberSession = await app.services.userAuthService.createAuthenticatedSession("member-tenant-a");
    const memberCookie = app.services.userAuthService.createSessionCookie(memberSession.session.id);
    assert.ok(memberCookie);

    const listResponse = await fetch(`${baseUrl}/api/v1/ui/accounts`, {
      headers: {
        cookie: memberCookie,
      },
    });
    const listJson = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listJson.accounts.length, 1);
    assert.equal(listJson.accounts[0].tenantKey, "tenant-a");

    const forbiddenDetail = await fetch(`${baseUrl}/api/v1/ui/accounts/facebook/fb-tenant-b`, {
      headers: {
        cookie: memberCookie,
      },
    });
    const forbiddenDetailJson = await forbiddenDetail.json();
    assert.equal(forbiddenDetail.status, 404);
    assert.equal(forbiddenDetailJson.error, "ACCOUNT_NOT_FOUND");
  } finally {
    await cleanup();
  }
});
