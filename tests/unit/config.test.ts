import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../backend/src/config.ts";

function withTemporaryEnv(changes, run) {
  const original = {
    API_SHARED_SECRET: process.env.API_SHARED_SECRET,
    ALLOWED_CLIENT_IDS: process.env.ALLOWED_CLIENT_IDS,
  };

  if (changes.API_SHARED_SECRET === undefined) {
    delete process.env.API_SHARED_SECRET;
  } else {
    process.env.API_SHARED_SECRET = changes.API_SHARED_SECRET;
  }

  if (changes.ALLOWED_CLIENT_IDS === undefined) {
    delete process.env.ALLOWED_CLIENT_IDS;
  } else {
    process.env.ALLOWED_CLIENT_IDS = changes.ALLOWED_CLIENT_IDS;
  }

  try {
    return run();
  } finally {
    if (original.API_SHARED_SECRET === undefined) {
      delete process.env.API_SHARED_SECRET;
    } else {
      process.env.API_SHARED_SECRET = original.API_SHARED_SECRET;
    }

    if (original.ALLOWED_CLIENT_IDS === undefined) {
      delete process.env.ALLOWED_CLIENT_IDS;
    } else {
      process.env.ALLOWED_CLIENT_IDS = original.ALLOWED_CLIENT_IDS;
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
