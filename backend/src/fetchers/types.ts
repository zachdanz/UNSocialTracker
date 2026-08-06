import { Platform } from "../platforms";

export interface FetchedStats {
  isVideo?: boolean;
  likes?: number;
  comments?: number;
  shares?: number;
  videoViews?: number;
}

export interface StatsFetcher {
  platform: Platform;
  /** Whether this adapter can currently fetch real stats (i.e. credentials are configured). */
  supportsAutoFetch(): boolean;
  /** Attempt to fetch stats. Only called when supportsAutoFetch() is true. */
  fetchStats(url: string): Promise<FetchedStats>;
}
