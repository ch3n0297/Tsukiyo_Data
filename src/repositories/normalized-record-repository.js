export class NormalizedRecordRepository {
  constructor(store) {
    this.store = store;
    this.collection = "normalized-content-records";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async replaceForAccount(accountKey, nextRecords) {
    return this.store.updateCollection(this.collection, async (records) => {
      const filtered = records.filter((record) => record.accountKey !== accountKey);
      filtered.push(...nextRecords);
      return filtered;
    });
  }
}
