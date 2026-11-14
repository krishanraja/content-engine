#!/usr/bin/env python3
"""The history test for the ideas board's checks (the ideas quality plan, item 11): every check is first run on the past
boards, using only what was known before each board was made.

    python3 scripts/post-pack/ideas_history.py check            # replay the checks on the fixture, print each board
    python3 scripts/post-pack/ideas_history.py check --json     # the same, as JSON (the eval suite reads it)
    python3 scripts/post-pack/ideas_history.py build --dumps <dir> [--out <file>]

It must pass three tests (Krish's own boards as the measure, never a reader's judgement):
  (a) it catches the 16 Nov Infosys Monday option: a warning that is never placed first while P6 waits for his yes,
      and a block once he approves it;
  (b) it fails the 16 Nov Infosys off-day return, for coming back unchanged;
  (c) it blocks none of his main picks, none of his off-day approvals, and no option that answers his own ask (the
      16 Nov wed-1 option names Qwen, a subject of a rejected option, and answers his 6 Nov ask).

The fixture (apps/control-plane/scripts/eval/cases/ideas-history.json, also the eval suite's cases) holds ids, names
and short hashes only, never his words: `build` reads his words from read-only dumps of the live tables, runs the same
code the Sunday run runs (idea_checks.py), and keeps what the decisions read. tests/ideas_history_test.py replays it
and fails on any field that could carry his words.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import idea_checks as ic  # noqa: E402

FIXTURE = ROOT / 'apps' / 'control-plane' / 'scripts' / 'eval' / 'cases' / 'ideas-history.json'
# Each board, and when it was made: the run's own date (ideas.json checked_on, or the off days' file), so only what he
# said before it counts.
BOARDS = {'2026-10-19': '2026-10-18T23:59:59', '2026-10-26': '2026-10-25T23:59:59', '2026-11-02': '2026-10-31T00:00:00',
          '2026-11-09': '2026-11-02T23:59:59', '2026-11-16': '2026-11-07T23:59:59'}
# His first press on each board: a board is read as it stood just before it (git), so an option moved later still counts.
FIRST_PRESS = {'2026-10-19': '2026-10-19T02:45:00', '2026-10-26': '2026-10-26T09:28:00', '2026-11-02': '2026-11-02T09:12:00',
               '2026-11-09': '2026-11-03T06:43:00', '2026-11-16': '2026-11-09T13:05:00'}
# What the checks read, reduced: these keys only, and no string longer than the longest id the engine uses (a sha256).
ID_MAX = 64


# ---------------------------------------------------------------------------------------------------------------------
# Build: his words in, ids and names out.


def _rows(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise SystemExit(f'{path}: not a list of rows ({str(data)[:200]})')
    return data


def as_pressed(path, before):
    """A board file as it stood just before his first press on it (the last commit before then), else as it is now."""
    import subprocess
    rel = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else None
    if rel:
        sha = subprocess.run(['git', 'log', '-1', f'--before={before}Z', '--format=%H', '--', rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        if sha:
            shown = subprocess.run(['git', 'show', f'{sha}:{rel}'], cwd=ROOT, capture_output=True, text=True)
            if shown.returncode == 0:
                return json.loads(shown.stdout)
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def sources_before(week, cutoff, dumps):
    """sources.json as a gather on the board's day would have read it, from the dumps of the live tables: his answers on
    the eight boards before (idea_outcomes, latest per document), his cues, his asks and his Drops, each said before the
    cutoff."""
    cut = ic.stamp(cutoff)
    outcomes = {'filed': [], 'rejected': [], 'trend': [], 'improved': []}
    seen = set()
    rows = sorted(_rows(dumps / 'outcomes.json'), key=lambda r: (ic.stamp(r['decided_at']), r['id']), reverse=True)
    for r in rows:
        if ic.stamp(r['decided_at']) > cut or str(r['week']) >= week:
            continue
        key = (r['week'], r['doc'])
        if key in seen:
            continue
        seen.add(key)
        if r['outcome'] in outcomes:
            outcomes[r['outcome']].append({'week': r['week'], 'day': r['day'], 'idea_id': r['idea_id'], 'option': r['option_ref'], 'doc': r['doc'],
                                           'said': r['words'], 'at': r['decided_at'], 'shown': r.get('shown')})
    cues = {}
    for c in _rows(dumps / 'cues.json'):
        if c.get('said_at') and ic.stamp(c['said_at']) <= cut:
            cues.setdefault(c['use'] if c['use'] != 'track_over_time' else 'tracked', []).append(
                {'id': c['id'], 'subject_ref': c['subject_ref'], 'subject': c['subject'], 'said': c['said'], 'said_at': c['said_at'], 'use_origin': c['use_origin']})
    cues = {('not_for_us' if k == 'not_for_us' else k): v for k, v in cues.items()}
    asks = [{'id': a['id'], 'his_words': {'why_here': a.get('why_here'), 'why_like': a.get('why_like') if a.get('why_like_source') == 'typed' else None,
                                          'would_do': a.get('would_do')}, 'words_at': a.get('answered_at') or a.get('created_at')}
            for a in _rows(dumps / 'asks.json') if ic.stamp(a.get('answered_at') or a.get('created_at')) <= cut]
    drops = []
    for t in _rows(dumps / 'triage.json'):
        tri = ((t.get('queue') or {}).get('triage') or {})
        if tri.get('verdict') == 'drop' and tri.get('decided_by') == 'Krish' and ic.stamp(tri.get('at')) <= cut:
            drops.append({'id': t['id'], 'idea': t.get('idea'), 'reason': tri.get('reason'), 'at': tri.get('at')})
    return {'week_start': week, 'outcomes': outcomes, 'cues': cues, 'asks': asks, 'must_cover': [], 'taste': {'drops': drops}}


def from_press(o, answers, week):
    """The press an option says it came from, when its `from` line names one on an earlier board ("Your Future trend
    press on the 9 Nov board"): the answer on that board on the same idea."""
    m = re.search(r'press on the (\d{1,2}) (Oct|Nov|Dec) board', str(o.get('from') or ''))
    if not m or not o.get('id'):
        return o.get('from_press')
    board = f'2026-{ {"Oct": 10, "Nov": 11, "Dec": 12}[m.group(2)]:02d}-{int(m.group(1)):02d}'
    hit = [a for a in answers if a['week'] == board and a['idea_id'] == str(o['id']).lower()]
    return hit[0]['ref'] if hit else None


def picked(week, dumps):
    """(the main options he approved on the board at any press, the off-day options he approved), by ref."""
    main, off = set(), set()
    for r in _rows(dumps / 'outcomes.json'):
        if r['week'] != week or r['outcome'] != 'approved':
            continue
        if r['via'] == 'pick':
            main.add(('idea', str(r['idea_id']).lower()))
        elif r['via'] == 'offday':
            off.add(f'off-{r["day"]}-{ic.offday_id(r["doc"])}')
    return main, off


# The October boards predate idea_outcomes: his picks there are the board_history picks relayed from his triage (19 Oct)
# and the pieces made from the 26 Oct board (its Monday, Wednesday and Friday picks).
OCTOBER_PICKS = {'2026-10-19': ['mon-1', 'wed-1', 'fri-2'], '2026-10-26': ['mon-1', 'wed-1', 'fri-1']}


def reduce_refusal(r):
    return {k: r[k] for k in ('ref', 'at', 'week', 'day', 'idea_id', 'option', 'hard', 'subjects', 'via')} | {'said16': ic.short_hash(r['said'])}


def reduce_answer(a, earlier16):
    return {k: a[k] for k in ('ref', 'kind', 'at', 'week', 'day', 'doc', 'idea_id', 'option')} | {
        'said16': ic.short_hash(a['said']) if a['said'] else None, 'questions': len(ic.questions(a['said'])) if a['said'] else 0, 'was16': earlier16(a)}


def build(dumps, plans=None):
    """The fixture: for each past board, what the checks read, reduced."""
    import board_feed
    dumps = Path(dumps)
    plans = Path(plans) if plans else ROOT / 'docs' / 'plans'
    shown_text, earlier16 = board_feed.plans_reader(plans)
    boards = []
    for week, cutoff in BOARDS.items():
        folder = plans / f'{week}-week'
        ideas, growth = as_pressed(folder / 'ideas.json', FIRST_PRESS[week]), as_pressed(folder / 'offdays-growth.json', FIRST_PRESS[week])
        if growth and not ideas.get('offdays'):
            # The 2 Nov off days are Growth's file, keyed by date: read as ideas.json offdays.
            from datetime import date
            ideas = dict(ideas, offdays={('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[date.fromisoformat(d).weekday()]:
                                         [dict(o, id=o.get('concept_id')) for o in opts] for d, opts in (growth.get('days') or {}).items()})
        sources = sources_before(week, cutoff, dumps)
        refused = ic.refusals_from(sources, shown_text)
        answers = ic.answers_of(sources)
        said = ic.his_words(sources)
        opts = ic.board_options(ideas)
        days = ideas.get('days') or {}
        for o in opts:
            if o['main']:
                raw = (days.get(o['day']) or [])[o['pos'] - 1]
                o['from_press'] = from_press(raw, answers, week)
        main, off = picked(week, dumps)
        picks = sorted({o['ref'] for o in opts if o['main'] and ('idea', o['idea_id']) in main} | set(OCTOBER_PICKS.get(week, [])))
        asks = ic.his_ids(sources)
        boards.append({
            'week': week, 'known_before': ic.stamp(cutoff),
            'options': [{k: o[k] for k in ('ref', 'day', 'pos', 'main', 'idea_id', 'off_id', 'names', 'covers', 'source_kind', 'recommended',
                                           'text16', 'source_dates', 'from_press')} for o in opts],
            'refusals': [reduce_refusal(r) for r in refused['refusals']],
            'filed': [reduce_answer(a, earlier16) for a in refused['filed']],
            'answers': [reduce_answer(a, earlier16) for a in answers],
            'mentions': [{'at': at, 'names': ic.names(words), 'ref': ref} for at, words, ref in said],
            'asks': sorted(asks),
            'picks': picks, 'approvals': sorted(off & {o['ref'] for o in opts}),
            'answers_ask': sorted(o['ref'] for o in opts if set(o['covers']) & asks),
        })
    return {'about': ('The ideas board checks replayed on the past boards (scripts/post-pack/ideas_history.py). Built from read-only dumps '
                      'of the live tables; ids, names and short hashes only, never his words.'), 'boards': boards}


# ---------------------------------------------------------------------------------------------------------------------
# Check: the same decisions the Sunday run makes, on the reduced boards.


def replay(board, p6=False, mutate=None):
    """The findings on one past board. mutate: a check to switch off, to prove the test can fail ('refused')."""
    opts = board['options']
    refused = {'refusals': [] if mutate == 'refused' else board['refusals'], 'filed': board['filed']}
    said = [(s['at'], ' | '.join(s['names']), s['ref']) for s in board['mentions']]
    found = ic.refused_findings(opts, refused, board['asks'], said, (), p6)
    was = {a['ref']: a.get('was16') for a in board['answers']}
    found += ic.returns_findings(opts, board['answers'], lambda a: was.get(a['ref']), shape=False)
    return found


def board_ok(board, p6=False, mutate=None):
    """(ok, misses) for one past board: it blocks none of his picks, approvals or answered asks, and on the 16 Nov board
    it warns the Infosys Monday option off first place (refuses it with P6) and holds the Infosys off-day return for
    coming back unchanged."""
    found = replay(board, p6, mutate)
    blocks = {f['ref'] for f in found if f['code'] in ic.GATE_CODES and not (p6 and f['code'] == 'refused' and board['week'] == '2026-11-16' and f['ref'] == 'mon-1')}
    misses = [f'blocks {kind} {ref}' for kind in ('picks', 'approvals', 'answers_ask') for ref in sorted(set(board[kind]) & blocks)]
    if board['week'] == '2026-11-16':
        codes = {(f['code'], f['ref']) for f in found}
        if ('refused' if p6 else 'warned_first', 'mon-1') not in codes:
            misses.append('the Infosys Monday option is not ' + ('refused' if p6 else 'warned off first place'))
        if not any(f['code'] == 'return' and f['ref'] == 'off-tue-infosys' and 'unchanged' in f['why'] for f in found):
            misses.append('the Infosys off-day return is not held for coming back unchanged')
    return not misses, misses, found


def verdict(fixture, mutate=None):
    """(passed, lines): the three tests on every board."""
    lines, ok = [], True
    by_week = {b['week']: b for b in fixture['boards']}
    nov16 = by_week['2026-11-16']
    mon = next(o for o in nov16['options'] if o['main'] and o['day'] == 'mon' and 'Infosys' in o['names'] and o['pos'] == 1)
    off = next(o for o in nov16['options'] if not o['main'] and o['off_id'] == 'infosys')
    before, after = replay(nov16, False, mutate), replay(nov16, True, mutate)
    a_ok = (any(f['code'] == 'warned' and f['ref'] == mon['ref'] and f['subject'] == 'Infosys' for f in before)
            and any(f['code'] == 'warned_first' and f['ref'] == mon['ref'] for f in before)
            and not any(f['code'] == 'refused' and f['ref'] == mon['ref'] for f in before)
            and any(f['code'] == 'refused' and f['ref'] == mon['ref'] for f in after))
    lines.append(f'(a) 16 Nov {mon["ref"]} (Infosys): ' + ('warned and never first before P6, refused after P6' if a_ok else 'NOT CAUGHT as the plan says'))
    b_ok = any(f['code'] == 'return' and f['ref'] == off['ref'] and 'unchanged' in f['why'] for f in before)
    lines.append(f'(b) 16 Nov {off["ref"]}: ' + ('held for coming back unchanged' if b_ok else 'NOT HELD for coming back unchanged'))
    c_ok, counts = True, {'picks': 0, 'approvals': 0, 'answers_ask': 0}
    for b in fixture['boards']:
        found = replay(b, False, mutate)
        blocks = {f['ref'] for f in found if f['code'] in ic.GATE_CODES}
        for kind in ('picks', 'approvals', 'answers_ask'):
            counts[kind] += len(b[kind])
            hit = sorted(set(b[kind]) & blocks)
            if hit:
                c_ok = False
                lines.append(f'(c) {b["week"]}: blocks {kind} {", ".join(hit)}')
        lines.append(f'    {b["week"]}: {len(b["options"])} options, {len(b["refusals"])} refusals known before it; '
                     f'gate findings on {", ".join(sorted(blocks)) or "none"}')
    lines.append(f'(c) blocks none of {counts["picks"]} main picks, {counts["approvals"]} off-day approvals and {counts["answers_ask"]} '
                 f'options that answer his asks' if c_ok else '(c) FAILED')
    ok = a_ok and b_ok and c_ok
    return ok, lines


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('check')
    c.add_argument('--fixture', default=str(FIXTURE))
    c.add_argument('--json', action='store_true')
    c.add_argument('--mutate', choices=['refused'], help='switch a check off, to see the test fail')
    r = sub.add_parser('replay', help='one past board: its findings and whether it meets the history test, as JSON (the eval suite)')
    r.add_argument('--fixture', default=str(FIXTURE))
    r.add_argument('--week', required=True)
    r.add_argument('--p6', action='store_true', help='as if he had approved P6')
    r.add_argument('--mutate', choices=['refused'])
    b = sub.add_parser('build')
    b.add_argument('--dumps', required=True, help='a folder with outcomes.json, cues.json, asks.json and triage.json (read-only dumps)')
    b.add_argument('--out', default=str(FIXTURE))
    args = ap.parse_args(argv)
    if args.cmd == 'build':
        data = build(args.dumps)
        Path(args.out).write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'wrote {args.out}: {len(data["boards"])} boards')
        return 0
    fixture = json.loads(Path(args.fixture).read_text(encoding='utf-8'))
    if args.cmd == 'replay':
        board = next((b for b in fixture['boards'] if b['week'] == args.week), None)
        if not board:
            print(json.dumps({'ok': False, 'misses': [f'no board {args.week} in the fixture']}))
            return 1
        ok, misses, found = board_ok(board, args.p6, args.mutate)
        print(json.dumps({'week': args.week, 'ok': ok, 'misses': misses, 'findings': [{k: f[k] for k in ('code', 'ref')} for f in found]}))
        return 0
    ok, lines = verdict(fixture, args.mutate)
    if args.json:
        print(json.dumps({'ok': ok, 'lines': lines}))
    else:
        print('\n'.join(lines))
        print('history test ' + ('passed' if ok else 'FAILED'))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
