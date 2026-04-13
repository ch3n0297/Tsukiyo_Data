import type { FileStore } from "../lib/fs-store.ts";
import type { PasswordResetToken } from "../types/password-reset.ts";

export class PasswordResetTokenRepository {
  private readonly store: FileStore;
  private readonly collection = "password-reset-tokens";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<PasswordResetToken[]> {
    return this.store.readCollection<PasswordResetToken>(this.collection);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const tokens = await this.listAll();
    return tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async create(token: PasswordResetToken): Promise<PasswordResetToken[]> {
    return this.store.updateCollection<PasswordResetToken>(this.collection, (tokens) => {
      tokens.push(token);
      return tokens;
    });
  }

  async updateById(
    tokenId: string,
    patch: Partial<PasswordResetToken>
  ): Promise<PasswordResetToken | null> {
    let updatedToken: PasswordResetToken | null = null;

    await this.store.updateCollection<PasswordResetToken>(this.collection, (tokens) => {
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

  async deleteByUserId(userId: string): Promise<PasswordResetToken[]> {
    return this.store.updateCollection<PasswordResetToken>(this.collection, (tokens) =>
      tokens.filter((token) => token.userId !== userId),
    );
  }
}
