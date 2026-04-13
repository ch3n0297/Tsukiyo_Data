import type { AccountConfig } from "../../types/account-config.ts";
import type { NormalizedRecord } from "../../types/record.ts";
import type { SheetGateway, SheetStatusPatch } from "../../types/adapter.ts";
import type { SheetSnapshotRepository } from "../../repositories/sheet-snapshot-repository.ts";

interface FileSheetGatewayOptions {
  sheetSnapshotRepository: SheetSnapshotRepository;
  clock: () => Date;
}

export class FileSheetGateway implements SheetGateway {
  readonly #sheetSnapshotRepository: SheetSnapshotRepository;
  readonly #clock: () => Date;

  constructor({ sheetSnapshotRepository, clock }: FileSheetGatewayOptions) {
    this.#sheetSnapshotRepository = sheetSnapshotRepository;
    this.#clock = clock;
  }

  async writeStatus(accountConfig: AccountConfig, patch: SheetStatusPatch): Promise<void> {
    const timestamp = this.#clock().toISOString();
    await this.#sheetSnapshotRepository.upsertStatus({
      ...patch,
      sheetId: accountConfig.sheetId,
      sheetRowKey: accountConfig.sheetRowKey,
      platform: accountConfig.platform,
      accountId: accountConfig.accountId,
      lastRequestTime: patch.lastRequestTime ?? null,
      lastSuccessTime: patch.lastSuccessTime ?? null,
      currentJobId: patch.currentJobId ?? null,
      updatedAt: timestamp,
    });
  }

  async writeOutput(accountConfig: AccountConfig, normalizedRecords: NormalizedRecord[]): Promise<void> {
    await this.#sheetSnapshotRepository.upsertOutput({
      sheetId: accountConfig.sheetId,
      sheetRowKey: accountConfig.sheetRowKey,
      platform: accountConfig.platform,
      accountId: accountConfig.accountId,
      syncedAt: this.#clock().toISOString(),
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
    });
  }
}
