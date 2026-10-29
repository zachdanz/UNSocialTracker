"""Build the MRP 2026 Explorer.

    python scripts/build.py

Steps:
 1. Parse the JO texts (scripts/parse_jos.py).
 2. Read the unofficial post-sharing CSV and match each entry to compendium posts.
 3. Write data/posts.json (one record per compendium post) and data/shared_not_in_compendium.json.
 4. Write data/build_report.md for review.
 5. Build dist/mrp-explorer.html (single self-contained file) from explorer/template.html.

Matching never claims certainty. Each entry -> post link gets one of these levels:
  reported  "Reported by post holder"   one clean MJO number; entity + duty station agree with compendium
  likely    "Likely match"              the entry's unit clearly matches this candidate's JO org setting
  possible  "Possible match (1 of N)"   several numbers given, or none given but entity+duty station+title fit N posts
  manual    "Matched manually"          set in data/manual_matches.json
Entries whose holder is "Not participating" / "Requesting Deferral" never go above "possible".
"""
import csv
import datetime
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse_jos  # noqa: E402

ROOT = parse_jos.ROOT
DATA = parse_jos.DATA
DIST = os.path.join(ROOT, 'dist')
TEMPLATE = os.path.join(ROOT, 'explorer', 'template.html')
MANUAL = os.path.join(DATA, 'manual_matches.json')

LEVEL_LABEL = {'reported': 'Reported by post holder', 'likely': 'Likely match — unit matches JO',
               'possible': 'Possible match', 'manual': 'Matched manually'}
NOT_PARTICIPATING_NOTE = 'Post holder may not be participating; this post may not be in the exercise.'
NETWORKS = {'DEVNET', 'MAGNET', 'INFONET', 'POLNET', 'ITECNET', 'LEGALNET', 'LOGNET', 'ECONET', 'SAFETYNET',
            'SCINET', 'PEACEOPS', 'POLNET'}


# ---------------------------------------------------------------- post-sharing CSV

def find_csv():
    """The post-sharing sheet: any CSV in data/raw whose name contains 'Post_Sharing' (newest wins)."""
    files = sorted(glob.glob(os.path.join(DATA, 'raw', '*Post_Sharing*.csv')), key=os.path.getmtime)
    return files[-1] if files else None


def col(row, prefix):
    """Value of the first column whose header starts with prefix (headers contain newlines/odd spacing)."""
    for k, v in row.items():
        if k and re.sub(r'\s+', ' ', k).strip().upper().startswith(prefix.upper()):
            return v
    return None


def tidy(v):
    """Strip whitespace (incl. non-breaking spaces); empty -> None. Inner newlines are kept."""
    if v is None:
        return None
    v = v.replace(' ', ' ').strip()
    return v or None


def read_entries(path):
    # The sheet is exported from Excel as Windows-1252, not UTF-8.
    rows = list(csv.DictReader(open(path, encoding='cp1252', newline='')))
    entries, seen = [], {}
    for i, r in enumerate(rows, start=2):  # row 1 is the header
        name = tidy(col(r, 'NAME'))
        if not name:
            continue
        network = tidy(col(r, 'JOB FAMILY'))
        if network and network.upper() in NETWORKS:
            network = network.upper()
        # Stable id from the name, so manual matches survive a re-download of the sheet.
        base = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        seen[base] = seen.get(base, 0) + 1
        e = dict(
            entry_id=base if seen[base] == 1 else f'{base}-{seen[base]}',
            csv_row=i,
            mjo_text=tidy(col(r, 'Mobility Job Opening')),
            title=tidy(col(r, 'Title')),
            job_network=network,
            entity=tidy(col(r, 'ENTITY')),
            duty_station=tidy(col(r, 'DUTY STATION')),
            unit=tidy(col(r, 'UNIT')),
            name=name,
            email=tidy(col(r, 'EMAIL')),
            relocation=tidy(col(r, 'Potential Relocation')),
            participation=tidy(col(r, 'LIKELIHOOD')),
            duties=tidy(col(r, 'DUTIES')),
            team_composition=tidy(col(r, 'TEAM COMPOSITION')),
            duty_station_assessment=tidy(col(r, 'DUTY STATION ASSESSMENT')),
            comments=tidy(col(r, 'COMMENTS')),
        )  # NB: the Whatsapp column is deliberately not copied (see check_no_whatsapp).
        e['mjo_numbers'] = re.findall(r'(?<!\d)\d{6}(?!\d)', e['mjo_text'] or '')
        entries.append(e)
    return entries


