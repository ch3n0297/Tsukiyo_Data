import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../backend/src/config.js";

function withTemporaryEnv(changes, run) {
  const original = {
    API_SHARED_SECRET: process.env.API_SHARED_SECRET,
    ALLOWED_CLIENT_IDS: process.env.ALLOWED_CLIENT_IDS,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    NODE_ENV: process.env.NODE_ENV,
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
  };

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("loadConfig requires API_SHARED_SECRET when no override is provided", () => {
  withTemporaryEnv(
    {
      API_SHARED_SECRET: undefined,
      ALLOWED_CLIENT_IDS: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /API_SHARED_SECRET must be configured/i);
    },
  );
});

test("loadConfig filters blank allowed client IDs and rejects empty results", () => {
  withTemporaryEnv(
    {
      API_SHARED_SECRET: "local-dev-secret",
      ALLOWED_CLIENT_IDS: " ,  ",
    },
    () => {
      assert.throws(() => loadConfig(), /ALLOWED_CLIENT_IDS must include at least one/i);
    },
  );
});

test("loadConfig keeps non-empty allowed client IDs only", () => {
  withTemporaryEnv(
    {
      API_SHARED_SECRET: "local-dev-secret",
      ALLOWED_CLIENT_IDS: "demo-sheet, ,apps-script  ",
    },
    () => {
      const config = loadConfig();
      assert.deepEqual(config.allowedClientIds, ["demo-sheet", "apps-script"]);
    },
  );
});

test("loadConfig rejects partial Google OAuth configuration", () => {
  withTemporaryEnv(
    {
      API_SHARED_SECRET: "local-dev-secret",
      ALLOWED_CLIENT_IDS: "demo-sheet",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REDIRECT_URI: "http://localhost/callback",
      GOOGLE_TOKEN_ENCRYPTION_KEY: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /GOOGLE_CLIENT_ID \/ GOOGLE_CLIENT_SECRET/i);
    },
  );
});

test("loadConfig requires a token encryption key when Google OAuth is enabled", () => {
  withTemporaryEnv(
    {
      API_SHARED_SECRET: "local-dev-secret",
      ALLOWED_CLIENT_IDS: "demo-sheet",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REDIRECT_URI: "http://localhost/callback",
      GOOGLE_TOKEN_ENCRYPTION_KEY: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /GOOGLE_TOKEN_ENCRYPTION_KEY/i);
    },
  );
});

test("loadConfig requires secure session cookies in production", () => {
  withTemporaryEnv(
    {
      API_SHARED_SECRET: "local-dev-secret",
      ALLOWED_CLIENT_IDS: "demo-sheet",
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "false",
    },
    () => {
      assert.throws(() => loadConfig(), /SESSION_COOKIE_SECURE must be enabled in production/i);
    },
  );
});
