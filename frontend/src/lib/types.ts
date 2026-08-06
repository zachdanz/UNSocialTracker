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
  rowNumber: number;
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
