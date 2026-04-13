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
