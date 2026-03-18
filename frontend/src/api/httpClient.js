export class HttpRequestError extends Error {
  constructor(message, { payload, status }) {
    super(message);
    this.name = "HttpRequestError";
    this.payload = payload;
    this.status = status;
  }
}

export async function requestJson(url, { signal } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
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
