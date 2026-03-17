export class JobQueue {
  constructor({ concurrency, processJob, logger }) {
    this.concurrency = concurrency;
    this.processJob = processJob;
    this.logger = logger;
    this.pending = [];
    this.pendingIds = new Set();
    this.running = 0;
    this.idleResolvers = [];
  }

  enqueue(job) {
    if (this.pendingIds.has(job.id)) {
      return;
    }

    this.pending.push(job);
    this.pendingIds.add(job.id);
    this.#drain();
  }

  snapshot() {
    return {
      pending: this.pending.length,
      running: this.running,
      concurrency: this.concurrency,
    };
  }

  async waitForIdle() {
    if (this.pending.length === 0 && this.running === 0) {
      return;
    }

    await new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  #drain() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      this.pendingIds.delete(job.id);
      this.running += 1;
      this.#run(job);
    }
  }

  async #run(job) {
    try {
      await this.processJob(job);
    } catch (error) {
      this.logger.error("Queue processor failed", {
        jobId: job.id,
        error: error.message,
      });
    } finally {
      this.running -= 1;
      if (this.pending.length === 0 && this.running === 0) {
        this.idleResolvers.splice(0).forEach((resolve) => resolve());
      }
      this.#drain();
    }
  }
}
