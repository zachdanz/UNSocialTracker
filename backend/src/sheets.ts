import { google, sheets_v4 } from "googleapis";
import { config } from "./config";
import { Platform } from "./platforms";
import { LanguageCode, TOTALS_ROW_ORDER } from "./languages";

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
  language: LanguageCode;
  lastUpdated: string;
}

export interface PostInput {
  date: string;
  platform: Platform;
  link: string;
  isVideo: boolean;
  likes: number;
  comments: number;
  shares: number;
  totalVideoViews: number | null;
  language: LanguageCode;
}

const POSTS_SHEET = "Posts";
const TOTALS_SHEET = "TOTALS";
const POSTS_HEADERS = [
  "Date",
  "Platform",
  "Link",
  "Video?",
  "Likes",
  "Comments",
  "Shares",
  "Total Engagement",
  "Total Video Views",
  "Language",
  "Last Updated",
];

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (client) return client;
  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail(),
    key: config.google.privateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

function rowToPost(row: string[], rowNumber: number): Post {
  const likes = Number(row[4] || 0);
  const comments = Number(row[5] || 0);
  const shares = Number(row[6] || 0);
  return {
    rowNumber,
    date: row[0] || "",
    platform: (row[1] || "") as Platform,
    link: row[2] || "",
    isVideo: (row[3] || "").toLowerCase() === "yes",
    likes,
    comments,
    shares,
    totalEngagement: Number(row[7] || likes + comments + shares),
    totalVideoViews: row[8] === "" || row[8] === undefined ? null : Number(row[8]),
    language: (row[9] || "") as LanguageCode,
    lastUpdated: row[10] || "",
  };
}

function postToRow(post: PostInput, lastUpdated: string): (string | number)[] {
  const totalEngagement = post.likes + post.comments + post.shares;
  return [
    post.date,
    post.platform,
    post.link,
    post.isVideo ? "yes" : "no",
    post.likes,
    post.comments,
    post.shares,
    totalEngagement,
    post.isVideo ? post.totalVideoViews ?? 0 : "",
    post.language,
    lastUpdated,
  ];
}

export async function ensureSheetStructure(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = config.google.sheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set((meta.data.sheets || []).map((s) => s.properties?.title));

  const addRequests: sheets_v4.Schema$Request[] = [];
  if (!existingTitles.has(POSTS_SHEET)) {
    addRequests.push({ addSheet: { properties: { title: POSTS_SHEET } } });
  }
  if (!existingTitles.has(TOTALS_SHEET)) {
    addRequests.push({ addSheet: { properties: { title: TOTALS_SHEET } } });
  }
  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
  }

  if (!existingTitles.has(POSTS_SHEET)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${POSTS_SHEET}!A1:K1`,
      valueInputOption: "RAW",
      requestBody: { values: [POSTS_HEADERS] },
    });
  }

  if (!existingTitles.has(TOTALS_SHEET)) {
    await initTotalsSheet(sheets, spreadsheetId);
  }
}

async function initTotalsSheet(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const headerRow = [
    "",
    "NUMBER POSTS",
    "Likes",
    "Comments",
    "Shares",
    "TOTAL ENGAGEMENTS",
    "NUMBER of Videos",
    "TOTAL VIEWS",
  ];

  const languageRows = TOTALS_ROW_ORDER.slice(0, 10).map((code, i) => {
    const r = i + 2;
    return [
      code,
      `=COUNTIF(${POSTS_SHEET}!$J:$J,$A${r})`,
      `=SUMIF(${POSTS_SHEET}!$J:$J,$A${r},${POSTS_SHEET}!$E:$E)`,
      `=SUMIF(${POSTS_SHEET}!$J:$J,$A${r},${POSTS_SHEET}!$F:$F)`,
      `=SUMIF(${POSTS_SHEET}!$J:$J,$A${r},${POSTS_SHEET}!$G:$G)`,
      `=SUMIF(${POSTS_SHEET}!$J:$J,$A${r},${POSTS_SHEET}!$H:$H)`,
      `=COUNTIFS(${POSTS_SHEET}!$J:$J,$A${r},${POSTS_SHEET}!$D:$D,"yes")`,
      `=SUMIF(${POSTS_SHEET}!$J:$J,$A${r},${POSTS_SHEET}!$I:$I)`,
    ];
  });

  const totalRow = [
    "TOTAL",
    "=SUM(B2:B11)",
    "=SUM(C2:C11)",
    "=SUM(D2:D11)",
    "=SUM(E2:E11)",
    "=SUM(F2:F11)",
    "=SUM(G2:G11)",
    "=SUM(H2:H11)",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TOTALS_SHEET}!A1:H12`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headerRow, ...languageRows, totalRow] },
  });
}

export async function listPosts(): Promise<Post[]> {
  const sheets = getClient();
  const spreadsheetId = config.google.sheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${POSTS_SHEET}!A2:K`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, i) => (row.length > 0 && row[2] ? rowToPost(row as string[], i + 2) : null))
    .filter((p): p is Post => p !== null);
}

export async function appendPost(post: PostInput): Promise<Post> {
  const sheets = getClient();
  const spreadsheetId = config.google.sheetId();
  const lastUpdated = new Date().toISOString();
  const values = [postToRow(post, lastUpdated)];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${POSTS_SHEET}!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  const updatedRange = res.data.updates?.updatedRange || "";
  const match = updatedRange.match(/![A-Z]+(\d+):/);
  const rowNumber = match ? Number(match[1]) : -1;

  return rowToPost(values[0].map(String), rowNumber);
}

export async function updatePostRow(rowNumber: number, post: PostInput): Promise<Post> {
  const sheets = getClient();
  const spreadsheetId = config.google.sheetId();
  const lastUpdated = new Date().toISOString();
  const values = [postToRow(post, lastUpdated)];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${POSTS_SHEET}!A${rowNumber}:K${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return rowToPost(values[0].map(String), rowNumber);
}

export async function getPostByRow(rowNumber: number): Promise<Post | null> {
  const sheets = getClient();
  const spreadsheetId = config.google.sheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${POSTS_SHEET}!A${rowNumber}:K${rowNumber}`,
  });
  const row = (res.data.values || [])[0];
  if (!row || !row[2]) return null;
  return rowToPost(row as string[], rowNumber);
}
