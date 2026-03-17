export class SheetSnapshotRepository {
  constructor(store) {
    this.store = store;
    this.statusCollection = "sheet-status";
    this.outputCollection = "sheet-output";
  }

  async listStatuses() {
    return this.store.readCollection(this.statusCollection);
  }

  async listOutputs() {
    return this.store.readCollection(this.outputCollection);
  }

  async upsertStatus(snapshot) {
    return this.store.updateCollection(this.statusCollection, async (records) => {
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

  async upsertOutput(snapshot) {
    return this.store.updateCollection(this.outputCollection, async (records) => {
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
