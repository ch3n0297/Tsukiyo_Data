import type { FileStore } from "../lib/fs-store.ts";
import type { AccountConfig } from "../types/account-config.ts";

export function makeAccountKey(platform: string, accountId: string): string {
  return `${platform}:${accountId}`;
}

export class AccountConfigRepository {
  private readonly store: FileStore;
  private readonly collection = "account-configs";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<AccountConfig[]> {
    return this.store.readCollection<AccountConfig>(this.collection);
  }

  async listActive(): Promise<AccountConfig[]> {
    const records = await this.listAll();
    return records.filter((record) => record.isActive);
  }

  async replaceAll(records: AccountConfig[]): Promise<AccountConfig[]> {
    return this.store.writeCollection<AccountConfig>(this.collection, records);
  }

  async findByPlatformAndAccountId(
    platform: string,
    accountId: string
  ): Promise<AccountConfig | undefined> {
    const records = await this.listAll();
    return records.find(
      (record) => record.platform === platform && record.accountId === accountId,
    );
  }

  async updateByAccountKey(
    accountKey: string,
    patch: Partial<AccountConfig>
  ): Promise<AccountConfig[]> {
    return this.store.updateCollection<AccountConfig>(this.collection, async (records) => {
      const index = records.findIndex(
        (record) => makeAccountKey(record.platform, record.accountId) === accountKey,
      );

      if (index === -1) {
        return records;
      }

      records[index] = {
        ...records[index],
        ...patch,
      };

      return records;
    });
  }
}
