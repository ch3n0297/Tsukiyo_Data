import type { AccountConfig } from "../types/account-config.ts";

export function makeAccountKey(platform: string, accountId: string): string {
  return `${platform}:${accountId}`;
}

export interface AccountConfigRepository {
  listAll(): Promise<AccountConfig[]>;
  listActive(): Promise<AccountConfig[]>;
  replaceAll(records: AccountConfig[]): Promise<AccountConfig[]>;
  findByPlatformAndAccountId(
    platform: string,
    accountId: string,
  ): Promise<AccountConfig | undefined>;
  updateByAccountKey(
    accountKey: string,
    patch: Partial<AccountConfig>,
  ): Promise<AccountConfig[]>;
}
