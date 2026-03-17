import test from "node:test";
import assert from "node:assert/strict";
import { createNormalizationService } from "../../src/services/normalization-service.js";

test("normalization service maps platform-specific fields into unified records", () => {
  const service = createNormalizationService({
    clock: () => new Date("2026-03-18T00:00:00.000Z"),
  });

  const instagramRecord = service.normalizeBatch({
    platform: "instagram",
    accountId: "ig-1",
    accountKey: "instagram:ig-1",
    jobId: "job-1",
    rawItems: [
      {
        id: "ig-item-1",
        media_type: "reel",
        caption: "IG",
        permalink: "https://instagram.example.com/p/ig-item-1",
        timestamp: "2026-03-17T00:00:00.000Z",
        metrics: { plays: 101, likes: 11, comments: 2, shares: 1 },
      },
    ],
  })[0];

  const facebookRecord = service.normalizeBatch({
    platform: "facebook",
    accountId: "fb-1",
    accountKey: "facebook:fb-1",
    jobId: "job-2",
    rawItems: [
      {
        post_id: "fb-item-1",
        type: "video",
        message: "FB",
        permalink_url: "https://facebook.example.com/p/fb-item-1",
        created_time: "2026-03-17T00:00:00.000Z",
        insights: { video_views: 202, reactions: 22, comments: 3, shares: 2 },
      },
    ],
  })[0];

  const tiktokRecord = service.normalizeBatch({
    platform: "tiktok",
    accountId: "tt-1",
    accountKey: "tiktok:tt-1",
    jobId: "job-3",
    rawItems: [
      {
        aweme_id: "tt-item-1",
        content_type: "video",
        desc: "TT",
        share_url: "https://tiktok.example.com/v/tt-item-1",
        create_time: "2026-03-17T00:00:00.000Z",
        analytics: { play_count: 303, digg_count: 33, comment_count: 4, share_count: 3 },
      },
    ],
  })[0];

  assert.equal(instagramRecord.views, 101);
  assert.equal(facebookRecord.likes, 22);
  assert.equal(tiktokRecord.shares, 3);
  assert.equal(tiktokRecord.fetchTime, "2026-03-18T00:00:00.000Z");
});
