import crypto from "node:crypto";
import type { Platform } from "../types/platform.ts";
import type { NormalizedRecord } from "../types/record.ts";

function normalizeContentType(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return "unknown";
  }

  return value.toLowerCase();
}

interface InstagramItem {
  id: string;
  media_type: string;
  timestamp: string;
  caption?: string;
  permalink: string;
  metrics?: { plays?: number; likes?: number; comments?: number; shares?: number };
}

interface FacebookItem {
  post_id: string;
  type: string;
  created_time: string;
  message?: string;
  permalink_url: string;
  insights?: { video_views?: number; reactions?: number; comments?: number; shares?: number };
}

interface TiktokItem {
  aweme_id: string;
  content_type: string;
  create_time: string;
  desc?: string;
  share_url: string;
  analytics?: { play_count?: number; digg_count?: number; comment_count?: number; share_count?: number };
}

type NormalizedItemBase = Omit<NormalizedRecord, 'id' | 'jobId' | 'accountKey' | 'platform' | 'accountId' | 'fetchTime' | 'dataStatus'>;

function normalizeInstagramItem(item: unknown): NormalizedItemBase {
  const i = item as InstagramItem;
  return {
    contentId: i.id,
    contentType: normalizeContentType(i.media_type),
    publishedAt: i.timestamp,
    caption: i.caption ?? "",
    url: i.permalink,
    views: i.metrics?.plays ?? 0,
    likes: i.metrics?.likes ?? 0,
    comments: i.metrics?.comments ?? 0,
    shares: i.metrics?.shares ?? 0,
  };
}

function normalizeFacebookItem(item: unknown): NormalizedItemBase {
  const i = item as FacebookItem;
  return {
    contentId: i.post_id,
    contentType: normalizeContentType(i.type),
    publishedAt: i.created_time,
    caption: i.message ?? "",
    url: i.permalink_url,
    views: i.insights?.video_views ?? 0,
    likes: i.insights?.reactions ?? 0,
    comments: i.insights?.comments ?? 0,
    shares: i.insights?.shares ?? 0,
  };
}

function normalizeTiktokItem(item: unknown): NormalizedItemBase {
  const i = item as TiktokItem;
  return {
    contentId: i.aweme_id,
    contentType: normalizeContentType(i.content_type),
    publishedAt: i.create_time,
    caption: i.desc ?? "",
    url: i.share_url,
    views: i.analytics?.play_count ?? 0,
    likes: i.analytics?.digg_count ?? 0,
    comments: i.analytics?.comment_count ?? 0,
    shares: i.analytics?.share_count ?? 0,
  };
}

const NORMALIZERS: Partial<Record<Platform, (item: unknown) => NormalizedItemBase>> = {
  instagram: normalizeInstagramItem,
  facebook: normalizeFacebookItem,
  tiktok: normalizeTiktokItem,
};

export interface NormalizeBatchParams {
  platform: Platform;
  accountId: string;
  accountKey: string;
  jobId: string;
  rawItems: unknown[];
}

export interface NormalizationService {
  normalizeBatch(params: NormalizeBatchParams): NormalizedRecord[];
}

export function createNormalizationService({ clock }: { clock: () => Date }): NormalizationService {
  return {
    normalizeBatch({ platform, accountId, accountKey, jobId, rawItems }: NormalizeBatchParams): NormalizedRecord[] {
      const normalizeItem = NORMALIZERS[platform];
      if (typeof normalizeItem !== "function") {
        const error = new Error(`目前不支援的平台：${platform}`) as Error & { code: string };
        error.code = "UNSUPPORTED_PLATFORM";
        throw error;
      }

      const fetchTime = clock().toISOString();

      return rawItems.map((item) => {
        const normalized = normalizeItem(item);

        return {
          ...normalized,
          id: crypto.randomUUID(),
          jobId,
          accountKey,
          platform,
          accountId,
          fetchTime,
          dataStatus: "fresh" as const,
        };
      });
    },
  };
}
