import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PlatformAdapter, FetchAccountContentParams } from "../../types/adapter.ts";
import type { Platform } from "../../types/platform.ts";

interface FixturePlatformAdapterOptions {
  platform: Platform;
  fixturesDir: string;
  getTimestamp(item: unknown): string | number;
}

function filterByRefreshDays(
  items: unknown[],
  now: Date,
  refreshDays: number,
  getTimestamp: (item: unknown) => string | number
): unknown[] {
  const cutoff = now.getTime() - refreshDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => Date.parse(String(getTimestamp(item))) >= cutoff);
}

function createUpstreamError(code: string, message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

export class FixturePlatformAdapter implements PlatformAdapter {
  readonly platform: Platform;
  readonly fixturesDir: string;
  readonly getTimestamp: (item: unknown) => string | number;

  constructor({ platform, fixturesDir, getTimestamp }: FixturePlatformAdapterOptions) {
    this.platform = platform;
    this.fixturesDir = fixturesDir;
    this.getTimestamp = getTimestamp;
  }

  async fetchAccountContent({ accountConfig, refreshDays, now }: FetchAccountContentParams): Promise<unknown[]> {
    const filename = path.join(
      this.fixturesDir,
      `${this.platform}--${accountConfig.accountId}.json`,
    );
    const content = await readFile(filename, "utf8");
    const parsed = JSON.parse(content) as { error?: { code: string; message: string }; items?: unknown[] };

    if (parsed.error) {
      throw createUpstreamError(parsed.error.code, parsed.error.message);
    }

    return filterByRefreshDays(parsed.items ?? [], now, refreshDays, this.getTimestamp);
  }
}
