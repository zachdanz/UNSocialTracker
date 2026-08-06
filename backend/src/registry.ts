import { google } from "googleapis";
import { config } from "./config";
import { ensureSheetStructure, getSheetsClient } from "./sheets";

export interface Project {
  id: string;
  name: string;
  sheetUrl: string;
  createdAt: string;
}

const PROJECTS_SHEET = "Projects";
const PROJECTS_HEADERS = ["Project Name", "Sheet ID", "Sheet URL", "Created At"];

function sheetUrlFor(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

export async function ensureRegistryStructure(): Promise<void> {
  const sheets = getSheetsClient();
  const masterId = config.google.sheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: masterId });
  const hasProjectsTab = (meta.data.sheets || []).some((s) => s.properties?.title === PROJECTS_SHEET);

  if (!hasProjectsTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: masterId,
      requestBody: { requests: [{ addSheet: { properties: { title: PROJECTS_SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterId,
      range: `${PROJECTS_SHEET}!A1:D1`,
      valueInputOption: "RAW",
      requestBody: { values: [PROJECTS_HEADERS] },
    });
  }
}

export async function listProjects(): Promise<Project[]> {
  const sheets = getSheetsClient();
  const masterId = config.google.sheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: masterId,
    range: `${PROJECTS_SHEET}!A2:D`,
  });
  const rows = res.data.values || [];
  return rows
    .filter((row) => row[1])
    .map((row) => ({
      name: row[0] || "",
      id: row[1],
      sheetUrl: row[2] || sheetUrlFor(row[1]),
      createdAt: row[3] || "",
    }));
}

export async function createProject(name: string): Promise<Project> {
  const sheets = getSheetsClient();
  const masterId = config.google.sheetId();

  const createRes = await sheets.spreadsheets.create({
    requestBody: { properties: { title: name } },
  });
  const spreadsheetId = createRes.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Google Sheets did not return a new spreadsheet ID.");
  }

  await ensureSheetStructure(spreadsheetId);

  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail(),
    key: config.google.privateKey(),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  const drive = google.drive({ version: "v3", auth });
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { type: "anyone", role: "writer" },
  });

  const createdAt = new Date().toISOString();
  const sheetUrl = sheetUrlFor(spreadsheetId);

  await sheets.spreadsheets.values.append({
    spreadsheetId: masterId,
    range: `${PROJECTS_SHEET}!A:D`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[name, spreadsheetId, sheetUrl, createdAt]] },
  });

  return { id: spreadsheetId, name, sheetUrl, createdAt };
}
