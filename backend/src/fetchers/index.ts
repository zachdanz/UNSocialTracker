import { PLATFORMS, Platform } from "../platforms";
import { StatsFetcher } from "./types";
import { makeStubFetcher } from "./stub";

// Registry of one adapter per platform. Every platform starts on the stub
// adapter (manual entry only). To enable auto-fetch for a platform:
//   1. Implement a StatsFetcher for it in this folder (e.g. meta.ts for
//      Facebook/Instagram using the Graph API).
//   2. Replace its entry below with the real adapter.
//   3. Add any required API keys to config.ts / .env.
const registry: Record<Platform, StatsFetcher> = PLATFORMS.reduce(
  (acc, platform) => {
    acc[platform] = makeStubFetcher(platform);
    return acc;
  },
  {} as Record<Platform, StatsFetcher>
);

export function getFetcher(platform: Platform): StatsFetcher {
  return registry[platform];
}

export function listCapabilities(): { platform: Platform; supportsAutoFetch: boolean }[] {
  return PLATFORMS.map((platform) => ({
    platform,
    supportsAutoFetch: registry[platform].supportsAutoFetch(),
  }));
}
