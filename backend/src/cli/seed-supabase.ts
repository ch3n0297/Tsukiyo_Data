import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSupabaseClient, type SupabaseClient } from "../lib/supabase-client.ts";
import type { Platform } from "../types/platform.ts";

const SEED_NAMESPACE = "tsukiyo-data:supabase-seed:v1";
const SEED_REFERENCE_TIME = "2026-04-01T09:00:00.000Z";
const DRY_RUN_OWNER_USER_ID = "00000000-0000-5000-8000-000000000001";

const DEFAULT_OWNER_NAME = "Supabase Seed Admin";

const TABLE_CONFLICTS = {
  account_configs: "id",
  jobs: "id",
  raw_records: "user_id,platform,account_id,post_id",
  normalized_records: "user_id,platform,account_id,post_id",
  sheet_snapshots: "user_id,account_config_id",
} as const;

type SeedTableName = keyof typeof TABLE_CONFLICTS;

interface SeedAccountDefinition {
  clientName: string;
  platform: Platform;
  accountId: string;
  refreshDays: number;
  sheetId: string;
  sheetTab: string;
  captions: string[];
  mediaTypes: string[];
}

interface SupabaseSeedCliOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  ownerUserId: string | undefined;
  ownerEmail: string | undefined;
  ownerPassword: string | undefined;
  ownerName: string;
  dryRun: boolean;
}

interface SupabaseSeedData {
  accountConfigs: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  rawRecords: Array<Record<string, unknown>>;
  normalizedRecords: Array<Record<string, unknown>>;
  sheetSnapshots: Array<Record<string, unknown>>;
}

interface SupabaseSeedResult {
  ownerUserId: string;
  counts: Record<keyof SupabaseSeedData, number>;
}

const SEED_ACCOUNTS: SeedAccountDefinition[] = [
  {
    clientName: "月夜資料示範",
    platform: "instagram",
    accountId: "tsukiyo-instagram-demo",
    refreshDays: 30,
    sheetId: "supabase-seed-dashboard",
    sheetTab: "instagram-demo",
    captions: [
      "春季新品短影音素材整理完成",
      "社群活動貼文成效追蹤",
      "品牌合作 Reels 上線後 24 小時表現",
    ],
    mediaTypes: ["reel", "image", "carousel"],
  },
  {
    clientName: "月夜資料示範",
    platform: "facebook",
    accountId: "tsukiyo-facebook-demo",
    refreshDays: 14,
    sheetId: "supabase-seed-dashboard",
    sheetTab: "facebook-demo",
    captions: [
      "粉絲專頁公告互動摘要",
      "活動頁導流貼文更新",
      "長文貼文留言品質追蹤",
    ],
    mediaTypes: ["post", "video", "link"],
  },
  {
    clientName: "月夜資料示範",
    platform: "tiktok",
    accountId: "tsukiyo-tiktok-demo",
    refreshDays: 7,
    sheetId: "supabase-seed-dashboard",
    sheetTab: "tiktok-demo",
    captions: [
      "短影音趨勢題材測試",
      "幕後花絮素材互動觀察",
      "UGC 挑戰賽素材追蹤",
    ],
    mediaTypes: ["video", "video", "video"],
  },
];

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value === "" ? undefined : value;
}

function readOptionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseSupabaseSeedArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): SupabaseSeedCliOptions {
  let ownerUserId = readEnv(env, "SUPABASE_SEED_USER_ID");
  let ownerEmail = readEnv(env, "SUPABASE_SEED_EMAIL") ?? readEnv(env, "BOOTSTRAP_ADMIN_EMAIL");
  let ownerPassword =
    readEnv(env, "SUPABASE_SEED_PASSWORD") ?? readEnv(env, "BOOTSTRAP_ADMIN_PASSWORD");
  let ownerName =
    readEnv(env, "SUPABASE_SEED_NAME") ?? readEnv(env, "BOOTSTRAP_ADMIN_NAME") ?? DEFAULT_OWNER_NAME;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    switch (option) {
      case "--user-id":
        ownerUserId = readOptionValue(argv, index, option);
        index += 1;
        break;
      case "--email":
        ownerEmail = readOptionValue(argv, index, option);
        index += 1;
        break;
      case "--password":
        ownerPassword = readOptionValue(argv, index, option);
        index += 1;
        break;
      case "--name":
        ownerName = readOptionValue(argv, index, option);
        index += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        throw new Error(`Unknown option: ${option}`);
    }
  }

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL must be configured before seeding Supabase data.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured before seeding Supabase data.");
  }

  if (ownerUserId !== undefined && !isUuid(ownerUserId)) {
    throw new Error("SUPABASE_SEED_USER_ID / --user-id must be a valid UUID.");
  }

  if (!dryRun && !ownerUserId && (!ownerEmail || !ownerPassword)) {
    throw new Error(
      "Set SUPABASE_SEED_USER_ID, or provide SUPABASE_SEED_EMAIL/SUPABASE_SEED_PASSWORD (BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD also work).",
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    ownerUserId,
    ownerEmail,
    ownerPassword,
    ownerName,
    dryRun,
  };
}

