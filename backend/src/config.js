import path from "node:path";
import { fileURLToPath } from "node:url";
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

function readStringList(value, fallback = []) {
  if (typeof value !== "string") {
    return fallback;
  }

  const items = value
    .split(",")
    .map((item) => readTrimmedString(item))
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

function readRequiredIfAny(values, fieldName) {
  const definedValues = values.filter((value) => value !== undefined);

  if (definedValues.length > 0 && definedValues.length !== values.length) {
    throw new Error(`${fieldName} must be configured together.`);
  }
}

function hasAnyDefined(values) {
  return values.some((value) => value !== undefined);
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
  const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const rootDir = overrides.rootDir ?? defaultRootDir;
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const googleClientId =
    overrides.googleClientId ?? readTrimmedString(process.env.GOOGLE_CLIENT_ID);
  const googleClientSecret =
    overrides.googleClientSecret ?? readTrimmedString(process.env.GOOGLE_CLIENT_SECRET);
  const googleSheetsRedirectUri =
    overrides.googleSheetsRedirectUri ??
    overrides.googleRedirectUri ??
    readTrimmedString(process.env.GOOGLE_SHEETS_REDIRECT_URI) ??
    readTrimmedString(process.env.GOOGLE_REDIRECT_URI);
  const googleLoginRedirectUri =
    overrides.googleLoginRedirectUri ?? readTrimmedString(process.env.GOOGLE_LOGIN_REDIRECT_URI);
  const googleTokenEncryptionKey =
    overrides.googleTokenEncryptionKey ??
    readTrimmedString(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const googleLoginScopes =
    overrides.googleLoginScopes ??
    readStringList(process.env.GOOGLE_LOGIN_SCOPES, [
      "openid",
      "email",
      "profile",
    ]);
  const googleSheetsOauthScopes =
    overrides.googleSheetsOauthScopes ??
    overrides.googleOauthScopes ??
    readStringList(
      process.env.GOOGLE_SHEETS_OAUTH_SCOPES ?? process.env.GOOGLE_OAUTH_SCOPES,
      [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",
      ],
    );

  readRequiredIfAny([googleClientId, googleClientSecret], "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");

  if (
    hasAnyDefined([googleClientId, googleClientSecret, googleSheetsRedirectUri, googleLoginRedirectUri]) &&
    (!googleClientId || !googleClientSecret)
  ) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET must be configured before enabling Google login or Google Sheets authorization.",
    );
  }

  const googleLoginEnabled = Boolean(googleClientId && googleClientSecret && googleLoginRedirectUri);
  const googleSheetsOauthEnabled = Boolean(
    googleClientId && googleClientSecret && googleSheetsRedirectUri,
  );
  const googleOauthEnabled = googleSheetsOauthEnabled;

  if (googleSheetsOauthEnabled && !googleTokenEncryptionKey) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be configured before enabling Google Sheets OAuth integration.",
    );
  }

  const config = {
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
    sessionCookieSameSite:
      overrides.sessionCookieSameSite ??
      readTrimmedString(process.env.SESSION_COOKIE_SAME_SITE) ??
      "Lax",
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
    nodeEnv,
    publicAppOrigin:
      overrides.publicAppOrigin ?? readTrimmedString(process.env.PUBLIC_APP_ORIGIN),
    frontendOrigins:
      overrides.frontendOrigins ??
      readStringList(process.env.FRONTEND_ORIGINS, [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
      ]),
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
    jobRetentionMs:
      overrides.jobRetentionMs ??
      readNumber(process.env.JOB_RETENTION_MS, 3 * 24 * 60 * 60 * 1000),
    rawRecordRetentionMs:
      overrides.rawRecordRetentionMs ??
      readNumber(process.env.RAW_RECORD_RETENTION_MS, 3 * 24 * 60 * 60 * 1000),
    autoStartScheduler: overrides.autoStartScheduler ?? true,
    seedDemoData: overrides.seedDemoData ?? true,
    googleLoginEnabled,
    googleOauthEnabled,
    googleSheetsOauthEnabled,
    googleClientId,
    googleClientSecret,
    googleLoginRedirectUri,
    googleSheetsRedirectUri,
    googleTokenEncryptionKey,
    googleLoginScopes,
    googleOauthScopes: googleSheetsOauthScopes,
    googleSheetsOauthScopes,
    googleStateTtlMs:
      overrides.googleStateTtlMs ??
      readNumber(process.env.GOOGLE_STATE_TTL_MS, 10 * 60 * 1000),
    googleOauthRateLimitWindowMs:
      overrides.googleOauthRateLimitWindowMs ??
      readNumber(process.env.GOOGLE_OAUTH_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
    googleOauthRateLimitMax:
      overrides.googleOauthRateLimitMax ??
      readNumber(process.env.GOOGLE_OAUTH_RATE_LIMIT_MAX, 10),
    logger: overrides.logger ?? createLogger({ silent: overrides.silentLogs ?? false }),
    clock: overrides.clock ?? (() => new Date()),
  };

  if (config.nodeEnv === "production" && !config.sessionCookieSecure) {
    throw new Error("SESSION_COOKIE_SECURE must be enabled in production.");
  }

  return config;
}
