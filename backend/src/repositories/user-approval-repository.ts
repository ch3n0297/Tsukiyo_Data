import { HttpError } from "../lib/errors.ts";
import type { FileStore } from "../lib/fs-store.ts";
import type { OutboxMessage } from "../types/outbox.ts";
import type { User, UserStatus } from "../types/user.ts";

interface ApprovalCollections extends Record<string, unknown[]> {
  users: User[];
  "outbox-messages": OutboxMessage[];
}

export interface DecidePendingUserOptions {
  targetUserId: string;
  nextStatus: UserStatus;
  nextFields: Partial<User>;
  invalidStatusMessage: string;
  outboxMessage: OutboxMessage;
}

export class UserApprovalRepository {
  private readonly store: FileStore;

  constructor(store: FileStore) {
    this.store = store;
  }

  async findById(userId: string): Promise<User | null> {
    const users = await this.store.readCollection<User>("users");
    return users.find((user) => user.id === userId) ?? null;
  }

  async listPendingUsers(): Promise<User[]> {
    const users = await this.store.readCollection<User>("users");
    return users.filter((user) => user.status === "pending");
  }

  async decidePendingUser({
    targetUserId,
    nextStatus,
    nextFields,
    invalidStatusMessage,
    outboxMessage,
  }: DecidePendingUserOptions): Promise<User> {
    let updatedUser: User | null = null;
    const { id: _ignoredId, ...safeNextFields } = nextFields ?? {};

    await this.store.updateCollections<ApprovalCollections>(
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

        updatedUser = {
          ...user,
          ...safeNextFields,
          status: nextStatus,
        };
        users[index] = updatedUser;
        outboxMessages.push(outboxMessage);

        return {
          users,
          "outbox-messages": outboxMessages,
        };
      },
    );

    if (!updatedUser) {
      throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
    }

    return updatedUser;
  }
}
