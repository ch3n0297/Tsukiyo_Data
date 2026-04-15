import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import { loadConfig } from "./config.ts";
import type { AppConfig, ConfigOverrides, Services } from "./types/app.ts";
import { FileSheetGateway } from "./adapters/sheets/file-sheet-gateway.ts";
import { createPlatformRegistry } from "./adapters/platforms/platform-registry.ts";
import { toErrorResponse } from "./lib/errors.ts";
import { FileStore } from "./lib/fs-store.ts";
import { createSupabaseClient } from "./lib/supabase-client.ts";
import { sendJson } from "./lib/http.ts";
import { AccountConfigRepository } from "./repositories/account-config-repository.ts";
import { JobRepository } from "./repositories/job-repository.ts";
import { OutboxMessageRepository } from "./repositories/outbox-message-repository.ts";
import { NormalizedRecordRepository } from "./repositories/normalized-record-repository.ts";
import { PasswordResetTokenRepository } from "./repositories/password-reset-token-repository.ts";
import { RawRecordRepository } from "./repositories/raw-record-repository.ts";
import { SessionRepository } from "./repositories/session-repository.ts";
import { SheetSnapshotRepository } from "./repositories/sheet-snapshot-repository.ts";
import { UserRepository } from "./repositories/user-repository.ts";
import { SupabaseAccountConfigRepository } from "./repositories/supabase/account-config-repository.ts";
import { SupabaseJobRepository } from "./repositories/supabase/job-repository.ts";
import { SupabaseRawRecordRepository } from "./repositories/supabase/raw-record-repository.ts";
import { SupabaseNormalizedRecordRepository } from "./repositories/supabase/normalized-record-repository.ts";
import { SupabaseSheetSnapshotRepository } from "./repositories/supabase/sheet-snapshot-repository.ts";
import { createRequireAuth } from "./middleware/require-auth.ts";
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
} from "./routes/auth-routes.ts";
import { handleHealthRoute } from "./routes/health-route.ts";
import { handleInternalScheduledSyncRoute } from "./routes/internal-scheduled-sync-route.ts";
import { handleManualRefreshRoute } from "./routes/manual-refresh-route.ts";
import { handleUiAccountDetailRoute, handleUiAccountsRoute } from "./routes/ui-accounts-route.ts";
import { seedDemoData } from "./cli/seed-demo.ts";
import { JobQueue } from "./services/job-queue.ts";
import { ManualRefreshService } from "./services/manual-refresh-service.ts";
import { createNormalizationService } from "./services/normalization-service.ts";
import { PasswordResetService } from "./services/password-reset-service.ts";
import { RefreshOrchestrator } from "./services/refresh-orchestrator.ts";
import { ScheduledSyncService } from "./services/scheduled-sync-service.ts";
import { SchedulerService } from "./services/scheduler-service.ts";
import { StatusService } from "./services/status-service.ts";
import { UiDashboardService } from "./services/ui-dashboard-service.ts";
import { UserApprovalService } from "./services/user-approval-service.ts";
import { UserAuthService } from "./services/user-auth-service.ts";
import type { Job } from "./types/job.ts";
import type { AccountConfigRepository as ACR } from "./repositories/account-config-repository.ts";
import type { JobRepository as JR } from "./repositories/job-repository.ts";

export interface AppInstance {
  config: AppConfig;
  fastify: FastifyInstance;
  server: import("node:http").Server;
  services: Services;
  start(): Promise<{ host: string; port: number }>;
  stop(): Promise<void>;
}

interface RecoverJobsParams {
  accountRepository: ACR;
  jobRepository: JR;
  jobQueue: JobQueue;
  statusService: StatusService;
  clock: () => Date;
}

