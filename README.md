# UN Social Media Campaign Tracker

A shared web tool for tracking UN social media campaign posts, organized by **project** (campaign). Paste a post link into a project, the app records it, and everyone on the team can view/edit the same data from their browser. All projects live in **one Google Sheet you create once**, each as its own pair of tabs, so it's also viewable/editable directly in Google Sheets at any time.

This guide assumes no prior technical setup. It walks through everything needed to get the app live and shared with your team. Expect **15–20 minutes** for first-time setup; you only do this once.

## What you'll end up with

- A live web address (e.g. `https://unsocialtracker.onrender.com`) that anyone on your team can open in a browser and use — no installation, no login required.
- A landing page where anyone can create a new project (campaign) by typing a name, or open an existing one.
- Each project automatically gets its own pair of tabs inside the one Google Sheet you set up in Step 1: `"<project name> — Posts"` (one row per tracked post) and `"<project name> — TOTALS"` (auto-calculated summary by language). You don't create these by hand — the app adds a new tab pair every time someone clicks "+ New project."

(Earlier versions of this app tried giving each project its own separate Google Sheet file, created automatically by the app. That turned out to be blocked by a Google restriction — service accounts can't create new files on a personal Gmail account, only Google Workspace accounts can via Shared Drives. Tabs within one Sheet you already own and share sidesteps that limitation entirely.)

## How it currently handles stats

**Important:** as of today, no social media platform has API credentials configured, so stats (likes, comments, shares, video views) are **entered manually** when you add a post and updated manually when you click "Refresh." The app is built so that any platform can be switched to fully automatic later — you'd just need to register a developer app with that platform (e.g. Meta for Facebook/Instagram) and give me the resulting API key, and I can wire it in without changing anything else about how the app works.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet. Name it whatever you like, e.g. "UN Social Media Tracker".
2. Look at the address bar. The URL looks like:
   `https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit`
   Copy the long ID part between `/d/` and `/edit` — you'll need it in Step 3. This is your `GOOGLE_SHEET_ID`.
3. Leave the sheet otherwise empty — the app will automatically add a pair of tabs for every project someone creates from the landing page.

## Step 2 — Create a Google service account (lets the app write to the sheet)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (top-left project dropdown → "New Project"). Any name is fine.
2. In the search bar, search for **"Google Sheets API"** and click **Enable**.
3. In the left sidebar, go to **APIs & Services → Credentials**.
4. Click **Create Credentials → Service account**. Give it any name (e.g. "tracker-bot") and click through the defaults to **Done**.
5. Click on the service account you just created, go to the **Keys** tab, click **Add Key → Create new key → JSON**, and download the file. Keep it safe — treat it like a password.
6. Open that downloaded JSON file in a text editor. You need two values from it:
   - `client_email` — this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` — this is your `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (a long block starting with `-----BEGIN PRIVATE KEY-----`)
7. Go back to your Google Sheet from Step 1, click **Share**, and paste in the `client_email` address, giving it **Editor** access. This is what allows the app to write to it — this one share covers every project, since they all live as tabs in this same Sheet.

(If you enabled the "Google Drive API" for this project while troubleshooting an earlier version of this app, you can leave it enabled or disable it — it's no longer used.)

## Step 3 — Deploy the app to Render (free hosting)

1. Go to [render.com](https://render.com) and sign up (you can sign in with GitHub).
2. Click **New → Blueprint**, and connect this GitHub repository (`zachdanz/UNSocialTracker`). Render will read the included `render.yaml` file and set everything up automatically.
3. When prompted for environment variables, fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — from Step 2
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — from Step 2 (paste the whole block, including the `BEGIN/END PRIVATE KEY` lines)
   - `GOOGLE_SHEET_ID` — from Step 1
   - `REFRESH_CRON_SECRET` — make up any long random string (e.g. mash your keyboard for 20 characters); this just protects the automated daily refresh from being triggered by strangers
4. Click **Apply**/**Deploy**. The first build takes a few minutes. When it's done, Render gives you a URL like `https://unsocialtracker.onrender.com` — that's the link to share with your team.

**Note on the free tier:** if nobody uses the app for a while, Render puts it to sleep, and the *first* visit after that can take 30–60 seconds to load while it wakes up. Everyone after that gets normal speed until it goes idle again. If this becomes annoying, Render's cheapest paid tier ($7/month) removes the sleep delay.

## Step 4 — Set up the daily automatic refresh (optional but recommended)

This makes the app re-check stats once a day automatically (for any platform that has automatic fetching configured — see note above, none do yet, but this is ready for when they are).

1. In this GitHub repository, go to **Settings → Secrets and variables → Actions**.
2. Add two repository secrets:
   - `APP_URL` — your Render URL from Step 3 (e.g. `https://unsocialtracker.onrender.com`, no trailing slash)
   - `REFRESH_CRON_SECRET` — the same value you set in Render in Step 3
3. That's it — `.github/workflows/daily-refresh.yml` will run automatically every day at 06:00 UTC. You can also trigger it manually any time from the **Actions** tab → "Daily stats refresh" → **Run workflow**.

## Step 5 — Share it with your team

Just send them the Render URL from Step 3. No accounts or installs needed — anyone with the link can add and edit posts. (Because there's no login, anyone with the link can edit; don't post the link somewhere public. If you later want to restrict who can edit, let me know and I can add sign-in.)

---

## Using the app

- **Landing page:** shows every project so far, with a "+ New project" box at the top. Type a name and it adds a new tab pair to your Sheet automatically, then takes you straight into it. Project names must be unique.
- **Inside a project:** paste a link at the top. The platform is detected automatically from the link. Pick the language, mark whether it's a video, and enter starting stats (or leave at 0 and fill in later).
- **Refresh:** click "Refresh" on a row to re-check its stats. Since no platform has automatic fetching configured yet, this currently prompts you to re-enter the numbers by hand — same as clicking "Edit."
- **Edit:** click "Edit" on any row to correct its numbers directly.
- **Filter:** use the language dropdown above the table to narrow the view.
- **View the raw spreadsheet:** each project page has an "open it directly ↗" link that jumps straight to that project's `Posts` tab in your Sheet. Its matching `"<project> — TOTALS"` tab sits right next to it, with auto-calculated totals per language using live spreadsheet formulas.

## Supported platforms

X, Facebook, WhatsApp, Instagram, LinkedIn, Threads, TikTok, VK, Weibo, Bilibili, Kuaishou, WeChat. A link from any other site will be rejected with an error asking you to check the URL.

## Local development

```bash
# Backend
cd backend
cp ../.env.example .env   # then fill in real values
npm install
npm run dev                # runs on http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                # runs on http://localhost:5173, proxies /api to :3000
```

## Adding real automatic stats fetching for a platform later

Each platform's stats-fetching logic lives in `backend/src/fetchers/`, behind a common interface (`backend/src/fetchers/types.ts`). Every platform currently uses the placeholder in `stub.ts`. To make a platform automatic:

1. Register a developer app with that platform and get API credentials (e.g. Meta Graph API for Facebook/Instagram, LinkedIn Marketing API, VK API).
2. Add the credentials as new environment variables (in `.env.example`, `backend/src/config.ts`, and Render's environment variable settings).
3. Create a new file in `backend/src/fetchers/` implementing the `StatsFetcher` interface for that platform, and swap it in for the stub in `backend/src/fetchers/index.ts`.

No other part of the app needs to change — the UI, the daily cron, and the Google Sheet writing all already call through this interface.
