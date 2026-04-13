import { toErrorResponse } from "../lib/errors.ts";
import { sendJson, setResponseCookie } from "../lib/http.ts";
import type { RouteContext, RouteContextWithParams } from "../types/route.ts";

export async function handleUiAccountsRoute({ req, res, services }: RouteContext): Promise<void> {
  try {
    const context = await services.userAuthService.requireAuthenticatedUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const payload = await services.uiDashboardService.listAccounts();
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleUiAccountDetailRoute({ req, res, services, params }: RouteContextWithParams): Promise<void> {
  try {
    const context = await services.userAuthService.requireAuthenticatedUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
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
