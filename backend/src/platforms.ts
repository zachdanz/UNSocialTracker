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

interface PlatformRule {
  platform: Platform;
  hostPatterns: RegExp[];
}

// Order matters: more specific hosts are checked before more general ones.
const RULES: PlatformRule[] = [
  { platform: "X", hostPatterns: [/(^|\.)x\.com$/i, /(^|\.)twitter\.com$/i, /(^|\.)t\.co$/i] },
  { platform: "Facebook", hostPatterns: [/(^|\.)facebook\.com$/i, /(^|\.)fb\.watch$/i, /(^|\.)fb\.com$/i] },
  { platform: "WhatsApp", hostPatterns: [/(^|\.)whatsapp\.com$/i, /(^|\.)wa\.me$/i] },
  { platform: "Instagram", hostPatterns: [/(^|\.)instagram\.com$/i, /(^|\.)instagr\.am$/i] },
  { platform: "LinkedIn", hostPatterns: [/(^|\.)linkedin\.com$/i, /(^|\.)lnkd\.in$/i] },
  { platform: "Threads", hostPatterns: [/(^|\.)threads\.net$/i, /(^|\.)threads\.com$/i] },
  { platform: "TikTok", hostPatterns: [/(^|\.)tiktok\.com$/i] },
  { platform: "VK", hostPatterns: [/(^|\.)vk\.com$/i, /(^|\.)vk\.ru$/i, /(^|\.)vkontakte\.ru$/i] },
  { platform: "Weibo", hostPatterns: [/(^|\.)weibo\.com$/i, /(^|\.)weibo\.cn$/i] },
  { platform: "Bilibili", hostPatterns: [/(^|\.)bilibili\.com$/i, /(^|\.)b23\.tv$/i] },
  { platform: "Kuaishou", hostPatterns: [/(^|\.)kuaishou\.com$/i, /(^|\.)gifshow\.com$/i, /(^|\.)chenzhongtech\.com$/i] },
  { platform: "WeChat", hostPatterns: [/(^|\.)weixin\.qq\.com$/i, /(^|\.)wechat\.com$/i] },
];

export function detectPlatform(url: string): Platform | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const rule of RULES) {
    if (rule.hostPatterns.some((pattern) => pattern.test(host))) {
      return rule.platform;
    }
  }
  return null;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
