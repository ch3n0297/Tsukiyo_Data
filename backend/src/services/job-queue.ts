import type { Logger } from "../lib/logger.ts";
import type { Job } from "../types/job.ts";

export interface JobQueueOptions {
  concurrency: number;
  processJob: (job: Job) => Promise<void>;
  logger: Logger;
}

export class JobQueue {
  readonly concurrency: number;
  readonly processJob: (job: Job) => Promise<void>;
  readonly logger: Logger;
  readonly pending: Job[];
  readonly pendingIds: Set<string>;
  readonly runningIds: Set<string>;
  running: number;
  idleResolvers: Array<() => void>;

  constructor({ concurrency, processJob, logger }: JobQueueOptions) {
    this.concurrency = concurrency;
    this.processJob = processJob;
    this.logger = logger;
    this.pending = [];
    this.pendingIds = new Set();
    this.runningIds = new Set();
    this.running = 0;
    this.idleResolvers = [];
  }

  enqueue(job: Job): boolean {
    if (this.pendingIds.has(job.id) || this.runningIds.has(job.id)) {
      return false;
    }

    this.pending.push(job);
    this.pendingIds.add(job.id);
    this.#drain();
    return true;
  }

  snapshot(): { pending: number; running: number; concurrency: number } {
    return {
      pending: this.pending.length,
      running: this.running,
      concurrency: this.concurrency,
    };
  }

  async waitForIdle(): Promise<void> {
    if (this.pending.length === 0 && this.running === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  #drain(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.pendingIds.delete(job.id);
      this.runningIds.add(job.id);
      this.running += 1;
      this.#run(job);
    }
  }

  async #run(job: Job): Promise<void> {
    try {
      await this.processJob(job);
    } catch (error) {
      this.logger.error("Queue processor failed", {
        jobId: job.id,
        error,
      });
    } finally {
      this.runningIds.delete(job.id);
      this.running -= 1;
      if (this.pending.length === 0 && this.running === 0) {
        this.idleResolvers.splice(0).forEach((resolve) => resolve());
      }
      this.#drain();
    }
  }
}
