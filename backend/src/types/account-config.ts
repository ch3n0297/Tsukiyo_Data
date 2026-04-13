import type { Platform } from './platform.ts';

// refreshStatus 反映最近一次同步工作的結果狀態。
export type RefreshStatus = 'idle' | 'queued' | 'running' | 'success' | 'error';

export interface AccountConfig {
  id: string;
  clientName: string;
  platform: Platform;
  accountId: string;
  refreshDays: number;
  sheetId: string;
  sheetRowKey: string;
  isActive: boolean;
  lastRequestTime: string | null;
  lastSuccessTime: string | null;
  currentJobId: string | null;
  refreshStatus: RefreshStatus;
  systemMessage: string;
  updatedAt: string;
}
