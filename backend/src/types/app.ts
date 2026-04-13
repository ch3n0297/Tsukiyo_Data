import type { AccountConfigRepository } from '../repositories/account-config-repository.ts';
import type { JobRepository } from '../repositories/job-repository.ts';
import type { OutboxMessageRepository } from '../repositories/outbox-message-repository.ts';
import type { RawRecordRepository } from '../repositories/raw-record-repository.ts';
import type { NormalizedRecordRepository } from '../repositories/normalized-record-repository.ts';
import type { PasswordResetTokenRepository } from '../repositories/password-reset-token-repository.ts';
import type { SheetSnapshotRepository } from '../repositories/sheet-snapshot-repository.ts';
import type { SessionRepository } from '../repositories/session-repository.ts';
import type { UserRepository } from '../repositories/user-repository.ts';
import type { FileSheetGateway } from '../adapters/sheets/file-sheet-gateway.ts';
import type { PlatformRegistry } from '../adapters/platforms/platform-registry.ts';
import type { StatusService } from '../services/status-service.ts';
import type { NormalizationService } from '../services/normalization-service.ts';
import type { RefreshOrchestrator } from '../services/refresh-orchestrator.ts';
import type { JobQueue } from '../services/job-queue.ts';
import type { ManualRefreshService } from '../services/manual-refresh-service.ts';
import type { PasswordResetService } from '../services/password-reset-service.ts';
import type { ScheduledSyncService } from '../services/scheduled-sync-service.ts';
import type { SchedulerService } from '../services/scheduler-service.ts';
import type { UiDashboardService } from '../services/ui-dashboard-service.ts';
import type { UserApprovalService } from '../services/user-approval-service.ts';
import type { UserAuthService } from '../services/user-auth-service.ts';

export type { AppConfig, ConfigOverrides } from '../config.ts';

export interface Services {
  // Repositories
  accountRepository: AccountConfigRepository;
  jobRepository: JobRepository;
  outboxMessageRepository: OutboxMessageRepository;
  rawRecordRepository: RawRecordRepository;
  normalizedRecordRepository: NormalizedRecordRepository;
  passwordResetTokenRepository: PasswordResetTokenRepository;
  sheetSnapshotRepository: SheetSnapshotRepository;
  sessionRepository: SessionRepository;
  userRepository: UserRepository;

  // Adapters
  sheetGateway: FileSheetGateway;
  platformRegistry: PlatformRegistry;

  // Services
  statusService: StatusService;
  normalizationService: NormalizationService;
  refreshOrchestrator: RefreshOrchestrator;
  jobQueue: JobQueue;
  manualRefreshService: ManualRefreshService;
  passwordResetService: PasswordResetService;
  scheduledSyncService: ScheduledSyncService;
  schedulerService: SchedulerService;
  uiDashboardService: UiDashboardService;
  userApprovalService: UserApprovalService;
  userAuthService: UserAuthService;
}
