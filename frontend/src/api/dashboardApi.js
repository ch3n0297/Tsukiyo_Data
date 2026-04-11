import { requestJson } from "./httpClient.js";

export function getHealth(options) {
  return requestJson("/health", options);
}

export function getContentOverview(options) {
  return requestJson("/api/v1/ui/content-overview", options);
}

export function listAccounts(options) {
  return requestJson("/api/v1/ui/accounts", options);
}

export function getAccountDetail(platform, accountId, options) {
  return requestJson(
    `/api/v1/ui/accounts/${encodeURIComponent(platform)}/${encodeURIComponent(accountId)}`,
    options,
  );
}
