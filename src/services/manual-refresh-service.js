import { HttpError } from "../lib/errors.js";
import { makeAccountKey } from "../repositories/account-config-repository.js";
import { createQueuedJob } from "./job-factory.js";
import { validateManualRefreshPayload } from "./validation-service.js";

export class ManualRefreshService {
  constructor({
    accountRepository,
    jobRepository,
    jobQueue,
    statusService,
    config,
    clock,
  }) {
    this.accountRepository = accountRepository;
    this.jobRepository = jobRepository;
    this.jobQueue = jobQueue;
    this.statusService = statusService;
    this.config = config;
    this.clock = clock;
    this.sourceRequestLog = new Map();
  }

  async enqueueManualRefresh({ payload, clientId }) {
    const validated = validateManualRefreshPayload(payload);
    const accountConfig = await this.accountRepository.findByPlatformAndAccountId(
      validated.platform,
      validated.accountId,
    );

    if (!accountConfig) {
      throw new HttpError(
        400,
        "ACCOUNT_NOT_CONFIGURED",
        "Account configuration does not exist for the requested platform/account_id.",
      );
    }

    this.#assertAccountHasSheetMetadata(accountConfig);

    const accountKey = makeAccountKey(accountConfig.platform, accountConfig.accountId);
    const activeJob = await this.jobRepository.findActiveByAccountKey(accountKey);
    if (activeJob) {
      await this.statusService.markRejected(accountConfig, {
        refreshStatus: activeJob.status,
        currentJobId: activeJob.id,
        systemMessage: "A refresh job is already queued or running for this account.",
      });
      throw new HttpError(
        409,
        "ACTIVE_JOB_EXISTS",
        "A refresh job is already queued or running for this account.",
      );
    }

    try {
      this.#assertSourceWithinRateLimit(clientId);
    } catch (error) {
      await this.statusService.markRejected(accountConfig, {
        refreshStatus: "error",
        currentJobId: null,
        systemMessage: error.message,
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
          systemMessage: "Refresh request is too frequent for this account.",
        });
        throw new HttpError(
          429,
          "ACCOUNT_RATE_LIMITED",
          "Refresh request is too frequent for this account.",
        );
      }
    }

    const job = createQueuedJob({
      accountKey,
      platform: accountConfig.platform,
      accountId: accountConfig.accountId,
      triggerType: "manual",
      requestSource: validated.requestSource,
      refreshDays: validated.refreshDays,
      clock: this.clock,
    });

    await this.jobRepository.create(job);
    await this.statusService.markQueued(accountConfig, job, "Manual refresh request accepted.");
    this.jobQueue.enqueue(job);

    return job;
  }

  #assertSourceWithinRateLimit(clientId) {
    const now = this.clock().getTime();
    const windowStart = now - this.config.sourceRateLimitWindowMs;
    const current = this.sourceRequestLog.get(clientId) ?? [];
    const recent = current.filter((timestamp) => timestamp >= windowStart);

    if (recent.length >= this.config.sourceRateLimitMax) {
      throw new HttpError(429, "SOURCE_RATE_LIMITED", "Request source is sending requests too quickly.");
    }

    recent.push(now);
    this.sourceRequestLog.set(clientId, recent);
  }

  #assertAccountHasSheetMetadata(accountConfig) {
    if (!accountConfig.sheetId || !accountConfig.sheetRowKey) {
      throw new HttpError(
        400,
        "ACCOUNT_CONFIG_INVALID",
        "Account configuration is missing target sheet metadata.",
      );
    }
  }
}