function deterministicUuid(label: string): string {
  const bytes = crypto.createHash("sha256").update(`${SEED_NAMESPACE}:${label}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function hoursBefore(hours: number): string {
  return new Date(Date.parse(SEED_REFERENCE_TIME) - hours * 60 * 60 * 1000).toISOString();
}

function buildAccountKey(platform: Platform, accountId: string): string {
  return `${platform}:${accountId}`;
}

function buildPostUrl(platform: Platform, accountId: string, postId: string): string {
  return `https://datatsukiyo.org/seed/${platform}/${accountId}/${postId}`;
}

export function buildSupabaseSeedData(ownerUserId: string): SupabaseSeedData {
  const accountConfigs: SupabaseSeedData["accountConfigs"] = [];
  const jobs: SupabaseSeedData["jobs"] = [];
  const rawRecords: SupabaseSeedData["rawRecords"] = [];
  const normalizedRecords: SupabaseSeedData["normalizedRecords"] = [];
  const sheetSnapshots: SupabaseSeedData["sheetSnapshots"] = [];

  for (const [accountIndex, account] of SEED_ACCOUNTS.entries()) {
    const accountConfigId = deterministicUuid(`account:${account.platform}:${account.accountId}`);
    const jobId = deterministicUuid(`job:${account.platform}:${account.accountId}:latest-success`);
    const lastRequestAt = hoursBefore(12 + accountIndex * 4);
    const lastSuccessAt = hoursBefore(11 + accountIndex * 4);

    accountConfigs.push({
      id: accountConfigId,
      user_id: ownerUserId,
      client_name: account.clientName,
      platform: account.platform,
      account_id: account.accountId,
      refresh_days: account.refreshDays,
      sheet_id: account.sheetId,
      sheet_tab: account.sheetTab,
      updated_at: lastSuccessAt,
    });

    jobs.push({
      id: jobId,
      user_id: ownerUserId,
      account_config_id: accountConfigId,
      trigger_source: accountIndex === 0 ? "manual" : "scheduled",
      refresh_days: account.refreshDays,
      status: "success",
      system_message: "Supabase seed data synchronized successfully.",
      queued_at: lastRequestAt,
      started_at: hoursBefore(11.75 + accountIndex * 4),
      completed_at: lastSuccessAt,
      created_at: lastRequestAt,
      account_key: buildAccountKey(account.platform, account.accountId),
      request_source: accountIndex === 0 ? "manual-refresh" : "scheduled-sync",
      platform: account.platform,
      account_id: account.accountId,
      error_code: null,
      result_summary: {
        inserted: account.captions.length,
        source: "seed:supabase",
      },
    });

    const outputRows = account.captions.map((caption, postIndex) => {
      const postId = `${account.accountId}-post-${postIndex + 1}`;
      const publishedAt = hoursBefore(24 * (postIndex + 1) + accountIndex * 3);
      const fetchedAt = lastSuccessAt;
      const contentType = account.mediaTypes[postIndex] ?? "post";
      const views = 900 + accountIndex * 350 + postIndex * 125;
      const likes = 80 + accountIndex * 24 + postIndex * 17;
      const comments = 12 + accountIndex * 4 + postIndex * 3;
      const shares = 5 + accountIndex * 2 + postIndex;
      const url = buildPostUrl(account.platform, account.accountId, postId);

      rawRecords.push({
        id: deterministicUuid(`raw:${account.platform}:${account.accountId}:${postId}`),
        user_id: ownerUserId,
        job_id: jobId,
        platform: account.platform,
        account_id: account.accountId,
        post_id: postId,
        raw_data: {
          id: postId,
          url,
          caption,
          media_type: contentType,
          metrics: {
            views,
            likes,
            comments,
            shares,
          },
          seeded_by: "seed:supabase",
        },
        fetched_at: fetchedAt,
      });

      normalizedRecords.push({
        id: deterministicUuid(`normalized:${account.platform}:${account.accountId}:${postId}`),
        user_id: ownerUserId,
        job_id: jobId,
        platform: account.platform,
        account_id: account.accountId,
        post_id: postId,
        post_timestamp: publishedAt,
        caption,
        media_type: contentType,
        like_count: likes,
        comment_count: comments,
        view_count: views,
        share_count: shares,
        extra_data: {
          url,
          seeded_by: "seed:supabase",
        },
        created_at: fetchedAt,
      });

      return {
        content_id: postId,
        content_type: contentType,
        published_at: publishedAt,
        caption,
        url,
        views,
        likes,
        comments,
        shares,
        data_status: "fresh",
      };
    });

    sheetSnapshots.push({
      id: deterministicUuid(`sheet-snapshot:${account.platform}:${account.accountId}`),
      user_id: ownerUserId,
      account_config_id: accountConfigId,
      refresh_status: "success",
      system_message: "Supabase seed data is ready.",
      last_request_at: lastRequestAt,
      last_success_at: lastSuccessAt,
      current_job_id: jobId,
      updated_at: lastSuccessAt,
      output_synced_at: lastSuccessAt,
      output_rows: outputRows,
    });
  }

  return {
    accountConfigs,
    jobs,
    rawRecords,
    normalizedRecords,
    sheetSnapshots,
  };
}

function summarizeSeedData(data: SupabaseSeedData): SupabaseSeedResult["counts"] {
  return {
    accountConfigs: data.accountConfigs.length,
    jobs: data.jobs.length,
    rawRecords: data.rawRecords.length,
    normalizedRecords: data.normalizedRecords.length,
    sheetSnapshots: data.sheetSnapshots.length,
  };
}

async function upsertRows(
  client: SupabaseClient,
  table: SeedTableName,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client
    .from(table)
    .upsert(rows, { onConflict: TABLE_CONFLICTS[table] });
  if (error) {
    throw new Error(`Failed to seed ${table}: ${error.message}`);
  }
}

async function resolveSeedOwnerUserId(
  client: SupabaseClient,
  options: SupabaseSeedCliOptions,
): Promise<string> {
  if (options.ownerUserId) {
    return options.ownerUserId;
  }

  if (!options.ownerEmail || !options.ownerPassword) {
    throw new Error("Owner email and password are required when owner user ID is not provided.");
  }

  const normalizedEmail = options.ownerEmail.trim().toLowerCase();
  const { data: usersPage, error: listError } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw listError;
  }

  const existingUser = usersPage.users.find(
    (user) => user.email?.trim().toLowerCase() === normalizedEmail,
  );
  const appMetadata = { role: "admin", status: "active" };
  const userMetadata = { name: options.ownerName };

  if (existingUser) {
    const { error: updateError } = await client.auth.admin.updateUserById(existingUser.id, {
      app_metadata: {
        ...existingUser.app_metadata,
        ...appMetadata,
      },
      user_metadata: {
        ...existingUser.user_metadata,
        ...userMetadata,
      },
    });
    if (updateError) {
      throw updateError;
    }
    return existingUser.id;
  }

  const { data: createdUser, error: createError } = await client.auth.admin.createUser({
    email: normalizedEmail,
    password: options.ownerPassword,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });
  if (createError) {
    throw createError;
  }
  if (!createdUser.user) {
    throw new Error("Supabase did not return a created seed owner user.");
  }

  return createdUser.user.id;
}

