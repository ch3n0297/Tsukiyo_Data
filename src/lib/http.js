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

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}
