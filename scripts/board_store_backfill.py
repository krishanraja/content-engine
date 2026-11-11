#!/usr/bin/env python3
"""File a week's plan files in the piece materials store, so any session finds them from the board.

  python3 scripts/board_store_backfill.py 2026-11-09 2026-11-16 [--dry-run]

For each week it files every Markdown file in docs/plans/<week>-week/ (and sources.json) as it stands at HEAD: a file
named for a day (mon-research.md, narrative-lock-fri.md, fri-storyboard.md) on that day's piece (or the day when it has
no piece), any other on the week. Each is a text material in the store alone, never on a piece's working set, keyed
repo:<path>, so filing it again after the file changed adds a new version and the same bytes again add nothing
(docs/PUBLISH_BOARDS.md, "Sessions and materials"). Then it reads each piece's listing, which files anything on the
piece's working set the store does not hold yet. It prints counts by kind. Nothing is deleted or changed.

The engine key comes from scripts/engine.py; it is never printed.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import engine  # noqa: E402

DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
NAMES = {'monday': 'mon', 'tuesday': 'tue', 'wednesday': 'wed', 'thursday': 'thu', 'friday': 'fri', 'saturday': 'sat', 'sunday': 'sun'}
MAX = 2_000_000


def day_of(name):
    """The day a plan file is for, from its name, or None for the week."""
    for part in re.split(r'[-_.]', name.lower()):
        if part in DAYS:
            return part
        if part in NAMES:
            return NAMES[part]
    return None


def kind_of(name):
    n = name.lower()
    if 'research' in n or n == 'sources.json':
        return 'research'
    if 'storyboard' in n:
        return 'storyboard'
    if 'lock' in n or 'interview' in n or 'brief' in n or 'handover' in n:
        return 'note'
    return 'corpus'


def plan_files(week):
    folder = ROOT / 'docs' / 'plans' / f'{week}-week'
    if not folder.is_dir():
        return []
    out = []
    for p in sorted(folder.rglob('*')):
        if p.is_file() and (p.suffix.lower() == '.md' or p.name == 'sources.json') and p.stat().st_size <= MAX:
            out.append(p)
    return out


def call(method, path, body=None):
    status, text = engine.call(method, path, body, token=engine.operator_key())
    try:
        return status, json.loads(text) if text else {}
    except ValueError:
        return status, {'ok': False, 'error': text[:200]}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('weeks', nargs='+')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args(argv)
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()[:12]
    totals = Counter()
    for week in args.weeks:
        status, pieces = call('GET', f'/api/board/{week}/pieces')
        by_day = {}
        if status == 200:
            # GET /api/board/<Monday>/pieces: {days: [{day, date, piece_id, ...}]} (board/_posted.ts readPieces)
            for v in pieces.get('days') or []:
                pid = v.get('piece_id') if isinstance(v, dict) else None
                if isinstance(pid, str) and re.fullmatch(r'[0-9a-f-]{36}', pid):
                    by_day[str(v.get('day'))[:3]] = pid
        filed = Counter()
        for p in plan_files(week):
            rel = p.relative_to(ROOT).as_posix()
            day = day_of(p.name)
            where = {'piece_id': by_day[day]} if day in by_day else {'week': week, **({'day': day} if day else {})}
            body = {**where, 'content': p.read_text(encoding='utf-8'), 'title': p.name, 'kind': kind_of(p.name), 'role': 'plan',
                    'material_key': f'repo:{rel}', 'source': 'repo', 'source_ref': f'{rel}@{commit}', 'by': 'Claude Code'}
            if args.dry_run:
                print(f"would file {rel} on {where}")
                continue
            status, answer = call('POST', '/api/content-ideas/store?op=text', body)
            if status not in (200, 201):
                print(f"not filed {rel}: {answer.get('error')}")
                filed['refused'] += 1
                continue
            filed[('already there ' if answer.get('duplicate') else '') + body['kind']] += 1
        for day, pid in sorted(by_day.items()):
            status, listing = call('GET', f'/api/content-ideas/store?piece={pid}')
            if status == 200:
                kinds = Counter(m.get('kind') for m in listing.get('materials') or [] if m.get('where') == 'piece')
                print(f"{week} {day} piece {pid[:8]}: {sum(kinds.values())} on file ({', '.join(f'{k} {n}' for k, n in sorted(kinds.items()))})")
        print(f"{week}: plan files filed: {dict(filed)}")
        totals.update(filed)
    print(f"all weeks: {dict(totals)}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
