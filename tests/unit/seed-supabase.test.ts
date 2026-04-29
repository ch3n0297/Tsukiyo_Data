import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSupabaseSeedData,
  parseSupabaseSeedArgs,
  seedSupabaseData,
} from "../../backend/src/cli/seed-supabase.ts";

const BASE_ENV = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  BOOTSTRAP_ADMIN_EMAIL: "admin@datatsukiyo.test",
  BOOTSTRAP_ADMIN_PASSWORD: "password",
};

test("parseSupabaseSeedArgs accepts bootstrap admin environment", () => {
  const options = parseSupabaseSeedArgs([], BASE_ENV);

  assert.equal(options.supabaseUrl, "http://127.0.0.1:54321");
  assert.equal(options.serviceRoleKey, "service-role");
  assert.equal(options.ownerEmail, "admin@datatsukiyo.test");
  assert.equal(options.ownerPassword, "password");
  assert.equal(options.dryRun, false);
});

test("parseSupabaseSeedArgs prefers explicit user id and dry run flag", () => {
  const options = parseSupabaseSeedArgs(
    ["--user-id", "11111111-1111-5111-8111-111111111111", "--dry-run"],
    {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    },
  );

  assert.equal(options.ownerUserId, "11111111-1111-5111-8111-111111111111");
  assert.equal(options.dryRun, true);
});

test("parseSupabaseSeedArgs rejects missing owner credentials", () => {
  assert.throws(
    () =>
      parseSupabaseSeedArgs([], {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    /SUPABASE_SEED_USER_ID/,
  );
});

test("parseSupabaseSeedArgs allows dry run without owner credentials", () => {
  const options = parseSupabaseSeedArgs(["--dry-run"], {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });

  assert.equal(options.ownerUserId, undefined);
  assert.equal(options.ownerEmail, undefined);
  assert.equal(options.dryRun, true);
});

test("buildSupabaseSeedData returns deterministic Supabase table rows", () => {
  const first = buildSupabaseSeedData("11111111-1111-5111-8111-111111111111");
  const second = buildSupabaseSeedData("11111111-1111-5111-8111-111111111111");

  assert.deepEqual(first, second);
  assert.equal(first.accountConfigs.length, 3);
  assert.equal(first.jobs.length, 3);
  assert.equal(first.rawRecords.length, 9);
  assert.equal(first.normalizedRecords.length, 9);
  assert.equal(first.sheetSnapshots.length, 3);

  assert.equal(first.accountConfigs[0].user_id, "11111111-1111-5111-8111-111111111111");
  assert.equal(first.accountConfigs[0].platform, "instagram");
  assert.equal(first.jobs[0].status, "success");
  assert.equal(first.sheetSnapshots[0].refresh_status, "success");
  assert.ok(Array.isArray(first.sheetSnapshots[0].output_rows));
});

test("seedSupabaseData dry run does not call Supabase APIs", async () => {
  const client = {
    auth: {
      admin: {
        listUsers() {
          throw new Error("dry-run should not resolve auth users");
        },
      },
    },
    from() {
      throw new Error("dry-run should not write tables");
    },
  };

  const result = await seedSupabaseData(client as any, {
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleKey: "service-role",
    ownerUserId: undefined,
    ownerEmail: "admin@datatsukiyo.test",
    ownerPassword: "password",
    ownerName: "Admin",
    dryRun: true,
  });

  assert.equal(result.ownerUserId, "00000000-0000-5000-8000-000000000001");
  assert.equal(result.counts.accountConfigs, 3);
});
