import crypto from "node:crypto";
import { HttpError } from "../../lib/errors.js";

const STATUS_SHEET_TITLE = "Status";
const OUTPUT_SHEET_TITLE = "Output";
const STATUS_HEADERS = [
  "sheet_row_key",
  "platform",
  "account_id",
  "refresh_status",
  "system_message",
  "last_request_time",
  "last_success_time",
  "current_job_id",
  "updated_at",
];
const OUTPUT_HEADERS = [
  "sheet_row_key",
  "platform",
  "account_id",
  "content_id",
  "content_type",
  "published_at",
  "caption",
  "url",
  "views",
  "likes",
  "comments",
  "shares",
  "data_status",
  "synced_at",
];

function buildAuditRecord({ eventType, metadata, subjectId, tenantKey, createdAt }) {
  return {
    id: crypto.randomUUID(),
    actorUserId: null,
    createdAt,
    eventType,
    metadata,
    subjectId,
    subjectType: "google-connection",
    tenantKey: tenantKey ?? null,
  };
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function buildStatusSnapshot(accountConfig, patch, clock) {
  const timestamp = clock().toISOString();
  return {
    ...patch,
    sheetId: accountConfig.sheetId,
    sheetRowKey: accountConfig.sheetRowKey,
    platform: accountConfig.platform,
    accountId: accountConfig.accountId,
    updatedAt: timestamp,
  };
}

function buildOutputSnapshot(accountConfig, normalizedRecords, clock) {
  return {
    sheetId: accountConfig.sheetId,
    sheetRowKey: accountConfig.sheetRowKey,
    platform: accountConfig.platform,
    accountId: accountConfig.accountId,
    syncedAt: clock().toISOString(),
    rows: normalizedRecords.map((record) => ({
      content_id: record.contentId,
      content_type: record.contentType,
      published_at: record.publishedAt,
      caption: record.caption,
      url: record.url,
      views: record.views,
      likes: record.likes,
      comments: record.comments,
      shares: record.shares,
      data_status: record.dataStatus,
    })),
  };
}

export class GoogleSheetGateway {
  constructor({
    auditLogRepository,
    clock,
    config,
    googleOauthService,
    logger,
    sheetSnapshotRepository,
    fetchImpl = globalThis.fetch,
  }) {
    this.auditLogRepository = auditLogRepository;
    this.clock = clock;
    this.config = config;
    this.googleOauthService = googleOauthService;
    this.logger = logger;
    this.sheetSnapshotRepository = sheetSnapshotRepository;
    this.fetchImpl = fetchImpl;
  }

  async writeStatus(accountConfig, patch) {
    const snapshot = buildStatusSnapshot(accountConfig, patch, this.clock);
    await this.sheetSnapshotRepository.upsertStatus(snapshot);

    if (!this.config.googleOauthEnabled || !accountConfig.googleConnectionId) {
      return snapshot;
    }

    try {
      const { accessToken, connection, spreadsheetId } =
        await this.googleOauthService.getAuthorizedAccountContext(accountConfig);
      await this.#ensureSheetsExist(accessToken, spreadsheetId);
      await this.#upsertStatusRow(accessToken, spreadsheetId, snapshot);
      return snapshot;
    } catch (error) {
      await this.#recordRemoteSyncFailure({
        accountConfig,
        connectionId: accountConfig.googleConnectionId,
        error,
        eventType: "google.sheet.status_sync_failed",
      });
      return snapshot;
    }
  }

  async writeOutput(accountConfig, normalizedRecords) {
    const snapshot = buildOutputSnapshot(accountConfig, normalizedRecords, this.clock);
    await this.sheetSnapshotRepository.upsertOutput(snapshot);

    if (!this.config.googleOauthEnabled) {
      return snapshot;
    }

    const { accessToken, connection, spreadsheetId } =
      await this.googleOauthService.getAuthorizedAccountContext(accountConfig);

    try {
      await this.#ensureSheetsExist(accessToken, spreadsheetId);
      await this.#replaceOutputRows(accessToken, spreadsheetId, snapshot);
      return snapshot;
    } catch (error) {
      await this.#recordRemoteSyncFailure({
        accountConfig,
        connectionId: connection.id,
        error,
        eventType: "google.sheet.output_sync_failed",
      });
      throw new HttpError(
        502,
        "GOOGLE_SHEET_SYNC_FAILED",
        "已完成資料整理，但同步至 Google Sheet 時失敗。",
      );
    }
  }

  async #ensureSheetsExist(accessToken, spreadsheetId) {
    const metadata = await this.#getSpreadsheetMetadata(accessToken, spreadsheetId);
    const existingTitles = new Set(
      (metadata.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean),
    );
    const requests = [];

    if (!existingTitles.has(STATUS_SHEET_TITLE)) {
      requests.push({
        addSheet: {
          properties: {
            title: STATUS_SHEET_TITLE,
          },
        },
      });
    }

    if (!existingTitles.has(OUTPUT_SHEET_TITLE)) {
      requests.push({
        addSheet: {
          properties: {
            title: OUTPUT_SHEET_TITLE,
          },
        },
      });
    }

    if (requests.length === 0) {
      return;
    }

    const response = await this.fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        body: JSON.stringify({ requests }),
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new HttpError(
        502,
        "GOOGLE_SHEET_SETUP_FAILED",
        "無法初始化 Google Sheet 所需的資料表分頁。",
      );
    }
  }

  async #upsertStatusRow(accessToken, spreadsheetId, snapshot) {
    const existingRows = await this.#readSheetValues(accessToken, spreadsheetId, `${STATUS_SHEET_TITLE}!A:I`);
    const rows = existingRows.length > 0 ? existingRows : [STATUS_HEADERS];
    const nextRows = rows.slice(0, 1);
    const targetRow = [
      snapshot.sheetRowKey,
      snapshot.platform,
      snapshot.accountId,
      snapshot.refreshStatus ?? "",
      snapshot.systemMessage ?? "",
      snapshot.lastRequestTime ?? "",
      snapshot.lastSuccessTime ?? "",
      snapshot.currentJobId ?? "",
      snapshot.updatedAt ?? "",
    ];

    let updated = false;

    for (const row of rows.slice(1)) {
      if (row[0] === snapshot.sheetRowKey) {
        nextRows.push(targetRow);
        updated = true;
        continue;
      }

      nextRows.push(row);
    }

    if (!updated) {
      nextRows.push(targetRow);
    }

    await this.#overwriteSheetValues(accessToken, spreadsheetId, `${STATUS_SHEET_TITLE}!A:I`, nextRows);
  }

  async #replaceOutputRows(accessToken, spreadsheetId, snapshot) {
    const existingRows = await this.#readSheetValues(accessToken, spreadsheetId, `${OUTPUT_SHEET_TITLE}!A:N`);
    const rows = existingRows.length > 0 ? existingRows : [OUTPUT_HEADERS];
    const nextRows = rows.slice(0, 1).concat(
      rows.slice(1).filter((row) => row[0] !== snapshot.sheetRowKey),
    );

    const outputRows = (snapshot.rows ?? []).map((row) => [
      snapshot.sheetRowKey,
      snapshot.platform,
      snapshot.accountId,
      row.content_id ?? "",
      row.content_type ?? "",
      row.published_at ?? "",
      row.caption ?? "",
      row.url ?? "",
      row.views ?? "",
      row.likes ?? "",
      row.comments ?? "",
      row.shares ?? "",
      row.data_status ?? "",
      snapshot.syncedAt ?? "",
    ]);

    nextRows.push(...outputRows);

    await this.#overwriteSheetValues(accessToken, spreadsheetId, `${OUTPUT_SHEET_TITLE}!A:N`, nextRows);
  }

  async #getSpreadsheetMetadata(accessToken, spreadsheetId) {
    const response = await this.fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,sheets.properties.title`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        method: "GET",
      },
    );
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new HttpError(
        response.status === 404 ? 404 : 403,
        "GOOGLE_SPREADSHEET_ACCESS_DENIED",
        "目前的 Google 授權無法存取指定的 Spreadsheet。",
      );
    }

    return payload;
  }

  async #readSheetValues(accessToken, spreadsheetId, range) {
    const response = await this.fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        method: "GET",
      },
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new HttpError(502, "GOOGLE_SHEET_READ_FAILED", "無法讀取 Google Sheet 既有資料。");
    }

    const payload = await readJsonResponse(response);
    return Array.isArray(payload.values) ? payload.values : [];
  }

  async #overwriteSheetValues(accessToken, spreadsheetId, range, values) {
    await this.#clearSheetValues(accessToken, spreadsheetId, range);

    const response = await this.fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        body: JSON.stringify({
          majorDimension: "ROWS",
          values,
        }),
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
    );

    if (!response.ok) {
      throw new HttpError(502, "GOOGLE_SHEET_WRITE_FAILED", "無法將資料寫回 Google Sheet。");
    }
  }

  async #clearSheetValues(accessToken, spreadsheetId, range) {
    const response = await this.fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new HttpError(502, "GOOGLE_SHEET_CLEAR_FAILED", "無法清除 Google Sheet 舊資料。");
    }
  }

  async #recordRemoteSyncFailure({ accountConfig, connectionId, error, eventType }) {
    this.logger.warn("Google Sheet sync failed", {
      accountConfigId: accountConfig.id,
      error: {
        code: error.code,
        message: error.message,
      },
      eventType,
    });

    if (!this.auditLogRepository || !connectionId) {
      return;
    }

    await this.auditLogRepository.append(
      buildAuditRecord({
        createdAt: this.clock().toISOString(),
        eventType,
        metadata: {
          accountConfigId: accountConfig.id,
          errorCode: error.code ?? "unknown",
          platform: accountConfig.platform,
          spreadsheetId: accountConfig.allowedSpreadsheetId ?? accountConfig.sheetId,
        },
        subjectId: connectionId,
        tenantKey: accountConfig.tenantKey,
      }),
    );
  }
}
