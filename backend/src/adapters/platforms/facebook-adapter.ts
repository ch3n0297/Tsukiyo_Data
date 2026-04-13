import { FixturePlatformAdapter } from "./fixture-platform-adapter.ts";
import type { PlatformAdapter } from "../../types/adapter.ts";

export function createFacebookAdapter({ fixturesDir }: { fixturesDir: string }): PlatformAdapter {
  return new FixturePlatformAdapter({
    platform: "facebook",
    fixturesDir,
    getTimestamp(item) {
      return (item as { created_time: string }).created_time;
    },
  });
}