export async function seedSupabaseData(
  client: SupabaseClient,
  options: SupabaseSeedCliOptions,
): Promise<SupabaseSeedResult> {
  const ownerUserId = options.dryRun
    ? options.ownerUserId ?? DRY_RUN_OWNER_USER_ID
    : await resolveSeedOwnerUserId(client, options);
  const data = buildSupabaseSeedData(ownerUserId);

  if (!options.dryRun) {
    await upsertRows(client, "account_configs", data.accountConfigs);
    await upsertRows(client, "jobs", data.jobs);
    await upsertRows(client, "raw_records", data.rawRecords);
    await upsertRows(client, "normalized_records", data.normalizedRecords);
    await upsertRows(client, "sheet_snapshots", data.sheetSnapshots);
  }

  return {
    ownerUserId,
    counts: summarizeSeedData(data),
  };
}

function formatHelp(): string {
  return `Usage: npm run seed:supabase -- [options]

Seeds deterministic TypeScript-created data into the configured Supabase project.

Required environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Owner resolution:
  SUPABASE_SEED_USER_ID
  or SUPABASE_SEED_EMAIL + SUPABASE_SEED_PASSWORD
  or BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD

Options:
  --user-id <uuid>       Use an existing Supabase Auth user id
  --email <email>        Create or reuse this Supabase Auth user
  --password <password>  Password used if the owner user must be created
  --name <name>          Owner display name
  --dry-run              Print seed counts without calling Supabase APIs
  --help                 Show this message
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    process.stdout.write(formatHelp());
    return;
  }

  const options = parseSupabaseSeedArgs(argv);
  const client = createSupabaseClient(options.supabaseUrl, options.serviceRoleKey);
  const result = await seedSupabaseData(client, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
