import { toErrorResponse } from "../lib/errors.js";
import {
  normalizeAppRedirectPath,
  readJsonRequest,
  redirectTo,
  requireTrustedBrowserOrigin,
  sendJson,
  setResponseCookie,
} from "../lib/http.js";

function resolveFallbackRedirect(config, systemMessage) {
  const target = new URL(config.publicAppOrigin ?? config.frontendOrigins?.[0] ?? "http://127.0.0.1:5173/");
  target.searchParams.set("integration", "google");
  target.searchParams.set("integration_status", "error");
  target.searchParams.set("integration_message", systemMessage);
  return target.toString();
}

export async function handleGoogleAuthorizationStartRoute({ req, res, services, config }) {
  try {
    requireTrustedBrowserOrigin(req, config);
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const accountConfigId = body?.account_config_id ?? body?.accountConfigId;
    const redirectToPath = normalizeAppRedirectPath(body?.redirect_to ?? body?.redirectTo ?? "/");
    const authorizationUrl = await services.googleOauthService.createAuthorizationUrl({
      accountConfigId,
      actorUser: context.user,
      redirectTo: redirectToPath,
    });

    sendJson(res, 200, {
      authorization_url: authorizationUrl,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleGoogleAuthorizationCallbackRoute({ req, res, services, config }) {
  try {
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const result = await services.googleOauthService.completeAuthorization({
      actorUser: context.user,
      code: req.query?.code,
      error: req.query?.error,
      errorDescription: req.query?.error_description,
      state: req.query?.state,
    });

    redirectTo(
      res,
      302,
      services.googleOauthService.buildCallbackRedirectUrl({
        accountConfigId: result.accountConfigId,
        redirectTo: result.redirectTo,
        status: "success",
        systemMessage: "Google Spreadsheet 授權連線已建立。",
      }),
    );
  } catch (error) {
    const response = toErrorResponse(error);
    redirectTo(res, 302, resolveFallbackRedirect(config, response.body.system_message));
  }
}

export async function handleGoogleConnectionStatusRoute({ req, res, services, params }) {
  try {
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    const payload = await services.googleOauthService.getConnectionSummary({
      accountConfigId: params.accountConfigId,
      actorUser: context.user,
    });
    sendJson(res, 200, payload);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleGoogleConnectionDisconnectRoute({ req, res, services, params }) {
  try {
    requireTrustedBrowserOrigin(req, services.userAuthService.config);
    const context = await services.userAuthService.requireAdminUser(req);
    setResponseCookie(res, services.userAuthService.createSessionCookie(context.session.id));
    await services.googleOauthService.disconnectConnection({
      accountConfigId: params.accountConfigId,
      actorUser: context.user,
    });
    sendJson(res, 200, {
      system_message: "Google 授權連線已解除。",
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
