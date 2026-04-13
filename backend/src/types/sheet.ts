import type { Platform } from './platform.ts';
import type { RefreshStatus } from './account-config.ts';

export interface SheetStatusSnapshot {
  sheetId: string;
  sheetRowKey: string;
  platform: Platform;
  accountId: string;
  refreshStatus: RefreshStatus;
  systemMessage: string;
  lastRequestTime: string | null;
  lastSuccessTime: string | null;
  currentJobId: string | null;
  updatedAt: string;
}

export interface SheetOutputRow {
  content_id: string;
  content_type: string;
  published_at: string;
  caption: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  data_status: string;
}

export interface SheetOutputSnapshot {
  sheetId: string;
  sheetRowKey: string;
  platform: Platform;
  accountId: string;
  syncedAt: string;
  rows: SheetOutputRow[];
}
