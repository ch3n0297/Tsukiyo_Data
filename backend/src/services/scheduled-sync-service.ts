import { makeAccountKey } from "../repositories/account-config-repository.ts";
import { createQueuedJob } from "./job-factory.ts";
import type { AccountConfigRepository } from "../repositories/account-config-repository.ts";
import type { JobRepository } from "../repositories/job-repository.ts";
import type { JobQueue } from "./job-queue.ts";
import type { RequestSource } from "../types/job.ts";
import type { StatusService } from "./status-service.ts";

interface ScheduledSyncServiceOptions {
  accountRepository: AccountConfigRepository;
  jobRepository: JobRepository;
  jobQueue: JobQueue;
  statusService: StatusService;
  clock: () => Date;
}

interface EnqueueResult {
  acceptedJobs: string[];
  skippedAccounts: Array<{ account_key: string; reason: string }>;
}

export class ScheduledSyncService {
  readonly accountRepository: AccountConfigRepository;
  readonly jobRepository: JobRepository;
  readonly jobQueue: JobQueue;
  readonly statusService: StatusService;
  readonly clock: () => Date;

  constructor({
    accountRepository,
    jobRepository,
    jobQueue,
    statusService,
    clock,
  }: ScheduledSyncServiceOptions) {
    this.accountRepository = accountRepository;
    this.jobRepository = jobRepository;
    this.jobQueue = jobQueue;
    this.statusService = statusService;
    this.clock = clock;
  }

  async enqueueAllActiveAccounts({ requestedBy }: { requestedBy: string }): Promise<EnqueueResult> {
    const accounts = await this.accountRepository.listActive();
    const acceptedJobs: string[] = [];
    const skippedAccounts: Array<{ account_key: string; reason: string }> = [];

    for (const accountConfig of accounts) {
      const accountKey = makeAccountKey(accountConfig.platform, accountConfig.accountId);

      if (!accountConfig.sheetId || !accountConfig.sheetRowKey) {
        skippedAccounts.push({
          account_key: accountKey,
          reason: "missing_sheet_metadata",
        });
        await this.statusService.markRejected(accountConfig, {
          refreshStatus: "error",
          currentJobId: null,
          systemMessage: "排程同步已略過：帳號缺少目標工作表資訊。",
        });
        continue;
      }

      const activeJob = await this.jobRepository.findActiveByAccountKey(accountKey);
      if (activeJob) {
        skippedAccounts.push({
          account_key: accountKey,
          reason: "active_job_exists",
        });
        await this.statusService.markRejected(accountConfig, {
          refreshStatus: activeJob.status,
          currentJobId: activeJob.id,
          systemMessage: "排程同步已略過：此帳號已有進行中的工作。",
        });
        continue;
      }

      const job = createQueuedJob({
        accountKey,
        platform: accountConfig.platform,
        accountId: accountConfig.accountId,
        triggerType: "scheduled",
        requestSource: requestedBy as RequestSource,
        refreshDays: accountConfig.refreshDays,
        clock: this.clock,
      });

      await this.jobRepository.create(job);
      await this.statusService.markQueued(accountConfig, job, "已排入排程同步工作。");
      this.jobQueue.enqueue(job);
      acceptedJobs.push(job.id);
    }

    return { acceptedJobs, skippedAccounts };
  }
}
