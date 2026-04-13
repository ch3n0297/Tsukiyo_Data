export class HttpRequestError extends Error {
  readonly name = "HttpRequestError" as const;
  readonly payload: unknown;
  readonly status: number;

  constructor(message: string, { payload, status }: { payload: unknown; status: number }) {
    super(message);
    this.payload = payload;
    this.status = status;
  }
}

function resolveApiUrl(pathname: string): string {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (!configuredBaseUrl) {
    return normalizedPathname;
  }

  const normalizedBaseUrl = configuredBaseUrl.endsWith("/")
    ? configuredBaseUrl.slice(0, -1)
    : configuredBaseUrl;

  return `${normalizedBaseUrl}${normalizedPathname}`;
}

export interface RequestJsonOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
  signal?: AbortSignal;
}

export async function requestJson(url: string, { body, headers, method = "GET", signal }: RequestJsonOptions = {}): Promise<unknown> {
  const response = await fetch(resolveApiUrl(url), {
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
    const p = payload as { system_message?: string };
    throw new HttpRequestError(p.system_message ?? `請求失敗，狀態碼 ${response.status}。`, {
      payload,
      status: response.status,
    });
  }

  return payload;
}
