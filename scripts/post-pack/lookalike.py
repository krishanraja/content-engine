#!/usr/bin/env python3
"""The lookalike step of the Sunday ideas run: what travels in his Instagram inspo sheet, as patterns the run then
searches the web for.

Krish, 2026-11-16: "we also need to build a lookalike model of stories that pull from the latest in [the Instagram
inspo sheet] and then go and find similar if not better stories on the web. The the suggestions, as a result, should be
either one clear theme containing lots of different news stories or one clear story that we can dive into. The goal
should always be immediate utility for the user, or interest, or humor."

    python3 scripts/post-pack/lookalike.py prepare 2026-11-23
    python3 scripts/post-pack/lookalike.py check 2026-11-23

prepare reads the sheet ("Instagram inspo.xlsx", Drive 1N3qftTy5aHiFjMkK_2c_O4rOvTAirw3N, tabs Themes and Posts)
through the engine (GET /api/inspiration/instagram-sheet, the operator key, read-only, no spend), takes the newest 100
Posts rows (by Published, else Retrieved: the profile-grid backfill of 16 Nov has no Published date) and the Themes tab,
and writes docs/plans/<Monday>-week/lookalike-input.json with how fresh the sheet is. When the sheet cannot be read, it
says why and uses the feed the gather already holds (sources.json inspiration.lookalike_feed, the same sheet's rows over
45 days), marked source "feed_fallback". A stale sheet (its newest row older than three days) or a fallback is a
warning in `warnings`, never a quiet skip: check refuses a lookalike.json whose _about does not carry each one, and the
gate refuses an ideas.json whose _about does not (board_feed.py lookalike_of, idea_checks.aim_findings).

The session then writes docs/plans/<Monday>-week/lookalike.json: 5 to 8 patterns, each
{"id", "pattern", "why_it_travels", "aim": "utility"|"interest"|"humour", "examples": [post URLs from the input],
"search_briefs": ["<what to search the web for this week>"]}, and check verifies it: every example is a post in the
input, nothing invented.
"""
import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'scripts'))
import idea_checks  # noqa: E402

SHEET_ROUTE = '/api/inspiration/instagram-sheet'
XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
NEWEST = 100
STALE_DAYS = 3
PATTERNS_MIN, PATTERNS_MAX = 5, 8
AIMS = idea_checks.AIMS
# The Posts tab's columns, by the words of each header (case and spacing aside).
COLUMNS = {
    'post_id': 'post id', 'published': 'published', 'retrieved': 'retrieved', 'type': 'type', 'pages': 'pages',
    'capture_status': 'capture status', 'headline': 'headline', 'summary': 'faithful summary', 'claims': 'future-of-ai claims',
    'entities': 'named entities', 'horizon': 'time horizon', 'evidence': 'evidence or source named', 'caption': 'full caption',
    'slides': 'carousel slide text', 'url': 'post url', 'account': 'account',
}
CLIP = {'caption': 300, 'slides': 600, 'summary': 600, 'claims': 400, 'entities': 300, 'evidence': 300, 'headline': 300}


class LookalikeError(Exception):
    pass


def monday(text):
    try:
        d = date.fromisoformat(str(text))
    except ValueError:
        raise LookalikeError(f'{text!r} is not a date, YYYY-MM-DD')
    if d.weekday() != 0:
        raise LookalikeError(f'{text} is not a Monday: give the Monday the week starts on')
    return d.isoformat()


def when(value):
    """A cell as a UTC time, 'YYYY-MM-DDTHH:MM:SSZ', or None when it is blank or not a time."""
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    else:
        text = str(value).strip().replace('Z', '+00:00')
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            try:
                dt = datetime.strptime(text[:16], '%Y-%m-%d %H:%M')
            except ValueError:
                return None
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def text(value, cap=None):
    t = '' if value is None else str(value).strip()
    return t[:cap] if cap else t


