import { HttpError } from "../lib/errors.ts";
import { sanitizeUser } from "../services/user-auth-service.ts";
import type { FastifyRequest } from "fastify";
import type { Services } from "../types/app.ts";
import type { AuthUser } from "../middleware/require-auth.ts";
import type { PublicUser, UserStatus } from "../types/user.ts";

interface RouteAuthParams {
  req: FastifyRequest;
  services: Services;
}

export interface RouteAuthContext {
  user: PublicUser;
  sessionCookie?: string;
}

function readSupabaseUser(req: FastifyRequest): AuthUser | undefined {
  return (req as FastifyRequest & { user?: AuthUser }).user;
}

function statusError(status: UserStatus): HttpError {
  if (status === "pending") {
    return new HttpError(403, "USER_PENDING", "帳號尚待管理員核准，暫時無法登入。");
  }

  if (status === "rejected") {
    return new HttpError(403, "USER_REJECTED", "此帳號註冊申請已被拒絕，請聯絡管理員。");
  }

  return new HttpError(403, "USER_DISABLED", "此帳號目前已停用，請聯絡管理員。");
}

function assertActiveUser(user: PublicUser): void {
  if (user.status !== "active") {
    throw statusError(user.status);
  }
}

function toPublicSupabaseUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    approvedAt: null,
    approvedBy: null,
    lastLoginAt: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function resolveSupabaseUser(
  services: Services,
  supabaseUser: AuthUser,
): Promise<PublicUser> {
  const legacyUser =
    await services.userRepository.findById(supabaseUser.id) ??
    (supabaseUser.email
      ? await services.userRepository.findByEmail(supabaseUser.email)
      : null);

  return sanitizeUser(legacyUser) ?? toPublicSupabaseUser(supabaseUser);
}

export async function requireRouteUser({
  req,
  services,
}: RouteAuthParams): Promise<RouteAuthContext> {
  const supabaseUser = readSupabaseUser(req);

  if (supabaseUser) {
    const user = await resolveSupabaseUser(services, supabaseUser);
    assertActiveUser(user);
    return { user };
  }

  const context = await services.userAuthService.requireAuthenticatedUser(req);
  return {
    user: context.user,
    sessionCookie: services.userAuthService.createSessionCookie(context.session.id),
  };
}

export async function requireRouteAdminUser(
  params: RouteAuthParams,
): Promise<RouteAuthContext> {
  const context = await requireRouteUser(params);

  if (context.user.role !== "admin") {
    throw new HttpError(403, "ADMIN_REQUIRED", "此功能需要管理員權限。");
  }

  return context;
}
