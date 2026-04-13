import { makeAccountKey } from "../repositories/account-config-repository.ts";
import type { AccountConfigRepository } from "../repositories/account-config-repository.ts";
import type { SheetGateway, SheetStatusPatch } from "../types/adapter.ts";
import type { AccountConfig } from "../types/account-config.ts";
import type { Job } from "../types/job.ts";
import type { NormalizedRecord } from "../types/record.ts";

interface StatusServiceOptions {
  accountRepository: AccountConfigRepository;
  sheetGateway: SheetGateway;
  clock: () => Date;
}

interface StatusPatch {
  refreshStatus: AccountConfig["refreshStatus"];
  systemMessage: string;
  currentJobId?: string | null;
  lastRequestTime?: string | null;
  lastSuccessTime?: string | null;
}

export class StatusService {
  readonly accountRepository: AccountConfigRepository;
  readonly sheetGateway: SheetGateway;
  readonly clock: () => Date;

  constructor({ accountRepository, sheetGateway, clock }: StatusServiceOptions) {
    this.accountRepository = accountRepository;
    this.sheetGateway = sheetGateway;
    this.clock = clock;
  }

  async bootstrapAccountSnapshots(): Promise<void> {
    const accounts = await this.accountRepository.listAll();
    await Promise.all(
      accounts.map((account) =>
        this.sheetGateway.writeStatus(account, {
          refreshStatus: account.refreshStatus,
          systemMessage: account.systemMessage,
          lastRequestTime: account.lastRequestTime,
          lastSuccessTime: account.lastSuccessTime,
          currentJobId: account.currentJobId,
        }),
      ),
    );
  }

  async markQueued(
    accountConfig: AccountConfig,
    job: Job,
    message = job.systemMessage
  ): Promise<AccountConfig> {
    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "queued",
      systemMessage: message,
      lastRequestTime: job.queuedAt,
      currentJobId: job.id,
    });
  }

  async markRunning(
    accountConfig: AccountConfig,
    job: Job,
    message = job.systemMessage
  ): Promise<AccountConfig> {
    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "running",
      systemMessage: message,
      currentJobId: job.id,
    });
  }

  async markSuccess(
    accountConfig: AccountConfig,
    job: Job,
    normalizedRecords: NormalizedRecord[],
    message = job.systemMessage
  ): Promise<AccountConfig> {
    await this.sheetGateway.writeOutput(accountConfig, normalizedRecords);

    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "success",
      systemMessage: message,
      currentJobId: null,
      lastSuccessTime: job.finishedAt,
    });
  }

  async markError(
    accountConfig: AccountConfig,
    job: Job,
    message = job.systemMessage
  ): Promise<AccountConfig> {
    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "error",
      systemMessage: message,
      currentJobId: null,
      lastRequestTime: job.queuedAt ?? accountConfig.lastRequestTime,
    });
  }

  async markRejected(
    accountConfig: AccountConfig | null,
    patch: StatusPatch
  ): Promise<AccountConfig | null> {
    if (!accountConfig) {
      return null;
    }

    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: patch.refreshStatus ?? accountConfig.refreshStatus ?? "error",
      systemMessage: patch.systemMessage,
      currentJobId:
        patch.currentJobId === undefined ? accountConfig.currentJobId ?? null : patch.currentJobId,
      lastRequestTime: this.clock().toISOString(),
    });
  }

  async #syncAccountStatus(
    accountConfig: AccountConfig,
    patch: StatusPatch
  ): Promise<AccountConfig> {
    const accountKey = makeAccountKey(accountConfig.platform, accountConfig.accountId);
    const nextPatch = {
      ...patch,
      updatedAt: this.clock().toISOString(),
    };
    await this.accountRepository.updateByAccountKey(accountKey, nextPatch);

    const updatedAccount: AccountConfig = {
      ...accountConfig,
      ...nextPatch,
    };

    const sheetPatch: SheetStatusPatch = {
      refreshStatus: updatedAccount.refreshStatus,
      systemMessage: updatedAccount.systemMessage,
      lastRequestTime: updatedAccount.lastRequestTime,
      lastSuccessTime: updatedAccount.lastSuccessTime,
      currentJobId: updatedAccount.currentJobId,
    };

    await this.sheetGateway.writeStatus(updatedAccount, sheetPatch);

    return updatedAccount;
  }
}
