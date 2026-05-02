import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  readStoreFile,
  sendSignedJson,
  setupTestApp,
} from "../../backend/test-support/support.ts";

test("manual refresh rejects invalid refresh_days", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-invalid-1" })];
  const fixtures = {
    "instagram--ig-invalid-1.json": { items: [] },
  };
  const { cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const { response, json } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        account_id: "ig-invalid-1",
        refresh_days: 366,
        request_source: "apps-script",
      },
    });

    assert.equal(response.status, 400);
    assert.match(json.system_message, /refresh_days/i);
  } finally {
    await cleanup();
  }
});

test("manual refresh rejects duplicate active jobs", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-dup-1" })];
  const fixtures = {
    "instagram--ig-dup-1.json": {
      items: [
        {
          id: "ig-dup",
          media_type: "reel",
          caption: "Duplicate test",
          permalink: "https://instagram.example.com/p/ig-dup",
          timestamp: "2026-03-17T10:00:00.000Z",
          metrics: { plays: 100, likes: 10, comments: 1, shares: 1 },
        },
      ],
    },
  };
  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts,
    fixtures,
    overrides: {
      maxConcurrentJobs: 1,
    },
  });

  const originalProcessJob = app.services.jobQueue.processJob;
  app.services.jobQueue.processJob = async (job) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return originalProcessJob(job);
  };

  try {
    const first = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        account_id: "ig-dup-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });
    assert.equal(first.response.status, 202);

    const second = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        account_id: "ig-dup-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(second.response.status, 409);
    assert.match(second.json.system_message, /待處理或執行中/);
    await app.services.jobQueue.waitForIdle();
  } finally {
    await cleanup();
  }
});

test("manual refresh rate limits by request source", async () => {
  const accounts = [
    createAccount({ platform: "instagram", accountId: "ig-rate-1" }),
    createAccount({ platform: "facebook", accountId: "fb-rate-1" }),
  ];
  const fixtures = {
    "instagram--ig-rate-1.json": {
      items: [
        {
          id: "ig-rate",
          media_type: "reel",
          caption: "Rate test",
          permalink: "https://instagram.example.com/p/ig-rate",
          timestamp: "2026-03-17T10:00:00.000Z",
          metrics: { plays: 100, likes: 10, comments: 1, shares: 1 },
        },
      ],
    },
    "facebook--fb-rate-1.json": {
      items: [
        {
          post_id: "fb-rate",
          type: "video",
          message: "Rate test",
          permalink_url: "https://facebook.example.com/p/fb-rate",
          created_time: "2026-03-17T10:00:00.000Z",
          insights: { video_views: 120, reactions: 12, comments: 2, shares: 1 },
        },
      ],
    },
  };
  const { app, cleanup, baseUrl } = await setupTestApp({
    accounts,
    fixtures,
    overrides: {
      sourceRateLimitMax: 1,
      accountCooldownMs: 0,
    },
  });

  try {
    const first = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        account_id: "ig-rate-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });
    assert.equal(first.response.status, 202);

    const second = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "facebook",
        account_id: "fb-rate-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(second.response.status, 429);
    assert.match(second.json.system_message, /頻率過高|過於頻繁/);
    await app.services.jobQueue.waitForIdle();
  } finally {
    await cleanup();
  }
});

test("upstream failures mark the job and sheet snapshot as error", async () => {
  const accounts = [createAccount({ platform: "tiktok", accountId: "tt-fail-1" })];
  const fixtures = {
    "tiktok--tt-fail-1.json": {
      error: {
        code: "TOKEN_EXPIRED",
        message: "Token expired",
      },
    },
  };
  const { app, cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  try {
    const { response } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "tiktok",
        account_id: "tt-fail-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(response.status, 202);
    await app.services.jobQueue.waitForIdle();

    const jobs = await app.services.jobRepository.listAll();
    assert.equal(jobs[0].status, "error");
    assert.equal(jobs[0].errorCode, "TOKEN_EXPIRED");

    const sheetStatuses = await readStoreFile(app, "sheet-status.json");
    const snapshot = sheetStatuses.find((entry) => entry.accountId === "tt-fail-1");
    assert.equal(snapshot.refreshStatus, "error");
    assert.match(snapshot.systemMessage, /授權已過期/);
  } finally {
    await cleanup();
  }
});
