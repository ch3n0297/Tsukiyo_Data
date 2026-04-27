import { toErrorResponse } from "../lib/errors.ts";
import { sendJson } from "../lib/http.ts";
import { refreshLegacySessionCookie, requireRouteUser } from "./route-auth.ts";
import type { RouteContext, RouteContextWithParams } from "../types/route.ts";

export async function handleUiAccountsRoute({ req, res, services }: RouteContext): Promise<void> {
  try {
    const context = await requireRouteUser(req, services);
    refreshLegacySessionCookie(res, services, context);
    const payload = await services.uiDashboardService.listAccounts();
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleUiAccountDetailRoute({ req, res, services, params }: RouteContextWithParams): Promise<void> {
  try {
    const context = await requireRouteUser(req, services);
    refreshLegacySessionCookie(res, services, context);
    const payload = await services.uiDashboardService.getAccountDetail({
      platform: params.platform,
      accountId: params.accountId,
    });
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
