import { toErrorResponse } from "../lib/errors.js";
import { sendJson } from "../lib/http.js";

export async function handleUiAccountsRoute({ res, services }) {
  try {
    const payload = await services.uiDashboardService.listAccounts();
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleUiAccountDetailRoute({ res, services, params }) {
  try {
    const payload = await services.uiDashboardService.getAccountDetail(params);
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
