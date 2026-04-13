import test from "node:test";
import assert from "node:assert/strict";
import { createLogger } from "../../backend/src/lib/logger.ts";

test("logger serializes circular context safely and preserves reserved fields", () => {
  const lines = [];
  const originalError = console.error;
  const circular = { level: "hijack", message: "hijack" };
  circular.self = circular;

  console.error = (line) => {
    lines.push(line);
  };

  try {
    const logger = createLogger();
    logger.error("real-message", circular);
  } finally {
    console.error = originalError;
  }

  assert.equal(lines.length, 1);

  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, "error");
  assert.equal(parsed.message, "real-message");
  assert.equal(parsed.context.level, "hijack");
  assert.equal(parsed.context.message, "hijack");
  assert.equal(parsed.context.self, "[Circular]");
});
