import test from "node:test";
import assert from "node:assert/strict";
import { signPayload, verifySignedRequest } from "../../src/services/auth-service.js";

test("verifySignedRequest accepts valid HMAC signatures", () => {
  const rawBody = JSON.stringify({ requested_by: "unit-test" });
  const timestamp = "2026-03-18T00:00:00.000Z";
  const signature = signPayload({
    sharedSecret: "local-dev-secret",
    timestamp,
    rawBody,
  });

  const result = verifySignedRequest({
    headers: {
      "x-client-id": "demo-sheet",
      "x-timestamp": timestamp,
      "x-signature": signature,
    },
    rawBody,
    sharedSecret: "local-dev-secret",
    allowedClientIds: ["demo-sheet"],
    signatureTtlMs: 5 * 60 * 1000,
    clock: () => new Date(timestamp),
  });

  assert.equal(result.clientId, "demo-sheet");
});

test("verifySignedRequest rejects invalid signatures", () => {
  const rawBody = JSON.stringify({ requested_by: "unit-test" });

  assert.throws(
    () =>
      verifySignedRequest({
        headers: {
          "x-client-id": "demo-sheet",
          "x-timestamp": "2026-03-18T00:00:00.000Z",
          "x-signature": "bad-signature",
        },
        rawBody,
        sharedSecret: "local-dev-secret",
        allowedClientIds: ["demo-sheet"],
        signatureTtlMs: 5 * 60 * 1000,
        clock: () => new Date("2026-03-18T00:00:00.000Z"),
      }),
    /validation failed/i,
  );
});
