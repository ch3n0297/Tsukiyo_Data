import crypto from "node:crypto";
import { HttpError } from "../lib/errors.ts";

function buildSigningMessage(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

function readHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

export interface SignPayloadParams {
  sharedSecret: string;
  timestamp: string;
  rawBody: string;
}

export function signPayload({ sharedSecret, timestamp, rawBody }: SignPayloadParams): string {
  return crypto
    .createHmac("sha256", sharedSecret)
    .update(buildSigningMessage(timestamp, rawBody))
    .digest("hex");
}

export interface VerifySignedRequestParams {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  sharedSecret: string;
  allowedClientIds: string[];
  signatureTtlMs: number;
  clock: () => Date;
}

export function verifySignedRequest({
  headers,
  rawBody,
  sharedSecret,
  allowedClientIds,
  signatureTtlMs,
  clock,
}: VerifySignedRequestParams): { clientId: string; timestamp: string } {
  if (typeof sharedSecret !== "string" || sharedSecret.trim() === "") {
    throw new HttpError(500, "AUTH_CONFIG_INVALID", "伺服器尚未設定簽章密鑰。");
  }

  const normalizedClientIds = Array.isArray(allowedClientIds)
    ? allowedClientIds.filter((clientId) => typeof clientId === "string" && clientId.trim() !== "")
    : [];

  if (normalizedClientIds.length === 0) {
    throw new HttpError(500, "AUTH_CONFIG_INVALID", "伺服器尚未設定允許的 client ID。");
  }

  const clientId = readHeaderValue(headers["x-client-id"]);
  const timestamp = readHeaderValue(headers["x-timestamp"]);
  const signature = readHeaderValue(headers["x-signature"]);

  if (!clientId || !timestamp || !signature) {
    throw new HttpError(
      401,
      "AUTH_HEADERS_MISSING",
      "缺少 x-client-id、x-timestamp 或 x-signature 驗證標頭。",
    );
  }

  if (!normalizedClientIds.includes(clientId)) {
    throw new HttpError(401, "CLIENT_NOT_ALLOWED", "目前的請求來源未被允許。");
  }

  const requestTime = Date.parse(timestamp);
  if (Number.isNaN(requestTime)) {
    throw new HttpError(401, "INVALID_TIMESTAMP", "請求時間格式無效。");
  }

  const skew = Math.abs(clock().getTime() - requestTime);
  if (skew > signatureTtlMs) {
    throw new HttpError(401, "TIMESTAMP_EXPIRED", "請求時間已超出允許的驗證時效。");
  }

  const expectedSignature = signPayload({ sharedSecret, timestamp, rawBody });

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new HttpError(401, "SIGNATURE_INVALID", "請求簽章驗證失敗。");
  }

  return { clientId, timestamp };
}