# ---------------------------------------------------------------- normalisation helpers

def norm_entity(s):
    return re.sub(r'\s+', '', (s or '').upper())


def entity_matches(entry_entity, comp_entity):
    """Exact match, or the sheet gives the parent code (e.g. 'DPPA' for compendium 'DPPA-DPO-SS')."""
    a, b = norm_entity(entry_entity), norm_entity(comp_entity)
    return bool(a) and (a == b or b.split('-')[0] == a or a.split('-')[0] == b)


def norm_ds(s):
    return re.sub(r'\s+', ' ', (s or '').strip().lower())


def norm_title(s):
    """Lower-case, Programme->Program, drop text in parentheses (also an unclosed '(' at the end),
    drop punctuation and the 'Associate' prefix."""
    s = (s or '').lower().replace('programme', 'program')
    s = re.sub(r'\([^)]*\)?', ' ', s)
    s = re.sub(r'[^a-z ]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'^(associate|ciate) ', '', s)
    return s


def title_matches(a, b):
    """Equal after normalisation, or one is a truncation (prefix, min. 8 chars) of the other."""
    a, b = norm_title(a), norm_title(b)
    if not a or not b:
        return False
    if a == b:
        return True
    short, long_ = sorted((a, b), key=len)
    return len(short) >= 8 and long_.startswith(short)


# Words that say nothing about which unit a post is in.
STOP = set('''a an and or of the for on in at to with by un united nations division divisions section unit branch
office department departments team cluster service services sub under new york geneva headquarters
s see notes'''.split())


def unit_tokens(unit):
    toks = re.findall(r'[A-Za-z]{3,}', unit or '')
    return sorted({t.lower() for t in toks if t.lower() not in STOP})


LOCATION = re.compile(r'locat|found (?:in|with)|(?:post|position) is|reports? (?:directly )?to|supervision|'
                      r'incumbent|is part of|based in|serves? in', re.I)


def location_text(jo):
    """The sentences of the org setting that say where the post sits ("This position is located in ...",
    "reports to ..."). Many JOs start with boilerplate about the whole entity, which would match any unit."""
    org = jo.get('org_setting_and_reporting') or ''
    sentences = re.split(r'(?<=[.;])\s+|\n+', org)
    keep = [x for x in sentences if LOCATION.search(x)]
    return ' '.join(keep) if keep else org


def jo_words(jo):
    text = ' '.join(filter(None, [jo.get('title_full'), location_text(jo)]))
    return set(re.findall(r'[a-z]+', text.lower()))


def has_token(tok, words):
    """Token is in the text; light stemming (first 6 letters) tolerates plurals and typos at the end."""
    stem = tok[:6] if len(tok) > 6 else tok
    return any(w.startswith(stem) for w in words) if len(tok) > 4 else tok in words


def unit_scores(unit, mjos, jos):
    """For posts that have a JO: how many of the entry's unit words appear in the JO org setting, counting only
    words that appear in some but not all of these posts' JOs (shared words can't tell them apart).
    Returns (scores dict, distinctive tokens list)."""
    with_jo = [m for m in mjos if m in jos]
    toks = unit_tokens(unit)
    words = {m: jo_words(jos[m]) for m in with_jo}
    present = {t: [m for m in with_jo if has_token(t, words[m])] for t in toks}
    distinctive = [t for t in toks if 0 < len(present[t]) < len(with_jo)] if len(with_jo) > 1 else []
    scores = {m: sum(1 for t in distinctive if m in present[t]) for m in with_jo}
    return scores, distinctive, present


# ---------------------------------------------------------------- matching

def match_entry(e, comp, jos, manual):
    """Return (list of candidate dicts {mjo, level, reasons}, general notes for the entry)."""
    cm = {c['mjo_number']: c for c in comp}
    notes = []
    dropped = {}  # mjo -> post it was dropped in favour of (summarised into one note at the end)
    caps = (e['participation'] or '').lower()
    not_participating = 'not participating' in caps or 'deferral' in caps
    if not_participating:
        notes.append(NOT_PARTICIPATING_NOTE)

    # 1. Manual override wins.
    if e['entry_id'] in manual['no_match']:
        return [], notes + ['Manually marked as matching no compendium post.']
    if e['entry_id'] in manual['matches']:
        return [dict(mjo=m, level='manual', reasons=['Set in data/manual_matches.json.'])
                for m in manual['matches'][e['entry_id']] if m in cm], notes

    nums = [n for n in dict.fromkeys(e['mjo_numbers'])]  # unique, keep order
    unknown = [n for n in nums if n not in cm]
    if unknown:
        notes.append(f'MJO number(s) {", ".join(unknown)} given in the entry are not in the compendium.')
    nums = [n for n in nums if n in cm]
    clean_single = len(nums) == 1 and (e['mjo_text'] or '').strip() == nums[0]

    pool = [c['mjo_number'] for c in comp
            if entity_matches(e['entity'], c['entity']) and norm_ds(e['duty_station']) == norm_ds(c['duty_station'])]

    def agree(m):
        c = cm[m]
        return entity_matches(e['entity'], c['entity']) and norm_ds(e['duty_station']) == norm_ds(c['duty_station'])

    # 2. Exactly one clean MJO number whose entity + duty station agree -> reported by post holder.
    if clean_single and agree(nums[0]):
        reasons = [f'Entry gives MJO {nums[0]}; entity and duty station agree with the compendium.']
        if norm_entity(e['entity']) != norm_entity(cm[nums[0]]['entity']):
            reasons.append(f'Entity given as {e["entity"]}; compendium says {cm[nums[0]]["entity"]}.')
        level = 'possible' if not_participating else 'reported'
        return [dict(mjo=nums[0], level=level, reasons=reasons)], notes

    # 3. Otherwise build a candidate list.
    cands = {}
    if nums:
        for m in nums:
            r = [f'Entry lists MJO {m}' + (f' among {len(nums)} numbers' if len(nums) > 1 else
                                           ' but not as a single clear number' if not clean_single else '') + '.']
            if not agree(m):
                c = cm[m]
                r.append(f'Entry says {e["entity"]}, {e["duty_station"]}; compendium says {c["entity"]}, '
                         f'{c["duty_station"]}.')
            cands[m] = r
    else:
        for m in pool:
            c = cm[m]
            jo_title = jos[m]['title_full'] if m in jos else None
            if title_matches(e['title'], c['title_compendium']) or title_matches(e['title'], jo_title):
                cands[m] = ['Entity, duty station and title match; no MJO number given.']

    # 4. Use the unit (UNIT/DIVISION) against the JO org settings to narrow down.
    likely = set()
    if e['unit'] and cands:
        with_jo = [m for m in cands if m in jos]
        if len(with_jo) > 1:
            scores, dist, present = unit_scores(e['unit'], with_jo, jos)
            best = max(scores.values())
            if best > 0:
                top = [m for m in with_jo if scores[m] == best]
                for m in with_jo:
                    words = [t for t in dist if m in present[t]]
                    if scores[m] < best:
                        cands.pop(m)
                        dropped[m] = ', '.join(top)
                    elif m in top:
                        cands[m].append(f'Unit words found where this JO\'s org setting says where the post sits: {", ".join(words)}.')
                if len(top) == 1:
                    likely.add(top[0])
                    # One JO clearly matches: posts with no JO text yet are no longer plausible either.
                    for m in [m for m in cands if m not in jos]:
                        cands.pop(m)
                        dropped[m] = top[0]
        elif len(with_jo) == 1:
            m = with_jo[0]
            toks = unit_tokens(e['unit'])
            hit = [t for t in toks if has_token(t, jo_words(jos[m]))]
            if toks and len(hit) / len(toks) >= 0.5:
                cands[m].append(f'Unit words found where this JO\'s org setting says where the post sits: {", ".join(hit)}.')
                if len(cands) == 1:
                    likely.add(m)
            elif toks:
                cands[m].append(f'The unit ("{e["unit"]}") is not clearly mentioned in this JO\'s org setting.')
        for m in cands:
            if m not in jos:
                cands[m].append('No JO text yet, so the unit could not be compared.')

    # 5. Title-insensitive rescue: titles in the compendium/JO/sheet are inconsistent (e.g. "Radio Producer" vs
    #    "Public Information Officer"), so a post at the same entity + duty station whose JO clearly matches
    #    the unit is added as a possible match even though the title differs.
    if e['unit'] and not nums:
        others = [m for m in pool if m in jos]
        if len(others) > 1:
            scores, dist, present = unit_scores(e['unit'], others, jos)
            best_cand = max([scores.get(m, 0) for m in cands] or [0])
            best = max(scores.values())
            top = [m for m in others if scores[m] == best]
            if best >= 1 and best > best_cand and len(top) == 1 and top[0] not in cands:
                m = top[0]
                words = [t for t in dist if m in present[t]]
                jt = jos[m]['title_full']
                for mm in cands:  # the title-based candidates are now contradicted by the unit
                    dropped[mm] = m
                cands = {m: [f'Title differs (entry: "{e["title"]}", JO: "{jt}"), but unit words found where '
                             f'this JO\'s org setting says where the post sits: {", ".join(words)}.']}

    for winner in dict.fromkeys(dropped.values()):
        lost = [m for m, w in dropped.items() if w == winner]
        notes.append(f'Also considered and ruled out: {", ".join(lost)} (the unit "{e["unit"]}" fits the JO of '
                     f'{winner} better).')
    for m, reasons in cands.items():
        c = cm[m]
        if norm_entity(e['entity']) != norm_entity(c['entity']) and agree(m):
            reasons.append(f'Entity given as {e["entity"]}; the compendium lists this post under {c["entity"]}.')
    out = []
    for m, reasons in cands.items():
        level = 'likely' if (m in likely and not not_participating) else 'possible'
        out.append(dict(mjo=m, level=level, reasons=reasons))
    return out, notes


def load_manual():
    """data/manual_matches.json:
    {"matches": {"<entry_id>": ["215401", ...]}, "no_match": ["<entry_id>", ...]}
    entry_id is shown in the build report for every entry (it's the NAME, lower-cased with dashes)."""
    if not os.path.exists(MANUAL):
        return {'matches': {}, 'no_match': []}
    m = json.load(open(MANUAL, encoding='utf-8'))
    return {'matches': {k: [v] if isinstance(v, str) else v for k, v in m.get('matches', {}).items()},
            'no_match': m.get('no_match', [])}


# ---------------------------------------------------------------- main

def main():
    built = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    jos, problems = parse_jos.parse(verbose=False)
    comp = list(csv.DictReader(open(os.path.join(DATA, 'compendium.csv'), encoding='utf-8')))
    cm = {c['mjo_number']: c for c in comp}
    manual = load_manual()

    csv_path = find_csv()
    entries = read_entries(csv_path) if csv_path else []
    if not csv_path:
        problems.append('No post-sharing CSV found in data/raw (expected a name containing "Post_Sharing").')
    for k in list(manual['matches']) + manual['no_match']:
        if k not in {e['entry_id'] for e in entries}:
            problems.append(f'manual_matches.json refers to unknown entry "{k}".')

    # Match every entry.
    by_post = {c['mjo_number']: [] for c in comp}
    unmatched = []
    for e in entries:
        cands, notes = match_entry(e, comp, jos, manual)
        for c in cands:
            c['n_candidates'] = len(cands)
        e['candidates'] = [dict(mjo=c['mjo'], level=c['level'], n_candidates=c['n_candidates']) for c in cands]
        e['notes'] = notes
        public = {k: v for k, v in e.items() if k not in ('candidates', 'mjo_numbers')}
        for c in cands:
            by_post[c['mjo']].append(dict(public, confidence=c['level'], n_candidates=c['n_candidates'],
                                          confidence_label=label(c), reasons=c['reasons']))
        if not cands:
            unmatched.append(public)

    # Several entries on one post: say so on each of them.
    for m, lst in by_post.items():
        if len(lst) > 1:
            for x in lst:
                x['notes'] = x['notes'] + [f'{len(lst)} post-sharing entries could describe this post.']
        order = {'reported': 0, 'manual': 1, 'likely': 2, 'possible': 3}
        lst.sort(key=lambda x: (order[x['confidence']], x['n_candidates']))

    posts = []
    for c in comp:
        m = c['mjo_number']
        jo = {k: v for k, v in jos[m].items()} if m in jos else None
        if jo:
            jo.pop('mjo_number', None)
        req = [l['language'] for l in jo['languages']['required']] if jo else []
        posts.append(dict(
            mjo_number=m, duty_station=c['duty_station'], entity=c['entity'], level=c['level'],
            title_compendium=c['title_compendium'], job_network=c['job_network'], job_family=c['job_family'],
            has_full_jo=jo is not None,
            display_title=pretty_title(jo['title_full']) if jo else c['title_compendium'],
            title_differs=bool(jo) and not title_matches(jo['title_full'], c['title_compendium']),
            required_languages_other=[l for l in req if l != 'English'],
            jo=jo,
            unofficial=by_post[m],
            unofficial_best=best_level(by_post[m]),
        ))
    json.dump(posts, open(os.path.join(DATA, 'posts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(unmatched, open(os.path.join(DATA, 'shared_not_in_compendium.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    write_report(built, comp, jos, posts, entries, unmatched, problems, csv_path)
    build_html(built, posts, unmatched)
    print(f'Built {built}: {len(posts)} posts, {sum(p["has_full_jo"] for p in posts)} with full JO, '
          f'{len(entries)} post-sharing entries ({len(unmatched)} not matched). See data/build_report.md')


def label(c):
    if c['level'] == 'possible':
        return f'Possible match (1 of {c["n_candidates"]})'
    return LEVEL_LABEL[c['level']]


def best_level(lst):
    for lvl in ('reported', 'manual', 'likely', 'possible'):
        if any(x['confidence'] == lvl for x in lst):
            return lvl
    return 'none'


def pretty_title(t):
    """Inspira titles are sometimes ALL CAPS; show them in title case (small words lower-case)."""
    if not t or t != t.upper():
        return t
    small = {'and', 'of', 'the', 'for', 'in', 'on'}
    words = t.lower().split(' ')
    return ' '.join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))


def write_report(built, comp, jos, posts, entries, unmatched, problems, csv_path):
    cm = {c['mjo_number']: c for c in comp}
    best = {}
    for p in posts:
        best[p['unofficial_best']] = best.get(p['unofficial_best'], 0) + 1
    R = [f'# Build report — {built}', '',
         '## Totals', '',
         f'- Posts in compendium: {len(posts)}',
         f'- Posts with full JO: {sum(p["has_full_jo"] for p in posts)}',
         f'- Posts without JO text ("Full JO not yet added"): '
         f'{", ".join(p["mjo_number"] for p in posts if not p["has_full_jo"]) or "none"}',
         f'- JO texts not in the compendium: {", ".join(sorted(set(jos) - set(cm))) or "none"}',
         f'- Post-sharing CSV: {os.path.basename(csv_path) if csv_path else "NOT FOUND"} '
         f'({len(entries)} entries with a NAME)',
         '- Posts by best unofficial confidence level:']
    for lvl in ('reported', 'manual', 'likely', 'possible', 'none'):
        R.append(f'  - {lvl}: {best.get(lvl, 0)}')
    R.append(f'- Entries matching no compendium post: {len(unmatched)}')

    def ent_line(e):
        c = ', '.join(f'{x["mjo"]} ({x["level"]})' for x in e['candidates']) or '—'
        return (f'| {e["entry_id"]} | {e["entity"]} / {e["duty_station"]} | {e["title"]} | {oneline(e["unit"])} | '
                f'{oneline(e["mjo_text"])} | {e["participation"] or ""} | {c} | {" ".join(e["notes"])} |')
    head = ['| entry_id | entity / duty station | title | unit | MJO as written | participation | '
            'candidates (level) | notes |', '|---|---|---|---|---|---|---|---|']
    amb = [e for e in entries if len(e['candidates']) > 1 or
           (e['candidates'] and e['candidates'][0]['level'] == 'possible')]
    R += ['', '## Ambiguous matches (possible match, or more than one candidate)', ''] + head + \
         [ent_line(e) for e in amb]
    R += ['', '## Posts with more than one entry', '']
    for p in posts:
        if len(p['unofficial']) > 1:
            R.append(f'- {p["mjo_number"]} {p["entity"]} {p["duty_station"]} {p["display_title"]}: ' +
                     '; '.join(f'{x["entry_id"]} ({x["confidence_label"]})' for x in p['unofficial']))
    R += ['', '## Every post-sharing entry', ''] + head + [ent_line(e) for e in entries]
    R += ['', '## Shared posts not in the compendium', '']
    R += [f'- {e["entry_id"]}: {e["entity"]}, {e["duty_station"]}, {e["title"]} ({oneline(e["unit"])}); '
          f'MJO as written: {oneline(e["mjo_text"]) or "—"}' for e in unmatched] or ['- none']
    R += ['', '## Parsing problems', ''] + ([f'- {p}' for p in problems] or ['- none'])
    R += ['', 'JO parser details: see data/validation_report.md',
          'To override a match, edit data/manual_matches.json (see README).']
    open(os.path.join(DATA, 'build_report.md'), 'w', encoding='utf-8').write('\n'.join(R) + '\n')


def oneline(s):
    return re.sub(r'\s+', ' ', s or '').replace('|', '/').strip()


def build_html(built, posts, unmatched):
    if not os.path.exists(TEMPLATE):
        print('(explorer/template.html not found yet: skipping the HTML build)')
        return
    payload = dict(built=built, posts=posts, shared_not_in_compendium=unmatched)
    # Escape '<' so text in the data can never close the <script> tag.
    blob = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    html = open(TEMPLATE, encoding='utf-8').read().replace('/*__DATA__*/null', blob)
    check_no_whatsapp(html)
    os.makedirs(DIST, exist_ok=True)
    open(os.path.join(DIST, 'mrp-explorer.html'), 'w', encoding='utf-8').write(html)


def check_no_whatsapp(html):
    """Safety net: stop the build if any WhatsApp number from the sheet appears in the output.
    (The column is only read here, to check its values are absent.)"""
    path = find_csv()
    if not path:
        return
    numbers = set()
    for r in csv.DictReader(open(path, encoding='cp1252', newline='')):
        digits = re.sub(r'\D', '', col(r, 'Whatsapp') or '')
        if len(digits) >= 7:
            numbers.add(digits)
    found = {re.sub(r'\D', '', m) for m in re.findall(r'\+?\d[\d \-().]{5,}\d', html)}
    leaks = [n for n in numbers if any(n in f or (len(f) >= 7 and f in n) for f in found)]
    if leaks:
        sys.exit(f'PRIVACY CHECK FAILED: {len(leaks)} WhatsApp number(s) would appear in the explorer. Not written.')


if __name__ == '__main__':
    main()