def header_map(row):
    """{field: column index} from the Posts tab's header row."""
    out = {}
    for i, h in enumerate(row):
        h = ' '.join(str(h or '').lower().split())
        for field, words in COLUMNS.items():
            if field not in out and h.startswith(words):
                out[field] = i
    return out


def parse_sheet(data):
    """(posts, themes, rows_total) from the workbook's bytes. posts: every Posts row with its post URL, each a dict of
    the named columns; themes: the Themes tab's rows as {header: value}."""
    import openpyxl
    try:
        book = openpyxl.load_workbook(BytesIO(data), read_only=True, data_only=True)
    except Exception as error:  # a workbook it cannot open is said, never read as empty
        raise LookalikeError(f'the sheet is not a workbook openpyxl can read ({type(error).__name__})')
    names = {n.lower(): n for n in book.sheetnames}
    if 'posts' not in names:
        raise LookalikeError(f'the sheet has no Posts tab (tabs: {", ".join(book.sheetnames)})')
    rows = list(book[names['posts']].iter_rows(values_only=True))
    if not rows:
        raise LookalikeError('the Posts tab is empty')
    cols = header_map(rows[0])
    missing = [f for f in ('published', 'retrieved', 'headline', 'url') if f not in cols]
    if missing:
        raise LookalikeError(f'the Posts tab has no {", ".join(COLUMNS[f] for f in missing)} column')
    posts = []
    for row in rows[1:]:
        if not any(v not in (None, '') for v in row):
            continue
        get = lambda f: row[cols[f]] if f in cols and cols[f] < len(row) else None
        post = {f: text(get(f), CLIP.get(f)) for f in COLUMNS if f not in ('published', 'retrieved')}
        post['published'] = when(get('published'))
        post['retrieved'] = when(get('retrieved'))
        if post['url'].startswith('http'):
            posts.append(post)
    themes = []
    if 'themes' in names:
        trows = list(book[names['themes']].iter_rows(values_only=True))
        heads = [text(h) for h in (trows[0] if trows else [])]
        for row in trows[1:]:
            item = {heads[i] or f'col{i + 1}': text(v, 600) for i, v in enumerate(row) if i < len(heads) and v not in (None, '')}
            if item:
                themes.append(item)
    return posts, themes, len(posts)


def newest_first(posts):
    """Newest first by Published, else Retrieved."""
    return sorted(posts, key=lambda p: p.get('published') or p.get('retrieved') or '', reverse=True)


def freshness(posts, today):
    """How fresh the sheet is: its newest Published and Retrieved times, its rows, and how many are from the last seven
    days (by Published, else Retrieved)."""
    pub = max((p['published'] for p in posts if p.get('published')), default=None)
    ret = max((p['retrieved'] for p in posts if p.get('retrieved')), default=None)
    since = (today - timedelta(days=7)).isoformat()
    return {'newest_published': pub, 'newest_retrieved': ret, 'rows_total': len(posts),
            'rows_last_7_days': sum(1 for p in posts if str(p.get('published') or p.get('retrieved') or '')[:10] >= since)}


def stale_warning(fresh, today, what='the Instagram inspo sheet'):
    """The warning when the newest row (Published or Retrieved) is older than STALE_DAYS, else None."""
    newest = max([x for x in (fresh.get('newest_published'), fresh.get('newest_retrieved')) if x], default=None)
    if newest and date.fromisoformat(newest[:10]) >= today - timedelta(days=STALE_DAYS):
        return None
    return (f'Stale sheet: {what}\'s newest row is {(newest or "none")[:10]}, more than {STALE_DAYS} days before '
            f'{today.isoformat()}; the patterns lean on older posts.')


