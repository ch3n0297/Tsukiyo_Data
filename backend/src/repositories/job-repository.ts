import type { FileStore } from "../lib/fs-store.ts";
import type { Job, JobStatus, TriggerType } from "../types/job.ts";

export class JobRepository {
  private store: FileStore;
  private collection = "jobs";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<Job[]> {
    return this.store.readCollection<Job>(this.collection);
  }

  async create(job: Job): Promise<Job[]> {
    return this.store.updateCollection<Job>(this.collection, async (records) => {
      records.push(job);
      return records;
    });
  }

  async findById(jobId: string): Promise<Job | undefined> {
    const records = await this.listAll();
    return records.find((record) => record.id === jobId);
  }

  async updateById(jobId: string, patch: Partial<Job>): Promise<Job | null> {
    let updatedJob: Job | null = null;

    await this.store.updateCollection<Job>(this.collection, async (records) => {
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

  async findActiveByAccountKey(accountKey: string): Promise<Job | undefined> {
    const records = await this.listAll();
    return records.find(
      (record) =>
        record.accountKey === accountKey &&
        (record.status === "queued" || record.status === "running"),
    );
  }

  async listByStatuses(statuses: JobStatus[]): Promise<Job[]> {
    const records = await this.listAll();
    return records.filter((record) => statuses.includes(record.status));
  }

  async listRecentBySource(requestSource: string, sinceIso: string): Promise<Job[]> {
    const sinceTime = Date.parse(sinceIso);
    const records = await this.listAll();
    return records.filter((record) => {
      if (record.requestSource !== requestSource) {
        return false;
      }

      return Date.parse(record.queuedAt) >= sinceTime;
    });
  }

  async findLatestAcceptedJob(accountKey: string, triggerType: TriggerType): Promise<Job | null> {
    const records = await this.listAll();
    const matched = records.filter(
      (record) =>
        record.accountKey === accountKey &&
        record.triggerType === triggerType &&
        (["queued", "running", "success"] as JobStatus[]).includes(record.status),
    );

    matched.sort((left, right) => Date.parse(right.queuedAt) - Date.parse(left.queuedAt));
    return matched[0] ?? null;
  }
}
