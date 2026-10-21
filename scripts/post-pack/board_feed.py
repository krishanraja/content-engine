#!/usr/bin/env python3
"""Sunday's one gather step: every source of ideas and the queue, read from the engine, written to one file.

Krish, 2026-10-21: "the ideas tab should, on a Sunday, contain a fresh batch of ideas that sources from all my
different sources of ideas ... The ideas engine should have learnt from what I previously liked talking about ...
You also need to pick up on whether there are multiple things in the queue that could be consolidated into one bigger
piece". His taste steers the sourcing and ranking only; the judges stay blind. Learning
queue-consolidation-and-fresh-sunday-ideas.

    python3 scripts/post-pack/board_feed.py gather 2026-10-26

Read-only with the engine key, no model and no spend: GET /api/week/options?week_start=<Monday>&include=sources and
GET /api/idea-queue?combine=1, written to docs/plans/<Monday>-week/sources.json. It prints the count from each
source and says which is empty and why. Then the session (plan-week, steps 1 to 3b) writes ideas.json from the
pool, his ideas first, each with source_kind, why_here and beats, and combine.json from the groups worth combining,
and builds with --ideas --queue --combine.
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import making  # noqa: E402


class FeedError(Exception):
    pass


def monday(text):
    try:
        d = date.fromisoformat(text)
    except ValueError:
        raise FeedError(f'{text!r} is not a date, YYYY-MM-DD')
    if d.weekday() != 0:
        raise FeedError(f'{text} is not a Monday: give the Monday the week starts on')
    return d


def get(call, path):
    status, text = call('GET', path, None)
    if status != 200:
        raise FeedError(f'GET {path}: HTTP {status}: {str(text)[:200]}')
    try:
        data = json.loads(text)
    except ValueError:
        raise FeedError(f'GET {path}: the engine answered with something that is not JSON')
    if not isinstance(data, dict) or data.get('ok') is False:
        raise FeedError(f'GET {path}: {str(text)[:200]}')
    return data


def gather(week, call=None, out_dir=None):
    """(path written, summary lines). call: (method, path, body) -> (status, text), the engine key by default."""
    call = call or making._engine_call
    wk = monday(week).isoformat()
    options = get(call, f'/api/week/options?week_start={wk}&include=sources')
    queue = get(call, '/api/idea-queue?combine=1')
    sources = options.get('sources')
    if not isinstance(sources, dict):
        raise FeedError('the engine answered without a sources block; is the include=sources route deployed?')
    out = {
        'week_start': wk,
        'how': 'Read-only gather (board_feed.py). Write ideas.json from series[].pool, his ideas first, each with source_kind, '
               'why_here and beats; write combine.json from the combine groups worth combining; build with --ideas --queue --combine.',
        'counts': sources.get('counts') or {},
        'empty': sources.get('empty') or [],
        'series': [dict(s, mandate=next((x.get('mandate') for x in options.get('series') or [] if x.get('slug') == s.get('slug')), None))
                   for s in sources.get('series') or []],
        'unassigned': sources.get('unassigned') or [],
        'his_relayed': sources.get('his_relayed') or [],
        'taste': sources.get('taste') or {},
        'queue': queue.get('queue') or [],
        'combine': queue.get('combine') or [],
        'scheduled': {s.get('slug'): s.get('scheduled') or [] for s in options.get('series') or []},
    }
    folder = Path(out_dir) if out_dir else ROOT / 'docs' / 'plans' / f'{wk}-week'
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'sources.json'
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    counts = out['counts']
    lines = [f'sources for the week of {wk}: his {counts.get("his", 0)}, inspo {counts.get("inspo", 0)}, engine {counts.get("engine", 0)}; '
             f'queue {len(out["queue"])}, could combine {len(out["combine"])} group(s); his relayed words {len(out["his_relayed"])}']
    lines += [f'  {s.get("slug")}: {len(s.get("pool") or [])} in the pool' for s in out['series']]
    lines += [f'  empty: {e.get("source")}: {e.get("why")}' for e in out['empty']]
    return path, lines


def self_test():
    """No engine: a fake answer for each route, then what gather writes and says."""
    import tempfile
    pool = [{'id': 'a', 'idea': 'His', 'source_kind': 'his', 'why_here': None}, {'id': 'b', 'idea': 'Engine', 'source_kind': 'engine', 'why_here': 'close to ...'}]
    answers = {
        '/api/week/options?week_start=2026-10-26&include=sources': {'ok': True, 'series': [{'slug': 'follow_the_money', 'mandate': 'M', 'scheduled': []}],
            'sources': {'counts': {'his': 1, 'inspo': 0, 'engine': 1}, 'empty': [{'source': 'inspo', 'why': 'no scan'}],
                        'series': [{'slug': 'follow_the_money', 'pool': pool}], 'taste': {}, 'his_relayed': []}},
        '/api/idea-queue?combine=1': {'ok': True, 'queue': [{'id': 'q1'}, {'id': 'q2'}], 'combine': [{'ids': ['q1', 'q2']}]},
    }
    calls = []

    def call(method, path, body):
        calls.append((method, path))
        return (200, json.dumps(answers[path])) if path in answers else (404, 'no')
    problems = []
    with tempfile.TemporaryDirectory() as tmp:
        path, lines = gather('2026-10-26', call, tmp)
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        if [m for m, _ in calls] != ['GET', 'GET']:
            problems.append('gather must only read')
        if data['series'][0]['pool'][0]['source_kind'] != 'his' or data['series'][0]['mandate'] != 'M':
            problems.append('the pool keeps its order, his first, with the mandate beside it')
        if len(data['combine']) != 1 or len(data['queue']) != 2:
            problems.append('the queue and its combine groups are written')
        if not any('empty: inspo: no scan' in x for x in lines) or 'his 1, inspo 0, engine 1' not in lines[0]:
            problems.append('the counts and the empty source are said')
    for bad in ('2026-10-27', 'soon'):
        try:
            monday(bad)
            problems.append(f'{bad} must be refused')
        except FeedError:
            pass
    try:
        gather('2026-10-26', lambda m, p, b: (500, 'down'))
        problems.append('an engine error must be said, never written as an empty pool')
    except FeedError:
        pass
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    g = sub.add_parser('gather', help='read every source and the queue into docs/plans/<Monday>-week/sources.json')
    g.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    g.add_argument('--out-dir', help='write sources.json here instead (a test)')
    sub.add_parser('self-test')
    args = ap.parse_args(argv)
    if args.cmd == 'self-test':
        problems = self_test()
        print('board_feed self-test ' + ('FAILED:\n  ' + '\n  '.join(problems) if problems else 'passed'))
        return 1 if problems else 0
    if args.cmd != 'gather':
        ap.print_help()
        return 2
    try:
        path, lines = gather(args.week, out_dir=args.out_dir)
    except (FeedError, making.MakingError) as error:
        print(f'board_feed gather: {error}', file=sys.stderr)
        return 1
    print('\n'.join(lines))
    print(f'wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
