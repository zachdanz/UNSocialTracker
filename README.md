# UN Social Media Campaign Tracker

A shared web tool for tracking UN social media campaign posts, organized by **project** (campaign). Paste a post link into a project, the app records it, and everyone on the team can view/edit the same data from their browser. Data is stored in a small database behind the app; you can download any project as a real Excel file at any time.

This guide assumes no prior technical setup. It walks through everything needed to get the app live and shared with your team. Expect **10–15 minutes** for first-time setup; you only do this once.

## What you'll end up with

- A live web address (e.g. `https://unsocialtracker.onrender.com`) that anyone on your team can open in a browser and use — no installation, no login required.
- A landing page where anyone can create a new project (campaign) by typing a name, or open an existing one.
- Inside each project: a table of tracked posts, a totals-by-language summary, and a "Download as Excel" button that generates a spreadsheet matching the original column layout (`Posts` tab + `TOTALS` tab) any time you want a snapshot.

(Earlier versions of this app used Google Sheets as the live data store. That turned out to be unreliable — Google's service-account/Drive permission model repeatedly blocked normal operations on a personal, non-Workspace Google account. Switching to a small database removes that whole fragile layer; the Excel download covers the same "give me a spreadsheet" need without depending on it as the live system of record.)

## How it currently handles stats

**Important:** as of today, no social media platform has API credentials configured, so stats (likes, comments, shares, video views) are **entered manually** when you add a post and updated manually when you click "Refresh." The app is built so that any platform can be switched to fully automatic later — you'd just need to register a developer app with that platform (e.g. Meta for Facebook/Instagram) and give me the resulting API key, and I can wire it in without changing anything else about how the app works.

---

## Step 1 — Create a free database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (you can sign in with GitHub or Google).
2. Create a new project (any name, e.g. "un-social-tracker"). Neon creates a database for you automatically.
3. On your project's dashboard, find **Connection Details** (sometimes labeled "Connection string") and copy the string that starts with `postgres://`. It looks like:
   `postgres://neondb_owner:AbCd1234@ep-cool-hill-12345.us-east-2.aws.neon.tech/neondb?sslmode=require`
   This is your `DATABASE_URL` — you'll paste it into Render in Step 2. Keep it private, it's effectively a password.
4. Nothing else to set up — the app creates its own tables automatically the first time it starts.

## Step 2 — Deploy the app to Render (free hosting)

1. Go to [render.com](https://render.com) and sign up (you can sign in with GitHub).
2. Click **New → Blueprint**, and connect this GitHub repository (`zachdanz/UNSocialTracker`). Render will read the included `render.yaml` file and set everything up automatically.
3. When prompted for environment variables, fill in:
   - `DATABASE_URL` — from Step 1
   - `REFRESH_CRON_SECRET` — make up any long random string (e.g. mash your keyboard for 20 characters); this just protects the automated daily refresh from being triggered by strangers
4. Click **Apply**/**Deploy**. The first build takes a few minutes. When it's done, Render gives you a URL like `https://unsocialtracker.onrender.com` — that's the link to share with your team.

**Note on the free tier:** if nobody uses the app for a while, Render puts it to sleep, and the *first* visit after that can take 30–60 seconds to load while it wakes up. Everyone after that gets normal speed until it goes idle again. If this becomes annoying, Render's cheapest paid tier ($7/month) removes the sleep delay.

## Step 3 — Set up the daily automatic refresh (optional but recommended)

This makes the app re-check stats once a day automatically (for any platform that has automatic fetching configured — see note above, none do yet, but this is ready for when they are).

1. In this GitHub repository, go to **Settings → Secrets and variables → Actions**.
2. Add two repository secrets:
   - `APP_URL` — your Render URL from Step 2 (e.g. `https://unsocialtracker.onrender.com`, no trailing slash)
   - `REFRESH_CRON_SECRET` — the same value you set in Render in Step 2
3. That's it — `.github/workflows/daily-refresh.yml` will run automatically every day at 06:00 UTC. You can also trigger it manually any time from the **Actions** tab → "Daily stats refresh" → **Run workflow**.

## Step 4 — Share it with your team

Just send them the Render URL from Step 2. No accounts or installs needed — anyone with the link can add and edit posts. (Because there's no login, anyone with the link can edit; don't post the link somewhere public. If you later want to restrict who can edit, let me know and I can add sign-in.)

---

## Using the app

- **Landing page:** shows every project so far, with a "+ New project" box at the top. Type a name to create one and jump straight in. Project names must be unique.
- **Inside a project:** paste a link at the top. The platform is detected automatically from the link. Pick the language, mark whether it's a video, and enter starting stats (or leave at 0 and fill in later).
- **Refresh:** click "Refresh" on a row to re-check its stats. Since no platform has automatic fetching configured yet, this currently prompts you to re-enter the numbers by hand — same as clicking "Edit."
- **Edit:** click "Edit" on any row to correct its numbers directly.
- **Filter:** use the language dropdown above the table to narrow the view.
- **Totals:** a "Totals by language" table below the posts list mirrors the original TOTALS layout (SG/EN/AR/ZH/ES/FR/RU/SW/PT/HI + TOTAL), always current.
- **Download as Excel:** the link under the project title downloads a real `.xlsx` file with a `Posts` sheet and a `TOTALS` sheet, matching the columns originally specified — a snapshot you can share, archive, or build off of in Excel/Sheets.

## Supported platforms

X, Facebook, WhatsApp, Instagram, LinkedIn, Threads, TikTok, VK, Weibo, Bilibili, Kuaishou, WeChat. A link from any other site will be rejected with an error asking you to check the URL.

## Local development

You'll need a Postgres database to develop against — either a free Neon database (see Step 1 above) or a local Postgres install.

```bash
# Backend
cd backend
cp ../.env.example .env   # then fill in DATABASE_URL and REFRESH_CRON_SECRET
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

No other part of the app needs to change — the UI, the daily cron, and the database writes all already call through this interface.
