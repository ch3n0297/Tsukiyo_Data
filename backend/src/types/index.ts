// Barrel re-export：所有型別統一從此匯出
// 外部使用者優先從 types/index.ts 引入，不直接引入子模組

export type { Platform } from './platform.ts';
export type { RefreshStatus, AccountConfig } from './account-config.ts';
export type { JobStatus, TriggerType, RequestSource, Job } from './job.ts';
export type { DataStatus, RawRecord, NormalizedRecord } from './record.ts';
export type { UserRole, UserStatus, User, PublicUser } from './user.ts';
export type { SheetStatusSnapshot, SheetOutputRow, SheetOutputSnapshot } from './sheet.ts';
export type { Logger } from './infra.ts';
export type {
  FetchAccountContentParams,
  PlatformAdapter,
  SheetStatusPatch,
  SheetGateway,
} from './adapter.ts';
export type {
  RouteContext,
  RouteContextWithParams,
  RouteHandler,
  RouteHandlerWithParams,
} from './route.ts';
export type { AppConfig, ConfigOverrides, Services } from './app.ts';
