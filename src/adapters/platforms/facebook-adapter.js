import { FixturePlatformAdapter } from "./fixture-platform-adapter.js";

export function createFacebookAdapter({ fixturesDir }) {
  return new FixturePlatformAdapter({
    platform: "facebook",
    fixturesDir,
    getTimestamp(item) {
      return item.created_time;
    },
  });
}
