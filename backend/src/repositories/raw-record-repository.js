export class RawRecordRepository {
  constructor(store) {
    this.store = store;
    this.collection = "raw-platform-records";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async appendMany(recordsToAdd) {
    return this.store.updateCollection(this.collection, async (records) => {
      records.push(...recordsToAdd);
      return records;
    });
  }

  async deleteOlderThan(cutoffIso) {
    const cutoffTime = Date.parse(cutoffIso);
    let removedCount = 0;

    await this.store.updateCollection(this.collection, async (records) => {
      const kept = records.filter(
        (record) => Date.parse(record.fetchedAt) >= cutoffTime,
      );
      removedCount = records.length - kept.length;
      return kept;
    });

    return removedCount;
  }
}