def feed_posts(sources):
    """(posts, which list) for the fallback: the feed the gather read (sources.json inspiration.lookalike_feed, else
    inspiration.feed, from a route that predates it), as posts."""
    inspo = (sources or {}).get('inspiration') if isinstance((sources or {}).get('inspiration'), dict) else {}
    which = 'inspiration.lookalike_feed' if isinstance(inspo.get('lookalike_feed'), list) else 'inspiration.feed'
    rows = inspo.get(which.split('.')[1])
    out = []
    for r in rows or []:
        if isinstance(r, dict) and str(r.get('url') or '').startswith('http'):
            out.append({'post_id': None, 'published': when(r.get('at')), 'retrieved': None, 'type': None, 'headline': text(r.get('title'), 300),
                        'summary': text(r.get('excerpt'), 600), 'url': r['url'], 'account': r.get('account')})
    return out, which


def download(call_bytes=None):
    """The sheet's bytes through the engine, or LookalikeError with why."""
    if call_bytes is None:
        import engine
        try:
            token = engine.operator_key()
        except engine.NoKey as no_key:
            raise LookalikeError(str(no_key))
        call_bytes = lambda path: engine.call_bytes(path, token)
    try:
        status, data, kind = call_bytes(SHEET_ROUTE)
    except Exception as error:  # the engine unreachable is a reason, said
        raise LookalikeError(f'the engine could not be reached ({error})')
    if status != 200:
        raise LookalikeError(f'GET {SHEET_ROUTE}: HTTP {status}: {data[:200].decode("utf-8", "replace") if isinstance(data, bytes) else str(data)[:200]}')
    if XLSX_TYPE not in str(kind):
        raise LookalikeError(f'GET {SHEET_ROUTE} answered {kind or "no content type"}, not a workbook')
    return data


def prepare(week, call_bytes=None, plans=None, today=None, sheet_file=None):
    """(path written, summary lines): docs/plans/<Monday>-week/lookalike-input.json."""
    wk = monday(week)
    today = today or datetime.now(timezone.utc).date()
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week'
    folder.mkdir(parents=True, exist_ok=True)
    warnings, reason = [], None
    try:
        data = Path(sheet_file).read_bytes() if sheet_file else download(call_bytes)
        posts, themes, total = parse_sheet(data)
        if not posts:
            raise LookalikeError('the Posts tab has no row with a post URL')
        source = 'sheet'
    except (LookalikeError, OSError) as error:
        reason = ' '.join(str(error).split())[:300]
        try:
            sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
        except (OSError, ValueError):
            raise LookalikeError(f'the sheet could not be read ({reason}) and there is no sources.json to fall back on; gather first')
        (posts, which), themes, source = feed_posts(sources), [], 'feed_fallback'
        total = len(posts)
        if posts:
            warnings.append(f'Feed fallback: the Instagram inspo sheet could not be read ({reason[:200]}); the patterns come from the feed the '
                            f'gather read ({which}).')
        else:
            # Nothing to draw patterns from is said, never a stop: the run makes the week without the lookalike step and
            # carries this line in ideas.json _about (idea_checks.aim_findings asks for it word for word).
            warnings.append(f'No lookalike this week: the Instagram inspo sheet could not be read ({reason[:200]}) and the gathered feed '
                            'holds no post with a link, so no option names a pattern.')
    fresh = freshness(posts, today)
    stale = stale_warning(fresh, today, 'the Instagram inspo sheet' if source == 'sheet' else 'the gathered feed')
    if stale:
        warnings.append(stale)
    out = {'_about': ('The newest posts of his Instagram inspo sheet (Drive "Instagram inspo.xlsx"), read for the lookalike step '
                      '(scripts/post-pack/lookalike.py prepare). Newest first, by Published, else Retrieved.'),
           'week_start': wk, 'read_on': today.isoformat(), 'source': source, **({'reason': reason} if reason else {}),
           'freshness': fresh, 'warnings': warnings, 'posts': newest_first(posts)[:NEWEST], 'themes': themes}
    path = folder / 'lookalike-input.json'
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    lines = [f'lookalike input for the week of {wk}: {source}, {len(out["posts"])} of {total} posts, {len(themes)} themes; '
             f'newest published {fresh["newest_published"] or "none"}, newest retrieved {fresh["newest_retrieved"] or "none"}, '
             f'{fresh["rows_last_7_days"]} in the last 7 days']
    lines += [f'  WARNING: {w}' for w in warnings]
    return path, lines


