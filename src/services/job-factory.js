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
    systemMessage: "Job queued for background processing.",
    queuedAt: clock().toISOString(),
    startedAt: null,
    finishedAt: null,
    errorCode: null,
    resultSummary: null,
  };
}
