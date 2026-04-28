import crypto from "node:crypto";
import type { AccountConfigRepository } from "../repositories/account-config-repository.ts";
import type { JobRepository } from "../repositories/job-repository.ts";
import type { RawRecordRepository } from "../repositories/raw-record-repository.ts";
import type { NormalizedRecordRepository } from "../repositories/normalized-record-repository.ts";
import type { PlatformRegistry } from "../adapters/platforms/platform-registry.ts";
import type { NormalizationService } from "./normalization-service.ts";
import type { StatusService } from "./status-service.ts";
import type { Logger } from "../lib/logger.ts";
import type { Job } from "../types/job.ts";
import type { RawRecord } from "../types/record.ts";
import type { NormalizedRecord } from "../types/record.ts";

interface RefreshOrchestratorOptions {
  accountRepository: AccountConfigRepository;
  jobRepository: JobRepository;
  rawRecordRepository: RawRecordRepository;
  normalizedRecordRepository: NormalizedRecordRepository;
  platformRegistry: PlatformRegistry;
  normalizationService: NormalizationService;
  statusService: StatusService;
  logger: Logger;
  clock: () => Date;
}

interface StoredRawRecord extends RawRecord {
  id: string;
  jobId: string;
  accountKey: string;
  platform: string;
  accountId: string;
  fetchedAt: string;
  payload: unknown;
}

function buildRawRecords(job: Job, rawItems: unknown[], fetchedAt: string): StoredRawRecord[] {
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

function toSystemMessage(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === "TOKEN_EXPIRED") {
    return "更新失敗：平台授權已過期。";
  }

  if (e.code === "RATE_LIMITED") {
    return "更新失敗：平台 API 目前觸發頻率限制。";
  }

  if (e.code === "ENOENT") {
    return "更新失敗：找不到對應的平台測試資料。";
  }

  return `更新失敗：${e.message}`;
}

export class RefreshOrchestrator {
  readonly accountRepository: AccountConfigRepository;
  readonly jobRepository: JobRepository;
  readonly rawRecordRepository: RawRecordRepository;
  readonly normalizedRecordRepository: NormalizedRecordRepository;
  readonly platformRegistry: PlatformRegistry;
  readonly normalizationService: NormalizationService;
  readonly statusService: StatusService;
  readonly logger: Logger;
  readonly clock: () => Date;

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
  }: RefreshOrchestratorOptions) {
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

  async processJob(job: Job): Promise<void> {
    const accountConfig = await this.accountRepository.findByPlatformAndAccountId(
      job.platform,
      job.accountId,
    );

    if (!accountConfig) {
      await this.jobRepository.updateById(job.id, {
        status: "error",
        finishedAt: this.clock().toISOString(),
        systemMessage: "帳號設定已不存在。",
        errorCode: "ACCOUNT_NOT_FOUND",
      });
      return;
    }

    const startedAt = this.clock().toISOString();
    const runningJob: Job = {
      ...job,
      status: "running",
      startedAt,
      systemMessage: "正在抓取平台資料。",
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

      await this.#persistFetchedRecords(job.accountKey, rawRecords, normalizedRecords);

      const finishedAt = this.clock().toISOString();
      const successfulJob: Job = {
        ...runningJob,
        status: "success",
        finishedAt,
        systemMessage: `更新完成，共整理 ${normalizedRecords.length} 筆內容資料。`,
        resultSummary: {
          rawRecordCount: rawRecords.length,
          normalizedRecordCount: normalizedRecords.length,
          sheetSync: "success",
        },
      };

      await this.jobRepository.updateById(job.id, {
        status: successfulJob.status,
        finishedAt: successfulJob.finishedAt,
        systemMessage: successfulJob.systemMessage,
        resultSummary: successfulJob.resultSummary,
      });
      await this.statusService.markSuccess(
        accountConfig,
        successfulJob,
        normalizedRecords,
        successfulJob.systemMessage,
      );
      this.logger.info("Job completed", {
        jobId: job.id,
        platform: job.platform,
        accountId: job.accountId,
      });
    } catch (error) {
      const e = error as { code?: string; message?: string };
      const finishedAt = this.clock().toISOString();
      const systemMessage = toSystemMessage(error);
      const failedJob: Job = {
        ...runningJob,
        status: "error",
        finishedAt,
        systemMessage,
        errorCode: e.code ?? "UNKNOWN",
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
        error,
      });
    }
  }

  async #persistFetchedRecords(
    accountKey: string,
    rawRecords: StoredRawRecord[],
    normalizedRecords: NormalizedRecord[]
  ): Promise<void> {
    const store = this.rawRecordRepository.store;

    if (
      !store ||
      store !== this.normalizedRecordRepository.store ||
      typeof store.updateCollections !== "function"
    ) {
      await this.rawRecordRepository.appendMany(rawRecords);
      await this.normalizedRecordRepository.replaceForAccount(accountKey, normalizedRecords);
      return;
    }

    type RefreshCollections = {
      [key: string]: unknown[];
    };

    const rawCol = this.rawRecordRepository.collection;
    const normCol = this.normalizedRecordRepository.collection;

    await store.updateCollections<RefreshCollections>(
      [rawCol, normCol],
      (collections) => {
        const nextRawRecords = collections[rawCol] as StoredRawRecord[];
        const nextNormalizedRecords = (collections[normCol] as NormalizedRecord[])
          .filter((record) => record.accountKey !== accountKey);

        nextRawRecords.push(...rawRecords);
        nextNormalizedRecords.push(...normalizedRecords);

        return {
          ...collections,
          [rawCol]: nextRawRecords,
          [normCol]: nextNormalizedRecords,
        };
      },
    );
  }
}
