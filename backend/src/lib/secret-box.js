import crypto from "node:crypto";

function deriveKey(secret) {
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new TypeError("A non-empty token encryption secret is required.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value, secret) {
  if (typeof value !== "string" || value === "") {
    throw new TypeError("Only non-empty string secrets can be encrypted.");
  }

  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.from(
    JSON.stringify({
      alg: "aes-256-gcm",
      iv: iv.toString("base64url"),
      tag: authTag.toString("base64url"),
      data: ciphertext.toString("base64url"),
    }),
    "utf8",
  ).toString("base64url");
}

export function decryptSecret(payload, secret) {
  if (typeof payload !== "string" || payload === "") {
    throw new TypeError("An encrypted payload string is required.");
  }

  const key = deriveKey(secret);
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

  if (decoded?.alg !== "aes-256-gcm") {
    throw new TypeError("Unsupported encrypted payload format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(decoded.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(decoded.tag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(decoded.data, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
