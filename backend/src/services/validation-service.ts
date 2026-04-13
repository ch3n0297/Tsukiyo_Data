import { HttpError } from "../lib/errors.ts";
import type { Platform } from "../types/platform.ts";
import type { RequestSource } from "../types/job.ts";

const SUPPORTED_PLATFORMS = new Set<Platform>(["instagram", "facebook", "tiktok"]);

function assertNonEmptyString(value: unknown, fieldName: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "VALIDATION_ERROR", `欄位 ${fieldName} 為必填。`);
  }
}

export interface ManualRefreshPayload {
  platform: Platform;
  accountId: string;
  refreshDays: number;
  requestSource: RequestSource;
}

export interface ScheduledSyncPayload {
  requestedBy: string;
}

export function validateManualRefreshPayload(payload: unknown): ManualRefreshPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const p = payload as Record<string, unknown>;
  assertNonEmptyString(p.platform, "platform");
  assertNonEmptyString(p.account_id, "account_id");
  assertNonEmptyString(p.request_source, "request_source");

  if (!SUPPORTED_PLATFORMS.has(p.platform as Platform)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "platform 必須是 instagram、facebook 或 tiktok 其中之一。",
    );
  }

  if (!Number.isInteger(p.refresh_days)) {
    throw new HttpError(400, "VALIDATION_ERROR", "refresh_days 必須是整數。");
  }

  const refreshDays = p.refresh_days as number;
  if (refreshDays < 1 || refreshDays > 365) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "refresh_days 必須是 1 到 365 之間的整數。",
    );
  }

  return {
    platform: p.platform as Platform,
    accountId: p.account_id as string,
    refreshDays,
    requestSource: p.request_source as RequestSource,
  };
}

export function validateScheduledSyncPayload(payload: unknown): ScheduledSyncPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const p = payload as Record<string, unknown>;
  assertNonEmptyString(p.requested_by, "requested_by");

  return {
    requestedBy: p.requested_by as string,
  };
}
