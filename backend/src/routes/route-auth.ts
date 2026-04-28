import { HttpError } from "../lib/errors.ts";
import { setResponseCookie } from "../lib/http.ts";
import { sanitizeUser } from "../services/user-auth-service.ts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser } from "../middleware/require-auth.ts";
import type { Services } from "../types/app.ts";
import type { PublicUser, UserStatus } from "../types/user.ts";

interface RouteAuthParams {
  req: FastifyRequest;
  services: Services;
}

type RouteAuthInput = FastifyRequest | RouteAuthParams;

export interface RouteAuthContext {
  user: PublicUser;
  sessionCookie?: string;
  sessionId?: string;
}

function resolveParams(input: RouteAuthInput, services?: Services): RouteAuthParams {
  if ("req" in input && "services" in input) {
    return input;
  }

  if (!services) {
    throw new Error("Route auth services are required.");
  }

  return {
    req: input,
    services,
  };
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
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    lastLoginAt: user.lastLoginAt,
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

export async function requireRouteUser(params: RouteAuthParams): Promise<RouteAuthContext>;
export async function requireRouteUser(
  req: FastifyRequest,
  services: Services,
): Promise<RouteAuthContext>;
export async function requireRouteUser(
  input: RouteAuthInput,
  services?: Services,
): Promise<RouteAuthContext> {
  const { req, services: resolvedServices } = resolveParams(input, services);
  const supabaseUser = readSupabaseUser(req);

  if (supabaseUser) {
    const user = await resolveSupabaseUser(resolvedServices, supabaseUser);
    assertActiveUser(user);
    return { user };
  }

  const context = await resolvedServices.userAuthService.requireAuthenticatedUser(req);
  const sessionCookie = resolvedServices.userAuthService.createSessionCookie(context.session.id);
  return {
    user: context.user,
    sessionCookie,
    sessionId: context.session.id,
  };
}

export async function requireRouteAdmin(params: RouteAuthParams): Promise<RouteAuthContext>;
export async function requireRouteAdmin(
  req: FastifyRequest,
  services: Services,
): Promise<RouteAuthContext>;
export async function requireRouteAdmin(
  input: RouteAuthInput,
  services?: Services,
): Promise<RouteAuthContext> {
  const context = await requireRouteUser(input as FastifyRequest, services as Services);

  if (context.user.role !== "admin") {
    throw new HttpError(403, "ADMIN_REQUIRED", "此功能需要管理員權限。");
  }

  return context;
}

export async function requireRouteAdminUser(
  params: RouteAuthParams,
): Promise<RouteAuthContext> {
  return requireRouteAdmin(params);
}

export function refreshLegacySessionCookie(
  res: FastifyReply,
  services: Services,
  authContext: RouteAuthContext,
): void {
  const cookie = authContext.sessionCookie ??
    (authContext.sessionId
      ? services.userAuthService.createSessionCookie(authContext.sessionId)
      : undefined);

  if (!cookie) {
    return;
  }

  setResponseCookie(res, cookie);
}
