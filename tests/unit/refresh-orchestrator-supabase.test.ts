import assert from "node:assert/strict";
import test from "node:test";
import { RefreshOrchestrator } from "../../backend/src/services/refresh-orchestrator.ts";
import type { AccountConfig } from "../../backend/src/types/account-config.ts";
import type { Job } from "../../backend/src/types/job.ts";
import type { NormalizedRecord, RawRecord } from "../../backend/src/types/record.ts";

const account: AccountConfig = {
  id: "account-1",
  clientName: "示範客戶",
  platform: "instagram",
  accountId: "acct-instagram-demo",
  refreshDays: 7,
  sheetId: "sheet-1",
  sheetRowKey: "row-1",
  isActive: true,
  lastRequestTime: null,
  lastSuccessTime: null,
  currentJobId: null,
  refreshStatus: "idle",
  systemMessage: "",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

const job: Job = {
  id: "22222222-2222-4222-8222-222222222222",
  accountKey: "instagram:acct-instagram-demo",
  platform: "instagram",
  accountId: "acct-instagram-demo",
  triggerType: "manual",
  requestSource: "manual-refresh",
  refreshDays: 7,
  status: "queued",
  systemMessage: "queued",
  queuedAt: "2026-04-28T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  errorCode: null,
  resultSummary: null,
};

test("RefreshOrchestrator persists through repository methods when store is absent", async () => {
  const appendedRawRecords: RawRecord[][] = [];
  const replacedNormalizedRecords: NormalizedRecord[][] = [];
  const updates: Array<Partial<Job>> = [];

  const normalizedRecord: NormalizedRecord = {
    id: "normalized-1",
    jobId: job.id,
    accountKey: job.accountKey,
    platform: job.platform,
    accountId: job.accountId,
    contentId: "post-1",
    contentType: "reel",
    publishedAt: "2026-04-28T00:00:00.000Z",
    caption: "caption",
    url: "https://example.com/post-1",
    views: 1,
    likes: 2,
    comments: 3,
    shares: 4,
    fetchTime: "2026-04-28T00:00:00.000Z",
    dataStatus: "fresh",
  };

  const orchestrator = new RefreshOrchestrator({
    accountRepository: {
      findByPlatformAndAccountId: async () => account,
    } as never,
    jobRepository: {
      updateById: async (_jobId: string, patch: Partial<Job>) => {
        updates.push(patch);
        return { ...job, ...patch };
      },
    } as never,
    rawRecordRepository: {
      appendMany: async (records: RawRecord[]) => {
        appendedRawRecords.push(records);
        return records;
      },
    } as never,
    normalizedRecordRepository: {
      replaceForAccount: async (_accountKey: string, records: NormalizedRecord[]) => {
        replacedNormalizedRecords.push(records);
        return records;
      },
    } as never,
    platformRegistry: {
      get: () => ({
        fetchAccountContent: async () => [{ id: "post-1" }],
      }),
    } as never,
    normalizationService: {
      normalizeBatch: () => [normalizedRecord],
    },
    statusService: {
      markRunning: async () => account,
      markSuccess: async () => account,
      markError: async () => account,
    } as never,
    logger: {
      info: () => undefined,
      error: () => undefined,
    } as never,
    clock: () => new Date("2026-04-28T00:00:00.000Z"),
  });

  await orchestrator.processJob(job);

  assert.equal(appendedRawRecords.length, 1);
  assert.equal(replacedNormalizedRecords.length, 1);
  assert.equal(updates.at(-1)?.status, "success");
});