def check_lookalike(look, given):
    """Problems with a lookalike.json against its lookalike-input.json; [] when it is ready."""
    out = []
    urls = {idea_checks.canon_url(p.get('url')) for p in (given or {}).get('posts') or [] if isinstance(p, dict)}
    urls.discard(None)
    pats = (look or {}).get('patterns')
    if not isinstance(pats, list) or not PATTERNS_MIN <= len(pats) <= PATTERNS_MAX:
        out.append(f'patterns: {PATTERNS_MIN} to {PATTERNS_MAX} of them ({len(pats) if isinstance(pats, list) else "none"} given)')
        pats = pats if isinstance(pats, list) else []
    seen = set()
    for n, p in enumerate(pats, 1):
        if not isinstance(p, dict):
            out.append(f'pattern {n}: an object')
            continue
        pid = str(p.get('id') or '').strip()
        label = pid or f'pattern {n}'
        if not pid or pid in seen:
            out.append(f'{label}: a short id of its own')
        seen.add(pid)
        for field in ('pattern', 'why_it_travels'):
            if len(str(p.get(field) or '').strip()) < 10:
                out.append(f'{label}: {field}, in a plain sentence')
        if p.get('aim') not in AIMS:
            out.append(f'{label}: aim is one of {", ".join(AIMS)}')
        ex = p.get('examples') if isinstance(p.get('examples'), list) else []
        if not ex:
            out.append(f'{label}: examples, the post URLs from the input it is drawn from')
        for u in ex:
            if idea_checks.canon_url(u) not in urls:
                out.append(f'{label}: example {u} is not a post in lookalike-input.json; use only the posts it holds')
        briefs = p.get('search_briefs') if isinstance(p.get('search_briefs'), list) else []
        if not [b for b in briefs if isinstance(b, str) and len(b.strip()) >= 10]:
            out.append(f'{label}: search_briefs, what to search the web for this week')
    about = str((look or {}).get('_about') or '')
    for w in (given or {}).get('warnings') or []:
        if w not in about:
            out.append(f'_about does not carry the warning, word for word: {w}')
    return out


def check(week, plans=None):
    wk = monday(week)
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week'
    try:
        given = json.loads((folder / 'lookalike-input.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        return [f'no lookalike-input.json ({error}); run lookalike.py prepare first']
    try:
        look = json.loads((folder / 'lookalike.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        return [f'no lookalike.json ({error}); write the patterns first']
    return check_lookalike(look, given)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('prepare', help='read the sheet (through the engine) into docs/plans/<Monday>-week/lookalike-input.json')
    p.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    p.add_argument('--file', help='read this workbook instead of downloading it (offline)')
    p.add_argument('--today', help='YYYY-MM-DD, for how fresh the sheet is (default: today, UTC)')
    c = sub.add_parser('check', help='check docs/plans/<Monday>-week/lookalike.json against its input')
    c.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    args = ap.parse_args(argv)
    try:
        if args.cmd == 'prepare':
            today = date.fromisoformat(args.today) if args.today else None
            path, lines = prepare(args.week, today=today, sheet_file=args.file)
            print('\n'.join(lines))
            print(f'wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
            return 0
        problems = check(args.week)
    except (LookalikeError, ValueError) as error:
        print(f'lookalike {args.cmd}: {error}', file=sys.stderr)
        return 1
    print('lookalike check: ' + ('NOT READY:\n  ' + '\n  '.join(problems) if problems else 'every pattern is drawn from posts in the input, with its aim and what to search for'))
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
