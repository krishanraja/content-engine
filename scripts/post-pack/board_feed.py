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
import re
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
    inspo = sources.get('inspiration')
    # Krish, 2026-10-24: "Double check my inspirationhouse gets read properly when ideas are being built". A gather
    # without the Inspiration House block is incomplete, never a quiet Sunday: say so and stop.
    if not isinstance(inspo, dict):
        raise FeedError('the engine answered without sources.inspiration (Inspiration House, content-watcher, creator moves); '
                        'the route on production predates it: merge and deploy, then gather again')
    relayed = sources.get('his_relayed') or []
    must_cover = list(inspo.get('must_cover') or []) + [
        {'id': r.get('id'), 'what': f'Your words on board item "{r.get("title")}"', 'his_words': r.get('detail')} for r in relayed if r.get('id')]
    out = {
        'week_start': wk,
        'how': 'Read-only gather (board_feed.py). Write ideas.json from series[].pool and inspiration (routed, liked, fresh, corpora, '
               'creators), his ideas first, each with source_kind, why_here, beats and style (config/styles.json); every must_cover id '
               'is in some idea\'s covers or in ideas.json accounted with a reason (board_feed.py cover); write combine.json; '
               'build with --ideas --queue --combine.',
        'counts': sources.get('counts') or {},
        'empty': sources.get('empty') or [],
        'series': [dict(s, mandate=next((x.get('mandate') for x in options.get('series') or [] if x.get('slug') == s.get('slug')), None))
                   for s in sources.get('series') or []],
        'unassigned': sources.get('unassigned') or [],
        'his_relayed': relayed,
        'inspiration': inspo,
        'must_cover': must_cover,
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
    ic = inspo.get('counts') or {}
    lines.append('  inspiration house: ' + ', '.join(f'{k} {ic.get(k, 0)}' for k in ('routed', 'study_style', 'liked', 'fresh', 'corpora', 'creators', 'claims')))
    lines += [f'  must cover: {m.get("what")}' for m in must_cover]
    lines += [f'  {s.get("slug")}: {len(s.get("pool") or [])} in the pool' for s in out['series']]
    lines += [f'  empty: {e.get("source")}: {e.get("why")}' for e in out['empty']]
    return path, lines


def cover(week, ideas_path=None):
    """Problems with the week's ideas.json against its sources.json: every must_cover id carried by an idea's
    `covers` or accounted for with a reason, and the style rules (week_board.style_problems). [] when ready."""
    import week_board
    wk = monday(week).isoformat()
    folder = ROOT / 'docs' / 'plans' / f'{wk}-week'
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    ideas = json.loads(Path(ideas_path or folder / 'ideas.json').read_text(encoding='utf-8'))
    return week_board.coverage_problems(ideas, sources) + week_board.style_problems(ideas)


COMBINE_DOC = re.compile(r'^combine-\d{1,3}$')


def his_taps(documents, series=None):
    """(synthesize bodies, skipped lines) from a board's queue documents. Only a Combine tap Krish wrote himself
    (updated_by 'Krish', the access-cookie writer) is relayed; the board API refuses a session's, and this refuses one
    that got there anyway. `said` stays None: the board's own words (the thesis a session wrote) are never his. A
    session adds `said` only from a comment Krish typed himself."""
    bodies, skipped = [], []
    for d in documents or []:
        if not isinstance(d, dict) or not COMBINE_DOC.match(str(d.get('id') or '')):
            continue
        body = d.get('body') if isinstance(d.get('body'), dict) else {}
        if body.get('combine') is not True:
            continue
        if d.get('updated_by') != 'Krish':
            skipped.append(f'{d.get("id")}: written by {d.get("updated_by")!r}, not Krish; not relayed')
            continue
        bodies.append({'tap': d['id'], 'source_idea_ids': list(body.get('members') or []), 'target_lane': 'publication',
                       'lane_slot': (series or {}).get(d['id']), 'decided_by': 'Krish', 'said': None})
    return bodies, skipped


def taps(week, read=None):
    """His Combine taps on a week's board, ready for POST /api/content-ideas/synthesize. Read-only."""
    wk = monday(week).isoformat()
    if read is None:
        import board_web
        read = lambda path: board_web.call('GET', path)
    answer = read(f'/api/board/{wk}/queue')
    return his_taps((answer or {}).get('documents') if isinstance(answer, dict) else [])


def self_test():
    """No engine: a fake answer for each route, then what gather writes and says."""
    import tempfile
    pool = [{'id': 'a', 'idea': 'His', 'source_kind': 'his', 'why_here': None}, {'id': 'b', 'idea': 'Engine', 'source_kind': 'engine', 'why_here': 'close to ...'}]
    answers = {
        '/api/week/options?week_start=2026-10-26&include=sources': {'ok': True, 'series': [{'slug': 'follow_the_money', 'mandate': 'M', 'scheduled': []}],
            'sources': {'counts': {'his': 1, 'inspo': 0, 'engine': 1}, 'empty': [{'source': 'inspo', 'why': 'no scan'}],
                        'series': [{'slug': 'follow_the_money', 'pool': pool}], 'taste': {}, 'his_relayed': [{'id': 'said-1', 'title': 'Do agents'}],
                        'inspiration': {'counts': {'routed': 1}, 'must_cover': [{'id': 'card-1', 'what': 'Inspiration card "x" you routed to Make a piece', 'his_words': 'yes'}]}}},
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
        if [m['id'] for m in data['must_cover']] != ['card-1', 'said-1'] or not any('routed 1' in x for x in lines):
            problems.append('every routed Inspiration card and relayed word is listed to cover, and the counts are said')
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
    old = json.loads(json.dumps(answers))
    old['/api/week/options?week_start=2026-10-26&include=sources']['sources'].pop('inspiration')
    try:
        with tempfile.TemporaryDirectory() as tmp:
            gather('2026-10-26', lambda m, p, b: (200, json.dumps(old[p])), tmp)
        problems.append('a gather without the Inspiration House block must stop, never look complete')
    except FeedError:
        pass
    try:
        gather('2026-10-26', lambda m, p, b: (500, 'down'))
        problems.append('an engine error must be said, never written as an empty pool')
    except FeedError:
        pass
    m = ['11111111-2222-4333-8444-555555555555', '22222222-3333-4444-8555-666666666666']
    docs = [{'id': 'combine-1', 'updated_by': 'Krish', 'body': {'combine': True, 'members': m, 'pick': 'combine-1'}},
            {'id': 'combine-2', 'updated_by': 'engine_operator', 'body': {'combine': True, 'members': m, 'pick': 'combine-2'}},
            {'id': 'mon-1', 'updated_by': 'Krish', 'body': {'pick': 'mon-1', 'queued': True}}]
    bodies, skipped = taps('2026-10-26', lambda path: {'ok': True, 'documents': docs})
    if [b['tap'] for b in bodies] != ['combine-1'] or bodies[0]['source_idea_ids'] != m or bodies[0]['decided_by'] != 'Krish':
        problems.append('only a Combine tap Krish wrote is relayed, with its members')
    if bodies and bodies[0]['said'] is not None:
        problems.append('a tap carries no said: the board\'s words are never his')
    if not skipped or 'combine-2' not in skipped[0]:
        problems.append('a tap a session wrote is skipped and said so')
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    g = sub.add_parser('gather', help='read every source and the queue into docs/plans/<Monday>-week/sources.json')
    g.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    g.add_argument('--out-dir', help='write sources.json here instead (a test)')
    t = sub.add_parser('taps', help='his Combine taps on a week\'s board, as synthesize bodies (only those Krish wrote)')
    t.add_argument('week', help='the Monday of the board the taps are on, YYYY-MM-DD')
    c = sub.add_parser('cover', help='check ideas.json carries every must_cover id and the style rules before the board is built')
    c.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    c.add_argument('--ideas', help='an ideas file other than docs/plans/<Monday>-week/ideas.json')
    sub.add_parser('self-test')
    args = ap.parse_args(argv)
    if args.cmd == 'taps':
        try:
            bodies, skipped = taps(args.week)
        except (FeedError, ValueError, OSError) as error:
            print(f'board_feed taps: {error}', file=sys.stderr)
            return 1
        for line in skipped:
            print(f'skipped {line}', file=sys.stderr)
        print(json.dumps(bodies, indent=1))
        return 0
    if args.cmd == 'self-test':
        problems = self_test()
        print('board_feed self-test ' + ('FAILED:\n  ' + '\n  '.join(problems) if problems else 'passed'))
        return 1 if problems else 0
    if args.cmd == 'cover':
        try:
            problems = cover(args.week, args.ideas)
        except (FeedError, OSError, ValueError) as error:
            print(f'board_feed cover: {error}', file=sys.stderr)
            return 1
        print('cover: ' + ('NOT READY:\n  ' + '\n  '.join(problems) if problems else 'every routed card and relayed word is on the board or accounted for; styles pass'))
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
