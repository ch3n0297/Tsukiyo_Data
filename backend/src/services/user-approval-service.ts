import { HttpError } from "../lib/errors.ts";
import type { SupabaseClient } from "../lib/supabase-client.ts";
import type { AuthUser } from "../middleware/require-auth.ts";
import type { AuditEventInput } from "../repositories/supabase/audit-event-repository.ts";
import type { UserProfileRepository } from "../repositories/user-repository.ts";
import type { PublicUser, User, UserRole, UserStatus } from "../types/user.ts";

interface AuditEventRepository {
  create(event: AuditEventInput): Promise<void>;
}

interface UserApprovalServiceOptions {
  userRepository: UserProfileRepository;
  auditEventRepository: AuditEventRepository;
  supabaseClient: SupabaseClient;
  clock: () => Date;
}

function readRole(value: unknown): UserRole {
  return value === "admin" || value === "member" ? value : "member";
}

function readStatus(value: unknown): UserStatus {
  return value === "active" || value === "rejected" || value === "pending"
    ? value
    : "pending";
}

function readMetadata(user: {
  app_metadata?: Record<string, unknown>;
}): { role: UserRole; status: UserStatus } {
  return {
    role: readRole(user.app_metadata?.role),
    status: readStatus(user.app_metadata?.status),
  };
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mergeProfileWithMetadata(
  profile: User | null,
  authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string | null;
    app_metadata?: Record<string, unknown>;
  },
  fallbackTimestamp: string,
): User {
  const metadata = readMetadata(authUser);
  const createdAt = authUser.created_at ?? profile?.createdAt ?? fallbackTimestamp;
  const displayName =
    profile?.displayName ??
    (typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name : undefined) ??
    authUser.email ??
    "";

  return {
    id: authUser.id,
    email: profile?.email ?? authUser.email ?? "",
    displayName,
    role: metadata.role,
    status: metadata.status,
    approvedAt: profile?.approvedAt ?? null,
    approvedBy: profile?.approvedBy ?? null,
    rejectedAt: profile?.rejectedAt ?? null,
    rejectedBy: profile?.rejectedBy ?? null,
    lastLoginAt: profile?.lastLoginAt ?? null,
    createdAt,
    updatedAt: profile?.updatedAt ?? authUser.updated_at ?? createdAt,
  };
}

function statusError(status: UserStatus): HttpError {
  if (status === "pending") {
    return new HttpError(403, "USER_PENDING", "帳號尚待管理員核准，暫時無法使用。");
  }
  if (status === "rejected") {
    return new HttpError(403, "USER_REJECTED", "此帳號註冊申請已被拒絕，請聯絡管理員。");
  }
  return new HttpError(403, "USER_DISABLED", "此帳號目前已停用，請聯絡管理員。");
}

export class UserApprovalService {
  readonly #userRepository: UserProfileRepository;
  readonly #auditEventRepository: AuditEventRepository;
  readonly #supabaseClient: SupabaseClient;
  readonly #clock: () => Date;

  constructor({
    userRepository,
    auditEventRepository,
    supabaseClient,
    clock,
  }: UserApprovalServiceOptions) {
    this.#userRepository = userRepository;
    this.#auditEventRepository = auditEventRepository;
    this.#supabaseClient = supabaseClient;
    this.#clock = clock;
  }

  async syncSignup({
    authUser,
    displayName,
  }: {
    authUser: AuthUser;
    displayName?: string;
  }): Promise<PublicUser> {
    const { data, error } = await this.#supabaseClient.auth.admin.getUserById(authUser.id);
    if (error || !data.user) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", error?.message ?? "找不到 Supabase Auth 使用者。");
    }
    const existingMetadata = readMetadata(data.user);
    if (existingMetadata.role !== "member" || existingMetadata.status !== "pending") {
      throw new HttpError(
        409,
        "USER_STATUS_INVALID",
        "只有新註冊或待審核帳號可以同步註冊狀態。",
      );
    }

