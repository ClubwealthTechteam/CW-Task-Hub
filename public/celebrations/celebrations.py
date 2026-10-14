#!/usr/bin/env python3
"""
Club Wealth daily celebrations: who has a birthday or work anniversary today, and whether today is a holiday.
Used by the Slack celebrations routine. Pure standard library, no network.

  python3 celebrations.py --date 2026-10-14 --fetch [--slack-users users.json] > plan.json

--fetch downloads the three "New Hires - Onboarding" tabs as CSV (they are shared by link; CW tabs only, never
HOMEXA or PFL). For testing, --sheet <file.json|file.csv> can be given instead (oldest first); a JSON file is the raw
values of one tab (a list of rows, header row first). Columns are found by their header, so the tabs may order them differently:
  status    "Remarks" (2025 / 2026 tabs) or "STATUS" (2023-2024 tab)  -> only "Working" people count
  name      "First and Last Name"
  birthday  "Date of Birth"
  position  "Position Hired For"
  start     "Start date (Friday Date)" or "Start date"
Later --sheet files win over earlier ones for the same person (pass oldest first), so a newer record with a
different status replaces an older one.
--slack-users is the "members" list from Slack users.list: people are matched by name to tag them and get photos.
"""
import argparse, csv, datetime as dt, io, json, re, sys, unicodedata, urllib.request

# The onboarding records, oldest first (a newer record for the same person wins).
SOURCES = [
    ('2023-2024', '1ql473Qhn0mJHkHrvuINZAkHSRClr3ClYbPkyPzMLJ8g', 199043715),  # tab "Form Responses 1"
    ('2025', '1-gltrA1qQekPpYik49VL_lgc0PvqkxsipRz4d1l89F4', 914234631),       # tab "2025"
    ('2026', '1cZ8RXgdvQ32CzXQlLMwojNe16cm3jQuwllTWBWaQHqI', 738878938),       # tab "CW"
]


def fetch_csv(sheet_id, gid):
    url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'cw-celebrations'}), timeout=60) as r:
        text = r.read().decode('utf-8')
    if text.lstrip().startswith('<'):
        raise SystemExit(f'Could not read sheet {sheet_id} (not shared by link?)')
    return list(csv.reader(io.StringIO(text)))


def load(path):
    if path.endswith('.csv'):
        return list(csv.reader(open(path, encoding='utf-8')))
    data = json.load(open(path))
    return data.get('values', data) if isinstance(data, dict) else data

# ---------------------------------------------------------------- holidays
GREETINGS = {
    'newyear': ("New Year's Day", "Happy New Year, <!here>! 🎆✨ Wishing everyone at Club Wealth a year filled with growth, success, new opportunities, and exciting milestones. Here's to another year of achieving great things together!"),
    'valentines': ("Valentine's Day", "Happy Valentine's Day, <!here>! ❤️💐 Today is a reminder to appreciate the people who make our lives and work more meaningful. Wishing everyone a day filled with love, kindness, and positivity!"),
    'easter': ('Easter', "Happy Easter, <!here>! 🐣🌷 May this special day bring renewed hope, peace, and happiness to you and your loved ones. Wishing everyone a beautiful and meaningful celebration!"),
    'july4': ('Independence Day', "Happy Fourth of July, <!here>! 🇺🇸🎆 Wishing everyone celebrating a wonderful and safe Independence Day filled with joy, gratitude, and meaningful moments with family and friends!"),
    'thanksgiving': ('Thanksgiving', "Happy Thanksgiving, <!here>! 🦃🍂 We're grateful to have such a dedicated team as part of the Club Wealth family. Thank you for your hard work, commitment, and contributions. Wishing you and your loved ones a wonderful Thanksgiving!"),
    'christmas': ('Christmas Day', "Merry Christmas, <!here>! 🎄🎁 Wishing everyone at Club Wealth a joyful holiday filled with love, peace, and happiness. Thank you for being part of our growing family and for everything you contribute. May this season bring wonderful memories and blessings to you and your loved ones!"),
    'ph-independence': ('Philippine Independence Day', "Happy Philippine Independence Day, <!here>! 🇵🇭✨ Today, we honor the courage, freedom, and sacrifices that shaped our nation. Wishing everyone a meaningful celebration filled with pride, gratitude, and unity!"),
    'halloween': ('Halloween', "Happy Halloween, <!here>! 🎃👻 Wishing everyone a fun-filled day with plenty of treats, laughter, and spooky good vibes. Stay safe and enjoy the festivities!"),
}
GENERAL = "Happy {name}, <!here>! 🎉✨ Wishing everyone celebrating a wonderful and meaningful holiday. May this special occasion bring happiness, peace, and positivity to you and your loved ones. Enjoy the celebration, and thank you for being part of the Club Wealth family!"


