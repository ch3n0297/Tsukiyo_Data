import { HttpError } from "./errors.js";

export async function readJsonRequest(req, { maxBodyBytes = 1024 * 1024 } = {}) {
  const declaredLength = Number(req.headers?.["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new HttpError(
      413,
      "PAYLOAD_TOO_LARGE",
      `請求內容不得超過 ${maxBodyBytes} 位元組。`,
    );
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBodyBytes) {
      throw new HttpError(
        413,
        "PAYLOAD_TOO_LARGE",
        `請求內容不得超過 ${maxBodyBytes} 位元組。`,
      );
    }

    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody) {
    return { rawBody: "", body: {} };
  }

  try {
    return {
      rawBody,
      body: JSON.parse(rawBody),
    };
  } catch {
    throw new HttpError(400, "INVALID_JSON", "請求內容必須是有效的 JSON。");
  }
}

export function readCookies(req) {
  const cookieHeader = req.headers?.cookie;

  if (typeof cookieHeader !== "string" || cookieHeader.trim() === "") {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");

        if (index === -1) {
          return [part, ""];
        }

        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.httpOnly ?? true) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

export function setResponseCookie(res, cookieValue) {
  const current = res.getHeader("Set-Cookie");

  if (!current) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  const next = Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue];
  res.setHeader("Set-Cookie", next);
}

export function getRequestOrigin(req, fallbackOrigin = "http://127.0.0.1:3000") {
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  const forwardedHost = req.headers?.["x-forwarded-host"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const resolvedProtocol = typeof proto === "string" && proto !== "" ? proto : "http";
  const resolvedHost =
    typeof host === "string" && host !== ""
      ? host
      : typeof req.headers?.host === "string" && req.headers.host !== ""
        ? req.headers.host
        : null;

  if (!resolvedHost) {
    return fallbackOrigin;
  }

  return `${resolvedProtocol}://${resolvedHost}`;
}

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}
