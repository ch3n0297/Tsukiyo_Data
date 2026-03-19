export class HttpRequestError extends Error {
  constructor(message, { payload, status }) {
    super(message);
    this.name = "HttpRequestError";
    this.payload = payload;
    this.status = status;
  }
}

export async function requestJson(url, { body, headers, method = "GET", signal } = {}) {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    method,
    signal,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HttpRequestError(payload.system_message ?? `請求失敗，狀態碼 ${response.status}。`, {
      payload,
      status: response.status,
    });
  }

  return payload;
}
