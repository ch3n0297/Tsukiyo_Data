import { HttpError } from "../lib/errors.ts";
import { setResponseCookie } from "../lib/http.ts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Services } from "../types/app.ts";
import type { PublicUser } from "../types/user.ts";

interface RouteAuthContext {
  user: PublicUser;
  sessionId?: string;
}

function getSupabaseRequestUser(req: FastifyRequest): PublicUser | null {
  return req.user ?? null;
}

export async function requireRouteUser(
  req: FastifyRequest,
  services: Services,
): Promise<RouteAuthContext> {
  const supabaseUser = getSupabaseRequestUser(req);
  if (supabaseUser) {
    return { user: supabaseUser };
  }

  const context = await services.userAuthService.requireAuthenticatedUser(req);
  return { user: context.user, sessionId: context.session.id };
}

export async function requireRouteAdmin(
  req: FastifyRequest,
  services: Services,
): Promise<RouteAuthContext> {
  const supabaseUser = getSupabaseRequestUser(req);
  if (supabaseUser) {
    if (supabaseUser.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED", "此功能需要管理員權限。");
    }

    return { user: supabaseUser };
  }

  const context = await services.userAuthService.requireAdminUser(req);
  return { user: context.user, sessionId: context.session.id };
}

export function refreshLegacySessionCookie(
  res: FastifyReply,
  services: Services,
  authContext: RouteAuthContext,
): void {
  if (!authContext.sessionId) {
    return;
  }

  setResponseCookie(res, services.userAuthService.createSessionCookie(authContext.sessionId));
}
