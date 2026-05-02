import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  readStoreFile,
  sendSignedJson,
  setupTestApp,
} from "../../backend/test-support/support.ts";

test("manual refresh returns queued immediately and completes asynchronously", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-manual-1" })];
  const fixtures = {
    "instagram--ig-manual-1.json": {
      items: [
        {
          id: "ig-manual-post",
          media_type: "reel",
          caption: "Manual refresh item",
          permalink: "https://instagram.example.com/p/ig-manual-post",
          timestamp: "2026-03-17T10:00:00.000Z",
          metrics: { plays: 410, likes: 35, comments: 6, shares: 2 },
        },
      ],
    },
  };

  const { app, baseUrl, cleanup } = await setupTestApp({ accounts, fixtures });

  try {
    const { response, json } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        account_id: "ig-manual-1",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(response.status, 202);
    assert.equal(json.status, "queued");
    assert.ok(json.job_id);

    const initialJobs = await app.services.jobRepository.listAll();
    assert.equal(initialJobs.length, 1);
    assert.ok(["queued", "running", "success"].includes(initialJobs[0].status));

    await app.services.jobQueue.waitForIdle();

    const jobs = await app.services.jobRepository.listAll();
    assert.equal(jobs[0].status, "success");

    const statuses = await readStoreFile(app, "sheet-status.json");
    const snapshot = statuses.find((entry) => entry.accountId === "ig-manual-1");
    assert.equal(snapshot.refreshStatus, "success");

    const output = await readStoreFile(app, "sheet-output.json");
    assert.equal(output[0].rows.length, 1);
  } finally {
    await cleanup();
  }
});

test("manual refresh requires a valid active owner in the signed payload", async () => {
  const pendingOwnerId = "22222222-2222-4222-8222-222222222222";
  const accounts = [
    {
      ...createAccount({ platform: "instagram", accountId: "ig-owned-manual" }),
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    },
  ];
  const { auth, baseUrl, cleanup } = await setupTestApp({
    accounts,
    fixtures: {
      "instagram--ig-owned-manual.json": { items: [] },
    },
  });

  try {
    auth.addUser({
      id: pendingOwnerId,
      email: "pending-owner@example.com",
      displayName: "待審擁有者",
      status: "pending",
    });

    const missingOwner = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        platform: "instagram",
        account_id: "ig-owned-manual",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });
    assert.equal(missingOwner.response.status, 400);
    assert.equal(missingOwner.json.error, "VALIDATION_ERROR");

    const unknownOwner = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: "99999999-9999-4999-8999-999999999999",
        platform: "instagram",
        account_id: "ig-owned-manual",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });
    assert.equal(unknownOwner.response.status, 404);
    assert.equal(unknownOwner.json.error, "USER_NOT_FOUND");

    const pendingOwner = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: pendingOwnerId,
        platform: "instagram",
        account_id: "ig-owned-manual",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });
    assert.equal(pendingOwner.response.status, 403);
    assert.equal(pendingOwner.json.error, "USER_PENDING");
  } finally {
    await cleanup();
  }
});

test("manual refresh enqueues jobs with the signed owner user id", async () => {
  const ownerUserId = "11111111-1111-4111-8111-111111111111";
  const accounts = [
    {
      ...createAccount({ platform: "instagram", accountId: "ig-owner-job" }),
      ownerUserId,
    },
  ];
  const { app, baseUrl, cleanup } = await setupTestApp({
    accounts,
    fixtures: {
      "instagram--ig-owner-job.json": { items: [] },
    },
  });

  try {
    const { response, json } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        owner_user_id: ownerUserId,
        platform: "instagram",
        account_id: "ig-owner-job",
        refresh_days: 7,
        request_source: "apps-script",
      },
    });

    assert.equal(response.status, 202);
    assert.equal(json.status, "queued");

    const jobs = await app.services.jobRepository.listAll();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].ownerUserId, ownerUserId);
  } finally {
    await cleanup();
  }
});
