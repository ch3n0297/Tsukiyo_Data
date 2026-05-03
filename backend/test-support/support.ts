import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLogger } from "../src/lib/logger.ts";
import { createApp } from "../src/app.ts";
import type { AppInstance } from "../src/app.ts";
import type { SupabaseClient } from "../src/lib/supabase-client.ts";
import { makeAccountKey } from "../src/repositories/account-config-repository.ts";
import type { RuntimeRepositories } from "../src/types/app.ts";
import { signPayload } from "../src/services/auth-service.ts";
import type { AccountConfig } from "../src/types/account-config.ts";
import type { ConfigOverrides } from "../src/config.ts";
import type { JobRepository } from "../src/repositories/job-repository.ts";
import type { Job, JobStatus, TriggerType } from "../src/types/job.ts";
import type { RawRecord, NormalizedRecord } from "../src/types/record.ts";
import type { SheetOutputSnapshot, SheetStatusSnapshot } from "../src/types/sheet.ts";
import type { PublicUser, User, UserRole, UserStatus } from "../src/types/user.ts";

const DEFAULT_OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";

interface AuthRecord {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SetupTestAppOptions {
  accounts: AccountConfig[];
  fixtures: Record<string, unknown>;
  now?: string;
  overrides?: ConfigOverrides;
}

export interface TestApp {
  app: AppInstance;
  baseUrl: string;
  auth: TestAuthStore;
  repositories: MemoryRepositories;
  cleanup(): Promise<void>;
}

export class TestAuthStore {
  readonly users = new Map<string, AuthRecord>();
  readonly #tokenToUserId = new Map<string, string>();

  constructor(initialUsers: AuthRecord[] = []) {
    initialUsers.forEach((user) => this.users.set(user.id, user));
  }

  get client(): SupabaseClient {
    return {
      auth: {
        getUser: async (token: string) => {
          const userId = this.#tokenToUserId.get(token);
          const user = userId ? this.users.get(userId) : undefined;
          return user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: { message: "Invalid token" } };
        },
        admin: {
          listUsers: async () => ({
            data: { users: [...this.users.values()] },
            error: null,
          }),
          getUserById: async (userId: string) => {
            const user = this.users.get(userId);
            return user
              ? { data: { user }, error: null }
              : { data: { user: null }, error: { message: "User not found" } };
          },
          updateUserById: async (userId: string, patch: {
            app_metadata?: Record<string, unknown>;
            user_metadata?: Record<string, unknown>;
          }) => {
            const user = this.users.get(userId);
            if (!user) {
              return { data: { user: null }, error: { message: "User not found" } };
            }
            const updated = {
              ...user,
              app_metadata: patch.app_metadata ?? user.app_metadata,
              user_metadata: patch.user_metadata ?? user.user_metadata,
              updated_at: new Date().toISOString(),
            };
            this.users.set(userId, updated);
            return { data: { user: updated }, error: null };
          },
          createUser: async (input: {
            email?: string;
            app_metadata?: Record<string, unknown>;
            user_metadata?: Record<string, unknown>;
          }) => {
            const user: AuthRecord = {
              id: crypto.randomUUID(),
              email: input.email ?? "",
              app_metadata: input.app_metadata ?? {},
              user_metadata: input.user_metadata ?? {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            this.users.set(user.id, user);
            return { data: { user }, error: null };
          },
        },
      },
    } as unknown as SupabaseClient;
  }

  addUser({
    id,
    email,
    displayName,
    role = "member",
    status = "pending",
    now = "2026-03-18T00:00:00.000Z",
  }: {
    id: string;
    email: string;
    displayName: string;
    role?: UserRole;
    status?: UserStatus;
    now?: string;
  }): AuthRecord {
    const user: AuthRecord = {
      id,
      email,
      user_metadata: { name: displayName },
      app_metadata: { role, status },
      created_at: now,
      updated_at: now,
    };
    this.users.set(id, user);
    return user;
  }

  authorizationFor(userId: string): string {
    const token = `test-token-${userId}`;
    this.#tokenToUserId.set(token, userId);
    return `Bearer ${token}`;
  }
}

class MemoryAccountRepository {
  readonly ownerUserId?: string;
  readonly accounts: AccountConfig[];

