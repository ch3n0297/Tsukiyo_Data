export class SchedulerService {
  constructor({ scheduledSyncService, intervalMs, logger }) {
    this.scheduledSyncService = scheduledSyncService;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.timer = null;
  }

  start() {
    if (this.timer || this.intervalMs <= 0) {
      return;
    }

    this.timer = setInterval(async () => {
      try {
        await this.scheduledSyncService.enqueueAllActiveAccounts({
          requestedBy: "scheduler",
        });
      } catch (error) {
        this.logger.error("Scheduled sync tick failed", { error: error.message });
      }
    }, this.intervalMs);

    this.timer.unref?.();
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  snapshot() {
    return {
      running: Boolean(this.timer),
      intervalMs: this.intervalMs,
    };
  }
}
