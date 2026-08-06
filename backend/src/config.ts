import * as dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  google: {
    serviceAccountEmail: () => required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    // Render/most hosts store multi-line keys with literal "\n" - convert back to real newlines.
    privateKey: () => required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    sheetId: () => required("GOOGLE_SHEET_ID"),
  },
  refreshCronSecret: process.env.REFRESH_CRON_SECRET || "",
};
