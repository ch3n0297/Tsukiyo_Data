import path from "node:path";
import { createLogger } from "./lib/logger.js";

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readTrimmedString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function resolveSharedSecret(overrides) {
  const sharedSecret = overrides.sharedSecret ?? readTrimmedString(process.env.API_SHARED_SECRET);

  if (!sharedSecret) {
    throw new Error("API_SHARED_SECRET must be configured before starting the service.");
  }

  return sharedSecret;
}

function resolveAllowedClientIds(overrides) {
  if (overrides.allowedClientIds !== undefined) {
    if (!Array.isArray(overrides.allowedClientIds)) {
      throw new TypeError("allowedClientIds override must be an array.");
    }

    const clientIds = overrides.allowedClientIds
      .map((value) => readTrimmedString(value))
      .filter(Boolean);

    if (clientIds.length === 0) {
      throw new Error("At least one allowed client ID must be configured.");
    }

    return clientIds;
  }

  const rawClientIds = process.env.ALLOWED_CLIENT_IDS;
  if (rawClientIds === undefined) {
    return ["demo-sheet"];
  }

  const clientIds = rawClientIds
    .split(",")
    .map((value) => readTrimmedString(value))
    .filter(Boolean);

  if (clientIds.length === 0) {
    throw new Error("ALLOWED_CLIENT_IDS must include at least one non-empty client ID.");
  }

  return clientIds;
}

export function loadConfig(overrides = {}) {
  const rootDir = overrides.rootDir ?? process.cwd();

  return {
    host: overrides.host ?? process.env.HOST ?? "127.0.0.1",
    port: overrides.port ?? readNumber(process.env.PORT, 3000),
    dataDir: overrides.dataDir ?? process.env.DATA_DIR ?? path.join(rootDir, "data"),
    fixturesDir:
      overrides.fixturesDir ??
      process.env.FIXTURES_DIR ??
      path.join(rootDir, "fixtures", "platforms"),
    sharedSecret: resolveSharedSecret(overrides),
    allowedClientIds: resolveAllowedClientIds(overrides),
    signatureTtlMs:
      overrides.signatureTtlMs ?? readNumber(process.env.SIGNATURE_TTL_MS, 5 * 60 * 1000),
    maxRequestBodyBytes:
      overrides.maxRequestBodyBytes ??
      readNumber(process.env.MAX_REQUEST_BODY_BYTES, 1024 * 1024),
    sessionCookieName:
      overrides.sessionCookieName ??
      readTrimmedString(process.env.SESSION_COOKIE_NAME) ??
      "social_data_session",
    sessionTtlMs:
      overrides.sessionTtlMs ?? readNumber(process.env.SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000),
    sessionCookieSecure:
      overrides.sessionCookieSecure ?? readBoolean(process.env.SESSION_COOKIE_SECURE, false),
    passwordResetTtlMs:
      overrides.passwordResetTtlMs ??
      readNumber(process.env.PASSWORD_RESET_TTL_MS, 60 * 60 * 1000),
    bootstrapAdminEmail:
      overrides.bootstrapAdminEmail ?? readTrimmedString(process.env.BOOTSTRAP_ADMIN_EMAIL),
    bootstrapAdminPassword:
      overrides.bootstrapAdminPassword ?? readTrimmedString(process.env.BOOTSTRAP_ADMIN_PASSWORD),
    bootstrapAdminName:
      overrides.bootstrapAdminName ??
      readTrimmedString(process.env.BOOTSTRAP_ADMIN_NAME) ??
      "系統管理員",
    publicAppOrigin:
      overrides.publicAppOrigin ?? readTrimmedString(process.env.PUBLIC_APP_ORIGIN),
    maxConcurrentJobs:
      overrides.maxConcurrentJobs ?? readNumber(process.env.MAX_CONCURRENT_JOBS, 3),
    sourceRateLimitWindowMs:
      overrides.sourceRateLimitWindowMs ??
      readNumber(process.env.SOURCE_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    sourceRateLimitMax:
      overrides.sourceRateLimitMax ?? readNumber(process.env.SOURCE_RATE_LIMIT_MAX, 10),
    accountCooldownMs:
      overrides.accountCooldownMs ??
      readNumber(process.env.ACCOUNT_COOLDOWN_MS, 30 * 1000),
    scheduleIntervalMs:
      overrides.scheduleIntervalMs ?? readNumber(process.env.SCHEDULE_INTERVAL_MS, 5 * 60 * 1000),
    autoStartScheduler: overrides.autoStartScheduler ?? true,
    seedDemoData: overrides.seedDemoData ?? true,
    logger: overrides.logger ?? createLogger({ silent: overrides.silentLogs ?? false }),
    clock: overrides.clock ?? (() => new Date()),
  };
}
