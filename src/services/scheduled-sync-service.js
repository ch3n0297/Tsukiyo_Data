import { makeAccountKey } from "../repositories/account-config-repository.js";
import { createQueuedJob } from "./job-factory.js";

export class ScheduledSyncService {
  constructor({
    accountRepository,
    jobRepository,
    jobQueue,
    statusService,
    clock,
  }) {
    this.accountRepository = accountRepository;
    this.jobRepository = jobRepository;
    this.jobQueue = jobQueue;
    this.statusService = statusService;
    this.clock = clock;
  }

  async enqueueAllActiveAccounts({ requestedBy }) {
    const accounts = await this.accountRepository.listActive();
    const acceptedJobs = [];
    const skippedAccounts = [];

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
        requestSource: requestedBy,
        refreshDays: accountConfig.refreshDays,
        clock: this.clock,
      });

      await this.jobRepository.create(job);
      await this.statusService.markQueued(accountConfig, job, "已排入排程同步工作。");
      this.jobQueue.enqueue(job);
      acceptedJobs.push(job.id);
    }

    return {
      acceptedJobs,
      skippedAccounts,
    };
  }
}
