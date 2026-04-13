import { HttpError } from "../lib/errors.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "VALIDATION_ERROR", `欄位 ${fieldName} 為必填。`);
  }

  return value.trim();
}

export function normalizeEmailAddress(email: unknown): string {
  return requireString(email, "email").toLowerCase();
}

function validateEmail(email: unknown): string {
  const normalizedEmail = normalizeEmailAddress(email);

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new HttpError(400, "VALIDATION_ERROR", "email 格式不正確。");
  }

  return normalizedEmail;
}

export function validatePassword(password: unknown, fieldName = "password"): string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} 長度至少需要 ${MIN_PASSWORD_LENGTH} 個字元。`,
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} 長度不得超過 ${MAX_PASSWORD_LENGTH} 個字元。`,
    );
  }

  return password;
}

function validatePasswordForAuthentication(password: unknown, fieldName = "password"): string {
  const normalizedPassword = requireString(password, fieldName);

  if (normalizedPassword.length > MAX_PASSWORD_LENGTH) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} 長度不得超過 ${MAX_PASSWORD_LENGTH} 個字元。`,
    );
  }

  return normalizedPassword;
}

export interface RegisterPayload {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export function validateRegisterPayload(payload: unknown): RegisterPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const p = payload as Record<string, unknown>;
  const displayName = requireString(p.display_name, "display_name");
  const email = validateEmail(p.email);
  const password = validatePassword(p.password);

  return { displayName, email, password };
}

export function validateLoginPayload(payload: unknown): LoginPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const p = payload as Record<string, unknown>;
  return {
    email: validateEmail(p.email),
    password: validatePasswordForAuthentication(p.password, "password"),
  };
}

export function validateForgotPasswordPayload(payload: unknown): ForgotPasswordPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const p = payload as Record<string, unknown>;
  return { email: validateEmail(p.email) };
}

export function validateResetPasswordPayload(payload: unknown): ResetPasswordPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const p = payload as Record<string, unknown>;
  const token = requireString(p.token, "token");
  const password = validatePassword(p.password);

  return { token, password };
}
