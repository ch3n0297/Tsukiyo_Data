import test from "node:test";
import assert from "node:assert/strict";
import { StatusService } from "../../backend/src/services/status-service.ts";

test("StatusService updates account updatedAt when syncing status", async () => {
  const updatedPatches = [];
  const statusWrites = [];
  const service = new StatusService({
    accountRepository: {
      async updateByAccountKey(accountKey, patch) {
        updatedPatches.push({ accountKey, patch });
      },
    },
    sheetGateway: {
      async writeStatus(account, status) {
        statusWrites.push({ account, status });
      },
    },
    clock: () => new Date("2026-03-22T12:00:00.000Z"),
  });

  const account = {
    platform: "instagram",
    accountId: "acct-1",
    refreshStatus: "idle",
    systemMessage: "ready",
    lastRequestTime: null,
    lastSuccessTime: null,
    currentJobId: null,
    updatedAt: "2026-03-18T00:00:00.000Z",
  };
  const job = {
    id: "job-1",
    queuedAt: "2026-03-22T11:59:00.000Z",
    systemMessage: "queued",
  };

  const updatedAccount = await service.markQueued(account, job);

  assert.equal(updatedPatches[0].accountKey, "instagram:acct-1");
  assert.equal(updatedPatches[0].patch.updatedAt, "2026-03-22T12:00:00.000Z");
  assert.equal(updatedAccount.updatedAt, "2026-03-22T12:00:00.000Z");
  assert.equal(statusWrites[0].account.updatedAt, "2026-03-22T12:00:00.000Z");
});
