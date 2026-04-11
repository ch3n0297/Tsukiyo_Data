import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { GoogleSheetGateway } from "./adapters/sheets/google-sheet-gateway.js";
import { createPlatformRegistry } from "./adapters/platforms/platform-registry.js";
import { toErrorResponse } from "./lib/errors.js";
import { FileStore } from "./lib/fs-store.js";
import { sendJson } from "./lib/http.js";
import { AccountConfigRepository } from "./repositories/account-config-repository.js";
import { AuditLogRepository } from "./repositories/audit-log-repository.js";
import { GoogleConnectionRepository } from "./repositories/google-connection-repository.js";
import { JobRepository } from "./repositories/job-repository.js";
import { OauthStateRepository } from "./repositories/oauth-state-repository.js";
import { OutboxMessageRepository } from "./repositories/outbox-message-repository.js";
import { NormalizedRecordRepository } from "./repositories/normalized-record-repository.js";
import { PasswordResetTokenRepository } from "./repositories/password-reset-token-repository.js";
import { RawRecordRepository } from "./repositories/raw-record-repository.js";
import { SessionRepository } from "./repositories/session-repository.js";
import { SheetSnapshotRepository } from "./repositories/sheet-snapshot-repository.js";
import { UserRepository } from "./repositories/user-repository.js";
import {
  handleApproveUserRoute,
  handleCurrentUserRoute,
  handleForgotPasswordRoute,
  handleLoginRoute,
  handleLogoutRoute,
  handlePendingUsersRoute,
  handleRegisterRoute,
  handleRejectUserRoute,
  handleResetPasswordRoute,
} from "./routes/auth-routes.js";
import {
  handleGoogleAuthorizationCallbackRoute,
  handleGoogleAuthorizationStartRoute,
  handleGoogleConnectionDisconnectRoute,
  handleGoogleConnectionStatusRoute,
} from "./routes/google-integration-routes.js";
import {
  handleGoogleLoginCallbackRoute,
  handleGoogleLoginStartRoute,
} from "./routes/google-login-routes.js";
import { handleHealthRoute } from "./routes/health-route.js";
import { handleInternalScheduledSyncRoute } from "./routes/internal-scheduled-sync-route.js";
import { handleManualRefreshRoute } from "./routes/manual-refresh-route.js";
import {
  handleUiAccountDetailRoute,
  handleUiAccountsRoute,
  handleUiContentOverviewRoute,
} from "./routes/ui-accounts-route.js";
import { seedDemoData } from "./cli/seed-demo.js";
import { JobQueue } from "./services/job-queue.js";
import { GoogleOauthService } from "./services/google-oauth-service.js";
import { ManualRefreshService } from "./services/manual-refresh-service.js";
import { createNormalizationService } from "./services/normalization-service.js";
import { PasswordResetService } from "./services/password-reset-service.js";
import { RefreshOrchestrator } from "./services/refresh-orchestrator.js";
import { ScheduledSyncService } from "./services/scheduled-sync-service.js";
import { SchedulerService } from "./services/scheduler-service.js";
import { DataRetentionService } from "./services/data-retention-service.js";
import { StatusService } from "./services/status-service.js";
import { UiDashboardService } from "./services/ui-dashboard-service.js";
import { UserApprovalService } from "./services/user-approval-service.js";
import { UserAuthService } from "./services/user-auth-service.js";
import { GoogleLoginSettingsRepository } from "./repositories/google-login-settings-repository.js";
import { GoogleLoginSettingsService } from "./services/google-login-settings-service.js";

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
      systemMessage: "服務重新啟動，工作在執行期間中斷。",
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
  for (const job of queuedJobs) {
    jobQueue.enqueue(job);
  }
}

function createCorsOriginResolver(config) {
  const allowedOrigins = new Set(config.frontendOrigins ?? []);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  };
}

