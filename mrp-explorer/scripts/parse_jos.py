"""Parse data/raw/YPP_Mobility_Job_Opening.txt (JOs separated by lines of '=') against data/compendium.csv.

Run on its own:   python scripts/parse_jos.py      (or via scripts/build.py, which calls parse())
Outputs: data/jos_parsed.json, data/raw/jos/<MJO>.txt, data/validation_report.md

Inspira text quirks handled here:
- Header: title and level come AFTER their labels; department and duty station come BEFORE theirs.
- Eligibility uses "Education:" / "Experience:" or "Education" / "Work Experience" (sometimes
  "Desirable Work Experience") as their own lines, and sometimes has its own "Languages" sub-heading.
- Empty "Career Development" and "YPP Conditions" headers are normal.
- A JO pasted twice with identical text is kept once.
"""
import collections
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
SRC = os.path.join(DATA, 'raw', 'YPP_Mobility_Job_Opening.txt')

# Section headers: lines exactly equal to one of these labels (after the header block).
SECTIONS = ['Org. Setting and Reporting', 'Responsibilities', 'Competencies', 'Eligibility & Suitability Req',
            'Career Development', 'YPP Conditions', 'Languages', 'Required Languages', 'Desirable Languages', 'Education']
KEY = {'Org. Setting and Reporting': 'org_setting_and_reporting', 'Responsibilities': 'responsibilities',
       'Competencies': 'competencies', 'Eligibility & Suitability Req': 'eligibility',
       'Career Development': 'career_development', 'YPP Conditions': 'ypp_conditions',
       'Languages': 'languages_note', 'Education': 'education_extra'}
# Inside Eligibility, only these headers end the section ("Education" and "Languages" are sub-headings there).
ENDS_ELIGIBILITY = {'Career Development', 'YPP Conditions', 'Required Languages', 'Desirable Languages'}


def lang_table(lines):
    """Tab-separated rows: Language, Reading, Writing, Listening, Speaking (header row skipped)."""
    rows = [l.split('\t') for l in lines if l.count('\t') >= 4 and not l.startswith('Language\t')]
    return [dict(language=r[0].strip(), reading=r[1].strip(), writing=r[2].strip(),
                 listening=r[3].strip(), speaking=r[4].strip()) for r in rows]


def clean(s):
    """Trim trailing spaces and runs of blank lines; empty -> None."""
    s = re.sub(r'[ \t ]+\n', '\n', s)
    s = re.sub(r'\n\s*\n(\s*\n)+', '\n\n', s)
    return s.strip() or None


def grab(text, name):
    """Sub-section of the eligibility text that starts with a heading like 'Education:' / 'Work Experience'
    and runs until the next such heading. Returns None if the heading isn't there."""
    heading = r'(?:Desirable\s+)?(?:Work\s+)?(?:Education|Experience|Languages?)s?\s*(?::|\n)'
    m = re.search(rf'(?:^|\n)[ \t]*(?:Desirable\s+)?(?:Work\s+)?{name}s?\s*(?::|\n)\s*(.+?)(?=\n[ \t]*{heading}|\Z)',
                  text, re.S | re.I)
    return clean(m.group(1)) if m else None


def parse_block(ch):
    L = ch.split('\n')
    S = [l.strip() for l in L]

    def after(lbl): return S[S.index(lbl) + 1] if lbl in S else None
    def before(lbl): return S[S.index(lbl) - 1] if lbl in S else None

    rec = dict(mjo_number=after('Mobility Job Opening'), title_full=after('Job Code Title'), level=after('Level'),
               department=before('Department'), duty_station_jo=before('Duty Station Code'),
               ypp_exercise=after('YPP Exercise'))
    # Split sections: everything after the 'Global Dynamic Adaptable Workforce' line.
    start = S.index('Global Dynamic Adaptable Workforce') if 'Global Dynamic Adaptable Workforce' in S else 0
    cur = None
    buf = collections.defaultdict(list)
    for raw, s in zip(L[start + 1:], S[start + 1:]):
        in_elig = cur == 'Eligibility & Suitability Req'
        if s in SECTIONS and (not in_elig or s in ENDS_ELIGIBILITY):
            cur = s
            continue
        if cur:
            buf[cur].append(raw)
    for lbl, k in KEY.items():
        rec[k] = clean('\n'.join(buf.get(lbl, [])))
    elig = rec['eligibility'] or ''
    rec['education'] = grab(elig, 'Education') or rec.get('education_extra')
    rec.pop('education_extra', None)
    rec['experience'] = grab(elig, 'Experience')
    rec['languages'] = dict(required=lang_table(buf.get('Required Languages', [])),
                            desirable=lang_table(buf.get('Desirable Languages', [])),
                            sentence=grab(elig, 'Language'))
    if not rec['languages']['sentence']:
        # Some JOs have the language sentence without a heading ("English and French are the ... working
        # languages ..."). Take that line as the sentence and remove it from the end of the experience text.
        m = re.search(r'^[ \t]*(English and French are[^\n]*working languages[^\n]*)$', elig, re.M | re.I)
        if m:
            rec['languages']['sentence'] = m.group(1).strip()
            if rec['experience'] and rec['experience'].endswith(rec['languages']['sentence']):
                rec['experience'] = clean(rec['experience'][:-len(rec['languages']['sentence'])])
    m = re.search(r'Reports? (?:directly )?to (?:the )?([^.\n]+)', rec['org_setting_and_reporting'] or '', re.I)
    rec['reports_to_snippet'] = m.group(0).strip() if m else None
    rec['raw_text'] = ch
    return rec


