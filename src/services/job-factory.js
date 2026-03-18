import crypto from "node:crypto";

export function createQueuedJob({
  accountKey,
  platform,
  accountId,
  triggerType,
  requestSource,
  refreshDays,
  clock,
}) {
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
