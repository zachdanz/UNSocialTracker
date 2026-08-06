export const PLATFORMS = [
  "X",
  "Facebook",
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "Threads",
  "TikTok",
  "VK",
  "Weibo",
  "Bilibili",
  "Kuaishou",
  "WeChat",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export interface LanguageOption {
  code: string;
  label: string;
}

export interface Post {
  id: number;
  date: string;
  platform: Platform;
  link: string;
  isVideo: boolean;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
  totalVideoViews: number | null;
  language: string;
  lastUpdated: string;
}

export interface PlatformCapability {
  platform: Platform;
  supportsAutoFetch: boolean;
}

export interface Project {
  id: number;
  name: string;
  createdAt: string;
  postCount: number;
  totalEngagement: number;
}

export interface TotalsRow {
  language: string;
  numberPosts: number;
  likes: number;
  comments: number;
  shares: number;
  totalEngagements: number;
  numberOfVideos: number;
  totalViews: number;
}
