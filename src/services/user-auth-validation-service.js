import { HttpError } from "../lib/errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "VALIDATION_ERROR", `欄位 ${fieldName} 為必填。`);
  }

  return value.trim();
}

export function normalizeEmailAddress(email) {
  return requireString(email, "email").toLowerCase();
}

function validateEmail(email) {
  const normalizedEmail = normalizeEmailAddress(email);

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new HttpError(400, "VALIDATION_ERROR", "email 格式不正確。");
  }

  return normalizedEmail;
}

export function validatePassword(password, fieldName = "password") {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} 長度至少需要 ${MIN_PASSWORD_LENGTH} 個字元。`,
    );
  }

  return password;
}

export function validateRegisterPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const displayName = requireString(payload.display_name, "display_name");
  const email = validateEmail(payload.email);
  const password = validatePassword(payload.password);

  return {
    displayName,
    email,
    password,
  };
}

export function validateLoginPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  return {
    email: validateEmail(payload.email),
    password: requireString(payload.password, "password"),
  };
}

export function validateForgotPasswordPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  return {
    email: validateEmail(payload.email),
  };
}

export function validateResetPasswordPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  const token = requireString(payload.token, "token");
  const password = validatePassword(payload.password);

  return {
    token,
    password,
  };
}
