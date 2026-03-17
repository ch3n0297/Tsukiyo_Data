import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  expectJobStatuses,
  readStoreFile,
  sendSignedJson,
  setupTestApp,
} from "../../test-support/support.js";

test("scheduled sync persists raw and normalized data and writes sheet snapshots", async () => {
  const accounts = [
    createAccount({ platform: "instagram", accountId: "ig-acct-1" }),
    createAccount({ platform: "facebook", accountId: "fb-acct-1" }),
    createAccount({ platform: "tiktok", accountId: "tt-acct-1" }),
  ];

  const fixtures = {
    "instagram--ig-acct-1.json": {
      items: [
        {
          id: "ig-1",
          media_type: "reel",
          caption: "IG launch",
          permalink: "https://instagram.example.com/p/ig-1",
          timestamp: "2026-03-17T10:00:00.000Z",
          metrics: { plays: 100, likes: 10, comments: 2, shares: 1 },
        },
      ],
    },
    "facebook--fb-acct-1.json": {
      items: [
        {
          post_id: "fb-1",
          type: "video",
          message: "FB launch",
          permalink_url: "https://facebook.example.com/p/fb-1",
          created_time: "2026-03-17T11:00:00.000Z",
          insights: { video_views: 200, reactions: 22, comments: 3, shares: 1 },
        },
      ],
    },
    "tiktok--tt-acct-1.json": {
      items: [
        {
          aweme_id: "tt-1",
          content_type: "video",
          desc: "TT launch",
          share_url: "https://tiktok.example.com/v/tt-1",
          create_time: "2026-03-17T12:00:00.000Z",
          analytics: { play_count: 300, digg_count: 30, comment_count: 4, share_count: 2 },
        },
      ],
    },
  };

  const { app, baseUrl, cleanup } = await setupTestApp({ accounts, fixtures });

  try {
    const { response, json } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/internal/scheduled-sync",
      body: { requested_by: "integration-test" },
    });

    assert.equal(response.status, 202);
    assert.equal(json.accepted_jobs.length, 3);

    await app.services.jobQueue.waitForIdle();

    const jobs = await expectJobStatuses(app.services.jobRepository, "success");
    assert.equal(jobs.length, 3);

    const rawRecords = await readStoreFile(app, "raw-platform-records.json");
    const normalizedRecords = await readStoreFile(app, "normalized-content-records.json");
    const sheetStatuses = await readStoreFile(app, "sheet-status.json");
    const sheetOutput = await readStoreFile(app, "sheet-output.json");

    assert.equal(rawRecords.length, 3);
    assert.equal(normalizedRecords.length, 3);
    assert.equal(sheetStatuses.filter((entry) => entry.refreshStatus === "success").length, 3);
    assert.equal(sheetOutput.length, 3);
  } finally {
    await cleanup();
  }
});
