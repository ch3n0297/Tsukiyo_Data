import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";

function buildSigningMessage(timestamp, rawBody) {
  return `${timestamp}.${rawBody}`;
}

export function signPayload({ sharedSecret, timestamp, rawBody }) {
  return crypto
    .createHmac("sha256", sharedSecret)
    .update(buildSigningMessage(timestamp, rawBody))
    .digest("hex");
}

export function verifySignedRequest({
  headers,
  rawBody,
  sharedSecret,
  allowedClientIds,
  signatureTtlMs,
  clock,
}) {
  const clientId = headers["x-client-id"];
  const timestamp = headers["x-timestamp"];
  const signature = headers["x-signature"];

  if (!clientId || !timestamp || !signature) {
    throw new HttpError(
      401,
      "AUTH_HEADERS_MISSING",
      "Missing x-client-id, x-timestamp, or x-signature header.",
    );
  }

  if (!allowedClientIds.includes(clientId)) {
    throw new HttpError(401, "CLIENT_NOT_ALLOWED", "Request source is not allowed.");
  }

  const requestTime = Date.parse(timestamp);
  if (Number.isNaN(requestTime)) {
    throw new HttpError(401, "INVALID_TIMESTAMP", "Request timestamp is invalid.");
  }

  const skew = Math.abs(clock().getTime() - requestTime);
  if (skew > signatureTtlMs) {
    throw new HttpError(401, "TIMESTAMP_EXPIRED", "Request timestamp is outside the allowed window.");
  }

  const expectedSignature = signPayload({
    sharedSecret,
    timestamp,
    rawBody,
  });

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new HttpError(401, "SIGNATURE_INVALID", "Request signature validation failed.");
  }

  return {
    clientId,
    timestamp,
  };
}
