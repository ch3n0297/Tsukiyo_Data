import assert from "node:assert/strict";
import test from "node:test";
import { requireRouteAdminUser, requireRouteUser } from "../../backend/src/routes/route-auth.ts";
import type { FastifyRequest } from "fastify";

const activeAdmin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
  status: "active" as const,
  approvedAt: "2026-04-28T00:00:00.000Z",
  approvedBy: "bootstrap-admin",
  lastLoginAt: null,
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

test("requireRouteAdminUser accepts active Supabase admin users", async () => {
  const context = await requireRouteAdminUser({
    req: {
      user: activeAdmin,
    } as FastifyRequest,
  });

  assert.equal(context.user.role, "admin");
  assert.equal(context.user.status, "active");
});

test("requireRouteUser keeps pending Supabase users out of protected routes", async () => {
  await assert.rejects(
    requireRouteUser({
      req: {
        user: {
          ...activeAdmin,
          role: "member",
          status: "pending",
        },
      } as FastifyRequest,
    }),
    { code: "USER_PENDING", statusCode: 403 },
  );
});

test("requireRouteUser rejects requests without Supabase JWT context", async () => {
  await assert.rejects(
    requireRouteUser({
      req: { headers: {} } as FastifyRequest,
    }),
    { code: "AUTH_REQUIRED", statusCode: 401 },
  );
});
