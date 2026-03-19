import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLogger } from "../src/lib/logger.js";
import { createApp } from "../src/app.js";
import { signPayload } from "../src/services/auth-service.js";

export function createAccount({
  clientName = "Test Client",
  platform,
  accountId,
  refreshDays = 7,
  sheetId = "sheet-1",
  sheetRowKey,
  isActive = true,
}) {
  return {
    id: `${platform}-${accountId}`,
    clientName,
    platform,
    accountId,
    refreshDays,
    sheetId,
    sheetRowKey: sheetRowKey ?? `${platform}-${accountId}`,
    isActive,
    lastRequestTime: null,
    lastSuccessTime: null,
    currentJobId: null,
    refreshStatus: "idle",
    systemMessage: "帳號已就緒，可進行資料更新。",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };
}

export async function setupTestApp({
  accounts,
  fixtures,
  now = "2026-03-18T00:00:00.000Z",
  overrides = {},
}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "social-data-hub-"));
  const dataDir = path.join(rootDir, "data");
  const fixturesDir = path.join(rootDir, "fixtures");
  await mkdir(dataDir, { recursive: true });
  await mkdir(fixturesDir, { recursive: true });

  for (const [filename, value] of Object.entries(fixtures)) {
    await writeFile(path.join(fixturesDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  const app = await createApp({
    dataDir,
    fixturesDir,
    port: 0,
    seedDemoData: false,
    autoStartScheduler: false,
    sharedSecret: "local-dev-secret",
    bootstrapAdminEmail: "admin@example.com",
    bootstrapAdminPassword: "AdminPassword123!",
    bootstrapAdminName: "測試管理員",
    logger: createLogger({ silent: true }),
    clock: () => new Date(now),
    ...overrides,
  });

  await app.services.accountRepository.replaceAll(accounts);
  await app.services.statusService.bootstrapAccountSnapshots();

  const address = await app.start();
  const host = address.host === "::" ? "127.0.0.1" : address.host;
  const baseUrl = `http://${host}:${address.port}`;

  return {
    app,
    baseUrl,
    async cleanup() {
      await app.stop();
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

export async function sendSignedJson({
  baseUrl,
  pathName,
  body,
  sharedSecret = "local-dev-secret",
  clientId = "demo-sheet",
  timestamp = "2026-03-18T00:00:00.000Z",
}) {
  const rawBody = JSON.stringify(body);
  const signature = signPayload({
    sharedSecret,
    timestamp,
    rawBody,
  });

  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId,
      "x-timestamp": timestamp,
      "x-signature": signature,
    },
    body: rawBody,
  });

  const json = await response.json();
  return { response, json };
}

export async function sendJsonRequest({
  baseUrl,
  pathName,
  method = "POST",
  body,
  cookie,
}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

export function readSessionCookie(response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    return null;
  }

  return setCookie.split(";")[0];
}

export async function loginAsAdmin(baseUrl, credentials = {}) {
  const { response, json } = await sendJsonRequest({
    baseUrl,
    pathName: "/api/v1/auth/login",
    body: {
      email: credentials.email ?? "admin@example.com",
      password: credentials.password ?? "AdminPassword123!",
    },
  });

  return {
    cookie: readSessionCookie(response),
    json,
    response,
  };
}

export async function readStoreFile(app, filename) {
  const content = await readFile(path.join(app.config.dataDir, filename), "utf8");
  return JSON.parse(content);
}

export async function expectJobStatuses(jobRepository, expectedStatus) {
  const jobs = await jobRepository.listAll();
  assert.ok(jobs.length > 0);
  jobs.forEach((job) => assert.equal(job.status, expectedStatus));
  return jobs;
}
