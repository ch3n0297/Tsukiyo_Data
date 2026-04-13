import type { FastifyRequest, FastifyReply } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "./errors.ts";

const INVALID_COOKIE_PATH_PATTERN = /[\u0000-\u001f\u007f;\r\n]/;

// AnyRequest covers both Fastify request (has .body) and Node.js IncomingMessage (async iterable)
export type AnyRequest = FastifyRequest | IncomingMessage;

// AnyReply covers both Fastify reply (has .code/.send) and Node.js ServerResponse
export type AnyReply = FastifyReply | ServerResponse;

export interface SerializeCookieOptions {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  sameSite?: string;
  secure?: boolean;
}

export interface ReadJsonRequestOptions {
  maxBodyBytes?: number;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCookiePath(pathValue: unknown): string {
  if (typeof pathValue !== "string") {
    throw new TypeError("Cookie path must be a string.");
  }

  if (!pathValue.startsWith("/") || INVALID_COOKIE_PATH_PATTERN.test(pathValue)) {
    throw new TypeError("Cookie path must start with '/' and may not contain control characters or ';'.");
  }

  return pathValue;
}

export async function readJsonRequest(
  req: AnyRequest,
  { maxBodyBytes = 1024 * 1024 }: ReadJsonRequestOptions = {}
): Promise<{ rawBody: string; body: unknown }> {
  // as any: AnyRequest is FastifyRequest | IncomingMessage union;
  // properties like .body and .rawBody only exist on FastifyRequest but are guarded
  // by runtime checks ("body" in req). TypeScript's union type can't express this.
  const anyReq = req as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (
    req &&
    typeof req === "object" &&
    "body" in req &&
    !(Symbol.asyncIterator in req)
  ) {
    const body = anyReq.body ?? {};
    const rawBody =
      typeof anyReq.rawBody === "string"
        ? anyReq.rawBody
        : body && Object.keys(body).length > 0
          ? JSON.stringify(body)
          : "";

    return { rawBody, body };
  }

  const headers = anyReq.headers as Record<string, string | string[] | undefined> | undefined;
  const declaredLength = Number(headers?.["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new HttpError(
      413,
      "PAYLOAD_TOO_LARGE",
      `請求內容不得超過 ${maxBodyBytes} 位元組。`,
    );
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req as AsyncIterable<Buffer>) {
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

export function readCookies(req: AnyRequest): Record<string, string> {
  const anyReq = req as any;
  const cookieHeader = anyReq.headers?.cookie;

  if (typeof cookieHeader !== "string" || cookieHeader.trim() === "") {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part: string) => part.trim())
      .filter(Boolean)
      .map((part: string) => {
        const index = part.indexOf("=");

        if (index === -1) {
          return [part, ""];
        }

        return [part.slice(0, index), decodeCookieValue(part.slice(index + 1))];
      }),
  );
}

export function serializeCookie(
  name: string,
  value: string,
  options: SerializeCookieOptions = {}
): string {
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

export function setResponseCookie(res: AnyReply, cookieValue: string): void {
  const anyRes = res as any;

  if (typeof anyRes.header === "function") {
    const current = anyRes.getHeader?.("set-cookie");
    const next = current
      ? Array.isArray(current)
        ? [...current, cookieValue]
        : [current, cookieValue]
      : cookieValue;
    anyRes.header("set-cookie", next);
    return;
  }

  const nodeRes = res as ServerResponse;
  const current = nodeRes.getHeader("Set-Cookie");

  if (!current) {
    nodeRes.setHeader("Set-Cookie", cookieValue);
    return;
  }

  const next = Array.isArray(current) ? [...current, cookieValue] : [current as string, cookieValue];
  nodeRes.setHeader("Set-Cookie", next);
}

export function getRequestOrigin(req: AnyRequest, fallbackOrigin?: string): string | undefined {
  const anyReq = req as any;
  const headers = anyReq.headers as Record<string, string | string[] | undefined> | undefined;
  const forwardedProto = headers?.["x-forwarded-proto"];
  const forwardedHost = headers?.["x-forwarded-host"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const resolvedProtocol = typeof proto === "string" && proto !== "" ? proto : "http";
  const resolvedHost =
    typeof host === "string" && host !== ""
      ? host
      : typeof headers?.host === "string" && headers.host !== ""
        ? headers.host
        : null;

  if (!resolvedHost) {
    return fallbackOrigin;
  }

  return `${resolvedProtocol}://${resolvedHost}`;
}

export function sendJson(res: AnyReply, statusCode: number, payload: unknown): void {
  const anyRes = res as any;

  if (typeof anyRes.code === "function" && typeof anyRes.send === "function") {
    anyRes.header("x-content-type-options", "nosniff");
    anyRes.code(statusCode).send(payload);
    return;
  }

  const nodeRes = res as ServerResponse;
  const body = JSON.stringify(payload);
  nodeRes.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
  });
  nodeRes.end(body);
}
