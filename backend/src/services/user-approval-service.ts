import crypto from "node:crypto";
import { HttpError } from "../lib/errors.ts";
import { sanitizeUser } from "./user-auth-service.ts";
import type { UserRepository } from "../repositories/user-repository.ts";
import type { OutboxMessageRepository } from "../repositories/outbox-message-repository.ts";
import type { SupabaseClient } from "../lib/supabase-client.ts";
import type { PublicUser, User, UserStatus } from "../types/user.ts";
import type { OutboxMessage } from "../types/outbox.ts";

interface OutboxMessageParams {
  clock: () => Date;
  to: string;
  type: string;
  subject: string;
  body: string;
}

function buildOutboxMessage({ clock, to, type, subject, body }: OutboxMessageParams): OutboxMessage {
  return {
    id: crypto.randomUUID(),
    type: type as OutboxMessage["type"],
    to,
    subject,
    body,
    createdAt: clock().toISOString(),
  };
}

interface DecideUserParams {
  targetUserId: string;
  adminUser: PublicUser;
  nextStatus: UserStatus;
  buildNextFields: (now: string) => Partial<User>;
  invalidStatusMessage: string;
  outboxMessage: { type: string; subject: string; body: string };
}

interface UserApprovalServiceOptions {
  userRepository: UserRepository;
  outboxMessageRepository: OutboxMessageRepository;
  supabaseClient?: SupabaseClient | null;
  clock: () => Date;
}

export class UserApprovalService {
  readonly userRepository: UserRepository;
  readonly outboxMessageRepository: OutboxMessageRepository;
  readonly supabaseClient: SupabaseClient | null;
  readonly clock: () => Date;

  constructor({
    userRepository,
    outboxMessageRepository,
    supabaseClient = null,
    clock,
  }: UserApprovalServiceOptions) {
    this.userRepository = userRepository;
    this.outboxMessageRepository = outboxMessageRepository;
    this.supabaseClient = supabaseClient;
    this.clock = clock;
  }

  async listPendingUsers(): Promise<PublicUser[]> {
    const users = await this.userRepository.listByStatus("pending");
    return users.map((user) => sanitizeUser(user)).filter((u): u is PublicUser => u !== null);
  }

  async approveUser({ targetUserId, adminUser }: { targetUserId: string; adminUser: PublicUser }): Promise<PublicUser | null> {
    const updatedUser = await this.#decideUser({
      targetUserId,
      adminUser,
      nextStatus: "active",
      buildNextFields: (now) => ({
        approvedAt: now,
        approvedBy: adminUser.id,
        rejectedAt: null,
        rejectedBy: null,
      }),
      invalidStatusMessage: "只有待審核帳號可以被核准。",
      outboxMessage: {
        type: "user-approved",
        subject: "社群資料中台帳號已核准",
        body: "你的帳號已由管理員核准，現在可以登入社群資料中台。",
      },
    });
    return sanitizeUser(updatedUser);
  }

  async rejectUser({ targetUserId, adminUser }: { targetUserId: string; adminUser: PublicUser }): Promise<PublicUser | null> {
    const updatedUser = await this.#decideUser({
      targetUserId,
      adminUser,
      nextStatus: "rejected",
      buildNextFields: (now) => ({
        rejectedAt: now,
        rejectedBy: adminUser.id,
      }),
      invalidStatusMessage: "只有待審核帳號可以被拒絕。",
      outboxMessage: {
        type: "user-rejected",
        subject: "社群資料中台註冊申請未通過",
        body: "你的註冊申請目前未通過，若需要存取權限請聯絡管理員。",
      },
    });
    return sanitizeUser(updatedUser);
  }

  async #decideUser({
    targetUserId,
    adminUser: _adminUser,
    nextStatus,
    buildNextFields,
    invalidStatusMessage,
    outboxMessage,
  }: DecideUserParams): Promise<User | null> {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
    }
    if (user.status !== "pending") {
      throw new HttpError(409, "USER_STATUS_INVALID", invalidStatusMessage);
    }

    const now = this.clock().toISOString();
    await this.#syncSupabaseAuthMetadata(user, nextStatus);

    const updatedUser = await this.userRepository.updateById(targetUserId, {
      status: nextStatus,
      ...buildNextFields(now),
      updatedAt: now,
    });

    await this.outboxMessageRepository.create(
      buildOutboxMessage({
        clock: this.clock,
        to: user.email,
        ...outboxMessage,
      }),
    );

    return updatedUser;
  }

  async #syncSupabaseAuthMetadata(user: User, status: UserStatus): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }

    const authUserId = await this.#findSupabaseAuthUserId(user);
    if (!authUserId) {
      throw new HttpError(502, "SUPABASE_USER_NOT_FOUND", "找不到對應的 Supabase Auth 使用者。");
    }

    const { data, error: readError } = await this.supabaseClient.auth.admin.getUserById(authUserId);
    if (readError) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", readError.message);
    }

    const existingMetadata =
      data.user?.app_metadata &&
      typeof data.user.app_metadata === "object" &&
      !Array.isArray(data.user.app_metadata)
        ? data.user.app_metadata
        : {};

    const { error } = await this.supabaseClient.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        ...existingMetadata,
        role: user.role,
        status,
      },
    });

    if (error) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", error.message);
    }
  }

  async #findSupabaseAuthUserId(user: User): Promise<string | null> {
    if (!this.supabaseClient) {
      return null;
    }

    const { data, error } = await this.supabaseClient.auth.admin.getUserById(user.id);
    if (!error && data.user) {
      return data.user.id;
    }

    const { data: usersData, error: listError } = await this.supabaseClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      throw new HttpError(502, "SUPABASE_AUTH_ERROR", listError.message);
    }

    const matchedUser = usersData.users.find(
      (entry) => entry.email?.toLowerCase() === user.email.toLowerCase(),
    );
    return matchedUser?.id ?? null;
  }
}
