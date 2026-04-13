import test from "node:test";
import assert from "node:assert/strict";
import { JobQueue } from "../../backend/src/services/job-queue.ts";

test("JobQueue rejects duplicate enqueue attempts while a job is running", async () => {
  let resolveJob;
  let callCount = 0;
  const queue = new JobQueue({
    concurrency: 1,
    processJob: async () => {
      callCount += 1;
      await new Promise((resolve) => {
        resolveJob = resolve;
      });
    },
    logger: {
      error() {},
    },
  });

  assert.equal(queue.enqueue({ id: "job-1" }), true);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(queue.enqueue({ id: "job-1" }), false);

  resolveJob();
  await queue.waitForIdle();

  assert.equal(callCount, 1);
});
