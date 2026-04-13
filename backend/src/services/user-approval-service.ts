import crypto from "node:crypto";
import { HttpError } from "../lib/errors.ts";
import { sanitizeUser } from "./user-auth-service.ts";
import type { FileStore } from "../lib/fs-store.ts";
import type { UserRepository } from "../repositories/user-repository.ts";
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
  store: FileStore;
  userRepository: UserRepository;
  clock: () => Date;
}

export class UserApprovalService {
  readonly store: FileStore;
  readonly userRepository: UserRepository;
  readonly clock: () => Date;

  constructor({ store, userRepository, clock }: UserApprovalServiceOptions) {
    this.store = store;
    this.userRepository = userRepository;
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
    let updatedUser: User | null = null;

    type Collections = { users: User[]; "outbox-messages": OutboxMessage[] };
    await this.store.updateCollections<Collections>(
      ["users", "outbox-messages"],
      (collections) => {
        const users = Array.isArray(collections.users) ? collections.users : [];
        const outboxMessages = Array.isArray(collections["outbox-messages"])
          ? collections["outbox-messages"]
          : [];
        const index = users.findIndex((user) => user.id === targetUserId);

        if (index === -1) {
          throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
        }

        const user = users[index];

        if (user.status !== "pending") {
          throw new HttpError(409, "USER_STATUS_INVALID", invalidStatusMessage);
        }

        const now = this.clock().toISOString();
        updatedUser = {
          ...user,
          status: nextStatus,
          ...buildNextFields(now),
          updatedAt: now,
        };
        users[index] = updatedUser;
        outboxMessages.push(
          buildOutboxMessage({
            clock: this.clock,
            to: user.email,
            ...outboxMessage,
          }),
        );

        return {
          users,
          "outbox-messages": outboxMessages,
        };
      },
    );

    return updatedUser;
  }
}
