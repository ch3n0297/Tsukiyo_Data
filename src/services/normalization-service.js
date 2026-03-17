import crypto from "node:crypto";

function normalizeInstagramItem(item) {
  return {
    contentId: item.id,
    contentType: item.media_type.toLowerCase(),
    publishedAt: item.timestamp,
    caption: item.caption ?? "",
    url: item.permalink,
    views: item.metrics?.plays ?? 0,
    likes: item.metrics?.likes ?? 0,
    comments: item.metrics?.comments ?? 0,
    shares: item.metrics?.shares ?? 0,
  };
}

function normalizeFacebookItem(item) {
  return {
    contentId: item.post_id,
    contentType: item.type,
    publishedAt: item.created_time,
    caption: item.message ?? "",
    url: item.permalink_url,
    views: item.insights?.video_views ?? 0,
    likes: item.insights?.reactions ?? 0,
    comments: item.insights?.comments ?? 0,
    shares: item.insights?.shares ?? 0,
  };
}

function normalizeTiktokItem(item) {
  return {
    contentId: item.aweme_id,
    contentType: item.content_type,
    publishedAt: item.create_time,
    caption: item.desc ?? "",
    url: item.share_url,
    views: item.analytics?.play_count ?? 0,
    likes: item.analytics?.digg_count ?? 0,
    comments: item.analytics?.comment_count ?? 0,
    shares: item.analytics?.share_count ?? 0,
  };
}

const NORMALIZERS = {
  instagram: normalizeInstagramItem,
  facebook: normalizeFacebookItem,
  tiktok: normalizeTiktokItem,
};

export function createNormalizationService({ clock }) {
  return {
    normalizeBatch({ platform, accountId, accountKey, jobId, rawItems }) {
      const normalizeItem = NORMALIZERS[platform];
      const fetchTime = clock().toISOString();

      return rawItems.map((item) => {
        const normalized = normalizeItem(item);

        return {
          id: crypto.randomUUID(),
          jobId,
          accountKey,
          platform,
          accountId,
          fetchTime,
          dataStatus: "fresh",
          ...normalized,
        };
      });
    },
  };
}
