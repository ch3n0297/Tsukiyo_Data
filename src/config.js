import path from "node:path";
import { createLogger } from "./lib/logger.js";

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    sharedSecret:
      overrides.sharedSecret ?? process.env.API_SHARED_SECRET ?? "local-dev-secret",
    allowedClientIds:
      overrides.allowedClientIds ??
      (process.env.ALLOWED_CLIENT_IDS
        ? process.env.ALLOWED_CLIENT_IDS.split(",").map((value) => value.trim())
        : ["demo-sheet"]),
    signatureTtlMs:
      overrides.signatureTtlMs ?? readNumber(process.env.SIGNATURE_TTL_MS, 5 * 60 * 1000),
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
