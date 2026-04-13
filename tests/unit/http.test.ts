import test from "node:test";
import assert from "node:assert/strict";
import { readCookies, serializeCookie } from "../../backend/src/lib/http.ts";

test("readCookies tolerates malformed percent-encoding", () => {
  const cookies = readCookies({
    headers: {
      cookie: "session=%E0%A4%A; theme=dark",
    },
  });

  assert.deepEqual(cookies, {
    session: "%E0%A4%A",
    theme: "dark",
  });
});

test("serializeCookie rejects unsafe cookie paths", () => {
  assert.throws(
    () => serializeCookie("session", "value", { path: "/app;Secure" }),
    /Cookie path must start with '\//,
  );
});
