import { HttpError } from "../lib/errors.js";

const SUPPORTED_PLATFORMS = new Set(["instagram", "facebook", "tiktok"]);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "VALIDATION_ERROR", `${fieldName} is required.`);
  }
}

export function validateManualRefreshPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  assertNonEmptyString(payload.platform, "platform");
  assertNonEmptyString(payload.account_id, "account_id");
  assertNonEmptyString(payload.request_source, "request_source");

  if (!SUPPORTED_PLATFORMS.has(payload.platform)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "platform must be one of instagram, facebook, or tiktok.",
    );
  }

  if (!Number.isInteger(payload.refresh_days)) {
    throw new HttpError(400, "VALIDATION_ERROR", "refresh_days must be an integer.");
  }

  if (payload.refresh_days < 1 || payload.refresh_days > 365) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "refresh_days must be an integer between 1 and 365.",
    );
  }

  return {
    platform: payload.platform,
    accountId: payload.account_id,
    refreshDays: payload.refresh_days,
    requestSource: payload.request_source,
  };
}

export function validateScheduledSyncPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  assertNonEmptyString(payload.requested_by, "requested_by");

  return {
    requestedBy: payload.requested_by,
  };
}
