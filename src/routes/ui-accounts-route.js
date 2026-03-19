import { toErrorResponse } from "../lib/errors.js";
import { sendJson, setResponseCookie } from "../lib/http.js";

export async function handleUiAccountsRoute({ req, res, services }) {
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

export async function handleUiAccountDetailRoute({ req, res, services, params }) {
  try {
    const context = await services.userAuthService.requireAuthenticatedUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const payload = await services.uiDashboardService.getAccountDetail(params);
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
