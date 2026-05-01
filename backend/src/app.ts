import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import { FileSheetGateway } from "./adapters/sheets/file-sheet-gateway.ts";
import { createPlatformRegistry } from "./adapters/platforms/platform-registry.ts";
import { loadConfig } from "./config.ts";
import type { AppConfig, ConfigOverrides } from "./config.ts";
import { toErrorResponse } from "./lib/errors.ts";
import { sendJson } from "./lib/http.ts";
import { createSupabaseClient } from "./lib/supabase-client.ts";
import type { SupabaseClient } from "./lib/supabase-client.ts";
import { createRequireAuth } from "./middleware/require-auth.ts";
import { SupabaseAccountConfigRepository } from "./repositories/supabase/account-config-repository.ts";
import { SupabaseAuditEventRepository } from "./repositories/supabase/audit-event-repository.ts";
import { SupabaseJobRepository } from "./repositories/supabase/job-repository.ts";
import { SupabaseNormalizedRecordRepository } from "./repositories/supabase/normalized-record-repository.ts";
import { SupabaseRawRecordRepository } from "./repositories/supabase/raw-record-repository.ts";
import { SupabaseSheetSnapshotRepository } from "./repositories/supabase/sheet-snapshot-repository.ts";
import { SupabaseUserRepository } from "./repositories/supabase/user-repository.ts";
import type { JobRepository as JR } from "./repositories/job-repository.ts";
import type { AccountConfigRepository as ACR } from "./repositories/account-config-repository.ts";
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
import { RefreshOrchestrator } from "./services/refresh-orchestrator.ts";
import { ScheduledSyncService } from "./services/scheduled-sync-service.ts";
import { SchedulerService } from "./services/scheduler-service.ts";
import { StatusService } from "./services/status-service.ts";
import { UiDashboardService } from "./services/ui-dashboard-service.ts";
import { UserApprovalService } from "./services/user-approval-service.ts";
import type { RuntimeRepositories, Services } from "./types/app.ts";
import type { Job } from "./types/job.ts";

const MIGRATION_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface AppInstance {
  config: AppConfig;
  fastify: FastifyInstance;
  server: import("node:http").Server;
  services: Services;
  start(): Promise<{ host: string; port: number }>;
  stop(): Promise<void>;
}

export type AppOverrides = ConfigOverrides & {
  supabaseClient?: SupabaseClient;
  repositories?: RuntimeRepositories;
  storageUserId?: string;
};

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

function createConfiguredSupabaseClient(config: AppConfig): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }
  return createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);
}

async function resolveStorageUserId(
  supabaseClient: SupabaseClient,
  config: AppConfig,
  overrideUserId?: string,
): Promise<string> {
  if (overrideUserId) {
    return overrideUserId;
  }

  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) {
    if (config.seedDemoData) {
      throw new Error(
        "Supabase demo seed requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.",
      );
    }
    return MIGRATION_SYSTEM_USER_ID;
  }

  const { data, error } = await supabaseClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    throw error;
  }

  const bootstrapAdmin = data.users.find(
    (user) => user.email?.trim().toLowerCase() === config.bootstrapAdminEmail?.trim().toLowerCase(),
  );
  const appMetadata = { role: "admin", status: "active" };
  const userMetadata = { name: config.bootstrapAdminName };

  if (bootstrapAdmin) {
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      bootstrapAdmin.id,
      {
        app_metadata: {
          ...bootstrapAdmin.app_metadata,
          ...appMetadata,
        },
        user_metadata: {
          ...bootstrapAdmin.user_metadata,
          ...userMetadata,
        },
      },
    );
    if (updateError) {
      throw updateError;
    }
    return bootstrapAdmin.id;
  }

  const { data: created, error: createError } = await supabaseClient.auth.admin.createUser({
    email: config.bootstrapAdminEmail,
    password: config.bootstrapAdminPassword,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });
  if (createError) {
    throw createError;
  }
  if (!created.user) {
    throw new Error("Supabase bootstrap admin creation returned no user.");
  }

  return created.user.id;
}

function createSupabaseRepositories(
  supabaseClient: SupabaseClient,
  storageUserId: string,
): RuntimeRepositories {
  return {
    accountRepository: new SupabaseAccountConfigRepository(supabaseClient, storageUserId),
    auditEventRepository: new SupabaseAuditEventRepository(supabaseClient),
    jobRepository: new SupabaseJobRepository(supabaseClient, storageUserId),
    rawRecordRepository: new SupabaseRawRecordRepository(supabaseClient, storageUserId),
    normalizedRecordRepository: new SupabaseNormalizedRecordRepository(supabaseClient, storageUserId),
    sheetSnapshotRepository: new SupabaseSheetSnapshotRepository(supabaseClient, storageUserId),
    userRepository: new SupabaseUserRepository(supabaseClient),
  };
}

export async function createApp(overrides: AppOverrides = {}): Promise<AppInstance> {
  const config = loadConfig(overrides);
  const supabaseClient = overrides.supabaseClient ?? createConfiguredSupabaseClient(config);
  const storageUserId = await resolveStorageUserId(
    supabaseClient,
    config,
    overrides.storageUserId,
  );
  const repositories =
    overrides.repositories ?? createSupabaseRepositories(supabaseClient, storageUserId);

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
  const uiDashboardService = new UiDashboardService({
    accountRepository: repositories.accountRepository,
    sheetSnapshotRepository: repositories.sheetSnapshotRepository,
    clock: config.clock,
  });
  const userApprovalService = new UserApprovalService({
    userRepository: repositories.userRepository,
    auditEventRepository: repositories.auditEventRepository,
    supabaseClient,
    clock: config.clock,
  });

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
    scheduledSyncService,
    schedulerService,
    uiDashboardService,
    userApprovalService,
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

  const requireAuth = createRequireAuth(supabaseClient);

  fastify.get("/health", async (request, reply) => {
    await handleHealthRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/ui/accounts", { preHandler: requireAuth }, async (request, reply) => {
    await handleUiAccountsRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/ui/accounts/:platform/:accountId", { preHandler: requireAuth }, async (request, reply) => {
    await handleUiAccountDetailRoute({
      req: request,
      res: reply,
      services,
      config,
      params: request.params as Record<string, string>,
    });
  });

  fastify.post("/api/v1/auth/register", { preHandler: requireAuth }, async (request, reply) => {
    await handleRegisterRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/login", async (request, reply) => {
    await handleLoginRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/logout", async (request, reply) => {
    await handleLogoutRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    await handleCurrentUserRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/forgot-password", async (request, reply) => {
    await handleForgotPasswordRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/auth/reset-password", async (request, reply) => {
    await handleResetPasswordRoute({ req: request, res: reply, services, config });
  });

  fastify.get("/api/v1/admin/pending-users", { preHandler: requireAuth }, async (request, reply) => {
    await handlePendingUsersRoute({ req: request, res: reply, services, config });
  });

  fastify.post("/api/v1/admin/pending-users/:userId/approve", { preHandler: requireAuth }, async (request, reply) => {
    await handleApproveUserRoute({
      req: request,
      res: reply,
      services,
      config,
      params: request.params as Record<string, string>,
    });
  });

  fastify.post("/api/v1/admin/pending-users/:userId/reject", { preHandler: requireAuth }, async (request, reply) => {
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
