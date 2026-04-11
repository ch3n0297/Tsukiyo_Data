export class OauthStateRepository {
  constructor(store) {
    this.store = store;
    this.collection = "oauth-states";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async findById(stateId) {
    const records = await this.listAll();
    return records.find((record) => record.id === stateId) ?? null;
  }

  async create(record) {
    return this.store.updateCollection(this.collection, (records) => {
      records.push(record);
      return records;
    });
  }

  async deleteById(stateId) {
    return this.store.updateCollection(this.collection, (records) =>
      records.filter((record) => record.id !== stateId),
    );
  }
}