  constructor(ownerUserId?: string, accounts: AccountConfig[] = []) {
    this.ownerUserId = ownerUserId;
    this.accounts = accounts;
  }

  forOwner(ownerUserId: string): MemoryAccountRepository {
    return new MemoryAccountRepository(ownerUserId, this.accounts);
  }

  #withOwner(record: AccountConfig): AccountConfig {
    return {
      ...record,
      ownerUserId: record.ownerUserId ?? this.ownerUserId ?? DEFAULT_OWNER_USER_ID,
    };
  }

  #belongsToOwner(record: AccountConfig): boolean {
    return !this.ownerUserId || record.ownerUserId === this.ownerUserId;
  }

  async listAll(): Promise<AccountConfig[]> {
    return this.accounts.filter((account) => this.#belongsToOwner(account)).map((account) => ({ ...account }));
  }

  async listActive(): Promise<AccountConfig[]> {
    return this.accounts
      .filter((account) => this.#belongsToOwner(account) && account.isActive)
      .map((account) => ({ ...account }));
  }

  async replaceAll(records: AccountConfig[]): Promise<AccountConfig[]> {
    const nextRecords = records.map((record) => this.#withOwner(record));
    if (!this.ownerUserId) {
      this.accounts.splice(0, this.accounts.length, ...nextRecords);
      return this.listAll();
    }

    const otherOwnerRecords = this.accounts.filter((account) => account.ownerUserId !== this.ownerUserId);
    this.accounts.splice(0, this.accounts.length, ...otherOwnerRecords, ...nextRecords);
    return this.listAll();
  }

  async findByPlatformAndAccountId(
    platform: string,
    accountId: string,
  ): Promise<AccountConfig | undefined> {
    const account = this.accounts.find(
      (entry) =>
        this.#belongsToOwner(entry) &&
        entry.platform === platform &&
        entry.accountId === accountId,
    );
    return account ? { ...account } : undefined;
  }

  async updateByAccountKey(
    accountKey: string,
    patch: Partial<AccountConfig>,
  ): Promise<AccountConfig[]> {
    const [platform, accountId] = accountKey.split(":");
    const index = this.accounts.findIndex(
      (entry) =>
        this.#belongsToOwner(entry) &&
        entry.platform === platform &&
        entry.accountId === accountId,
    );
    if (index !== -1) {
      this.accounts[index] = {
        ...this.accounts[index],
        ...patch,
      };
    }
    return this.listAll();
  }
}

class MemoryJobRepository implements JobRepository {
  readonly ownerUserId?: string;
  readonly jobs: Job[];

  constructor(ownerUserId?: string, jobs: Job[] = []) {
    this.ownerUserId = ownerUserId;
    this.jobs = jobs;
  }

  forOwner(ownerUserId: string): MemoryJobRepository {
    return new MemoryJobRepository(ownerUserId, this.jobs);
  }

  #withOwner(job: Job): Job {
    return {
      ...job,
      ownerUserId: job.ownerUserId ?? this.ownerUserId ?? DEFAULT_OWNER_USER_ID,
    };
  }

  #belongsToOwner(job: Job): boolean {
    return !this.ownerUserId || job.ownerUserId === this.ownerUserId;
  }

  async listAll(): Promise<Job[]> {
    return this.jobs.filter((job) => this.#belongsToOwner(job)).map((job) => ({ ...job }));
  }

  async create(job: Job): Promise<Job[]> {
    this.jobs.push(this.#withOwner(job));
    return this.listAll();
  }

  async findById(jobId: string): Promise<Job | undefined> {
    const job = this.jobs.find((entry) => this.#belongsToOwner(entry) && entry.id === jobId);
    return job ? { ...job } : undefined;
  }

  async updateById(jobId: string, patch: Partial<Job>): Promise<Job | null> {
    const index = this.jobs.findIndex((entry) => this.#belongsToOwner(entry) && entry.id === jobId);
    if (index === -1) {
      return null;
    }
    this.jobs[index] = {
      ...this.jobs[index],
      ...patch,
    };
    return { ...this.jobs[index] };
  }

  async findActiveByAccountKey(accountKey: string): Promise<Job | undefined> {
    const job = this.jobs.find(
      (entry) =>
        this.#belongsToOwner(entry) &&
        entry.accountKey === accountKey &&
        ["queued", "running"].includes(entry.status),
    );
    return job ? { ...job } : undefined;
  }

  async listByStatuses(statuses: JobStatus[]): Promise<Job[]> {
    return this.jobs
      .filter((job) => this.#belongsToOwner(job) && statuses.includes(job.status))
      .map((job) => ({ ...job }));
  }

  async listRecentBySource(requestSource: string, sinceIso: string): Promise<Job[]> {
    return this.jobs
      .filter(
        (job) =>
          this.#belongsToOwner(job) &&
          job.requestSource === requestSource &&
          job.queuedAt >= sinceIso,
      )
      .map((job) => ({ ...job }));
  }

  async findLatestAcceptedJob(accountKey: string, triggerType: TriggerType): Promise<Job | null> {
    const job = this.jobs
      .filter(
        (entry) =>
          entry.accountKey === accountKey &&
          this.#belongsToOwner(entry) &&
          entry.triggerType === triggerType &&
          ["queued", "running", "success"].includes(entry.status),
      )
      .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))[0];
    return job ? { ...job } : null;
  }
}

class MemoryRawRecordRepository {
  readonly ownerUserId?: string;
  readonly records: RawRecord[];

  constructor(ownerUserId?: string, records: RawRecord[] = []) {
    this.ownerUserId = ownerUserId;
    this.records = records;
  }

  forOwner(ownerUserId: string): MemoryRawRecordRepository {
    return new MemoryRawRecordRepository(ownerUserId, this.records);
  }

  #belongsToOwner(record: RawRecord): boolean {
    return !this.ownerUserId || record.ownerUserId === this.ownerUserId;
  }

  async listAll(): Promise<RawRecord[]> {
    return this.records.filter((record) => this.#belongsToOwner(record)).map((record) => ({ ...record }));
  }

  async appendMany(recordsToAdd: RawRecord[]): Promise<RawRecord[]> {
    this.records.push(
      ...recordsToAdd.map((record) => ({
        ...record,
        ownerUserId: record.ownerUserId ?? this.ownerUserId ?? DEFAULT_OWNER_USER_ID,
      })),
    );
    return this.listAll();
  }
}

class MemoryNormalizedRecordRepository {
  readonly ownerUserId?: string;
  readonly records: NormalizedRecord[];

  constructor(ownerUserId?: string, records: NormalizedRecord[] = []) {
    this.ownerUserId = ownerUserId;
    this.records = records;
  }

  forOwner(ownerUserId: string): MemoryNormalizedRecordRepository {
    return new MemoryNormalizedRecordRepository(ownerUserId, this.records);
  }

  #belongsToOwner(record: NormalizedRecord): boolean {
    return !this.ownerUserId || record.ownerUserId === this.ownerUserId;
  }

  async listAll(): Promise<NormalizedRecord[]> {
    return this.records.filter((record) => this.#belongsToOwner(record)).map((record) => ({ ...record }));
  }

  async replaceForAccount(
    accountKey: string,
    nextRecords: NormalizedRecord[],
  ): Promise<NormalizedRecord[]> {
    const remaining = this.records.filter(
      (record) => !this.#belongsToOwner(record) || record.accountKey !== accountKey,
    );
    this.records.splice(
      0,
      this.records.length,
      ...remaining,
      ...nextRecords.map((record) => ({
        ...record,
        ownerUserId: record.ownerUserId ?? this.ownerUserId ?? DEFAULT_OWNER_USER_ID,
      })),
    );
    return this.listAll();
  }
}

class MemorySheetSnapshotRepository {
  readonly ownerUserId?: string;
  readonly statuses: SheetStatusSnapshot[];
  readonly outputs: SheetOutputSnapshot[];

  constructor(
    ownerUserId?: string,
    statuses: SheetStatusSnapshot[] = [],
    outputs: SheetOutputSnapshot[] = [],
  ) {
    this.ownerUserId = ownerUserId;
    this.statuses = statuses;
    this.outputs = outputs;
  }

  forOwner(ownerUserId: string): MemorySheetSnapshotRepository {
    return new MemorySheetSnapshotRepository(ownerUserId, this.statuses, this.outputs);
  }

  #belongsToOwner(record: { ownerUserId?: string }): boolean {
    return !this.ownerUserId || record.ownerUserId === this.ownerUserId;
  }

  async listStatuses(): Promise<SheetStatusSnapshot[]> {
    return this.statuses.filter((status) => this.#belongsToOwner(status)).map((status) => ({ ...status }));
  }

  async listOutputs(): Promise<SheetOutputSnapshot[]> {
    return this.outputs
      .filter((output) => this.#belongsToOwner(output))
      .map((output) => ({ ...output, rows: [...output.rows] }));
  }

  async upsertStatus(snapshot: SheetStatusSnapshot): Promise<SheetStatusSnapshot[]> {
    const key = makeAccountKey(snapshot.platform, snapshot.accountId);
    const index = this.statuses.findIndex(
      (entry) => this.#belongsToOwner(entry) && makeAccountKey(entry.platform, entry.accountId) === key,
    );
    const ownedSnapshot = {
      ...snapshot,
      ownerUserId: snapshot.ownerUserId ?? this.ownerUserId ?? DEFAULT_OWNER_USER_ID,
    };
    if (index === -1) {
      this.statuses.push(ownedSnapshot);
    } else {
      this.statuses[index] = { ...this.statuses[index], ...ownedSnapshot };
    }
    return this.listStatuses();
  }

  async upsertOutput(snapshot: SheetOutputSnapshot): Promise<SheetOutputSnapshot[]> {
    const key = makeAccountKey(snapshot.platform, snapshot.accountId);
    const index = this.outputs.findIndex(
      (entry) => this.#belongsToOwner(entry) && makeAccountKey(entry.platform, entry.accountId) === key,
    );
    const ownedSnapshot = {
      ...snapshot,
      ownerUserId: snapshot.ownerUserId ?? this.ownerUserId ?? DEFAULT_OWNER_USER_ID,
      rows: [...snapshot.rows],
    };
    if (index === -1) {
      this.outputs.push(ownedSnapshot);
    } else {
      this.outputs[index] = ownedSnapshot;
    }
    return this.listOutputs();
  }
}

class MemoryUserProfileRepository {
  readonly users = new Map<string, User>();

  async findById(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const user = [...this.users.values()].find((entry) => entry.email === normalized);
    return user ? { ...user } : null;
  }

  async upsertSignupUser({
    userId,
    email,
    displayName,
    createdAt,
    updatedAt,
  }: {
    userId: string;
    email: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<User> {
    const existing = this.users.get(userId);
    const user: User = {
      id: userId,
      email: email.trim().toLowerCase(),
      displayName,
      role: existing?.role ?? "member",
      status: existing?.status ?? "pending",
      approvedAt: existing?.approvedAt ?? null,
      approvedBy: existing?.approvedBy ?? null,
      rejectedAt: existing?.rejectedAt ?? null,
      rejectedBy: existing?.rejectedBy ?? null,
      lastLoginAt: existing?.lastLoginAt ?? null,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt,
    };
    this.users.set(userId, user);
    return { ...user };
  }

  async recordApproval({
    targetUserId,
    adminUser,
    approvedAt,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
    approvedAt: string;
  }): Promise<User> {
    const user = this.users.get(targetUserId);
    if (!user) throw new Error("Profile not found");
    const updated: User = {
      ...user,
      status: "active",
      approvedAt,
      approvedBy: adminUser.id,
      rejectedAt: null,
      rejectedBy: null,
      updatedAt: approvedAt,
    };
    this.users.set(targetUserId, updated);
    return { ...updated };
  }

  async recordRejection({
    targetUserId,
    adminUser,
    rejectedAt,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
    rejectedAt: string;
  }): Promise<User> {
    const user = this.users.get(targetUserId);
    if (!user) throw new Error("Profile not found");
    const updated: User = {
      ...user,
      status: "rejected",
      rejectedAt,
      rejectedBy: adminUser.id,
      updatedAt: rejectedAt,
    };
    this.users.set(targetUserId, updated);
    return { ...updated };
  }
}

class MemoryAuditEventRepository {
  readonly events: unknown[] = [];

  async create(event: unknown): Promise<void> {
    this.events.push(event);
  }
}

export interface MemoryRepositories extends RuntimeRepositories {
  accountRepository: MemoryAccountRepository;
  auditEventRepository: MemoryAuditEventRepository;
  jobRepository: MemoryJobRepository;
  rawRecordRepository: MemoryRawRecordRepository;
  normalizedRecordRepository: MemoryNormalizedRecordRepository;
  sheetSnapshotRepository: MemorySheetSnapshotRepository;
  userRepository: MemoryUserProfileRepository;
}

function createMemoryRepositories(auth: TestAuthStore): MemoryRepositories {
  const accountRepository = new MemoryAccountRepository();
  const jobRepository = new MemoryJobRepository();
  const rawRecordRepository = new MemoryRawRecordRepository();
  const normalizedRecordRepository = new MemoryNormalizedRecordRepository();
  const sheetSnapshotRepository = new MemorySheetSnapshotRepository();
  const activeOwnerIds = (): Set<string> =>
    new Set(
      [...auth.users.values()]
        .filter((user) => user.app_metadata.status === "active")
        .map((user) => user.id),
    );

  return {
    accountRepository,
    auditEventRepository: new MemoryAuditEventRepository(),
    jobRepository,
    rawRecordRepository,
    normalizedRecordRepository,
    sheetSnapshotRepository,
    userRepository: new MemoryUserProfileRepository(),
    systemOwnershipRepository: {
      listActiveAccountsWithOwners: async () => {
        const ownerIds = activeOwnerIds();
        return (await accountRepository.listActive()).filter((account) => ownerIds.has(account.ownerUserId));
      },
      listJobsByStatusesAcrossOwners: async (statuses) => {
        const ownerIds = activeOwnerIds();
        return (await jobRepository.listByStatuses(statuses)).filter((job) => ownerIds.has(job.ownerUserId));
      },
    },
    forUser(ownerUserId: string) {
      return {
        accountRepository: accountRepository.forOwner(ownerUserId),
        jobRepository: jobRepository.forOwner(ownerUserId),
        rawRecordRepository: rawRecordRepository.forOwner(ownerUserId),
        normalizedRecordRepository: normalizedRecordRepository.forOwner(ownerUserId),
        sheetSnapshotRepository: sheetSnapshotRepository.forOwner(ownerUserId),
      };
    },
  };
}

export function createAccount(params: Partial<AccountConfig> & {
  platform: string;
  accountId: string;
}): AccountConfig {
  const {
    ownerUserId = DEFAULT_OWNER_USER_ID,
    clientName = "Test Client",
    platform,
    accountId,
    refreshDays = 7,
    sheetId = "sheet-1",
    sheetRowKey,
    isActive = true,
  } = params;

  return {
    id: `${platform}-${accountId}`,
    ownerUserId,
    clientName,
    platform: platform as AccountConfig["platform"],
    accountId,
    refreshDays,
    sheetId,
    sheetRowKey: sheetRowKey ?? `${platform}-${accountId}`,
    isActive,
    lastRequestTime: null,
    lastSuccessTime: null,
    currentJobId: null,
    refreshStatus: "idle",
    systemMessage: "帳號已就緒，可進行資料更新。",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };
}

export async function setupTestApp({
  accounts,
  fixtures,
  now = "2026-03-18T00:00:00.000Z",
  overrides = {},
}: SetupTestAppOptions): Promise<TestApp> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "social-data-hub-"));
  const fixturesDir = path.join(rootDir, "fixtures");
  await mkdir(fixturesDir, { recursive: true });

  for (const [filename, value] of Object.entries(fixtures)) {
    await writeFile(path.join(fixturesDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  const auth = new TestAuthStore();
  const repositories = createMemoryRepositories(auth);
  await repositories.accountRepository.replaceAll(accounts);

  auth.addUser({
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.com",
    displayName: "測試管理員",
    role: "admin",
    status: "active",
    now,
  });
  await repositories.userRepository.upsertSignupUser({
    userId: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.com",
    displayName: "測試管理員",
    createdAt: now,
    updatedAt: now,
  });
  await repositories.userRepository.recordApproval({
    targetUserId: "11111111-1111-4111-8111-111111111111",
    adminUser: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "admin@example.com",
      displayName: "測試管理員",
      role: "admin",
      status: "active",
      approvedAt: now,
      approvedBy: "bootstrap-admin",
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    },
    approvedAt: now,
  });

  const app = await createApp({
    fixturesDir,
    port: 0,
    seedDemoData: false,
    autoStartScheduler: false,
    sharedSecret: "local-dev-secret",
    logger: createLogger({ silent: true }),
    clock: () => new Date(now),
    supabaseClient: auth.client,
    repositories,
    ...overrides,
  });

  const address = await app.start();
  const host = address.host === "::" ? "127.0.0.1" : address.host;
  const baseUrl = `http://${host}:${address.port}`;

  return {
    app,
    auth,
    repositories,
    baseUrl,
    async cleanup() {
      await app.stop();
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

export interface SendSignedJsonOptions {
  baseUrl: string;
  pathName: string;
  body: unknown;
  sharedSecret?: string;
  clientId?: string;
  timestamp?: string;
}

export async function sendSignedJson({
  baseUrl,
  pathName,
  body,
  sharedSecret = "local-dev-secret",
  clientId = "demo-sheet",
  timestamp = "2026-03-18T00:00:00.000Z",
}: SendSignedJsonOptions): Promise<{ response: Response; json: unknown }> {
  const rawBody = JSON.stringify(body);
  const signature = signPayload({
    sharedSecret,
    timestamp,
    rawBody,
  });

  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId,
      "x-timestamp": timestamp,
      "x-signature": signature,
    },
    body: rawBody,
  });

  const json = await response.json();
  return { response, json };
}

export interface SendJsonRequestOptions {
  baseUrl: string;
  pathName: string;
  method?: string;
  body?: unknown;
  authorization?: string | null;
}

export async function sendJsonRequest({
  baseUrl,
  pathName,
  method = "POST",
  body,
  authorization,
}: SendJsonRequestOptions): Promise<{ response: Response; json: unknown }> {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

export function authHeaders(authorization: string): Record<string, string> {
  return { authorization };
}

export async function loginAsAdmin(
  baseUrl: string,
  auth: TestAuthStore,
): Promise<{ authorization: string; headers: Record<string, string>; json: unknown; response: Response }> {
  const authorization = auth.authorizationFor("11111111-1111-4111-8111-111111111111");
  const { response, json } = await sendJsonRequest({
    baseUrl,
    pathName: "/api/v1/auth/me",
    method: "GET",
    authorization,
  });

  return {
    authorization,
    headers: authHeaders(authorization),
    json,
    response,
  };
}

export async function readStoreFile(app: AppInstance, filename: string): Promise<unknown> {
  if (filename === "sheet-status.json") {
    return app.services.sheetSnapshotRepository.listStatuses();
  }
  if (filename === "sheet-output.json") {
    return app.services.sheetSnapshotRepository.listOutputs();
  }
  if (filename === "raw-platform-records.json") {
    return app.services.rawRecordRepository.listAll();
  }
  if (filename === "normalized-content-records.json") {
    return app.services.normalizedRecordRepository.listAll();
  }
  throw new Error(`Unsupported test snapshot: ${filename}`);
}

export async function expectJobStatuses(
  jobRepository: JobRepository,
  expectedStatus: string
) {
  const jobs = await jobRepository.listAll();
  assert.ok(jobs.length > 0);
  jobs.forEach((job) => assert.equal(job.status, expectedStatus));
  return jobs;
}
