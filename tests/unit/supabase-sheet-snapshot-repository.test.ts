import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseSheetSnapshotRepository } from "../../backend/src/repositories/supabase/sheet-snapshot-repository.ts";

function createQuery(data: unknown[]) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    order() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

test("SupabaseSheetSnapshotRepository builds output snapshots from normalized records", async () => {
  const client = {
    from(table: string) {
      if (table === "account_configs") {
        return createQuery([
          {
            platform: "instagram",
            account_id: "acct-1",
            sheet_id: "sheet-1",
            sheet_tab: "row-1",
          },
        ]);
      }

      if (table === "normalized_records") {
        return createQuery([
          {
            platform: "instagram",
            account_id: "acct-1",
            post_id: "post-1",
            post_timestamp: "2026-03-17T10:00:00.000Z",
            caption: "Snapshot row",
            media_type: "reel",
            like_count: 45,
            comment_count: 8,
            view_count: 510,
            share_count: 3,
            created_at: "2026-04-27T18:45:00.000Z",
          },
        ]);
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const repository = new SupabaseSheetSnapshotRepository(client as any, "user-1");
  const outputs = await repository.listOutputs();

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].sheetId, "sheet-1");
  assert.equal(outputs[0].sheetRowKey, "row-1");
  assert.equal(outputs[0].rows.length, 1);
  assert.equal(outputs[0].rows[0].content_id, "post-1");
  assert.equal(outputs[0].rows[0].caption, "Snapshot row");
  assert.equal(outputs[0].rows[0].views, 510);
});
