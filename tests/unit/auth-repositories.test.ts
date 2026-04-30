import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../backend/src/lib/errors.ts";
import { OutboxMessageRepository } from "../../backend/src/repositories/outbox-message-repository.ts";
import { SessionRepository } from "../../backend/src/repositories/session-repository.ts";
import { UserApprovalRepository } from "../../backend/src/repositories/user-approval-repository.ts";
import { UserRepository } from "../../backend/src/repositories/user-repository.ts";

function createMemoryStore(initialCollections = {}) {
  const collections = structuredClone(initialCollections);

  return {
    async readCollection(collection) {
      return structuredClone(collections[collection]);
    },
    async updateCollection(collection, updater) {
      const next = await updater(structuredClone(collections[collection]));
      collections[collection] = structuredClone(next);
      return structuredClone(next);
    },
    async updateCollections(collectionNames, updater) {
      const current = Object.fromEntries(
        collectionNames.map((collection) => [collection, structuredClone(collections[collection])]),
      );
      const next = await updater(current);

      for (const collection of collectionNames) {
        collections[collection] = structuredClone(next[collection]);
      }

      return structuredClone(next);
    },
  };
}

test("OutboxMessageRepository.create initializes a malformed collection defensively", async () => {
  const repository = new OutboxMessageRepository(
    createMemoryStore({
      "outbox-messages": null,
    }),
  );

  const messages = await repository.create({
    id: "message-1",
    type: "password-reset",
  });

  assert.deepEqual(messages, [
    {
      id: "message-1",
      type: "password-reset",
    },
  ]);
});

test("SessionRepository.updateById keeps the original session id", async () => {
  const repository = new SessionRepository(
    createMemoryStore({
      sessions: [
        {
          id: "session-1",
          userId: "user-1",
          createdAt: "2026-03-18T00:00:00.000Z",
        },
      ],
    }),
  );

  const updatedSession = await repository.updateById("session-1", {
    id: "session-2",
    lastSeenAt: "2026-03-18T01:00:00.000Z",
  });

  assert.deepEqual(updatedSession, {
    id: "session-1",
    userId: "user-1",
    createdAt: "2026-03-18T00:00:00.000Z",
    lastSeenAt: "2026-03-18T01:00:00.000Z",
  });
});

test("UserRepository.create normalizes emails and rejects case-insensitive duplicates", async () => {
  const repository = new UserRepository(
    createMemoryStore({
      users: [],
    }),
  );

  await repository.create({
    id: "user-1",
    email: "Member@Example.com",
    displayName: "Member",
  });

  await assert.rejects(
    repository.create({
      id: "user-2",
      email: "member@example.com",
      displayName: "Another Member",
    }),
    (error) =>
      error instanceof HttpError &&
      error.statusCode === 409 &&
      error.code === "USER_ALREADY_EXISTS",
  );

  const existingUser = await repository.findById("user-1");
  assert.equal(existingUser.email, "member@example.com");
});

test("UserApprovalRepository updates pending user and outbox in one store transaction", async () => {
  const store = createMemoryStore({
    users: [
      {
        id: "user-1",
        email: "pending@example.com",
        displayName: "Pending",
        role: "member",
        status: "pending",
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        lastLoginAt: null,
        createdAt: "2026-03-18T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
      },
    ],
    "outbox-messages": [],
  });
  const approvalRepository = new UserApprovalRepository(store);
  const outboxRepository = new OutboxMessageRepository(store);

  const updatedUser = await approvalRepository.decidePendingUser({
    targetUserId: "user-1",
    nextStatus: "active",
    nextFields: {
      approvedAt: "2026-03-18T01:00:00.000Z",
      approvedBy: "admin-1",
      updatedAt: "2026-03-18T01:00:00.000Z",
    },
    invalidStatusMessage: "只有待審核帳號可以被核准。",
    outboxMessage: {
      id: "message-1",
      type: "user-approved",
      to: "pending@example.com",
      subject: "approved",
      body: "approved",
      createdAt: "2026-03-18T01:00:00.000Z",
    },
  });

  assert.equal(updatedUser.status, "active");
  assert.equal(updatedUser.approvedBy, "admin-1");
  assert.deepEqual(await approvalRepository.listPendingUsers(), []);
  assert.deepEqual(await outboxRepository.listAll(), [
    {
      id: "message-1",
      type: "user-approved",
      to: "pending@example.com",
      subject: "approved",
      body: "approved",
      createdAt: "2026-03-18T01:00:00.000Z",
    },
  ]);
});
