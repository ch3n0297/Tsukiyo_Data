import { requestJson } from "./httpClient";
import type { RequestJsonOptions } from "./httpClient";

export function getHealth(options?: RequestJsonOptions) {
  return requestJson("/health", options);
}

export function listAccounts(options?: RequestJsonOptions) {
  return requestJson("/api/v1/ui/accounts", options);
}

export function getAccountDetail(platform: string, accountId: string, options?: RequestJsonOptions) {
  return requestJson(
    `/api/v1/ui/accounts/${encodeURIComponent(platform)}/${encodeURIComponent(accountId)}`,
    options,
  );
}
