import type { AccountConfig } from './account-config.ts';
import type { NormalizedRecord } from './record.ts';
import type { RefreshStatus } from './account-config.ts';

export interface FetchAccountContentParams {
  accountConfig: AccountConfig;
  refreshDays: number;
  now: Date;
}

export interface PlatformAdapter {
  fetchAccountContent(params: FetchAccountContentParams): Promise<unknown[]>;
}

export interface SheetStatusPatch {
  refreshStatus: RefreshStatus;
  systemMessage: string;
  lastRequestTime?: string | null;
  lastSuccessTime?: string | null;
  currentJobId?: string | null;
}

export interface SheetGateway {
  writeStatus(accountConfig: AccountConfig, patch: SheetStatusPatch): Promise<void>;
  writeOutput(accountConfig: AccountConfig, normalizedRecords: NormalizedRecord[]): Promise<void>;
}