def easter(year):  # Anonymous Gregorian algorithm
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return dt.date(year, month, day)


def nth_weekday(year, month, weekday, n):  # weekday: Mon=0; n=-1 for last
    if n > 0:
        d = dt.date(year, month, 1)
        d += dt.timedelta(days=(weekday - d.weekday()) % 7)
        return d + dt.timedelta(weeks=n - 1)
    nxt = dt.date(year + (month == 12), month % 12 + 1, 1)
    d = nxt - dt.timedelta(days=1)
    return d - dt.timedelta(days=(d.weekday() - weekday) % 7)


def holidays(year):
    """key -> (date, name). Named greetings first; 'general:<name>' uses the General Holiday greeting."""
    return {
        'newyear': dt.date(year, 1, 1),
        'valentines': dt.date(year, 2, 14),
        'easter': easter(year),
        'ph-independence': dt.date(year, 6, 12),
        'july4': dt.date(year, 7, 4),
        'halloween': dt.date(year, 10, 31),
        'thanksgiving': nth_weekday(year, 11, 3, 4),
        'christmas': dt.date(year, 12, 25),
        # Special occasions (General Holiday greeting). Edit this list to add or drop days.
        "general:Mother's Day": nth_weekday(year, 5, 6, 2),
        'general:Memorial Day': nth_weekday(year, 5, 0, -1),
        "general:Father's Day": nth_weekday(year, 6, 6, 3),
        'general:National Heroes Day': nth_weekday(year, 8, 0, -1),
        'general:Labor Day': nth_weekday(year, 9, 0, 1),
        'general:Bonifacio Day': dt.date(year, 11, 30),
        'general:Rizal Day': dt.date(year, 12, 30),
    }


def holiday_for(day):
    for key, when in holidays(day.year).items():
        if when != day:
            continue
        if key.startswith('general:'):
            name = key.split(':', 1)[1]
            return {'key': 'general', 'name': name, 'title': f'Happy {name}', 'text': GENERAL.format(name=name)}
        name, text = GREETINGS[key]
        return {'key': key, 'name': name, 'title': None, 'text': text}
    return None

# ---------------------------------------------------------------- people
HEADERS = {
    'status': ['remarks', 'status'],
    'name': ['first and last name'],
    'birthday': ['date of birth'],
    'position': ['position hired for'],
    'start': ['start date (friday date)', 'start date'],
    'email': ['email address'],
    'preferred': ['preferred name at work'],
}


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', s.lower())).strip()


def parse_date(v):
    v = str(v or '').strip()
    if not v:
        return None
    for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%m/%d/%y', '%m-%d-%Y', '%B %d, %Y', '%b %d, %Y', '%d %B %Y', '%m/%d/%Y %H:%M:%S'):
        try:
            return dt.datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    if re.fullmatch(r'\d{5}', v):  # a Sheets serial number
        return dt.date(1899, 12, 30) + dt.timedelta(days=int(v))
    return None


def columns(header):
    h = [norm(x) for x in header]
    out = {}
    for field, names in HEADERS.items():
        for name in names:  # first header name that exists wins (e.g. "start date (friday date)" before "start date")
            if norm(name) in h:
                out[field] = h.index(norm(name))
                break
    return out


def people(sheets):
    by_key = {}
    for rows in sheets:
        if not rows:
            continue
        col = columns(rows[0])
        missing = [f for f in ('status', 'name', 'birthday', 'start') if f not in col]
        if missing:
            raise SystemExit(f'A sheet is missing columns: {missing} (headers: {rows[0]})')
        for row in rows[1:]:
            cell = lambda f: (row[col[f]] if f in col and col[f] < len(row) else '').strip()
            name = re.sub(r'\s+', ' ', cell('name'))
            if not name:
                continue
            rec = {
                'name': name, 'preferred': cell('preferred'), 'status': cell('status'), 'position': cell('position'),
                'birthday': parse_date(cell('birthday')), 'start': parse_date(cell('start')),
            }
            keys = {'n:' + norm(name)} | ({'e:' + norm(cell('email'))} if cell('email') else set())
            # A newer record for the same person (same name or same email) replaces every older one.
            for old in {id(by_key[k]): by_key[k] for k in keys if k in by_key}.values():
                old['superseded'] = True
            for k in keys:
                by_key[k] = rec
    out, seen = [], set()
    for p in by_key.values():
        if id(p) in seen or p.get('superseded'):
            continue
        seen.add(id(p))
        if p['status'].strip().lower() == 'working':
            out.append(p)
    return out


