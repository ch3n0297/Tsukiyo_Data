import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { FileStore } from "../lib/fs-store.js";
import { AccountConfigRepository } from "../repositories/account-config-repository.js";

export function createDemoAccounts(clock) {
  const now = clock().toISOString();

  return [
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      tenantKey: "demo-tenant",
      platform: "instagram",
      accountId: "acct-instagram-demo",
      refreshDays: 7,
      sheetId: "marketing-sheet-instagram",
      allowedSpreadsheetId: "marketing-sheet-instagram",
      sheetRowKey: "row-instagram",
      googleConnectionId: null,
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
      tenantKey: "demo-tenant",
      platform: "facebook",
      accountId: "acct-facebook-demo",
      refreshDays: 7,
      sheetId: "marketing-sheet-facebook",
      allowedSpreadsheetId: "marketing-sheet-facebook",
      sheetRowKey: "row-facebook",
      googleConnectionId: null,
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
      tenantKey: "demo-tenant",
      platform: "tiktok",
      accountId: "acct-tiktok-demo",
      refreshDays: 7,
      sheetId: "marketing-sheet-tiktok",
      allowedSpreadsheetId: "marketing-sheet-tiktok",
      sheetRowKey: "row-tiktok",
      googleConnectionId: null,
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

export async function seedDemoData({ accountRepository, clock, overwrite = false }) {
  const existing = await accountRepository.listAll();
  if (existing.length > 0 && !overwrite) {
    return existing;
  }

  const demoAccounts = createDemoAccounts(clock);
  await accountRepository.replaceAll(demoAccounts);
  return demoAccounts;
}

async function main() {
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

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isDirectExecution()) {
  await main();
}
