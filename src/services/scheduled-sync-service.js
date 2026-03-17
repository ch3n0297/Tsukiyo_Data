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
          systemMessage: "Scheduled sync skipped: account is missing target sheet metadata.",
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
          systemMessage: "Scheduled sync skipped: an active job already exists.",
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
      await this.statusService.markQueued(accountConfig, job, "Scheduled sync queued.");
      this.jobQueue.enqueue(job);
      acceptedJobs.push(job.id);
    }

    return {
      acceptedJobs,
      skippedAccounts,
    };
  }
}
