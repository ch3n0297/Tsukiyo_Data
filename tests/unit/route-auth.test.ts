import assert from "node:assert/strict";
import test from "node:test";
import { requireRouteAdminUser, requireRouteUser } from "../../backend/src/routes/route-auth.ts";
import type { FastifyRequest } from "fastify";
import type { Services } from "../../backend/src/types/app.ts";
import type { User } from "../../backend/src/types/user.ts";

const activeAdmin: User = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  displayName: "Admin",
  passwordHash: "unused",
  role: "admin",
  status: "active",
  approvedAt: "2026-04-28T00:00:00.000Z",
  approvedBy: "bootstrap-admin",
  rejectedAt: null,
  rejectedBy: null,
  lastLoginAt: null,
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

function makeServices(user: User | null): Services {
  return {
    userRepository: {
      findById: async (id: string) => user?.id === id ? user : null,
      findByEmail: async (email: string) => user?.email === email ? user : null,
    },
    userAuthService: {
      requireAuthenticatedUser: async () => ({
        session: { id: "legacy-session" },
        user: {
          id: "legacy-user",
          email: "legacy@example.com",
          displayName: "Legacy",
          role: "member",
          status: "active",
          approvedAt: null,
          approvedBy: null,
          lastLoginAt: null,
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
        },
      }),
      createSessionCookie: (sessionId: string) => `sid=${sessionId}`,
    },
  } as unknown as Services;
}

test("requireRouteAdminUser accepts Supabase JWT users through the server approval record", async () => {
  const context = await requireRouteAdminUser({
    req: {
      user: {
        id: activeAdmin.id,
        email: activeAdmin.email,
        displayName: activeAdmin.displayName,
        role: "member",
        status: "pending",
        createdAt: activeAdmin.createdAt,
        updatedAt: activeAdmin.updatedAt,
      },
    } as FastifyRequest,
    services: makeServices(activeAdmin),
  });

  assert.equal(context.user.role, "admin");
  assert.equal(context.user.status, "active");
  assert.equal(context.sessionCookie, undefined);
});

test("requireRouteUser keeps pending Supabase users out of protected routes", async () => {
  const pendingUser = { ...activeAdmin, role: "member" as const, status: "pending" as const };

  await assert.rejects(
    requireRouteUser({
      req: {
        user: {
          id: pendingUser.id,
          email: pendingUser.email,
          displayName: pendingUser.displayName,
          role: "member",
          status: "pending",
          createdAt: pendingUser.createdAt,
          updatedAt: pendingUser.updatedAt,
        },
      } as FastifyRequest,
      services: makeServices(pendingUser),
    }),
    { code: "USER_PENDING", statusCode: 403 },
  );
});

test("requireRouteUser preserves legacy cookie sessions when no JWT user exists", async () => {
  const context = await requireRouteUser({
    req: { headers: {} } as FastifyRequest,
    services: makeServices(null),
  });

  assert.equal(context.user.id, "legacy-user");
  assert.equal(context.sessionCookie, "sid=legacy-session");
});