async function recoverJobs({
  accountRepository,
  jobRepository,
  jobQueue,
  statusService,
  clock,
}: RecoverJobsParams): Promise<void> {
  const runningJobs = await jobRepository.listByStatuses(["running"]);

  for (const runningJob of runningJobs) {
    const accountConfig = await accountRepository.findByPlatformAndAccountId(
      runningJob.platform,
      runningJob.accountId,
    );
    const finishedAt = clock().toISOString();
    const failedJob: Job = {
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

function createCorsOriginResolver(config: AppConfig) {
  const allowedOrigins = new Set(config.frontendOrigins ?? []);

  return (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  };
}

const MIGRATION_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function createApp(overrides: ConfigOverrides = {}): Promise<AppInstance> {
  const config = loadConfig(overrides);
  const store = new FileStore(config.dataDir);

  await store.init([
    "account-configs",
    "jobs",
    "outbox-messages",
    "password-reset-tokens",
    "raw-platform-records",
    "normalized-content-records",
    "sessions",
    "sheet-status",
    "sheet-output",
    "users",
  ]);

  const fileStoreRepos = {
    accountRepository: new AccountConfigRepository(store),
    jobRepository: new JobRepository(store),
    outboxMessageRepository: new OutboxMessageRepository(store),
    rawRecordRepository: new RawRecordRepository(store),
    normalizedRecordRepository: new NormalizedRecordRepository(store),
    passwordResetTokenRepository: new PasswordResetTokenRepository(store),
    sheetSnapshotRepository: new SheetSnapshotRepository(store),
    sessionRepository: new SessionRepository(store),
    userRepository: new UserRepository(store),
  };

  let repositories = fileStoreRepos;

  // supabaseClient 提升到外層作用域，供 repositories 和 requireAuth 共用（避免重複建立）
  const supabaseClient = config.useSupabaseStorage
    ? createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey)
    : null;

  if (supabaseClient) {
    const userId = MIGRATION_SYSTEM_USER_ID;
    Object.assign(repositories, {
      accountRepository: new SupabaseAccountConfigRepository(supabaseClient, userId),
      jobRepository: new SupabaseJobRepository(supabaseClient, userId),
      rawRecordRepository: new SupabaseRawRecordRepository(supabaseClient, userId),
      normalizedRecordRepository: new SupabaseNormalizedRecordRepository(supabaseClient, userId),
      sheetSnapshotRepository: new SupabaseSheetSnapshotRepository(supabaseClient, userId),
    });
  }

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
  const userAuthService = new UserAuthService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    clock: config.clock,
    config,
  });
  const userApprovalService = new UserApprovalService({
    userRepository: repositories.userRepository,
    outboxMessageRepository: repositories.outboxMessageRepository,
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
  const uiDashboardService = new UiDashboardService({
    accountRepository: repositories.accountRepository,
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

  const services: Services = {
    ...repositories,
    sheetGateway,
    statusService,
    normalizationService,
    platformRegistry,
    refreshOrchestrator,
    jobQueue,
    manualRefreshService,
    passwordResetService,
    scheduledSyncService,
    schedulerService,
    uiDashboardService,
    userApprovalService,
    userAuthService,
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

  fastify.setNotFoundHandler((_request, reply) => {
    sendJson(reply, 404, {
      error: "NOT_FOUND",
      system_message: "找不到對應的路由。",
    });
  });

  const requireAuth = supabaseClient ? createRequireAuth(supabaseClient) : null;

  fastify.get("/health", async (request, reply) => {
    handleHealthRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/ui/accounts", {
    preHandler: requireAuth ?? undefined,
  }, async (request, reply) => {
    await handleUiAccountsRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/ui/accounts/:platform/:accountId", {
    preHandler: requireAuth ?? undefined,
  }, async (request, reply) => {
    await handleUiAccountDetailRoute({
      req: request,
      res: reply,
      services,
      config,
      params: request.params as Record<string, string>,
    });
  });

  fastify.post("/api/v1/auth/register", async (request, reply) => {
    await handleRegisterRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/login", async (request, reply) => {
    await handleLoginRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/logout", async (request, reply) => {
    await handleLogoutRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/auth/me", async (request, reply) => {
    await handleCurrentUserRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/forgot-password", async (request, reply) => {
    await handleForgotPasswordRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/reset-password", async (request, reply) => {
    await handleResetPasswordRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/admin/pending-users", {
    preHandler: requireAuth ?? undefined,
  }, async (request, reply) => {
    await handlePendingUsersRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/admin/pending-users/:userId/approve", {
    preHandler: requireAuth ?? undefined,
  }, async (request, reply) => {
    await handleApproveUserRoute({
      req: request,
      res: reply,
      services,
      config,
      params: request.params as Record<string, string>,
    });
  });

  fastify.post("/api/v1/admin/pending-users/:userId/reject", {
    preHandler: requireAuth ?? undefined,
  }, async (request, reply) => {
    await handleRejectUserRoute({
      req: request,
      res: reply,
      services,
      config,
      params: request.params as Record<string, string>,
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
        host: typeof address === "object" && address ? address.address : config.host,
        port: typeof address === "object" && address ? address.port : config.port,
      };
    },
    async stop() {
      schedulerService.stop();
      await fastify.close();
      await jobQueue.waitForIdle();
    },
  };
}
