import type { FileStore } from "../lib/fs-store.ts";
import type { NormalizedRecord } from "../types/record.ts";

export class NormalizedRecordRepository {
  readonly store: FileStore;
  readonly collection = "normalized-content-records";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<NormalizedRecord[]> {
    return this.store.readCollection<NormalizedRecord>(this.collection);
  }

  async replaceForAccount(accountKey: string, nextRecords: NormalizedRecord[]): Promise<NormalizedRecord[]> {
    return this.store.updateCollection<NormalizedRecord>(this.collection, async (records) => {
      const filtered = records.filter((record) => record.accountKey !== accountKey);
      filtered.push(...nextRecords);
      return filtered;
    });
  }
}
