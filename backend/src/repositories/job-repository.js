export class JobRepository {
  constructor(store) {
    this.store = store;
    this.collection = "jobs";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async create(job) {
    return this.store.updateCollection(this.collection, async (records) => {
      records.push(job);
      return records;
    });
  }

  async findById(jobId) {
    const records = await this.listAll();
    return records.find((record) => record.id === jobId);
  }

  async updateById(jobId, patch) {
    let updatedJob = null;

    await this.store.updateCollection(this.collection, async (records) => {
      const index = records.findIndex((record) => record.id === jobId);
      if (index === -1) {
        return records;
      }

      records[index] = {
        ...records[index],
        ...patch,
      };
      updatedJob = records[index];
      return records;
    });

    return updatedJob;
  }

  async findActiveByAccountKey(accountKey) {
    const records = await this.listAll();
    return records.find(
      (record) =>
        record.accountKey === accountKey &&
        (record.status === "queued" || record.status === "running"),
    );
  }

  async listByStatuses(statuses) {
    const records = await this.listAll();
    return records.filter((record) => statuses.includes(record.status));
  }

  async listRecentBySource(requestSource, sinceIso) {
    const sinceTime = Date.parse(sinceIso);
    const records = await this.listAll();
    return records.filter((record) => {
      if (record.requestSource !== requestSource) {
        return false;
      }

      return Date.parse(record.queuedAt) >= sinceTime;
    });
  }

  async findLatestAcceptedJob(accountKey, triggerType) {
    const records = await this.listAll();
    const matched = records.filter(
      (record) =>
        record.accountKey === accountKey &&
        record.triggerType === triggerType &&
        ["queued", "running", "success"].includes(record.status),
    );

    matched.sort((left, right) => Date.parse(right.queuedAt) - Date.parse(left.queuedAt));
    return matched[0] ?? null;
  }

  async deleteOlderThan(cutoffIso) {
    const cutoffTime = Date.parse(cutoffIso);
    let removedCount = 0;

    await this.store.updateCollection(this.collection, async (records) => {
      const kept = records.filter((record) => {
        if (record.status === "queued" || record.status === "running") {
          return true;
        }
        return Date.parse(record.finishedAt || record.queuedAt) >= cutoffTime;
      });
      removedCount = records.length - kept.length;
      return kept;
    });

    return removedCount;
  }
}
