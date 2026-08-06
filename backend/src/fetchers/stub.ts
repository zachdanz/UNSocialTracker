import { Platform } from "../platforms";
import { StatsFetcher } from "./types";

/**
 * Placeholder adapter used for every platform until real API credentials are
 * wired up. Swap this out per-platform (see fetchers/index.ts) once you have
 * a developer app / API key for that platform — the rest of the app already
 * calls through the StatsFetcher interface, so nothing else needs to change.
 */
export function makeStubFetcher(platform: Platform): StatsFetcher {
  return {
    platform,
    supportsAutoFetch: () => false,
    fetchStats: async () => {
      throw new Error(`Automatic stats fetching for ${platform} is not configured yet.`);
    },
  };
}
