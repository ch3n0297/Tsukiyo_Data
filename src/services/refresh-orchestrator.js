import crypto from "node:crypto";

function buildRawRecords(job, rawItems, fetchedAt) {
  return rawItems.map((item) => ({
    id: crypto.randomUUID(),
    jobId: job.id,
    accountKey: job.accountKey,
    platform: job.platform,
    accountId: job.accountId,
    fetchedAt,
    payload: item,
  }));
}

function toSystemMessage(error) {
  if (error.code === "TOKEN_EXPIRED") {
    return "Failed to refresh account: token expired.";
  }

  if (error.code === "RATE_LIMITED") {
    return "Failed to refresh account: upstream API rate limited the request.";
  }

  if (error.code === "ENOENT") {
    return "Failed to refresh account: platform fixture data is missing.";
  }

  return `Failed to refresh account: ${error.message}`;
}

export class RefreshOrchestrator {
  constructor({
    accountRepository,
    jobRepository,
    rawRecordRepository,
    normalizedRecordRepository,
    platformRegistry,
    normalizationService,
    statusService,
    logger,
    clock,
  }) {
    this.accountRepository = accountRepository;
    this.jobRepository = jobRepository;
    this.rawRecordRepository = rawRecordRepository;
    this.normalizedRecordRepository = normalizedRecordRepository;
    this.platformRegistry = platformRegistry;
    this.normalizationService = normalizationService;
    this.statusService = statusService;
    this.logger = logger;
    this.clock = clock;
  }

  async processJob(job) {
    const accountConfig = await this.accountRepository.findByPlatformAndAccountId(
      job.platform,
      job.accountId,
    );

    if (!accountConfig) {
      await this.jobRepository.updateById(job.id, {
        status: "error",
        finishedAt: this.clock().toISOString(),
        systemMessage: "Account configuration no longer exists.",
        errorCode: "ACCOUNT_NOT_FOUND",
      });
      return;
    }

    const startedAt = this.clock().toISOString();
    const runningJob = {
      ...job,
      status: "running",
      startedAt,
      systemMessage: "Fetching platform data.",
    };

    await this.jobRepository.updateById(job.id, {
      status: runningJob.status,
      startedAt: runningJob.startedAt,
      systemMessage: runningJob.systemMessage,
    });
    await this.statusService.markRunning(accountConfig, runningJob);

    try {
      const adapter = this.platformRegistry.get(job.platform);
      const rawItems = await adapter.fetchAccountContent({
        accountConfig,
        refreshDays: job.refreshDays,
        now: this.clock(),
      });
      const fetchedAt = this.clock().toISOString();
      const rawRecords = buildRawRecords(job, rawItems, fetchedAt);
      const normalizedRecords = this.normalizationService.normalizeBatch({
        platform: job.platform,
        accountId: job.accountId,
        accountKey: job.accountKey,
        jobId: job.id,
        rawItems,
      });

      await this.rawRecordRepository.appendMany(rawRecords);
      await this.normalizedRecordRepository.replaceForAccount(job.accountKey, normalizedRecords);

      const finishedAt = this.clock().toISOString();
      const successfulJob = {
        ...runningJob,
        status: "success",
        finishedAt,
        systemMessage: `Refresh completed with ${normalizedRecords.length} normalized records.`,
        resultSummary: {
          rawRecordCount: rawRecords.length,
          normalizedRecordCount: normalizedRecords.length,
          sheetSync: "success",
        },
      };

      await this.statusService.markSuccess(
        accountConfig,
        successfulJob,
        normalizedRecords,
        successfulJob.systemMessage,
      );
      await this.jobRepository.updateById(job.id, {
        status: successfulJob.status,
        finishedAt: successfulJob.finishedAt,
        systemMessage: successfulJob.systemMessage,
        resultSummary: successfulJob.resultSummary,
      });
      this.logger.info("Job completed", {
        jobId: job.id,
        platform: job.platform,
        accountId: job.accountId,
      });
    } catch (error) {
      const finishedAt = this.clock().toISOString();
      const systemMessage = toSystemMessage(error);
      const failedJob = {
        ...runningJob,
        status: "error",
        finishedAt,
        systemMessage,
        errorCode: error.code ?? "UNKNOWN",
      };

      await this.jobRepository.updateById(job.id, {
        status: failedJob.status,
        finishedAt: failedJob.finishedAt,
        systemMessage: failedJob.systemMessage,
        errorCode: failedJob.errorCode,
      });
      await this.statusService.markError(accountConfig, failedJob, failedJob.systemMessage);
      this.logger.error("Job failed", {
        jobId: job.id,
        platform: job.platform,
        accountId: job.accountId,
        error: error.message,
      });
    }
  }
}
