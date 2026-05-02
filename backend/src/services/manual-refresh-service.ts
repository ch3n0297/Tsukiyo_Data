import { HttpError } from "../lib/errors.ts";
import { makeAccountKey } from "../repositories/account-config-repository.ts";
import { createQueuedJob } from "./job-factory.ts";
import { validateManualRefreshPayload } from "./validation-service.ts";
import type { AccountConfigRepository } from "../repositories/account-config-repository.ts";
import type { JobRepository } from "../repositories/job-repository.ts";
import type { JobQueue } from "./job-queue.ts";
import type { StatusService } from "./status-service.ts";
import type { AppConfig } from "../types/app.ts";
import type { Job } from "../types/job.ts";
import type { AccountConfig } from "../types/account-config.ts";

interface ManualRefreshServiceOptions {
  accountRepository: AccountConfigRepository;
  jobRepository: JobRepository;
  jobQueue: JobQueue;
  statusService: StatusService;
  config: AppConfig;
  clock: () => Date;
}

export class ManualRefreshService {
  readonly accountRepository: AccountConfigRepository;
  readonly jobRepository: JobRepository;
  readonly jobQueue: JobQueue;
  readonly statusService: StatusService;
  readonly config: AppConfig;
  readonly clock: () => Date;
  readonly sourceRequestLog: Map<string, number[]>;

  constructor({
    accountRepository,
    jobRepository,
    jobQueue,
    statusService,
    config,
    clock,
  }: ManualRefreshServiceOptions) {
    this.accountRepository = accountRepository;
    this.jobRepository = jobRepository;
    this.jobQueue = jobQueue;
    this.statusService = statusService;
    this.config = config;
    this.clock = clock;
    this.sourceRequestLog = new Map();
  }

  async enqueueManualRefresh({ payload, clientId }: { payload: unknown; clientId: string }): Promise<Job> {
    const validated = validateManualRefreshPayload(payload);
    const accountConfig = await this.accountRepository.findByPlatformAndAccountId(
      validated.platform,
      validated.accountId,
    );

    if (!accountConfig) {
      throw new HttpError(
        400,
        "ACCOUNT_NOT_CONFIGURED",
        "找不到對應平台與 account_id 的帳號設定。",
      );
    }

    this.#assertAccountHasSheetMetadata(accountConfig);

    const accountKey = makeAccountKey(accountConfig.platform, accountConfig.accountId);
    const activeJob = await this.jobRepository.findActiveByAccountKey(accountKey);
    if (activeJob) {
      await this.statusService.markRejected(accountConfig, {
        refreshStatus: activeJob.status,
        currentJobId: activeJob.id,
        systemMessage: "此帳號已有待處理或執行中的更新工作。",
      });
      throw new HttpError(
        409,
        "ACTIVE_JOB_EXISTS",
        "此帳號已有待處理或執行中的更新工作。",
      );
    }

    try {
      this.#assertSourceWithinRateLimit(clientId);
    } catch (error) {
      await this.statusService.markRejected(accountConfig, {
        refreshStatus: "error",
        currentJobId: null,
        systemMessage: (error as Error).message,
      });
      throw error;
    }

    const latestAcceptedJob = await this.jobRepository.findLatestAcceptedJob(accountKey, "manual");
    if (latestAcceptedJob) {
      const cooldownRemaining =
        Date.parse(latestAcceptedJob.queuedAt) + this.config.accountCooldownMs -
        this.clock().getTime();

      if (cooldownRemaining > 0) {
        await this.statusService.markRejected(accountConfig, {
          refreshStatus: accountConfig.refreshStatus,
          currentJobId: null,
          systemMessage: "此帳號的更新請求過於頻繁，請稍後再試。",
        });
        throw new HttpError(
          429,
          "ACCOUNT_RATE_LIMITED",
          "此帳號的更新請求過於頻繁，請稍後再試。",
        );
      }
    }

    const job = createQueuedJob({
      ownerUserId: validated.ownerUserId,
      accountKey,
      platform: accountConfig.platform,
      accountId: accountConfig.accountId,
      triggerType: "manual",
      requestSource: validated.requestSource,
      refreshDays: validated.refreshDays,
      clock: this.clock,
    });

    await this.jobRepository.create(job);
    await this.statusService.markQueued(accountConfig, job, "已受理手動更新請求，正在排入佇列。");
    this.jobQueue.enqueue(job);

    return job;
  }

  #assertSourceWithinRateLimit(clientId: string): void {
    const now = this.clock().getTime();
    const windowStart = now - this.config.sourceRateLimitWindowMs;
    const current = this.sourceRequestLog.get(clientId) ?? [];
    const recent = current.filter((timestamp) => timestamp >= windowStart);

    if (recent.length >= this.config.sourceRateLimitMax) {
      throw new HttpError(429, "SOURCE_RATE_LIMITED", "此請求來源的送出頻率過高，請稍後再試。");
    }

    recent.push(now);
    this.sourceRequestLog.set(clientId, recent);
  }

  #assertAccountHasSheetMetadata(accountConfig: AccountConfig): void {
    if (!accountConfig.sheetId || !accountConfig.sheetRowKey) {
      throw new HttpError(
        400,
        "ACCOUNT_CONFIG_INVALID",
        "帳號設定缺少目標工作表資訊。",
      );
    }
  }
}
