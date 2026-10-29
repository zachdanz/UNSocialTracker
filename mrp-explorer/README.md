# MRP 2026 Explorer

An **unofficial**, searchable and filterable list of the 108 mobility job openings (MJOs, all P2) in the
2026 YPP Managed Reassignment Programme. It was made by an MRP candidate for fellow candidates because Inspira
displays the posts badly.

> **Unofficial tool. Data may contain errors — always verify against the original JO on Inspira.**
> The build date is shown at the top right of the page, so you can tell which version you have.

---

## For colleagues

### What it is
One file, `mrp-explorer.html`, that combines:
- the official **compendium** (all 108 posts),
- the **full JO text** of each post as copied from Inspira (107 of 108 so far),
- the crowd-sourced **post-sharing sheet**, where current post holders describe their posts
  (clearly marked as unofficial).

### How to open it
Save the file and **double-click it**. It opens in your browser. It needs no internet, login or installation,
and it makes no network requests. It works on a phone too.

### What you can do
- **Search** everything, including the JO text and post holders' descriptions. All words must match; use
  quotes for a phrase (`"social media"`). Press `/` to jump to the search box.
- **Filter** by duty station, entity, job network, job family, required language, full JO available,
  unofficial description, and your own tags. Combine filters freely; "Clear all" resets them.
- **Sort** by title, duty station, entity, job family, MJO number or your own ranking.
- **Open a post** to see the compendium info, the official JO sections, and the unofficial post-holder
  information (in a yellow, dashed box).
- **Overview** shows counts by duty station, entity, network, family and language. Click a bar to see those posts.
- **Not in compendium** lists posts people shared that don't match any compendium post.
- **Bookmark** a view: the address bar keeps your search, filters and sort. Your personal data is never put in the link.

### Badges
| Badge | Meaning |
|---|---|
| **Full JO** | The full job opening text is included. |
| **Full JO not yet added** | Only the compendium line is available so far. Check Inspira. |
| **French required** (etc.) | A language other than English is in the JO's *Required Languages* table. |
| **Unofficial: reported / matched manually / likely / possible (N) / none** | The best confidence level among the post-sharing entries that could describe this post. *N* is how many entries are attached to it. |

### Confidence levels (unofficial descriptions)
A post-sharing entry is **never** treated as certainly belonging to a post. Every link is labelled:

| Level | Meaning |
|---|---|
| **Reported by post holder** | The entry gives exactly one MJO number, and its entity and duty station agree with the compendium. |
| **Matched manually** | The maintainer linked it by hand after checking. This is still not an official confirmation. |
| **Likely match — unit matches JO** | No single MJO number was given, but the entry's unit/division matches where this JO says the post sits, better than any other candidate. |
| **Possible match (1 of N)** | The entry could describe any of N posts (several numbers given, or none, with entity + duty station + title fitting N posts). It is shown on each of them. |

The detail view always shows the **reason** for the label. If the post holder answered "Not participating" or
"Requesting deferral", you'll see: *"Post holder may not be participating; this post may not be in the
exercise."* Those entries are never labelled above "Possible". Several entries can point to the same post (e.g.
two people in the same unit), so even a single candidate is not proof.

### Your private notes
Shortlist (★), drag-to-rank, private notes, tags and "Not for me" hiding are stored **only in your own browser**
(localStorage). They are **never** written into the file and never sent anywhere. Nobody else can see them,
including whoever shares the file with you.

They are keyed by MJO number, so **they carry over to newer versions of the file**: save the new version
**in the same folder with the same file name** and open it in the same browser. (A different browser, a
private/incognito window, or clearing your browsing data will not have them.)

**Back them up:** go to **Shortlist → Export backup** to save a `.json` file. Use **Import backup** to restore it,
or to move your notes to another computer or browser. **Export shortlist (CSV)** gives you a spreadsheet of your
ranked shortlist (rank, MJO number, title, duty station, entity, tags, notes).

