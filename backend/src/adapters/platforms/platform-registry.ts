import { HttpError } from "../../lib/errors.ts";
import { createFacebookAdapter } from "./facebook-adapter.ts";
import { createInstagramAdapter } from "./instagram-adapter.ts";
import { createTiktokAdapter } from "./tiktok-adapter.ts";
import type { PlatformAdapter } from "../../types/adapter.ts";
import type { Platform } from "../../types/platform.ts";

export interface PlatformRegistry {
  get(platform: string): PlatformAdapter;
}

export function createPlatformRegistry({ fixturesDir }: { fixturesDir: string }): PlatformRegistry {
  const adapters = new Map<Platform, PlatformAdapter>([
    ["instagram", createInstagramAdapter({ fixturesDir })],
    ["facebook", createFacebookAdapter({ fixturesDir })],
    ["tiktok", createTiktokAdapter({ fixturesDir })],
  ]);

  return {
    get(platform: string): PlatformAdapter {
      if (!adapters.has(platform as Platform)) {
        throw new HttpError(400, "PLATFORM_UNSUPPORTED", `目前不支援的平台：${platform}`);
      }

      return adapters.get(platform as Platform)!;
    },
  };
}
