export class AuditLogRepository {
  constructor(store) {
    this.store = store;
    this.collection = "audit-logs";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async append(record) {
    return this.store.updateCollection(this.collection, (records) => {
      records.push(record);
      return records;
    });
  }
}