export async function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const store = new FileStore(config.dataDir);
  const googleFetchImpl = overrides.googleFetchImpl ?? globalThis.fetch;

  await store.init([
    "account-configs",
    "audit-logs",
    "google-connections",
    "google-login-settings",
    "jobs",
    "oauth-states",
    "outbox-messages",
    "password-reset-tokens",
    "raw-platform-records",
    "normalized-content-records",
    "sessions",
    "sheet-status",
    "sheet-output",
    "users",
  ]);

  const repositories = {
    accountRepository: new AccountConfigRepository(store),
    auditLogRepository: new AuditLogRepository(store),
    googleConnectionRepository: new GoogleConnectionRepository(store),
    jobRepository: new JobRepository(store),
    oauthStateRepository: new OauthStateRepository(store),
    outboxMessageRepository: new OutboxMessageRepository(store),
    rawRecordRepository: new RawRecordRepository(store),
    normalizedRecordRepository: new NormalizedRecordRepository(store),
    passwordResetTokenRepository: new PasswordResetTokenRepository(store),
    sheetSnapshotRepository: new SheetSnapshotRepository(store),
    sessionRepository: new SessionRepository(store),
    googleLoginSettingsRepository: new GoogleLoginSettingsRepository(store),
    userRepository: new UserRepository(store),
  };

  if (config.seedDemoData) {
    await seedDemoData({
      accountRepository: repositories.accountRepository,
      clock: config.clock,
      overwrite: false,
    });
  }

  const googleOauthService = new GoogleOauthService({
    accountRepository: repositories.accountRepository,
    auditLogRepository: repositories.auditLogRepository,
    config,
    googleConnectionRepository: repositories.googleConnectionRepository,
    logger: config.logger,
    oauthStateRepository: repositories.oauthStateRepository,
    clock: config.clock,
    fetchImpl: googleFetchImpl,
  });
  const sheetGateway = new GoogleSheetGateway({
    auditLogRepository: repositories.auditLogRepository,
    clock: config.clock,
    config,
    googleOauthService,
    logger: config.logger,
    sheetSnapshotRepository: repositories.sheetSnapshotRepository,
    fetchImpl: googleFetchImpl,
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
  const dataRetentionService = new DataRetentionService({
    jobRepository: repositories.jobRepository,
    rawRecordRepository: repositories.rawRecordRepository,
    logger: config.logger,
    clock: config.clock,
    jobRetentionMs: config.jobRetentionMs,
    rawRecordRetentionMs: config.rawRecordRetentionMs,
  });
  const schedulerService = new SchedulerService({
    scheduledSyncService,
    dataRetentionService,
    intervalMs: config.scheduleIntervalMs,
    logger: config.logger,
  });
  const userAuthService = new UserAuthService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    clock: config.clock,
    config,
  });
  const userApprovalService = new UserApprovalService({
    store,
    userRepository: repositories.userRepository,
    clock: config.clock,
  });
  const passwordResetService = new PasswordResetService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    passwordResetTokenRepository: repositories.passwordResetTokenRepository,
    outboxMessageRepository: repositories.outboxMessageRepository,
    clock: config.clock,
    config,
  });
  const googleLoginSettingsService = new GoogleLoginSettingsService({
    accountRepository: repositories.accountRepository,
    clock: config.clock,
    googleLoginSettingsRepository: repositories.googleLoginSettingsRepository,
  });
  const uiDashboardService = new UiDashboardService({
    accountRepository: repositories.accountRepository,
    config,
    googleConnectionRepository: repositories.googleConnectionRepository,
    sheetSnapshotRepository: repositories.sheetSnapshotRepository,
    clock: config.clock,
  });

  await userAuthService.seedBootstrapAdmin();
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
    auditLogRepository: repositories.auditLogRepository,
    googleLoginSettingsService,
    googleOauthService,
    sheetGateway,
    statusService,
    normalizationService,
    platformRegistry,
    refreshOrchestrator,
    jobQueue,
    manualRefreshService,
    outboxMessageRepository: repositories.outboxMessageRepository,
    passwordResetService,
    passwordResetTokenRepository: repositories.passwordResetTokenRepository,
    scheduledSyncService,
    schedulerService,
    sessionRepository: repositories.sessionRepository,
    uiDashboardService,
    userApprovalService,
    userAuthService,
    userRepository: repositories.userRepository,
  };

  const fastify = Fastify({
    bodyLimit: config.maxRequestBodyBytes,
    logger: false,
  });

  await fastify.register(fastifyCors, {
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    origin: createCorsOriginResolver(config),
  });

  fastify.setErrorHandler((error, request, reply) => {
    config.logger.error("Unhandled request failure", {
      method: request.method,
      path: request.url,
      error,
    });

    const response = toErrorResponse(error);
    reply.header("x-content-type-options", "nosniff");
    reply.code(response.statusCode).send(response.body);
  });

  fastify.setNotFoundHandler((request, reply) => {
    sendJson(reply, 404, {
      error: "NOT_FOUND",
      system_message: "找不到對應的路由。",
    });
  });

  fastify.get("/health", async (request, reply) => {
    handleHealthRoute({ res: reply, services, config });
  });

  fastify.get("/api/v1/ui/accounts", async (request, reply) => {
    await handleUiAccountsRoute({ req: request, res: reply, services });
  });

  fastify.get("/api/v1/ui/content-overview", async (request, reply) => {
    await handleUiContentOverviewRoute({ req: request, res: reply, services });
  });

  fastify.get("/api/v1/ui/accounts/:platform/:accountId", async (request, reply) => {
    await handleUiAccountDetailRoute({
      req: request,
      res: reply,
      services,
      params: request.params,
    });
  });

  fastify.post("/api/v1/integrations/google/start", async (request, reply) => {
    await handleGoogleAuthorizationStartRoute({
      req: request,
      res: reply,
      services,
      config,
    });
  });

  fastify.get("/api/v1/integrations/google/callback", async (request, reply) => {
    await handleGoogleAuthorizationCallbackRoute({
      req: request,
      res: reply,
      services,
      config,
    });
  });

  fastify.get("/api/v1/integrations/google/connections/:accountConfigId", async (request, reply) => {
    await handleGoogleConnectionStatusRoute({
      req: request,
      res: reply,
      services,
      params: request.params,
    });
  });

  fastify.post("/api/v1/integrations/google/connections/:accountConfigId/disconnect", async (request, reply) => {
    await handleGoogleConnectionDisconnectRoute({
      req: request,
      res: reply,
      services,
      params: request.params,
    });
  });

  fastify.post("/api/v1/auth/google/start", async (request, reply) => {
    await handleGoogleLoginStartRoute({
      req: request,
      res: reply,
      services,
      config,
    });
  });

  fastify.get("/api/v1/auth/google/callback", async (request, reply) => {
    await handleGoogleLoginCallbackRoute({
      req: request,
      res: reply,
      services,
      config,
    });
  });

  fastify.post("/api/v1/auth/register", async (request, reply) => {
    await handleRegisterRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/login", async (request, reply) => {
    await handleLoginRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/logout", async (request, reply) => {
    await handleLogoutRoute({ req: request, res: reply, services });
  });

  fastify.get("/api/v1/auth/me", async (request, reply) => {
    await handleCurrentUserRoute({ req: request, res: reply, services });
  });

  fastify.post("/api/v1/auth/forgot-password", async (request, reply) => {
    await handleForgotPasswordRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/reset-password", async (request, reply) => {
    await handleResetPasswordRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/admin/pending-users", async (request, reply) => {
    await handlePendingUsersRoute({ req: request, res: reply, services });
  });

  fastify.post("/api/v1/admin/pending-users/:userId/approve", async (request, reply) => {
    await handleApproveUserRoute({
      req: request,
      res: reply,
      services,
      params: request.params,
    });
  });

  fastify.post("/api/v1/admin/pending-users/:userId/reject", async (request, reply) => {
    await handleRejectUserRoute({
      req: request,
      res: reply,
      services,
      params: request.params,
    });
  });

  fastify.post("/api/v1/refresh-jobs/manual", async (request, reply) => {
    await handleManualRefreshRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/internal/scheduled-sync", async (request, reply) => {
    await handleInternalScheduledSyncRoute({ req: request, res: reply, services, config });
  });

  return {
    config,
    fastify,
    server: fastify.server,
    services,
    async start() {
      await fastify.listen({
        host: config.host,
        port: config.port,
      });

      if (config.autoStartScheduler) {
        schedulerService.start();
      }

      const address = fastify.server.address();
      return {
        host: typeof address === "object" ? address.address : config.host,
        port: typeof address === "object" ? address.port : config.port,
      };
    },
    async stop() {
      schedulerService.stop();
      await fastify.close();
      await jobQueue.waitForIdle();
    },
  };
}
