import { afterEach, expect, test, vi } from "vitest";
import { requestJson } from "./httpClient";

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("requestJson sends the Supabase session JWT as a bearer header", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:55321");
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: "signed-jwt" } },
    error: null,
  });

  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  await expect(requestJson("/api/v1/ui/accounts")).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/ui/accounts",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer signed-jwt",
      }),
    }),
  );
});
