import { HttpError } from "../lib/errors.ts";
import type { FileStore } from "../lib/fs-store.ts";
import type { User, UserStatus } from "../types/user.ts";

function normalizeEmail(email: string): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export class UserRepository {
  private store: FileStore;
  private collection = "users";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<User[]> {
    return this.store.readCollection<User>(this.collection);
  }

  async listByStatus(status: UserStatus): Promise<User[]> {
    const users = await this.listAll();
    return users.filter((user) => user.status === status);
  }

  async findById(userId: string): Promise<User | null> {
    const users = await this.listAll();
    return users.find((user) => user.id === userId) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);
    const users = await this.listAll();
    return users.find((user) => normalizeEmail(user.email) === normalizedEmail) ?? null;
  }

  async create(user: User): Promise<User[]> {
    return this.store.updateCollection<User>(this.collection, (users) => {
      const nextUsers = Array.isArray(users) ? users : [];
      const normalizedEmail = normalizeEmail(user.email);

      if (nextUsers.some((existingUser) => existingUser.id === user.id)) {
        throw new HttpError(409, "USER_ALREADY_EXISTS", "此使用者識別碼已存在。");
      }

      if (nextUsers.some((existingUser) => normalizeEmail(existingUser.email) === normalizedEmail)) {
        throw new HttpError(409, "USER_ALREADY_EXISTS", "此 email 已被使用。");
      }

      nextUsers.push({
        ...user,
        email: normalizedEmail,
      });
      return nextUsers;
    });
  }

  async updateById(userId: string, patch: Partial<User>): Promise<User | null> {
    let updatedUser: User | null = null;
    const { id: _ignoredId, ...safePatch } = patch ?? {};

    await this.store.updateCollection<User>(this.collection, (users) => {
      const index = users.findIndex((user) => user.id === userId);

      if (index === -1) {
        return users;
      }

      if (
        safePatch.email &&
        users.some(
          (user) => user.id !== userId && normalizeEmail(user.email) === normalizeEmail(safePatch.email!),
        )
      ) {
        throw new HttpError(409, "USER_ALREADY_EXISTS", "此 email 已被使用。");
      }

      users[index] = {
        ...users[index],
        ...safePatch,
        ...(safePatch.email ? { email: normalizeEmail(safePatch.email) } : {}),
      };
      updatedUser = users[index];
      return users;
    });

    return updatedUser;
  }
}
