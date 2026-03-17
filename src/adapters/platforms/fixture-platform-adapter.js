import { readFile } from "node:fs/promises";
import path from "node:path";

function filterByRefreshDays(items, now, refreshDays, getTimestamp) {
  const cutoff = now.getTime() - refreshDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => Date.parse(getTimestamp(item)) >= cutoff);
}

function createUpstreamError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export class FixturePlatformAdapter {
  constructor({ platform, fixturesDir, getTimestamp }) {
    this.platform = platform;
    this.fixturesDir = fixturesDir;
    this.getTimestamp = getTimestamp;
  }

  async fetchAccountContent({ accountConfig, refreshDays, now }) {
    const filename = path.join(
      this.fixturesDir,
      `${this.platform}--${accountConfig.accountId}.json`,
    );
    const content = await readFile(filename, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.error) {
      throw createUpstreamError(parsed.error.code, parsed.error.message);
    }

    return filterByRefreshDays(parsed.items ?? [], now, refreshDays, this.getTimestamp);
  }
}
