import { requestJson } from "./httpClient.js";

export function getCurrentUser(options) {
  return requestJson("/api/v1/auth/me", options);
}

export function registerUser(body, options) {
  return requestJson("/api/v1/auth/register", {
    ...options,
    body,
    method: "POST",
  });
}

export function loginUser(body, options) {
  return requestJson("/api/v1/auth/login", {
    ...options,
    body,
    method: "POST",
  });
}

export function logoutUser(options) {
  return requestJson("/api/v1/auth/logout", {
    ...options,
    method: "POST",
  });
}

export function requestPasswordReset(body, options) {
  return requestJson("/api/v1/auth/forgot-password", {
    ...options,
    body,
    method: "POST",
  });
}

export function resetPassword(body, options) {
  return requestJson("/api/v1/auth/reset-password", {
    ...options,
    body,
    method: "POST",
  });
}

export function startGoogleLogin(redirectTo = "/", options) {
  return requestJson("/api/v1/auth/google/start", {
    ...options,
    body: { redirect_to: redirectTo },
    method: "POST",
  });
}

export function listPendingUsers(options) {
  return requestJson("/api/v1/admin/pending-users", options);
}

export function approvePendingUser(userId, options) {
  return requestJson(`/api/v1/admin/pending-users/${encodeURIComponent(userId)}/approve`, {
    ...options,
    method: "POST",
  });
}

export function rejectPendingUser(userId, options) {
  return requestJson(`/api/v1/admin/pending-users/${encodeURIComponent(userId)}/reject`, {
    ...options,
    method: "POST",
  });
}
