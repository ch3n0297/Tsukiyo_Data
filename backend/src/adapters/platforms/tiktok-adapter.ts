import { FixturePlatformAdapter } from "./fixture-platform-adapter.ts";
import type { PlatformAdapter } from "../../types/adapter.ts";

export function createTiktokAdapter({ fixturesDir }: { fixturesDir: string }): PlatformAdapter {
  return new FixturePlatformAdapter({
    platform: "tiktok",
    fixturesDir,
    getTimestamp(item) {
      return (item as { create_time: string }).create_time;
    },
  });
}
