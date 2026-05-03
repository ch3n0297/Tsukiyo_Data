import { HttpError, toErrorResponse } from "../lib/errors.ts";
import { readJsonRequest, sendJson } from "../lib/http.ts";
import { requireRouteAdmin, requireRouteUser } from "./route-auth.ts";
import type { AuthUser } from "../middleware/require-auth.ts";
import type { RouteContext, RouteContextWithParams } from "../types/route.ts";

function readAuthUser(req: RouteContext["req"]): AuthUser {
  const user = req.user;
  if (!user) {
    throw new HttpError(401, "AUTH_REQUIRED", "請先登入後再存取此功能。");
  }
  return user;
}

function readOptionalDisplayName(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const payload = body as Record<string, unknown>;
  for (const forbiddenKey of ["email", "external_user_id", "password", "role", "status"]) {
    if (forbiddenKey in payload) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "註冊同步只能接收 display_name，身份與授權資料必須由 Supabase JWT 取得。",
      );
    }
  }
  const value = payload.display_name ?? payload.displayName;
  return typeof value === "string" ? value.trim() : undefined;
}

function sendLegacyRemoved(res: RouteContext["res"]): void {
  sendJson(res, 410, {
    error: "LEGACY_AUTH_REMOVED",
    system_message: "此舊版認證端點已停用，請使用 Supabase Auth 流程。",
  });
}

export async function handleRegisterRoute({ req, res, services, config }: RouteContext): Promise<void> {
  try {
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const user = await services.userApprovalService.syncSignup({
      authUser: readAuthUser(req),
      displayName: readOptionalDisplayName(body),
    });

    sendJson(res, 201, {
      status: "pending",
      system_message: "註冊申請已送出，待管理員核准後即可登入。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleLoginRoute({ res }: RouteContext): Promise<void> {
  sendLegacyRemoved(res);
}

export async function handleLogoutRoute({ res }: RouteContext): Promise<void> {
  sendJson(res, 200, {
    system_message: "已成功登出。",
  });
}

export async function handleCurrentUserRoute({ req, res, services }: RouteContext): Promise<void> {
  try {
    await requireRouteUser({ req });
    const user = await services.userApprovalService.getCurrentUser(readAuthUser(req));
    sendJson(res, 200, {
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleForgotPasswordRoute({ res }: RouteContext): Promise<void> {
  sendLegacyRemoved(res);
}

export async function handleResetPasswordRoute({ res }: RouteContext): Promise<void> {
  sendLegacyRemoved(res);
}

export async function handlePendingUsersRoute({ req, res, services }: RouteContext): Promise<void> {
  try {
    await requireRouteAdmin({ req });
    const users = await services.userApprovalService.listPendingUsers();
    sendJson(res, 200, {
      users,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleApproveUserRoute({ req, res, services, params }: RouteContextWithParams): Promise<void> {
  try {
    const context = await requireRouteAdmin({ req });
    const user = await services.userApprovalService.approveUser({
      targetUserId: params.userId,
      adminUser: context.user,
    });

    sendJson(res, 200, {
      system_message: "已核准該使用者。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleRejectUserRoute({ req, res, services, params }: RouteContextWithParams): Promise<void> {
  try {
    const context = await requireRouteAdmin({ req });
    const user = await services.userApprovalService.rejectUser({
      targetUserId: params.userId,
      adminUser: context.user,
    });

    sendJson(res, 200, {
      system_message: "已拒絕該使用者的註冊申請。",
      user,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
