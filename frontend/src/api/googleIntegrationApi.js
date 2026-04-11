import { requestJson } from "./httpClient.js";

export function startGoogleAuthorization(accountConfigId, redirectTo = "/", options) {
  return requestJson("/api/v1/integrations/google/start", {
    ...options,
    body: {
      account_config_id: accountConfigId,
      redirect_to: redirectTo,
    },
    method: "POST",
  });
}

export function getGoogleConnectionStatus(accountConfigId, options) {
  return requestJson(`/api/v1/integrations/google/connections/${encodeURIComponent(accountConfigId)}`, options);
}

export function disconnectGoogleConnection(accountConfigId, options) {
  return requestJson(
    `/api/v1/integrations/google/connections/${encodeURIComponent(accountConfigId)}/disconnect`,
    {
      ...options,
      method: "POST",
    },
  );
}
