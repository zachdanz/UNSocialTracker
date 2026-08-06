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

export const POSTS_SUFFIX = " — Posts";
export const TOTALS_SUFFIX = " — TOTALS";

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

export function postsTabName(projectId: string): string {
  return `${projectId}${POSTS_SUFFIX}`;
}

export function totalsTabName(projectId: string): string {
  return `${projectId}${TOTALS_SUFFIX}`;
}

/** Wrap a sheet/tab name for use inside an A1 range or formula (handles spaces/special chars). */
function q(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

let sheetsClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail(),
    key: config.google.privateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
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

/**
 * Creates the "<project> — Posts" / "<project> — TOTALS" tabs inside the single
 * shared spreadsheet, if they don't already exist. Returns the new tabs' sheetIds
 * (Google's internal numeric tab id, used for deep-linking to a tab).
 */
export async function ensureProjectTabs(
  spreadsheetId: string,
  projectId: string
): Promise<{ postsSheetId: number | null; totalsSheetId: number | null }> {
  const sheets = getSheetsClient();
  const postsTab = postsTabName(projectId);
  const totalsTab = totalsTabName(projectId);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets || [];
  const findId = (title: string) => existing.find((s) => s.properties?.title === title)?.properties?.sheetId ?? null;

  const addRequests: sheets_v4.Schema$Request[] = [];
  if (findId(postsTab) === null) {
    addRequests.push({ addSheet: { properties: { title: postsTab } } });
  }
  if (findId(totalsTab) === null) {
    addRequests.push({ addSheet: { properties: { title: totalsTab } } });
  }

  let addedSheets: sheets_v4.Schema$Sheet[] = [];
  if (addRequests.length > 0) {
    const batchRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
    addedSheets = (batchRes.data.replies || [])
      .map((r) => r.addSheet)
      .filter((s): s is sheets_v4.Schema$Sheet => Boolean(s));
  }

  const postsSheetId = findId(postsTab) ?? addedSheets.find((s) => s.properties?.title === postsTab)?.properties?.sheetId ?? null;
  const totalsSheetId =
    findId(totalsTab) ?? addedSheets.find((s) => s.properties?.title === totalsTab)?.properties?.sheetId ?? null;

  if (findId(postsTab) === null) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${q(postsTab)}!A1:K1`,
      valueInputOption: "RAW",
      requestBody: { values: [POSTS_HEADERS] },
    });
  }

  if (findId(totalsTab) === null) {
    await initTotalsSheet(sheets, spreadsheetId, postsTab, totalsTab);
  }

  return { postsSheetId, totalsSheetId };
}

async function initTotalsSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  postsTab: string,
  totalsTab: string
): Promise<void> {
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

  const p = q(postsTab);

  const languageRows = TOTALS_ROW_ORDER.slice(0, 10).map((code, i) => {
    const r = i + 2;
    return [
      code,
      `=COUNTIF(${p}!$J:$J,$A${r})`,
      `=SUMIF(${p}!$J:$J,$A${r},${p}!$E:$E)`,
      `=SUMIF(${p}!$J:$J,$A${r},${p}!$F:$F)`,
      `=SUMIF(${p}!$J:$J,$A${r},${p}!$G:$G)`,
      `=SUMIF(${p}!$J:$J,$A${r},${p}!$H:$H)`,
      `=COUNTIFS(${p}!$J:$J,$A${r},${p}!$D:$D,"yes")`,
      `=SUMIF(${p}!$J:$J,$A${r},${p}!$I:$I)`,
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
    range: `${q(totalsTab)}!A1:H12`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headerRow, ...languageRows, totalRow] },
  });
}

export async function listPosts(spreadsheetId: string, projectId: string): Promise<Post[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${q(postsTabName(projectId))}!A2:K`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, i) => (row.length > 0 && row[2] ? rowToPost(row as string[], i + 2) : null))
    .filter((p): p is Post => p !== null);
}

export async function appendPost(spreadsheetId: string, projectId: string, post: PostInput): Promise<Post> {
  const sheets = getSheetsClient();
  const lastUpdated = new Date().toISOString();
  const values = [postToRow(post, lastUpdated)];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${q(postsTabName(projectId))}!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  const updatedRange = res.data.updates?.updatedRange || "";
  const match = updatedRange.match(/![A-Z]+(\d+):/);
  const rowNumber = match ? Number(match[1]) : -1;

  return rowToPost(values[0].map(String), rowNumber);
}

export async function updatePostRow(
  spreadsheetId: string,
  projectId: string,
  rowNumber: number,
  post: PostInput
): Promise<Post> {
  const sheets = getSheetsClient();
  const lastUpdated = new Date().toISOString();
  const values = [postToRow(post, lastUpdated)];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${q(postsTabName(projectId))}!A${rowNumber}:K${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return rowToPost(values[0].map(String), rowNumber);
}

export async function getPostByRow(
  spreadsheetId: string,
  projectId: string,
  rowNumber: number
): Promise<Post | null> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${q(postsTabName(projectId))}!A${rowNumber}:K${rowNumber}`,
  });
  const row = (res.data.values || [])[0];
  if (!row || !row[2]) return null;
  return rowToPost(row as string[], rowNumber);
}
