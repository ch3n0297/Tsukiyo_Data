export function makeAccountKey(platform, accountId) {
  return `${platform}:${accountId}`;
}

export class AccountConfigRepository {
  constructor(store) {
    this.store = store;
    this.collection = "account-configs";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async listActive() {
    const records = await this.listAll();
    return records.filter((record) => record.isActive);
  }

  async replaceAll(records) {
    return this.store.writeCollection(this.collection, records);
  }

  async findByPlatformAndAccountId(platform, accountId) {
    const records = await this.listAll();
    return records.find(
      (record) => record.platform === platform && record.accountId === accountId,
    );
  }

  async updateByAccountKey(accountKey, patch) {
    return this.store.updateCollection(this.collection, async (records) => {
      const index = records.findIndex(
        (record) => makeAccountKey(record.platform, record.accountId) === accountKey,
      );

      if (index === -1) {
        return records;
      }

      records[index] = {
        ...records[index],
        ...patch,
      };

      return records;
    });
  }
}
