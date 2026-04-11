export class GoogleConnectionRepository {
  constructor(store) {
    this.store = store;
    this.collection = "google-connections";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async findById(connectionId) {
    const records = await this.listAll();
    return records.find((record) => record.id === connectionId) ?? null;
  }

  async findByAccountConfigId(accountConfigId) {
    const records = await this.listAll();
    return records.find((record) => record.accountConfigId === accountConfigId) ?? null;
  }

  async upsertByAccountConfigId(accountConfigId, record) {
    let savedRecord = null;

    await this.store.updateCollection(this.collection, (records) => {
      const index = records.findIndex((entry) => entry.accountConfigId === accountConfigId);

      if (index === -1) {
        records.push(record);
        savedRecord = record;
        return records;
      }

      records[index] = {
        ...records[index],
        ...record,
        id: records[index].id,
        accountConfigId: records[index].accountConfigId,
      };
      savedRecord = records[index];
      return records;
    });

    return savedRecord;
  }

  async updateById(connectionId, patch) {
    let updated = null;
    const { id: _ignoredId, accountConfigId: _ignoredAccountConfigId, ...safePatch } = patch ?? {};

    await this.store.updateCollection(this.collection, (records) => {
      const index = records.findIndex((record) => record.id === connectionId);

      if (index === -1) {
        return records;
      }

      records[index] = {
        ...records[index],
        ...safePatch,
      };
      updated = records[index];
      return records;
    });

    return updated;
  }

  async deleteById(connectionId) {
    return this.store.updateCollection(this.collection, (records) =>
      records.filter((record) => record.id !== connectionId),
    );
  }
}
