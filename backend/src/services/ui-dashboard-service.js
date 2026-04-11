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

function sortPlatforms(left, right) {
  return left.localeCompare(right);
}

function indexByAccountKey(records) {
  const map = new Map();

  for (const record of records) {
    map.set(makeAccountKey(record.platform, record.accountId), record);
  }

  return map;
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTimestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortContentItems(left, right) {
  return (
    asNumber(right.views) - asNumber(left.views) ||
    toTimestamp(right.published_at) - toTimestamp(left.published_at) ||
    String(left.content_id ?? "").localeCompare(String(right.content_id ?? ""))
  );
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
    tenantKey: accountConfig.tenantKey ?? null,
    platform: accountConfig.platform,
    accountId: accountConfig.accountId,
    refreshDays: accountConfig.refreshDays,
    isActive: Boolean(accountConfig.isActive),
    sheetId: accountConfig.sheetId,
    allowedSpreadsheetId: accountConfig.allowedSpreadsheetId ?? accountConfig.sheetId ?? null,
    sheetRowKey: accountConfig.sheetRowKey,
    googleConnection: accountConfig.googleConnection ?? null,
    refreshStatus: statusSnapshot?.refreshStatus ?? accountConfig.refreshStatus,
    systemMessage: statusSnapshot?.systemMessage ?? accountConfig.systemMessage,
    lastRequestTime: statusSnapshot?.lastRequestTime ?? accountConfig.lastRequestTime ?? null,
    lastSuccessTime: statusSnapshot?.lastSuccessTime ?? accountConfig.lastSuccessTime ?? null,
    currentJobId: statusSnapshot?.currentJobId ?? accountConfig.currentJobId ?? null,
    statusUpdatedAt: statusSnapshot?.updatedAt ?? accountConfig.updatedAt ?? null,
    latestOutput: buildLatestOutput(outputSnapshot, { includeRows }),
  };
}

function buildContentItem(row, account, syncedAt) {
  return {
    accountId: account.accountId,
    accountKey: account.accountKey,
    caption: row.caption ?? null,
    clientName: account.clientName,
    comments: asNumber(row.comments),
    content_id: row.content_id ?? null,
    content_type: row.content_type ?? null,
    data_status: row.data_status ?? null,
    likes: asNumber(row.likes),
    platform: account.platform,
    published_at: row.published_at ?? null,
    shares: asNumber(row.shares),
    syncedAt,
    url: row.url ?? null,
    views: asNumber(row.views),
  };
}

function buildPlatformGroup(platform, accounts, outputByKey) {
  const items = accounts
    .flatMap((account) => {
      const outputSnapshot = outputByKey.get(account.accountKey);
      const rows = Array.isArray(outputSnapshot?.rows) ? outputSnapshot.rows : [];

      return rows.map((row) => buildContentItem(row, account, outputSnapshot?.syncedAt ?? null));
    })
    .sort(sortContentItems);

  const totalViews = items.reduce((sum, item) => sum + asNumber(item.views), 0);
  const lastPublishedAt = items.reduce((latestValue, item) => {
    if (toTimestamp(item.published_at) > toTimestamp(latestValue)) {
      return item.published_at;
    }

    return latestValue;
  }, null);

  return {
    platform,
    accountCount: accounts.length,
    contentCount: items.length,
    totalViews,
    lastPublishedAt,
    previewItems: items.slice(0, 5),
    items,
  };
}

export class UiDashboardService {
  constructor({ accountRepository, config, googleConnectionRepository, sheetSnapshotRepository, clock }) {
    this.accountRepository = accountRepository;
    this.config = config;
    this.googleConnectionRepository = googleConnectionRepository;
    this.sheetSnapshotRepository = sheetSnapshotRepository;
    this.clock = clock;
  }

  async listAccounts(currentUser) {
    const { uiAccounts } = await this.#loadSnapshotMaps(currentUser);

    return {
      generatedAt: this.clock().toISOString(),
      capabilities: UI_CAPABILITIES,
      accounts: uiAccounts,
    };
  }

  async getContentOverview(currentUser) {
    const { accounts, outputByKey, uiAccounts } = await this.#loadSnapshotMaps(currentUser);
    const accountsByPlatform = new Map();

    for (const account of uiAccounts) {
      const currentAccounts = accountsByPlatform.get(account.platform) ?? [];
      currentAccounts.push(account);
      accountsByPlatform.set(account.platform, currentAccounts);
    }

    return {
      generatedAt: this.clock().toISOString(),
      capabilities: UI_CAPABILITIES,
      accounts: uiAccounts,
      platforms: [...new Set(accounts.map((account) => account.platform))]
        .sort(sortPlatforms)
        .map((platform) =>
          buildPlatformGroup(platform, accountsByPlatform.get(platform) ?? [], outputByKey),
        ),
    };
  }

  async getAccountDetail({ platform, accountId }, currentUser) {
    const { accounts, statusByKey, outputByKey } = await this.#loadSnapshotMaps(currentUser);
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

  async #loadSnapshotMaps(currentUser) {
    const [storedAccounts, statuses, outputs, googleConnections] = await Promise.all([
      this.accountRepository.listAll(),
      this.sheetSnapshotRepository.listStatuses(),
      this.sheetSnapshotRepository.listOutputs(),
      this.googleConnectionRepository?.listAll?.() ?? [],
    ]);
    const visibleAccounts = this.#filterAccountsForUser(storedAccounts, currentUser);
    const connectionByAccountConfigId = new Map(
      googleConnections.map((connection) => [connection.accountConfigId, connection]),
    );

    const accounts = visibleAccounts.map((account) => ({
      ...account,
      googleConnection: this.#buildConnectionSummary(account, connectionByAccountConfigId.get(account.id)),
    }));
    const statusByKey = indexByAccountKey(statuses);
    const outputByKey = indexByAccountKey(outputs);
    const uiAccounts = [...accounts]
      .sort(sortAccounts)
      .map((account) => {
        const accountKey = makeAccountKey(account.platform, account.accountId);

        return buildUiAccount(account, statusByKey.get(accountKey), outputByKey.get(accountKey));
      });

    return {
      accounts,
      uiAccounts,
      statusByKey,
      outputByKey,
    };
  }

  #filterAccountsForUser(accounts, currentUser) {
    if (!currentUser || currentUser.role === "admin") {
      return accounts;
    }

    if (!currentUser.tenantKey) {
      return [];
    }

    return accounts.filter((account) => account.tenantKey === currentUser.tenantKey);
  }

  #buildConnectionSummary(accountConfig, connection) {
    if (!connection) {
      return {
        allowedSpreadsheetId: accountConfig.allowedSpreadsheetId ?? accountConfig.sheetId ?? null,
        authorizedEmail: null,
        connectedAt: null,
        lastErrorCode: null,
        lastRefreshedAt: null,
        status: this.config?.googleOauthEnabled ? "not_connected" : "disabled",
      };
    }

    return {
      allowedSpreadsheetId:
        connection.allowedSpreadsheetId ?? accountConfig.allowedSpreadsheetId ?? accountConfig.sheetId ?? null,
      authorizedEmail: connection.authorizedEmail ?? null,
      connectedAt: connection.connectedAt ?? null,
      lastErrorCode: connection.lastErrorCode ?? null,
      lastRefreshedAt: connection.lastRefreshedAt ?? null,
      status: connection.status ?? "active",
    };
  }
}
