import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStore } from "../../backend/src/lib/fs-store.ts";

test("FileStore rejects collection names that attempt path traversal", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "fs-store-"));
  const store = new FileStore(rootDir);

  try {
    await store.init(["jobs"]);

    await assert.rejects(
      () => store.readCollection("../secrets"),
      /collection names must match/i,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("FileStore updates multiple collections under one lock", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "fs-store-"));
  const store = new FileStore(rootDir);

  try {
    await store.init(["jobs", "raw-platform-records"]);

    await store.updateCollections(["jobs", "raw-platform-records"], (collections) => ({
      jobs: [{ id: "job-1" }],
      "raw-platform-records": [{ id: "raw-1" }],
    }));

    assert.deepEqual(await store.readCollection("jobs"), [{ id: "job-1" }]);
    assert.deepEqual(await store.readCollection("raw-platform-records"), [{ id: "raw-1" }]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
