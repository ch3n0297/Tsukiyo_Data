import { HttpError } from "./errors.js";

const INVALID_COOKIE_PATH_PATTERN = /[\u0000-\u001f\u007f;\r\n]/;

function decodeCookieValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCookiePath(pathValue) {
  if (typeof pathValue !== "string") {
    throw new TypeError("Cookie path must be a string.");
  }

  if (!pathValue.startsWith("/") || INVALID_COOKIE_PATH_PATTERN.test(pathValue)) {
    throw new TypeError("Cookie path must start with '/' and may not contain control characters or ';'.");
  }

  return pathValue;
}

export async function readJsonRequest(req, { maxBodyBytes = 1024 * 1024 } = {}) {
  if (
    req &&
    typeof req === "object" &&
    "body" in req &&
    !(Symbol.asyncIterator in req)
  ) {
    const body = req.body ?? {};
    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : body && Object.keys(body).length > 0
          ? JSON.stringify(body)
        : "";

    return { rawBody, body };
  }

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

        return [part.slice(0, index), decodeCookieValue(part.slice(index + 1))];
      }),
  );
}

export function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.path) {
    segments.push(`Path=${normalizeCookiePath(options.path)}`);
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
  if (typeof res.header === "function") {
    const current = res.getHeader?.("set-cookie");
    const next = current
      ? Array.isArray(current)
        ? [...current, cookieValue]
        : [current, cookieValue]
      : cookieValue;
    res.header("set-cookie", next);
    return;
  }

  const current = res.getHeader("Set-Cookie");

  if (!current) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  const next = Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue];
  res.setHeader("Set-Cookie", next);
}

export function getRequestOrigin(req, fallbackOrigin) {
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
  if (typeof res.code === "function" && typeof res.send === "function") {
    res.header("x-content-type-options", "nosniff");
    res.code(statusCode).send(payload);
    return;
  }

  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}
