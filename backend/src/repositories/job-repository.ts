import type { Job, JobStatus, TriggerType } from "../types/job.ts";

export interface JobRepository {
  listAll(): Promise<Job[]>;
  create(job: Job): Promise<Job[]>;
  findById(jobId: string): Promise<Job | undefined>;
  updateById(jobId: string, patch: Partial<Job>): Promise<Job | null>;
  findActiveByAccountKey(accountKey: string): Promise<Job | undefined>;
  listByStatuses(statuses: JobStatus[]): Promise<Job[]>;
  listRecentBySource(requestSource: string, sinceIso: string): Promise<Job[]>;
  findLatestAcceptedJob(accountKey: string, triggerType: TriggerType): Promise<Job | null>;
}
