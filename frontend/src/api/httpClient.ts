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

async function getSupabaseAuthHeader(): Promise<Record<string, string>> {
  // 動態 import 避免 Supabase URL 未設定時的初始化錯誤
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  if (!supabaseUrl) return {};

  try {
    const { supabase } = await import('../lib/supabase-client');
    if (!supabase) return {};
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (err) {
    // Supabase 未初始化或網路錯誤時降級為無 auth header（不中斷請求）
    console.warn('[httpClient] getSupabaseAuthHeader failed:', err);
  }
  return {};
}

export async function requestJson(url: string, { body, headers, method = "GET", signal }: RequestJsonOptions = {}): Promise<unknown> {
  const authHeaders = await getSupabaseAuthHeader();
  const response = await fetch(resolveApiUrl(url), {
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...authHeaders,
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
