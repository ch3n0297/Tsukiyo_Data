import crypto from "node:crypto";
import type { Job, TriggerType, RequestSource } from "../types/job.ts";
import type { Platform } from "../types/platform.ts";

export interface CreateQueuedJobParams {
  accountKey: string;
  platform: Platform;
  accountId: string;
  triggerType: TriggerType;
  requestSource: RequestSource;
  refreshDays: number;
  clock: () => Date;
}

export function createQueuedJob(params: CreateQueuedJobParams): Job {
  const { accountKey, platform, accountId, triggerType, requestSource, refreshDays, clock } = params;
  return {
    id: crypto.randomUUID(),
    accountKey,
    platform,
    accountId,
    triggerType,
    requestSource,
    refreshDays,
    status: "queued",
    systemMessage: "已受理工作，等待背景執行。",
    queuedAt: clock().toISOString(),
    startedAt: null,
    finishedAt: null,
    errorCode: null,
    resultSummary: null,
  };
}
