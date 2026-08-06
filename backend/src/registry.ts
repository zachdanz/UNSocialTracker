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

function describeGoogleError(step: string, err: any): Error {
  const apiError = err?.response?.data?.error;
  const reason = apiError?.errors?.[0]?.reason;
  const detail = apiError?.message || err.message || "Unknown error";
  console.error(`[registry] Google API call failed during "${step}":`, JSON.stringify(apiError || err.message));
  return new Error(`Failed during "${step}"${reason ? ` (${reason})` : ""}: ${detail}`);
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

  let spreadsheetId: string;
  try {
    const createRes = await sheets.spreadsheets.create({
      requestBody: { properties: { title: name } },
    });
    if (!createRes.data.spreadsheetId) {
      throw new Error("Google Sheets did not return a new spreadsheet ID.");
    }
    spreadsheetId = createRes.data.spreadsheetId;
  } catch (err: any) {
    throw describeGoogleError("creating the project's spreadsheet", err);
  }

  try {
    await ensureSheetStructure(spreadsheetId);
  } catch (err: any) {
    throw describeGoogleError("setting up the Posts/TOTALS tabs", err);
  }

  try {
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
  } catch (err: any) {
    throw describeGoogleError("sharing the new spreadsheet via link", err);
  }

  const createdAt = new Date().toISOString();
  const sheetUrl = sheetUrlFor(spreadsheetId);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: masterId,
      range: `${PROJECTS_SHEET}!A:D`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[name, spreadsheetId, sheetUrl, createdAt]] },
    });
  } catch (err: any) {
    throw describeGoogleError("recording the project in the master registry sheet", err);
  }

  return { id: spreadsheetId, name, sheetUrl, createdAt };
}
