import type { Platform } from './platform.ts';

export type JobStatus = 'queued' | 'running' | 'success' | 'error';

// NOTE: 原始碼使用 triggerType，不是 triggerSource。
export type TriggerType = 'scheduled' | 'manual';

export type RequestSource = 'manual-refresh' | 'scheduled-sync';

export interface Job {
  id: string;
  ownerUserId: string;
  accountKey: string;
  platform: Platform;
  accountId: string;
  triggerType: TriggerType;
  requestSource: RequestSource;
  refreshDays: number;
  status: JobStatus;
  systemMessage: string;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  resultSummary: unknown | null;
}
