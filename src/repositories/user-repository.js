function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
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

  async create(user) {
    return this.store.updateCollection(this.collection, (users) => {
      users.push(user);
      return users;
    });
  }

  async updateById(userId, patch) {
    let updatedUser = null;

    await this.store.updateCollection(this.collection, (users) => {
      const index = users.findIndex((user) => user.id === userId);

      if (index === -1) {
        return users;
      }

      users[index] = {
        ...users[index],
        ...patch,
      };
      updatedUser = users[index];
      return users;
    });

    return updatedUser;
  }
}
