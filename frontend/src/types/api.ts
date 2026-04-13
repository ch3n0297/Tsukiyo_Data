// 前端 API response 型別（獨立定義，不共用後端 import）

export type Platform = 'instagram' | 'facebook' | 'tiktok';
export type RefreshStatus = 'idle' | 'queued' | 'running' | 'success' | 'error';
export type UserRole = 'admin' | 'member';
export type UserStatus = 'pending' | 'active' | 'rejected';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
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

export interface LatestOutput {
  syncedAt: string | null;
  rowCount: number;
  rows?: SheetOutputRow[];
}

export interface AccountConfig {
  id: string;
  accountKey: string;
  clientName: string;
  platform: Platform;
  accountId: string;
  refreshDays: number;
  isActive: boolean;
  sheetId: string;
  sheetRowKey: string;
  refreshStatus: RefreshStatus;
  systemMessage: string;
  lastRequestTime: string | null;
  lastSuccessTime: string | null;
  currentJobId: string | null;
  statusUpdatedAt: string | null;
  latestOutput: LatestOutput | null;
}

export interface UiCapabilities {
  mode: string;
  manualRefresh: boolean;
  scheduledSync: boolean;
  reason: string;
}

export interface QueueSnapshot {
  pending: number;
  running: number;
  concurrency: number;
}

export interface SchedulerSnapshot {
  running: boolean;
  intervalMs: number;
  tickInProgress: boolean;
}

export interface HealthResponse {
  status: string;
  queue: QueueSnapshot;
  scheduler: SchedulerSnapshot;
  now: string;
}

export interface DashboardListResponse {
  generatedAt: string;
  capabilities: UiCapabilities;
  accounts: AccountConfig[];
}

export interface DashboardDetailResponse {
  generatedAt: string;
  capabilities: UiCapabilities;
  account: AccountConfig;
}
