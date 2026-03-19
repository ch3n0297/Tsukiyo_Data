export class PasswordResetTokenRepository {
  constructor(store) {
    this.store = store;
    this.collection = "password-reset-tokens";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async findByTokenHash(tokenHash) {
    const tokens = await this.listAll();
    return tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async create(token) {
    return this.store.updateCollection(this.collection, (tokens) => {
      tokens.push(token);
      return tokens;
    });
  }

  async updateById(tokenId, patch) {
    let updatedToken = null;

    await this.store.updateCollection(this.collection, (tokens) => {
      const index = tokens.findIndex((token) => token.id === tokenId);

      if (index === -1) {
        return tokens;
      }

      tokens[index] = {
        ...tokens[index],
        ...patch,
      };
      updatedToken = tokens[index];
      return tokens;
    });

    return updatedToken;
  }

  async deleteByUserId(userId) {
    return this.store.updateCollection(this.collection, (tokens) =>
      tokens.filter((token) => token.userId !== userId),
    );
  }
}
