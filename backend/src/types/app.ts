import type { FileSheetGateway } from '../adapters/sheets/file-sheet-gateway.ts';
import type { PlatformRegistry } from '../adapters/platforms/platform-registry.ts';
import type { AccountConfigRepository } from '../repositories/account-config-repository.ts';
import type { AuditEventInput } from '../repositories/supabase/audit-event-repository.ts';
import type { JobRepository } from '../repositories/job-repository.ts';
import type { NormalizedRecordRepository } from '../repositories/normalized-record-repository.ts';
import type { RawRecordRepository } from '../repositories/raw-record-repository.ts';
import type { SheetSnapshotRepository } from '../repositories/sheet-snapshot-repository.ts';
import type { UserProfileRepository } from '../repositories/user-repository.ts';
import type { JobQueue } from '../services/job-queue.ts';
import type { ManualRefreshService } from '../services/manual-refresh-service.ts';
import type { NormalizationService } from '../services/normalization-service.ts';
import type { RefreshOrchestrator } from '../services/refresh-orchestrator.ts';
import type { ScheduledSyncService } from '../services/scheduled-sync-service.ts';
import type { SchedulerService } from '../services/scheduler-service.ts';
import type { StatusService } from '../services/status-service.ts';
import type { UiDashboardService } from '../services/ui-dashboard-service.ts';
import type { UserApprovalService } from '../services/user-approval-service.ts';

export type { AppConfig, ConfigOverrides } from '../config.ts';

export interface AuditEventRepository {
  create(event: AuditEventInput): Promise<void>;
}

export interface RuntimeRepositories {
  accountRepository: AccountConfigRepository;
  jobRepository: JobRepository;
  rawRecordRepository: RawRecordRepository;
  normalizedRecordRepository: NormalizedRecordRepository;
  sheetSnapshotRepository: SheetSnapshotRepository;
  userRepository: UserProfileRepository;
  auditEventRepository: AuditEventRepository;
}

export interface Services extends RuntimeRepositories {
  sheetGateway: FileSheetGateway;
  platformRegistry: PlatformRegistry;
  statusService: StatusService;
  normalizationService: NormalizationService;
  refreshOrchestrator: RefreshOrchestrator;
  jobQueue: JobQueue;
  manualRefreshService: ManualRefreshService;
  scheduledSyncService: ScheduledSyncService;
  schedulerService: SchedulerService;
  uiDashboardService: UiDashboardService;
  userApprovalService: UserApprovalService;
}
