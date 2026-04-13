import type { Logger } from "../lib/logger.ts";

interface ScheduledSyncServiceLike {
  enqueueAllActiveAccounts(params: { requestedBy: string }): Promise<unknown>;
}

export interface SchedulerServiceOptions {
  scheduledSyncService: ScheduledSyncServiceLike;
  intervalMs: number;
  logger: Logger;
}

export class SchedulerService {
  readonly scheduledSyncService: ScheduledSyncServiceLike;
  readonly intervalMs: number;
  readonly logger: Logger;
  timer: ReturnType<typeof setTimeout> | null;
  started: boolean;
  tickInProgress: boolean;

  constructor({ scheduledSyncService, intervalMs, logger }: SchedulerServiceOptions) {
    this.scheduledSyncService = scheduledSyncService;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.timer = null;
    this.started = false;
    this.tickInProgress = false;
  }

  start(): void {
    if (this.started || this.intervalMs <= 0) {
      return;
    }

    this.started = true;
    this.#scheduleNextTick();
  }

  async #runTick(): Promise<void> {
    if (!this.started || this.tickInProgress) {
      return;
    }

    this.tickInProgress = true;

    try {
      await this.scheduledSyncService.enqueueAllActiveAccounts({
        requestedBy: "scheduler",
      });
    } catch (error) {
      this.logger.error("Scheduled sync tick failed", { error });
    } finally {
      this.tickInProgress = false;
      this.#scheduleNextTick();
    }
  }

  #scheduleNextTick(): void {
    if (!this.started) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.#runTick();
    }, this.intervalMs);

    this.timer.unref?.();
  }

  stop(): void {
    this.started = false;

    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  snapshot(): { running: boolean; intervalMs: number; tickInProgress: boolean } {
    return {
      running: this.started,
      intervalMs: this.intervalMs,
      tickInProgress: this.tickInProgress,
    };
  }
}
