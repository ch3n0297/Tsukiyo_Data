import type { FileStore } from "../lib/fs-store.ts";
import type { SheetStatusSnapshot, SheetOutputSnapshot } from "../types/sheet.ts";

export class SheetSnapshotRepository {
  private store: FileStore;
  private statusCollection = "sheet-status";
  private outputCollection = "sheet-output";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listStatuses(): Promise<SheetStatusSnapshot[]> {
    return this.store.readCollection<SheetStatusSnapshot>(this.statusCollection);
  }

  async listOutputs(): Promise<SheetOutputSnapshot[]> {
    return this.store.readCollection<SheetOutputSnapshot>(this.outputCollection);
  }

  async upsertStatus(snapshot: SheetStatusSnapshot): Promise<SheetStatusSnapshot[]> {
    return this.store.updateCollection<SheetStatusSnapshot>(this.statusCollection, async (records) => {
      const index = records.findIndex(
        (record) =>
          record.sheetId === snapshot.sheetId && record.sheetRowKey === snapshot.sheetRowKey,
      );

      if (index === -1) {
        records.push(snapshot);
        return records;
      }

      records[index] = {
        ...records[index],
        ...snapshot,
      };
      return records;
    });
  }

  async upsertOutput(snapshot: SheetOutputSnapshot): Promise<SheetOutputSnapshot[]> {
    return this.store.updateCollection<SheetOutputSnapshot>(this.outputCollection, async (records) => {
      const index = records.findIndex(
        (record) =>
          record.sheetId === snapshot.sheetId && record.sheetRowKey === snapshot.sheetRowKey,
      );

      if (index === -1) {
        records.push(snapshot);
        return records;
      }

      records[index] = {
        ...records[index],
        ...snapshot,
      };
      return records;
    });
  }
}
