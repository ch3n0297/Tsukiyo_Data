import { afterEach, expect, test, vi } from "vitest";
import { HttpRequestError, requestJson } from "./httpClient";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("requestJson wraps non-2xx responses with readable errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ system_message: "權限不足" }), {
        headers: {
          "content-type": "application/json",
        },
        status: 401,
      }),
    ),
  );

  await expect(requestJson("/api/v1/ui/accounts")).rejects.toBeInstanceOf(HttpRequestError);
  await expect(requestJson("/api/v1/ui/accounts")).rejects.toMatchObject({
    message: "權限不足",
    status: 401,
  });
});

test("requestJson normalizes urls that do not start with a slash", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  await expect(requestJson("api/v1/auth/me")).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/auth/me",
    expect.objectContaining({
      method: "GET",
    }),
  );
});
