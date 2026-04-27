import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseCurrentUser } from "./authApi";

const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("../lib/supabase-client", () => ({
  supabase: { auth: mockAuth },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("getSupabaseCurrentUser treats a missing session as logged out", async () => {
  mockAuth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  await expect(getSupabaseCurrentUser()).resolves.toBeNull();
  expect(mockAuth.getUser).not.toHaveBeenCalled();
});
