export class FileSheetGateway {
  constructor({ sheetSnapshotRepository, clock }) {
    this.sheetSnapshotRepository = sheetSnapshotRepository;
    this.clock = clock;
  }

  async writeStatus(accountConfig, patch) {
    const timestamp = this.clock().toISOString();
    await this.sheetSnapshotRepository.upsertStatus({
      sheetId: accountConfig.sheetId,
      sheetRowKey: accountConfig.sheetRowKey,
      platform: accountConfig.platform,
      accountId: accountConfig.accountId,
      updatedAt: timestamp,
      ...patch,
    });
  }

  async writeOutput(accountConfig, normalizedRecords) {
    await this.sheetSnapshotRepository.upsertOutput({
      sheetId: accountConfig.sheetId,
      sheetRowKey: accountConfig.sheetRowKey,
      platform: accountConfig.platform,
      accountId: accountConfig.accountId,
      syncedAt: this.clock().toISOString(),
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
