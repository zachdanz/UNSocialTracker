import { Platform } from "./types";

const RULES: [Platform, RegExp[]][] = [
  ["X", [/(^|\.)x\.com$/i, /(^|\.)twitter\.com$/i, /(^|\.)t\.co$/i]],
  ["Facebook", [/(^|\.)facebook\.com$/i, /(^|\.)fb\.watch$/i, /(^|\.)fb\.com$/i]],
  ["WhatsApp", [/(^|\.)whatsapp\.com$/i, /(^|\.)wa\.me$/i]],
  ["Instagram", [/(^|\.)instagram\.com$/i, /(^|\.)instagr\.am$/i]],
  ["LinkedIn", [/(^|\.)linkedin\.com$/i, /(^|\.)lnkd\.in$/i]],
  ["Threads", [/(^|\.)threads\.net$/i, /(^|\.)threads\.com$/i]],
  ["TikTok", [/(^|\.)tiktok\.com$/i]],
  ["VK", [/(^|\.)vk\.com$/i, /(^|\.)vk\.ru$/i, /(^|\.)vkontakte\.ru$/i]],
  ["Weibo", [/(^|\.)weibo\.com$/i, /(^|\.)weibo\.cn$/i]],
  ["Bilibili", [/(^|\.)bilibili\.com$/i, /(^|\.)b23\.tv$/i]],
  ["Kuaishou", [/(^|\.)kuaishou\.com$/i, /(^|\.)gifshow\.com$/i, /(^|\.)chenzhongtech\.com$/i]],
  ["WeChat", [/(^|\.)weixin\.qq\.com$/i, /(^|\.)wechat\.com$/i]],
];

export function detectPlatform(url: string): Platform | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const [platform, patterns] of RULES) {
    if (patterns.some((p) => p.test(host))) return platform;
  }
  return null;
}
