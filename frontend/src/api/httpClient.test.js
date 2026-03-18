import { afterEach, expect, test, vi } from "vitest";
import { HttpRequestError, requestJson } from "./httpClient.js";

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
