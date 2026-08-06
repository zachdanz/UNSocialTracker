import { config } from "./config";
import { ensureProjectTabs, getSheetsClient, POSTS_SUFFIX } from "./sheets";

export interface Project {
  id: string;
  name: string;
  sheetUrl: string;
}

const MAX_TAB_BASE_LENGTH = 85; // leaves room for " — TOTALS" within Sheets' 100-char tab name limit

/** Turn a free-typed project name into a name safe to use as a Google Sheets tab title. */
export function sanitizeProjectName(raw: string): string {
  return raw
    .trim()
    .replace(/[[\]*?/\\:]/g, "-") // characters Google Sheets disallows in tab names
    .replace(/\s+/g, " ")
    .slice(0, MAX_TAB_BASE_LENGTH)
    .trim();
}

function sheetEditUrl(masterId: string, gid: number | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${masterId}/edit`;
  return gid !== null ? `${base}#gid=${gid}` : base;
}

export async function verifyMasterSheetAccess(): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.get({ spreadsheetId: config.google.sheetId() });
}

export async function listProjects(): Promise<Project[]> {
  const sheets = getSheetsClient();
  const masterId = config.google.sheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: masterId });
  const tabs = meta.data.sheets || [];

  const projects = tabs
    .filter((s) => (s.properties?.title || "").endsWith(POSTS_SUFFIX))
    .map((s) => {
      const title = s.properties?.title || "";
      const id = title.slice(0, title.length - POSTS_SUFFIX.length);
      return {
        id,
        name: id,
        sheetUrl: sheetEditUrl(masterId, s.properties?.sheetId ?? null),
      };
    });

  // Sheets API returns tabs in left-to-right (creation) order; show newest first.
  return projects.reverse();
}

export async function createProject(rawName: string): Promise<Project> {
  const masterId = config.google.sheetId();
  const id = sanitizeProjectName(rawName);
  if (!id) {
    throw new Error("Please enter a valid project name.");
  }

  const existing = await listProjects();
  if (existing.some((p) => p.id.toLowerCase() === id.toLowerCase())) {
    throw new Error(`A project named "${id}" already exists.`);
  }

  const { postsSheetId } = await ensureProjectTabs(masterId, id);

  return { id, name: id, sheetUrl: sheetEditUrl(masterId, postsSheetId) };
}
