import { FixturePlatformAdapter } from "./fixture-platform-adapter.js";

export function createTiktokAdapter({ fixturesDir }) {
  return new FixturePlatformAdapter({
    platform: "tiktok",
    fixturesDir,
    getTimestamp(item) {
      return item.create_time;
    },
  });
}
