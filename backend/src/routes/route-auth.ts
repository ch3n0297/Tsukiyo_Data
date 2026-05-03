import { HttpError } from "../lib/errors.ts";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "../middleware/require-auth.ts";
import type { PublicUser, UserStatus } from "../types/user.ts";

interface RouteAuthParams {
  req: FastifyRequest;
}

type RouteAuthInput = FastifyRequest | RouteAuthParams;

export interface RouteAuthContext {
  user: PublicUser;
}

function resolveRequest(input: RouteAuthInput): FastifyRequest {
  const maybeParams = input as Partial<RouteAuthParams>;
  if (maybeParams.req) {
    return maybeParams.req;
  }
  return input as FastifyRequest;
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

function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function requireRouteUser(input: RouteAuthInput): Promise<RouteAuthContext> {
  const supabaseUser = readSupabaseUser(resolveRequest(input));
  if (!supabaseUser) {
    throw new HttpError(401, "AUTH_REQUIRED", "請先登入後再存取此功能。");
  }
  if (supabaseUser.status !== "active") {
    throw statusError(supabaseUser.status);
  }
  return { user: toPublicUser(supabaseUser) };
}

export async function requireRouteAdmin(input: RouteAuthInput): Promise<RouteAuthContext> {
  const context = await requireRouteUser(input);
  if (context.user.role !== "admin") {
    throw new HttpError(403, "ADMIN_REQUIRED", "此功能需要管理員權限。");
  }
  return context;
}

export async function requireRouteAdminUser(input: RouteAuthInput): Promise<RouteAuthContext> {
  return requireRouteAdmin(input);
}
