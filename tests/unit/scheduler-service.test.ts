import test from "node:test";
import assert from "node:assert/strict";
import { SchedulerService } from "../../backend/src/services/scheduler-service.ts";

test("SchedulerService does not overlap ticks when a run takes longer than the interval", async () => {
  let activeRuns = 0;
  let maxActiveRuns = 0;
  let calls = 0;
  let releaseFirstRun;

  const scheduler = new SchedulerService({
    scheduledSyncService: {
      async enqueueAllActiveAccounts() {
        calls += 1;
        activeRuns += 1;
        maxActiveRuns = Math.max(maxActiveRuns, activeRuns);

        if (calls === 1) {
          await new Promise((resolve) => {
            releaseFirstRun = resolve;
          });
        }

        activeRuns -= 1;
      },
    },
    intervalMs: 5,
    logger: {
      error() {},
    },
  });

  scheduler.start();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(calls, 1);
  assert.equal(maxActiveRuns, 1);

  releaseFirstRun();
  await new Promise((resolve) => setTimeout(resolve, 20));
  scheduler.stop();

  assert.ok(calls >= 2);
  assert.equal(maxActiveRuns, 1);
});
