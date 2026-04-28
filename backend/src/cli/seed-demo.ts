import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.ts";
import { FileStore } from "../lib/fs-store.ts";
import { AccountConfigRepository } from "../repositories/account-config-repository.ts";
import type { AccountConfig } from "../types/account-config.ts";

const DEMO_REFRESH_DAYS = 90;

export function createDemoAccounts(clock: () => Date): AccountConfig[] {
  const now = clock().toISOString();

  return [
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      platform: "instagram",
      accountId: "acct-instagram-demo",
      refreshDays: DEMO_REFRESH_DAYS,
      sheetId: "marketing-sheet",
      sheetRowKey: "row-instagram",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: null,
      currentJobId: null,
      refreshStatus: "idle",
      systemMessage: "帳號已就緒，可進行資料更新。",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      platform: "facebook",
      accountId: "acct-facebook-demo",
      refreshDays: DEMO_REFRESH_DAYS,
      sheetId: "marketing-sheet",
      sheetRowKey: "row-facebook",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: null,
      currentJobId: null,
      refreshStatus: "idle",
      systemMessage: "帳號已就緒，可進行資料更新。",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      platform: "tiktok",
      accountId: "acct-tiktok-demo",
      refreshDays: DEMO_REFRESH_DAYS,
      sheetId: "marketing-sheet",
      sheetRowKey: "row-tiktok",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: null,
      currentJobId: null,
      refreshStatus: "idle",
      systemMessage: "帳號已就緒，可進行資料更新。",
      updatedAt: now,
    },
  ];
}

export interface SeedDemoDataOptions {
  accountRepository: AccountConfigRepository;
  clock: () => Date;
  overwrite?: boolean;
}

export async function seedDemoData({ accountRepository, clock, overwrite = false }: SeedDemoDataOptions): Promise<AccountConfig[]> {
  const existing = await accountRepository.listAll();
  if (existing.length > 0 && !overwrite) {
    return existing;
  }

  const demoAccounts = createDemoAccounts(clock);
  await accountRepository.replaceAll(demoAccounts);
  return demoAccounts;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new FileStore(config.dataDir);
  await store.init(["account-configs"]);
  const accountRepository = new AccountConfigRepository(store);
  const accounts = await seedDemoData({
    accountRepository,
    clock: config.clock,
    overwrite: true,
  });

  config.logger.info("Seeded demo accounts", { count: accounts.length });
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isDirectExecution()) {
  await main();
}
