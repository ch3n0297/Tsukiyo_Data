import { HttpError } from "../lib/errors.js";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeGoogleSub(googleSub) {
  return typeof googleSub === "string" && googleSub.trim() !== "" ? googleSub.trim() : "";
}

export class UserRepository {
  constructor(store) {
    this.store = store;
    this.collection = "users";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async listByStatus(status) {
    const users = await this.listAll();
    return users.filter((user) => user.status === status);
  }

  async findById(userId) {
    const users = await this.listAll();
    return users.find((user) => user.id === userId) ?? null;
  }

  async findByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const users = await this.listAll();
    return users.find((user) => normalizeEmail(user.email) === normalizedEmail) ?? null;
  }

  async findByGoogleSub(googleSub) {
    const normalizedGoogleSub = normalizeGoogleSub(googleSub);

    if (!normalizedGoogleSub) {
      return null;
    }

    const users = await this.listAll();
    return users.find((user) => normalizeGoogleSub(user.googleSub) === normalizedGoogleSub) ?? null;
  }

  async create(user) {
    return this.store.updateCollection(this.collection, (users) => {
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

  async updateById(userId, patch) {
    let updatedUser = null;
    const { id: _ignoredId, ...safePatch } = patch ?? {};

    await this.store.updateCollection(this.collection, (users) => {
      const index = users.findIndex((user) => user.id === userId);

      if (index === -1) {
        return users;
      }

      if (
        safePatch.email &&
        users.some(
          (user) => user.id !== userId && normalizeEmail(user.email) === normalizeEmail(safePatch.email),
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
