import { requestJson } from "./httpClient";
import type { RequestJsonOptions } from "./httpClient";

export function getCurrentUser(options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/me", options);
}

export function registerUser(body: unknown, options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/register", {
    ...options,
    body,
    method: "POST",
  });
}

export function loginUser(body: unknown, options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/login", {
    ...options,
    body,
    method: "POST",
  });
}

export function logoutUser(options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/logout", {
    ...options,
    method: "POST",
  });
}

export function requestPasswordReset(body: unknown, options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/forgot-password", {
    ...options,
    body,
    method: "POST",
  });
}

export function resetPassword(body: unknown, options?: RequestJsonOptions) {
  return requestJson("/api/v1/auth/reset-password", {
    ...options,
    body,
    method: "POST",
  });
}

export function listPendingUsers(options?: RequestJsonOptions) {
  return requestJson("/api/v1/admin/pending-users", options);
}

export function approvePendingUser(userId: string, options?: RequestJsonOptions) {
  return requestJson(`/api/v1/admin/pending-users/${encodeURIComponent(userId)}/approve`, {
    ...options,
    method: "POST",
  });
}

export function rejectPendingUser(userId: string, options?: RequestJsonOptions) {
  return requestJson(`/api/v1/admin/pending-users/${encodeURIComponent(userId)}/reject`, {
    ...options,
    method: "POST",
  });
}
