import type { Platform } from './platform.ts';

export interface RawRecord {
  [key: string]: unknown;
}

export type DataStatus = 'fresh';

export interface NormalizedRecord {
  id: string;
  jobId: string;
  accountKey: string;
  platform: Platform;
  accountId: string;
  contentId: string;
  contentType: string;
  publishedAt: string;
  caption: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  fetchTime: string;
  dataStatus: DataStatus;
}
