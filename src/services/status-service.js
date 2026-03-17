import { makeAccountKey } from "../repositories/account-config-repository.js";

export class StatusService {
  constructor({ accountRepository, sheetGateway, clock }) {
    this.accountRepository = accountRepository;
    this.sheetGateway = sheetGateway;
    this.clock = clock;
  }

  async bootstrapAccountSnapshots() {
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

  async markQueued(accountConfig, job, message = job.systemMessage) {
    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "queued",
      systemMessage: message,
      lastRequestTime: job.queuedAt,
      currentJobId: job.id,
    });
  }

  async markRunning(accountConfig, job, message = job.systemMessage) {
    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "running",
      systemMessage: message,
      currentJobId: job.id,
    });
  }

  async markSuccess(accountConfig, job, normalizedRecords, message = job.systemMessage) {
    await this.sheetGateway.writeOutput(accountConfig, normalizedRecords);

    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "success",
      systemMessage: message,
      currentJobId: null,
      lastSuccessTime: job.finishedAt,
    });
  }

  async markError(accountConfig, job, message = job.systemMessage) {
    return this.#syncAccountStatus(accountConfig, {
      refreshStatus: "error",
      systemMessage: message,
      currentJobId: null,
      lastRequestTime: job.queuedAt ?? accountConfig.lastRequestTime,
    });
  }

  async markRejected(accountConfig, patch) {
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

  async #syncAccountStatus(accountConfig, patch) {
    const accountKey = makeAccountKey(accountConfig.platform, accountConfig.accountId);
    await this.accountRepository.updateByAccountKey(accountKey, patch);

    const updatedAccount = {
      ...accountConfig,
      ...patch,
    };

    await this.sheetGateway.writeStatus(updatedAccount, {
      refreshStatus: updatedAccount.refreshStatus,
      systemMessage: updatedAccount.systemMessage,
      lastRequestTime: updatedAccount.lastRequestTime,
      lastSuccessTime: updatedAccount.lastSuccessTime,
      currentJobId: updatedAccount.currentJobId,
    });

    return updatedAccount;
  }
}
