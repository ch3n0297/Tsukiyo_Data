import test from "node:test";
import assert from "node:assert/strict";
import { FileSheetGateway } from "../../backend/src/adapters/sheets/file-sheet-gateway.ts";

test("writeStatus does not allow patches to override account identity fields", async () => {
  let captured = null;
  const gateway = new FileSheetGateway({
    sheetSnapshotRepository: {
      async upsertStatus(snapshot) {
        captured = snapshot;
      },
    },
    clock: () => new Date("2026-03-18T00:00:00.000Z"),
  });

  await gateway.writeStatus(
    {
      sheetId: "sheet-1",
      sheetRowKey: "row-1",
      platform: "instagram",
      accountId: "acct-1",
    },
    {
      sheetId: "attacker-sheet",
      accountId: "attacker-account",
      refreshStatus: "success",
    },
  );

  assert.equal(captured.sheetId, "sheet-1");
  assert.equal(captured.accountId, "acct-1");
  assert.equal(captured.refreshStatus, "success");
  assert.equal(captured.updatedAt, "2026-03-18T00:00:00.000Z");
});
