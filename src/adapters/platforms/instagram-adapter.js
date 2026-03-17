import { FixturePlatformAdapter } from "./fixture-platform-adapter.js";

export function createInstagramAdapter({ fixturesDir }) {
  return new FixturePlatformAdapter({
    platform: "instagram",
    fixturesDir,
    getTimestamp(item) {
      return item.timestamp;
    },
  });
}