### Compare
Click "Compare" on 2 or 3 posts, then open the **Compare** tab to see them side by side, section by section.

---

## For the maintainer

### Folder layout
```
mrp-explorer/
  scripts/parse_jos.py        JO text parser (also runnable on its own)
  scripts/build.py            the one build command
  explorer/template.html      the explorer (HTML/CSS/vanilla JS); the build inserts the data into it
  data/compendium.csv         master list of the 108 posts (never edited by the build)
  data/raw/YPP_Mobility_Job_Opening.txt          JO texts pasted from Inspira
  data/raw/*Post_Sharing*.csv                    the post-sharing sheet (Windows-1252 CSV)
  data/manual_matches.json    your match overrides
  data/posts.json, data/build_report.md, data/validation_report.md   build outputs
  dist/mrp-explorer.html      the file to share
```
Only the raw post-sharing CSV is **gitignored**, because it contains colleagues' WhatsApp numbers. Everything
else, including `dist/mrp-explorer.html` and `data/posts.json` (which contain names and emails from the sheet),
is committed. To rebuild from a fresh clone, put the downloaded sheet back in `data/raw/`.

### Build
```bash
python scripts/build.py
```
This needs Python 3.8+ and no packages. Run it from the `mrp-explorer` folder (or from anywhere, since paths are
resolved relative to the script). Then read `data/build_report.md`: totals, ambiguous matches, every entry
with its candidates, posts not in the compendium, and parsing problems.

The build **refuses to write the explorer** if any WhatsApp number from the sheet would appear in it. Personal
data (stars, notes, rankings) lives only in each user's browser and can never be in the dist file.

### Add a missing JO (e.g. 215456)
1. Copy the full JO text from Inspira.
2. Paste it at the end of `data/raw/YPP_Mobility_Job_Opening.txt`, separated from the previous JO by a line
   containing only `===`.
3. Run `python scripts/build.py`. Check that the report no longer lists it under "Posts without JO text".

Pasting the same JO twice is harmless; identical copies are kept once.

### Update the post-sharing sheet
1. Download the sheet again as CSV.
2. Put it in `data/raw/`. Its file name must contain `Post_Sharing`. If there are several, the newest file is
   used, so delete old ones to avoid confusion.
3. Run `python scripts/build.py` and review "Ambiguous matches" in the report.

### Override a match
Edit `data/manual_matches.json`. Entry ids are listed in the build report; an id is the person's NAME in lower
case with dashes.
```json
{
  "matches":  { "zach-danz": "215456", "someone-else": ["215398", "215421"] },
  "no_match": [ "an-entry-id" ]
}
```
Manual matches show as **"Matched manually"**, never as confirmed. Re-run the build afterwards.

### How matching works (build.py)
1. **Manual override** wins.
2. **One clean MJO number**, with entity and duty station agreeing with the compendium → *Reported by post holder*.
3. Otherwise, **candidates** are the listed numbers, or (if none) the compendium posts with the same entity
   and duty station and a matching title. Titles are normalized (case, Programme/Program, text in parentheses,
   truncation) and compared against both the JO title and the compendium title. A sheet entity like `DPPA` also
   matches `DPPA-DPO-SS`.
4. **Unit check**: the entry's UNIT/DIVISION words are compared with the sentences of each candidate's
   *Org. Setting* that say where the post sits. Only words that tell the candidates apart count. The best
   candidate(s) are kept and the rest are ruled out (listed in the reason). A single clear winner becomes
   *Likely*.
5. If a post at the same entity and duty station matches the unit clearly better but has a different title (the
   compendium, the JO and the sheet often disagree), it is added as *Possible*, with the reason shown.
6. Not participating / requesting deferral → capped at *Possible*, with a warning.
7. No candidates → **Shared posts not in the compendium**.

### Editing the explorer
Edit `explorer/template.html` (plain HTML/CSS/JS, commented by section) and re-run the build. The data goes in
where the template has `/*__DATA__*/null`.