def parse(verbose=True):
    """Parse all JOs; write outputs; return (jos dict keyed by MJO, list of problem strings)."""
    os.makedirs(os.path.join(DATA, 'raw', 'jos'), exist_ok=True)
    comp = list(csv.DictReader(open(os.path.join(DATA, 'compendium.csv'), encoding='utf-8')))
    cm = {c['mjo_number']: c for c in comp}
    t = open(SRC, encoding='utf-8').read().replace('\r\n', '\n')
    chunks = [x.strip('\n') for x in re.split(r'\n=+[ \t]*\n', t) if x.strip()]
    jos, dupes, problems = {}, [], []
    for ch in chunks:
        try:
            rec = parse_block(ch)
        except Exception as e:  # never stop the build on one bad block; report it instead
            problems.append(f'Could not parse a block starting "{ch[:60]!r}": {e}')
            continue
        if not rec['mjo_number'] or not re.fullmatch(r'\d{6}', rec['mjo_number']):
            problems.append(f'Block without a valid MJO number (starts "{ch[:60]!r}")')
            continue
        if rec['mjo_number'] in jos:
            dupes.append(rec['mjo_number'])
            if jos[rec['mjo_number']]['raw_text'] == ch:
                continue  # identical duplicate paste: keep one
            problems.append(f"{rec['mjo_number']} appears twice with DIFFERENT text; the last copy is used")
        jos[rec['mjo_number']] = rec
        open(os.path.join(DATA, 'raw', 'jos', f"{rec['mjo_number']}.txt"), 'w', encoding='utf-8').write(ch + '\n')
    json.dump(list(jos.values()), open(os.path.join(DATA, 'jos_parsed.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    # ---- validation report
    def n(s): return re.sub(r'[^a-z]', '', (s or '').lower().replace('programme', 'program'))
    rep = ['# Validation report', '', f'- JO blocks in file: {len(chunks)}', f'- Unique MJO numbers: {len(jos)}',
           f'- Posts in compendium: {len(comp)}', f'- Duplicate blocks (identical, kept once): {dupes}',
           f'- In compendium but no JO text: {sorted(set(cm) - set(jos))}',
           f'- JO text not in compendium: {sorted(set(jos) - set(cm))}', '', '## Duty station mismatches (JO vs compendium)']
    for k, j in jos.items():
        if k in cm and (j['duty_station_jo'] or '').lower() != cm[k]['duty_station'].lower():
            rep.append(f'- {k}: {j["duty_station_jo"]} vs {cm[k]["duty_station"]}')
    rep += ['', '## Title differences (JO title is the official one; compendium may be truncated or use a different name)']
    for k, j in sorted(jos.items()):
        if k in cm and not n(j['title_full']).startswith(n(cm[k]['title_compendium'])[:15]):
            rep.append(f'- {k}: JO "{j["title_full"]}" / compendium "{cm[k]["title_compendium"]}"')
    rep += ['', '## Posts requiring a language other than English']
    for k, j in sorted(jos.items()):
        ls = [x['language'] for x in j['languages']['required'] if x['language'] != 'English']
        if ls and k in cm:
            rep.append(f'- {k} ({cm[k]["entity"]}, {cm[k]["duty_station"]}, {j["title_full"]}): {", ".join(ls)}')
    rep += ['', '## Field coverage']
    for f in ['org_setting_and_reporting', 'responsibilities', 'competencies', 'education', 'experience',
              'reports_to_snippet']:
        miss = [k for k, j in jos.items() if not j.get(f)]
        rep.append(f'- {f}: missing in {len(miss)}' + (f' {sorted(miss)}' if miss else ''))
    miss = sorted(k for k, j in jos.items() if not j['languages']['required'])
    rep.append(f'- required language table: missing in {len(miss)} {miss if miss else ""}')
    miss = sorted(k for k, j in jos.items() if not j['languages']['sentence'])
    rep.append(f'- "Language:" sentence in eligibility: missing in {len(miss)} {miss if miss else ""}')
    if problems:
        rep += ['', '## Parsing problems'] + [f'- {p}' for p in problems]
    open(os.path.join(DATA, 'validation_report.md'), 'w', encoding='utf-8').write('\n'.join(rep) + '\n')
    if verbose:
        print('\n'.join(rep))
    return jos, problems


if __name__ == '__main__':
    parse()
