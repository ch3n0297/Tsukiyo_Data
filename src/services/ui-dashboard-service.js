import { HttpError } from "../lib/errors.js";
import { makeAccountKey } from "../repositories/account-config-repository.js";

const UI_CAPABILITIES = Object.freeze({
  mode: "read-only",
  manualRefresh: false,
  scheduledSync: false,
  reason:
    "儀表板目前僅提供唯讀檢視；手動刷新與排程同步仍需透過簽章保護的伺服器 API 進行。",
});

function sortAccounts(left, right) {
  return (
    left.clientName.localeCompare(right.clientName) ||
    left.platform.localeCompare(right.platform) ||
    left.accountId.localeCompare(right.accountId)
  );
}

function indexByAccountKey(records) {
  const map = new Map();

  for (const record of records) {
    map.set(makeAccountKey(record.platform, record.accountId), record);
  }

  return map;
}

function buildLatestOutput(outputSnapshot, { includeRows = false } = {}) {
  if (!outputSnapshot) {
    return includeRows
      ? {
          syncedAt: null,
          rowCount: 0,
          rows: [],
        }
      : null;
  }

  const rows = Array.isArray(outputSnapshot.rows) ? outputSnapshot.rows : [];
  const payload = {
    syncedAt: outputSnapshot.syncedAt ?? null,
    rowCount: rows.length,
  };

  if (includeRows) {
    payload.rows = rows;
  }

  return payload;
}

function buildUiAccount(accountConfig, statusSnapshot, outputSnapshot, { includeRows = false } = {}) {
  return {
    id: accountConfig.id,
    accountKey: makeAccountKey(accountConfig.platform, accountConfig.accountId),
    clientName: accountConfig.clientName,
    platform: accountConfig.platform,
    accountId: accountConfig.accountId,
    refreshDays: accountConfig.refreshDays,
    isActive: Boolean(accountConfig.isActive),
    sheetId: accountConfig.sheetId,
    sheetRowKey: accountConfig.sheetRowKey,
    refreshStatus: statusSnapshot?.refreshStatus ?? accountConfig.refreshStatus,
    systemMessage: statusSnapshot?.systemMessage ?? accountConfig.systemMessage,
    lastRequestTime: statusSnapshot?.lastRequestTime ?? accountConfig.lastRequestTime ?? null,
    lastSuccessTime: statusSnapshot?.lastSuccessTime ?? accountConfig.lastSuccessTime ?? null,
    currentJobId: statusSnapshot?.currentJobId ?? accountConfig.currentJobId ?? null,
    statusUpdatedAt: statusSnapshot?.updatedAt ?? accountConfig.updatedAt ?? null,
    latestOutput: buildLatestOutput(outputSnapshot, { includeRows }),
  };
}

export class UiDashboardService {
  constructor({ accountRepository, sheetSnapshotRepository, clock }) {
    this.accountRepository = accountRepository;
    this.sheetSnapshotRepository = sheetSnapshotRepository;
    this.clock = clock;
  }

  async listAccounts() {
    const { accounts, statusByKey, outputByKey } = await this.#loadSnapshotMaps();

    return {
      generatedAt: this.clock().toISOString(),
      capabilities: UI_CAPABILITIES,
      accounts: [...accounts].sort(sortAccounts).map((account) => {
        const accountKey = makeAccountKey(account.platform, account.accountId);

        return buildUiAccount(account, statusByKey.get(accountKey), outputByKey.get(accountKey));
      }),
    };
  }

  async getAccountDetail({ platform, accountId }) {
    const { accounts, statusByKey, outputByKey } = await this.#loadSnapshotMaps();
    const account = accounts.find(
      (entry) => entry.platform === platform && entry.accountId === accountId,
    );

    if (!account) {
      throw new HttpError(404, "ACCOUNT_NOT_FOUND", "找不到指定的儀表板帳號資料。");
    }

    const accountKey = makeAccountKey(platform, accountId);

    return {
      generatedAt: this.clock().toISOString(),
      capabilities: UI_CAPABILITIES,
      account: buildUiAccount(account, statusByKey.get(accountKey), outputByKey.get(accountKey), {
        includeRows: true,
      }),
    };
  }

  async #loadSnapshotMaps() {
    const [accounts, statuses, outputs] = await Promise.all([
      this.accountRepository.listAll(),
      this.sheetSnapshotRepository.listStatuses(),
      this.sheetSnapshotRepository.listOutputs(),
    ]);

    return {
      accounts,
      statusByKey: indexByAccountKey(statuses),
      outputByKey: indexByAccountKey(outputs),
    };
  }
}
