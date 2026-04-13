import { FixturePlatformAdapter } from "./fixture-platform-adapter.ts";
import type { PlatformAdapter } from "../../types/adapter.ts";

export function createInstagramAdapter({ fixturesDir }: { fixturesDir: string }): PlatformAdapter {
  return new FixturePlatformAdapter({
    platform: "instagram",
    fixturesDir,
    getTimestamp(item) {
      return (item as { timestamp: string }).timestamp;
    },
  });
}
