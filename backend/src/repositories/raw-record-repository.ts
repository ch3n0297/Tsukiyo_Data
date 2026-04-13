import type { FileStore } from "../lib/fs-store.ts";
import type { RawRecord } from "../types/record.ts";

export class RawRecordRepository {
  readonly store: FileStore;
  readonly collection = "raw-platform-records";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<RawRecord[]> {
    return this.store.readCollection<RawRecord>(this.collection);
  }

  async appendMany(recordsToAdd: RawRecord[]): Promise<RawRecord[]> {
    return this.store.updateCollection<RawRecord>(this.collection, async (records) => {
      records.push(...recordsToAdd);
      return records;
    });
  }
}
