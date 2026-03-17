import http from "node:http";
import { loadConfig } from "./config.js";
import { FileSheetGateway } from "./adapters/sheets/file-sheet-gateway.js";
import { createPlatformRegistry } from "./adapters/platforms/platform-registry.js";
import { FileStore } from "./lib/fs-store.js";
import { sendJson } from "./lib/http.js";
import { AccountConfigRepository } from "./repositories/account-config-repository.js";
import { JobRepository } from "./repositories/job-repository.js";
import { NormalizedRecordRepository } from "./repositories/normalized-record-repository.js";
import { RawRecordRepository } from "./repositories/raw-record-repository.js";
import { SheetSnapshotRepository } from "./repositories/sheet-snapshot-repository.js";
import { handleHealthRoute } from "./routes/health-route.js";
import { handleInternalScheduledSyncRoute } from "./routes/internal-scheduled-sync-route.js";
import { handleManualRefreshRoute } from "./routes/manual-refresh-route.js";
import { seedDemoData } from "./cli/seed-demo.js";
import { JobQueue } from "./services/job-queue.js";
import { ManualRefreshService } from "./services/manual-refresh-service.js";
import { createNormalizationService } from "./services/normalization-service.js";
import { RefreshOrchestrator } from "./services/refresh-orchestrator.js";
import { ScheduledSyncService } from "./services/scheduled-sync-service.js";
import { SchedulerService } from "./services/scheduler-service.js";
import { StatusService } from "./services/status-service.js";

async function recoverJobs({
  accountRepository,
  jobRepository,
  jobQueue,
  statusService,
  clock,
}) {
  const runningJobs = await jobRepository.listByStatuses(["running"]);

  for (const runningJob of runningJobs) {
    const accountConfig = await accountRepository.findByPlatformAndAccountId(
      runningJob.platform,
      runningJob.accountId,
    );
    const finishedAt = clock().toISOString();
    const failedJob = {
      ...runningJob,
      status: "error",
      finishedAt,
      errorCode: "PROCESS_RESTARTED",
      systemMessage: "Service restarted while the job was running.",
    };

    await jobRepository.updateById(runningJob.id, {
      status: failedJob.status,
      finishedAt: failedJob.finishedAt,
      errorCode: failedJob.errorCode,
      systemMessage: failedJob.systemMessage,
    });

    if (accountConfig) {
      await statusService.markError(accountConfig, failedJob, failedJob.systemMessage);
    }
  }

  const queuedJobs = await jobRepository.listByStatuses(["queued"]);
  queuedJobs.forEach((job) => jobQueue.enqueue(job));
}

export async function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const store = new FileStore(config.dataDir);

  await store.init([
    "account-configs",
    "jobs",
    "raw-platform-records",
    "normalized-content-records",
    "sheet-status",
    "sheet-output",
  ]);

  const repositories = {
    accountRepository: new AccountConfigRepository(store),
    jobRepository: new JobRepository(store),
    rawRecordRepository: new RawRecordRepository(store),
    normalizedRecordRepository: new NormalizedRecordRepository(store),
    sheetSnapshotRepository: new SheetSnapshotRepository(store),
  };

  if (config.seedDemoData) {
    await seedDemoData({
      accountRepository: repositories.accountRepository,
      clock: config.clock,
      overwrite: false,
    });
  }

  const sheetGateway = new FileSheetGateway({
    sheetSnapshotRepository: repositories.sheetSnapshotRepository,
    clock: config.clock,
  });
  const statusService = new StatusService({
    accountRepository: repositories.accountRepository,
    sheetGateway,
    clock: config.clock,
  });
  const normalizationService = createNormalizationService({ clock: config.clock });
  const platformRegistry = createPlatformRegistry({ fixturesDir: config.fixturesDir });
  const refreshOrchestrator = new RefreshOrchestrator({
    accountRepository: repositories.accountRepository,
    jobRepository: repositories.jobRepository,
    rawRecordRepository: repositories.rawRecordRepository,
    normalizedRecordRepository: repositories.normalizedRecordRepository,
    platformRegistry,
    normalizationService,
    statusService,
    logger: config.logger,
    clock: config.clock,
  });
  const jobQueue = new JobQueue({
    concurrency: config.maxConcurrentJobs,
    processJob: (job) => refreshOrchestrator.processJob(job),
    logger: config.logger,
  });
  const manualRefreshService = new ManualRefreshService({
    accountRepository: repositories.accountRepository,
    jobRepository: repositories.jobRepository,
    jobQueue,
    statusService,
    config,
    clock: config.clock,
  });
  const scheduledSyncService = new ScheduledSyncService({
    accountRepository: repositories.accountRepository,
    jobRepository: repositories.jobRepository,
    jobQueue,
    statusService,
    clock: config.clock,
  });
  const schedulerService = new SchedulerService({
    scheduledSyncService,
    intervalMs: config.scheduleIntervalMs,
    logger: config.logger,
  });

  await statusService.bootstrapAccountSnapshots();
  await recoverJobs({
    accountRepository: repositories.accountRepository,
    jobRepository: repositories.jobRepository,
    jobQueue,
    statusService,
    clock: config.clock,
  });

  const services = {
    ...repositories,
    sheetGateway,
    statusService,
    normalizationService,
    platformRegistry,
    refreshOrchestrator,
    jobQueue,
    manualRefreshService,
    scheduledSyncService,
    schedulerService,
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const key = `${req.method} ${url.pathname}`;

    if (key === "GET /health") {
      await handleHealthRoute({ res, services, config });
      return;
    }

    if (key === "POST /api/v1/refresh-jobs/manual") {
      await handleManualRefreshRoute({ req, res, services, config });
      return;
    }

    if (key === "POST /api/v1/internal/scheduled-sync") {
      await handleInternalScheduledSyncRoute({ req, res, services, config });
      return;
    }

    sendJson(res, 404, {
      error: "NOT_FOUND",
      system_message: "Route not found.",
    });
  });

  return {
    config,
    services,
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => {
          server.off("error", reject);
          resolve();
        });
      });

      if (config.autoStartScheduler) {
        schedulerService.start();
      }

      const address = server.address();
      return {
        host: typeof address === "object" ? address.address : config.host,
        port: typeof address === "object" ? address.port : config.port,
      };
    },
    async stop() {
      schedulerService.stop();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await jobQueue.waitForIdle();
    },
  };
}
