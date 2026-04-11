export class HttpRequestError extends Error {
  constructor(message, { payload, status }) {
    super(message);
    this.name = "HttpRequestError";
    this.payload = payload;
    this.status = status;
  }
}

export function resolveApiUrl(pathname) {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return normalizedPathname;
  }

  const normalizedBaseUrl = configuredBaseUrl.endsWith("/")
    ? configuredBaseUrl.slice(0, -1)
    : configuredBaseUrl;

  return `${normalizedBaseUrl}${normalizedPathname}`;
}

export async function requestJson(url, { body, headers, method = "GET", signal } = {}) {
  let response;

  try {
    response = await fetch(resolveApiUrl(url), {
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
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new HttpRequestError(
      "目前無法連線到後端服務，請先確認 backend API 是否已啟動。",
      {
        payload: null,
        status: 0,
      },
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HttpRequestError(payload.system_message ?? `請求失敗，狀態碼 ${response.status}。`, {
      payload,
      status: response.status,
    });
  }

  return payload;
}