    const now = this.#clock().toISOString();
    const resolvedDisplayName = displayName?.trim() || authUser.displayName || authUser.email;
    await this.#updateAppMetadata(authUser.id, { role: "member", status: "pending" });
    const profile = await this.#userRepository.upsertSignupUser({
      userId: authUser.id,
      email: authUser.email,
      displayName: resolvedDisplayName,
      createdAt: authUser.createdAt || now,
      updatedAt: now,
    });
    const user: User = {
      ...profile,
      role: "member",
      status: "pending",
    };
    await this.#auditEventRepository.create({
      userId: user.id,
      actorUserId: user.id,
      actorType: "user",
      eventType: "auth.signup_synced",
      entityType: "profile",
      entityId: user.id,
    });
    return toPublicUser(user);
  }

  async getCurrentUser(authUser: AuthUser): Promise<PublicUser> {
    const profile = await this.#userRepository.findById(authUser.id);
    const user: User = {
      ...(profile ?? {
        id: authUser.id,
        email: authUser.email,
        displayName: authUser.displayName,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        lastLoginAt: null,
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt,
      }),
      role: authUser.role,
      status: authUser.status,
    };
    if (user.status !== "active") {
      throw statusError(user.status);
    }
    return toPublicUser(user);
  }

  async listPendingUsers(): Promise<PublicUser[]> {
    const { data, error } = await this.#supabaseClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", error.message);
    }

    const users: PublicUser[] = [];
    for (const authUser of data.users) {
      const metadata = readMetadata(authUser);
      if (metadata.status !== "pending") {
        continue;
      }
      const profile = await this.#userRepository.findById(authUser.id);
      users.push(toPublicUser(mergeProfileWithMetadata(
        profile,
        authUser,
        this.#clock().toISOString(),
      )));
    }

    return users;
  }

  async approveUser({
    targetUserId,
    adminUser,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
  }): Promise<PublicUser> {
    return this.#decideUser({
      targetUserId,
      adminUser,
      nextStatus: "active",
      eventType: "auth.user_approved",
      persistDecision: (now) =>
        this.#userRepository.recordApproval({
          targetUserId,
          adminUser,
          approvedAt: now,
        }),
      invalidStatusMessage: "只有待審核帳號可以被核准。",
    });
  }

  async rejectUser({
    targetUserId,
    adminUser,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
  }): Promise<PublicUser> {
    return this.#decideUser({
      targetUserId,
      adminUser,
      nextStatus: "rejected",
      eventType: "auth.user_rejected",
      persistDecision: (now) =>
        this.#userRepository.recordRejection({
          targetUserId,
          adminUser,
          rejectedAt: now,
        }),
      invalidStatusMessage: "只有待審核帳號可以被拒絕。",
    });
  }

  async #decideUser({
    targetUserId,
    adminUser,
    nextStatus,
    eventType,
    persistDecision,
    invalidStatusMessage,
  }: {
    targetUserId: string;
    adminUser: PublicUser;
    nextStatus: UserStatus;
    eventType: string;
    persistDecision: (now: string) => Promise<User>;
    invalidStatusMessage: string;
  }): Promise<PublicUser> {
    const { data, error } = await this.#supabaseClient.auth.admin.getUserById(targetUserId);
    if (error || !data.user) {
      throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
    }
    const metadata = readMetadata(data.user);
    if (metadata.status !== "pending") {
      throw new HttpError(409, "USER_STATUS_INVALID", invalidStatusMessage);
    }

    await this.#updateAppMetadata(targetUserId, {
      role: metadata.role,
      status: nextStatus,
    });

    const now = this.#clock().toISOString();
    const profile = await persistDecision(now);
    const user = {
      ...profile,
      role: metadata.role,
      status: nextStatus,
    };
    await this.#auditEventRepository.create({
      userId: targetUserId,
      actorUserId: adminUser.id,
      actorType: "admin",
      eventType,
      entityType: "profile",
      entityId: targetUserId,
    });

    return toPublicUser(user);
  }

  async #updateAppMetadata(
    userId: string,
    metadataPatch: { role: UserRole; status: UserStatus },
  ): Promise<void> {
    const { data, error: readError } = await this.#supabaseClient.auth.admin.getUserById(userId);
    if (readError || !data.user) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", readError?.message ?? "找不到 Supabase Auth 使用者。");
    }

    const existingMetadata =
      data.user.app_metadata &&
      typeof data.user.app_metadata === "object" &&
      !Array.isArray(data.user.app_metadata)
        ? data.user.app_metadata
        : {};

    const { error } = await this.#supabaseClient.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existingMetadata,
        ...metadataPatch,
      },
    });
    if (error) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", error.message);
    }
  }
}
