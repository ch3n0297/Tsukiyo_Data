import test from "node:test";
import assert from "node:assert/strict";
import { createRequireAuth } from "../../backend/src/middleware/require-auth.ts";
import { HttpError } from "../../backend/src/lib/errors.ts";
import type { SupabaseClient } from "../../backend/src/lib/supabase-client.ts";
import type { FastifyReply, FastifyRequest } from "fastify";

function createMockSupabase(user: unknown): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({
        data: { user },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
}

function createRequest(): FastifyRequest {
  return {
    headers: {
      authorization: "Bearer test-token",
    },
  } as FastifyRequest;
}

test("Supabase auth rejects pending users before protected handlers run", async () => {
  const requireAuth = createRequireAuth(
    createMockSupabase({
      id: "user-pending",
      email: "pending@example.com",
      user_metadata: { name: "Pending", status: "pending" },
      app_metadata: {},
    }),
  );

  await assert.rejects(
    () => requireAuth(createRequest(), {} as FastifyReply),
    (error) =>
      error instanceof HttpError &&
      error.statusCode === 403 &&
      error.code === "USER_PENDING",
  );
});

test("Supabase admin guard accepts active admins and rejects active members", async () => {
  const adminRequest = createRequest();
  const requireAdmin = createRequireAuth(
    createMockSupabase({
      id: "user-admin",
      email: "admin@example.com",
      user_metadata: { name: "Admin" },
      app_metadata: { role: "admin", status: "active" },
    }),
    { requireAdmin: true },
  );

  await requireAdmin(adminRequest, {} as FastifyReply);
  assert.equal(adminRequest.user?.role, "admin");
  assert.equal(adminRequest.user?.status, "active");

  const memberGuard = createRequireAuth(
    createMockSupabase({
      id: "user-member",
      email: "member@example.com",
      user_metadata: { name: "Member" },
      app_metadata: { role: "member", status: "active" },
    }),
    { requireAdmin: true },
  );

  await assert.rejects(
    () => memberGuard(createRequest(), {} as FastifyReply),
    (error) =>
      error instanceof HttpError &&
      error.statusCode === 403 &&
      error.code === "ADMIN_REQUIRED",
  );
});