def same_day(d, today):
    if not d:
        return False
    if d.month == 2 and d.day == 29 and not is_leap(today.year):  # Feb 29: celebrate on Feb 28
        return today.month == 2 and today.day == 28
    return (d.month, d.day) == (today.month, today.day)


def is_leap(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)

# ---------------------------------------------------------------- Slack matching
def slack_index(members):
    idx = []
    for m in members or []:
        if m.get('deleted') or m.get('is_bot') or m.get('id') == 'USLACKBOT':
            continue
        prof = m.get('profile') or {}
        names = {norm(prof.get('real_name')), norm(prof.get('display_name')), norm(m.get('real_name')), norm(m.get('name', '').replace('.', ' '))}
        names.discard('')
        photo = prof.get('image_original') or prof.get('image_1024') or prof.get('image_512') or ''
        if prof.get('is_custom_image') is False or 'gravatar.com' in photo:
            photo = ''  # Slack's default avatar: use initials on the poster instead
        idx.append({'id': m['id'], 'names': names, 'photo': photo})
    return idx


def match(person, idx):
    """A Slack member whose name has the person's first and last name (and nothing contradicting). Unique only."""
    full = norm(person['name']).split()
    if not full:
        return None
    first, last = full[0], full[-1]
    pref = norm(person.get('preferred')).split()
    cands = []
    for u in idx:
        for n in u['names']:
            t = n.split()
            if (first in t or (pref and pref[0] in t)) and last in t:
                cands.append(u)
                break
    if len({c['id'] for c in cands}) == 1:
        return cands[0]
    if not cands:  # fall back to an exact full-name match
        exact = [u for u in idx if norm(person['name']) in u['names']]
        return exact[0] if len(exact) == 1 else None
    return None


def join(xs):
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--date', required=True)
    ap.add_argument('--sheet', action='append', default=[])
    ap.add_argument('--fetch', action='store_true')
    ap.add_argument('--slack-users')
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.date)
    sheets = [fetch_csv(sid, gid) for _, sid, gid in SOURCES] if a.fetch else [load(f) for f in a.sheet]
    team = people(sheets)
    idx = slack_index(json.load(open(a.slack_users)) if a.slack_users else [])

    def entry(p, kind):
        u = match(p, idx)
        e = {'name': p['name'], 'position': p['position'], 'slack_id': u['id'] if u else None, 'photo': u['photo'] if u else '',
             'tag': f"<@{u['id']}>" if u else f"*{p['name']}*"}
        if kind == 'anniversary':
            e['since'] = p['start'].isoformat()
            e['years'] = today.year - p['start'].year
        else:
            e['date'] = today.isoformat()
        return e

    # Skip obvious typos in the sheets: a birth date less than 15 years ago, or a start date over 20 years ago.
    birthdays = [entry(p, 'birthday') for p in team if same_day(p['birthday'], today) and p['birthday'].year <= today.year - 15]
    anniversaries = [entry(p, 'anniversary') for p in team if same_day(p['start'], today) and today.year - 20 <= p['start'].year < today.year]
    plan = {'date': today.isoformat(), 'working_people': len(team), 'holiday': holiday_for(today), 'birthdays': birthdays, 'anniversaries': anniversaries, 'messages': []}

    if birthdays:
        tags = join([b['tag'] for b in birthdays])
        plan['messages'].append({'kind': 'birthday', 'text': f"Happy Birthday, {tags}! 🎉🎂 Club Wealth family is wishing you a wonderful birthday filled with happiness, success, and exciting new opportunities. Thank you for being part of the Club Wealth family. May this year bring you more growth, achievements, and milestones to celebrate! 🥳"})
    if anniversaries:
        tags = join([x['tag'] for x in anniversaries])
        you = 'you' if len(anniversaries) == 1 else 'you both' if len(anniversaries) == 2 else 'you all'
        plan['messages'].append({'kind': 'anniversary', 'text': f"Happy Anniversary, {tags}! 🎉🥂 Thank you for being part of the Club Wealth family. Wishing {you} continued growth, success, and many more milestones to celebrate! 🏆✨"})
    if plan['holiday']:
        plan['messages'].append({'kind': 'holiday', 'text': plan['holiday']['text']})
    plan['unmatched'] = [x['name'] for x in birthdays + anniversaries if not x['slack_id']]
    json.dump(plan, sys.stdout, indent=2, ensure_ascii=False)


if __name__ == '__main__':
    main()
