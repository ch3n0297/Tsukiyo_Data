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
}
