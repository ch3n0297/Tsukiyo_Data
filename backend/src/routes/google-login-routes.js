import { toErrorResponse } from "../lib/errors.js";
import {
  normalizeAppRedirectPath,
  readJsonRequest,
  redirectTo,
  requireTrustedBrowserOrigin,
  sendJson,
  setResponseCookie,
} from "../lib/http.js";

function buildFrontendRedirectUrl(config, { status, message, redirectTo: redirectPath }) {
  const origin =
    config.publicAppOrigin ?? config.frontendOrigins?.[0] ?? "http://127.0.0.1:5173";
  const url = new URL(redirectPath || "/", origin);
  url.searchParams.set("auth", "google");
  url.searchParams.set("auth_status", status);

  if (message) {
    url.searchParams.set("auth_message", message);
  }

  return url.toString();
}

export async function handleGoogleLoginStartRoute({ req, res, services, config }) {
  try {
    requireTrustedBrowserOrigin(req, config);
    const { body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const redirectToPath = normalizeAppRedirectPath(body?.redirect_to ?? body?.redirectTo ?? "/");
    const authorizationUrl = await services.googleOauthService.createLoginAuthorizationUrl({
      redirectTo: redirectToPath,
    });

    sendJson(res, 200, { authorization_url: authorizationUrl });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}

export async function handleGoogleLoginCallbackRoute({ req, res, services, config }) {
  try {
    const identity = await services.googleOauthService.completeLoginAuthorization({
      code: req.query?.code,
      error: req.query?.error,
      errorDescription: req.query?.error_description,
      state: req.query?.state,
    });

    const tenantKey = await services.googleLoginSettingsService.resolveTenantKeyForEmail(
      identity.email,
    );

    const result = await services.userAuthService.loginWithGoogleIdentity({
      displayName: identity.displayName,
      email: identity.email,
      googleSub: identity.googleSub,
      tenantKey,
    });

    setResponseCookie(res, services.userAuthService.createSessionCookie(result.session.id));

    redirectTo(
      res,
      302,
      buildFrontendRedirectUrl(config, {
        status: "success",
        message: "Google 登入成功。",
        redirectTo: identity.redirectTo,
      }),
    );
  } catch (error) {
    const response = toErrorResponse(error);
    const fallbackUrl = buildFrontendRedirectUrl(config, {
      status: "error",
      message: response.body.system_message,
      redirectTo: "/",
    });
    redirectTo(res, 302, fallbackUrl);
  }
}
