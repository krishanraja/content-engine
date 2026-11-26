#!/usr/bin/env python3
"""divergent-thinker on call for the ideas board: one wildcard a day, a repeat guard, and what went live recorded.

divergent-thinker (krishanraja/divergent-thinker) is the fleet's divergent thinking engine: it maps the obvious answers
to a question first, then pushes ideas away from them and from everything already in its archive. plan-week offers "a
wildcard the engine would not usually offer" each publishing day; this asks the engine for one. It holds no taste and
decides nothing: an option made from its spark is the engine's (`source_kind: engine`, never his), goes through the same
refute pass and reviewer as every option, and only Krish's presses put anything on a board.

    python3 divergent.py wildcard --problem "..." --sources SOURCES.json [--day mon] [--count 3] [--context "..."]
        provoke: sparks for one day's wildcard slot (2 model calls, about $0.15), after the chain cap check
    python3 divergent.py score IDEAS.json --sources SOURCES.json
        the repeat guard: every option on the board against what went out (zero model calls: `obvious` is given)
    python3 divergent.py record [ITEM ...] [--live SOURCES.json] [--items-file F] [--label L] [--lane NAME]
        what went live, into the archive the wildcard and the guard read (zero model calls; the engine skips repeats)

At will, for any session (docs/DIVERGENT.md says when): each prints the engine's answer for the session to read and
writes nothing to any board. Paid ops check the chain cap first and are refused over it.

    python3 divergent.py map --problem "..." [--context "..."]                           the obvious answers (1 call)
    python3 divergent.py provoke --problem "..." [--count N] [--temperament wild] ...     sparks (2 calls, about $0.15)
    python3 divergent.py challenge --problem "..." --idea "..." [--context "..."]        attack one idea (3 calls)
    python3 divergent.py diverge --problem "..." [--count N] ...                         a full run (about 25 calls,
                                                                                          about $1.30, 1 a day)
    python3 divergent.py score --problem "..." --ideas-file F [--obvious-file F] [--judge]
        free with --obvious-file and no --judge; otherwise the engine spends calls to find the obvious, so it is paid
    Shared flags: --context, --cliche (repeatable), --target (default writing), --temperament, --lane NAME (namespace
    content-engine:<lane>, default ideas). A file is a JSON list of strings, or plain text with one item a line.

Through Control Center's `POST /api/divergent/content-engine` on the engine's operator key ENGINE_OPERATOR_TOKEN (the
same key humour_check.py uses), namespace `content-engine:ideas`. Its calls are metered as agent
`divergent-content-engine`, inside the $15 a week chain (config/chain-cap.json, family `divergent`; Ruling, Krish,
2026-11-18). Exit 0: done (score: nothing flagged). Exit 1: score flagged an option for the reviewer. Exit 2: not served,
refused by the chain cap, or no key: never a pass, and the session carries on exactly as it would without the engine.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

ORIGIN = 'https://controlcenter.krishraja.com'
CALLER = 'content-engine'
NAMESPACE = 'content-engine:ideas'
TOKEN_ENV = 'ENGINE_OPERATOR_TOKEN'
EXIT = {'ok': 0, 'pass': 0, 'flagged': 1, 'unavailable': 2, 'refused': 2}
LANE = re.compile(r'^[a-z0-9-]+$')  # the route's namespace rule: content-engine:<lane>
TARGETS = ('generic', 'code', 'writing', 'research', 'strategy', 'design', 'video', 'product')
TEMPERAMENTS = ('grounded', 'balanced', 'wild')
# What each op spends (the route's own ceiling per op): the at-will ops that make model calls check the chain cap first.
PAID = {'map': '1 model call', 'provoke': '2 model calls, about $0.15', 'challenge': '3 model calls',
        'diverge': 'about 25 model calls, about $1.30, 1 a day', 'score': 'model calls to find the obvious or judge'}
KILL_LIST = ROOT / 'vendor' / 'makeyourmindup' / 'kill-list' / 'kill-list.v1.json'
# The route's own limits (control-center api/_divergent.ts, divergentCallSchema).
MAX_CLICHES, MAX_CLICHE_CHARS = 50, 500
MAX_BANNED, MAX_BANNED_CHARS = 200, 60
MAX_OBVIOUS, MAX_OBVIOUS_CHARS = 30, 1000
MAX_IDEAS, MAX_IDEA_CHARS = 100, 4000
MAX_RECORD = 200
FLAG = {
    'rejected_archive': 'repeats the archive: it sits close to something already recorded (what went live, or an earlier spark)',
    'rejected_gravity': 'pulled to what went out: it sits close to a recent post or an earlier option',
}


def origin():
    return (os.environ.get('CONTROL_CENTER_URL') or ORIGIN).rstrip('/')


def url():
    return origin() + '/api/divergent/' + CALLER


def post(body, token=None, timeout=150):
    """(status, json) from Control Center's divergent route. Never raises for HTTP or network errors (status None when
    unreachable); never prints the token."""
    token = token if token is not None else os.environ.get(TOKEN_ENV, '')
    req = urllib.request.Request(url(), data=json.dumps(body).encode(), method='POST',
                                 headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'{}')
        except ValueError:
            return e.code, {}
    except (urllib.error.URLError, OSError, ValueError) as e:
        return None, {'error': type(e).__name__}


def chain_week():
    """This week's chain spend from the engine's own check (POST /api/triage/sweep, action chain_cap, dry run: reads,
    writes nothing), or None when it cannot be read."""
    try:
        import engine
        status, text = engine.call('POST', '/api/triage/sweep', {'action': 'chain_cap', 'dry_run': True},
                                   token=engine.operator_key(), timeout=60)
        body = json.loads(text or '{}')
    except Exception:  # noqa: BLE001  unknown is said, never a crash
        return None
    if status != 200 or not body.get('ok') or body.get('chain_unread'):
        return None
    return body


def chain_verdict(week):
    """(runs, why): the chain cap's rule (apps/control-plane/api/_chainCap.ts, chainAllows): over the cap a paid call
    is refused; a spend that cannot be read stops nothing, and says so."""
    if week is None:
        return True, "this week's chain spend could not be read, and unknown stops nothing"
    if week.get('chain_over'):
        return False, ('the chain is over its $%s a week ($%s since Monday): no paid divergent call this week'
                       % (week.get('chain_cap_usd', 15), week.get('chain_usd')))
    return True, 'the chain is under its $%s this week ($%s since Monday)' % (week.get('chain_cap_usd', 15), week.get('chain_usd'))


def banned_words(path=KILL_LIST):
    """The kill list's banned vocabulary, as the route takes it."""
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    words = next((v.get('words') or [] for v in data.get('vetoes') or [] if v.get('id') == 'banned_vocabulary'), [])
    return [str(w)[:MAX_BANNED_CHARS] for w in words if str(w).strip()][:MAX_BANNED]


def _clip(text, n):
    return re.sub(r'\s+', ' ', str(text or '')).strip()[:n]


def earlier_titles(sources, plans=None):
    """The headline or hook of each option the earlier boards offered (sources.json earlier_options, read back from its
    week's ideas.json: the gather keeps only their ids)."""
    import idea_checks
    plans = Path(plans) if plans else ROOT / 'docs' / 'plans'
    wanted, out, cache = {}, [], {}
    for o in (sources or {}).get('earlier_options') or []:
        if isinstance(o, dict) and o.get('week') and o.get('id'):
            wanted.setdefault(str(o['week']), set()).add(str(o['id']).lower())
    for week, ids in sorted(wanted.items(), reverse=True):
        path = plans / f'{week}-week' / 'ideas.json'
        if week not in cache:
            try:
                cache[week] = json.loads(path.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                cache[week] = {}
        for _ref, _day, main, o in idea_checks.board_raw(cache[week]):
            if str(o.get('id') or '').lower() in ids:
                title = (idea_checks.headline_of(o) if main else None) or o.get('hook') or o.get('title') or o.get('story')
                if title:
                    out.append(_clip(title, MAX_CLICHE_CHARS))
    return out


def recent_titles(sources):
    """What went out or is on its way, newest week first: each recent post's title."""
    posts = [p for p in (sources or {}).get('recent_posts') or [] if isinstance(p, dict) and p.get('title')]
    posts.sort(key=lambda p: str(p.get('date') or p.get('week') or ''), reverse=True)
    return [_clip(p['title'], MAX_CLICHE_CHARS) for p in posts]


def _unique(items):
    seen, out = set(), []
    for x in items:
        k = x.lower()
        if x and k not in seen:
            seen.add(k)
            out.append(x)
    return out


def worn(sources, plans=None):
    """The board's worn ground: recent posts first, then earlier options, no repeats."""
    return _unique(recent_titles(sources) + earlier_titles(sources, plans))


def _served(status, body):
    """None when the route answered; else why it is not served (any non-200 is 'not served')."""
    if status == 200 and isinstance(body, dict) and body.get('ok') is not False:
        return None
    return 'divergent-thinker not served (%s%s)' % (status or 'unreachable', ', ' + str(body.get('error')) if isinstance(body, dict) and body.get('error') else '')


def wildcard(problem, sources, *, count=3, context=None, day=None, poster=post, cap=chain_week, plans=None, kill_list=KILL_LIST):
    """provoke: sparks for one day's wildcard slot. Refused over the chain cap; not served is never a pass."""
    out = {'kind': 'wildcard', 'day': day, 'namespace': NAMESPACE, 'sparks': []}
    if not os.environ.get(TOKEN_ENV) and poster is post:
        return {**out, 'status': 'unavailable', 'reason': TOKEN_ENV + ' is not set: write the wildcard yourself'}
    runs, why = chain_verdict(cap())
    out['chain'] = why
    if not runs:
        return {**out, 'status': 'refused', 'reason': why + ': write the wildcard yourself'}
    body = {'op': 'provoke', 'problem': _clip(problem, 4000), 'count': max(1, min(int(count), 8)), 'target': 'writing',
            'namespace': NAMESPACE, 'cliches': worn(sources, plans)[:MAX_CLICHES], 'bannedWords': banned_words(kill_list)}
    if context:
        body['context'] = str(context)[:8000]
    status, answer = poster(body)
    why = _served(status, answer)
    if why:
        return {**out, 'status': 'unavailable', 'reason': why + ': write the wildcard yourself'}
    keep = ('rank', 'title', 'mechanism', 'whyNonObvious', 'firstStep', 'lens', 'conventionalTwin', 'score')
    out['run_id'] = answer.get('runId')
    out['sparks'] = [{k: s.get(k) for k in keep if k in s} for s in answer.get('sparks') or [] if isinstance(s, dict)]
    out['label'] = 'engine-made: source_kind engine, divergent {"run_id", "spark"}; never his'
    return {**out, 'status': 'ok' if out['sparks'] else 'unavailable',
            **({} if out['sparks'] else {'reason': 'no sparks came back: write the wildcard yourself'})}


def board_ideas(ideas):
    """[(ref, option, text)] for every option on the board, the words the repeat check reads."""
    import idea_checks
    out = []
    for ref, _day, main, o in idea_checks.board_raw(ideas):
        text = (idea_checks.option_text_main(o) if main else idea_checks.option_text_off(o)) or o.get('hook') or o.get('title')
        if text:
            out.append((ref, o, _clip(text, MAX_IDEA_CHARS)))
    return out


def score_body(ideas, sources, plans=None):
    """The score call: every option against what went out, `obvious` given and no judge, so it makes no model call.
    None when there is nothing to hold them against (no `obvious` would make the engine spend calls to find one)."""
    rows = board_ideas(ideas)[:MAX_IDEAS]
    obvious = [_clip(t, MAX_OBVIOUS_CHARS) for t in worn(sources, plans)][:MAX_OBVIOUS]
    if not rows or not obvious:
        return None, rows
    week = (ideas or {}).get('week_start') or (sources or {}).get('week_start') or ''
    # The reader's subject, config/beat.json reader.about (the North Star reader line, 2026-11-26), never a copy here.
    about = json.loads((Path(__file__).resolve().parents[2] / 'config' / 'beat.json').read_text(encoding='utf-8'))['reader']['about']
    problem = 'Story ideas for makeyourmindup, a publication on %s, for the week of %s' % (about, week)
    return {'op': 'score', 'problem': problem.strip(), 'ideas': [t for _r, _o, t in rows], 'obvious': obvious,
            'namespace': NAMESPACE}, rows


def score(ideas, sources, *, poster=post, plans=None):
    """The repeat guard. Flags an option the engine finds in the archive or pulled to what went out, for the reviewer;
    it never drops one and never replaces repeat_review or board_feed.py gate."""
    out = {'kind': 'score', 'namespace': NAMESPACE, 'findings': [], 'statuses': {}}
    if not os.environ.get(TOKEN_ENV) and poster is post:
        return {**out, 'status': 'unavailable', 'reason': TOKEN_ENV + ' is not set: the repeat guard did not run'}
    body, rows = score_body(ideas, sources, plans)
    if body is None:
        why = 'no options on the board' if not rows else 'no recent posts or earlier options to hold them against'
        return {**out, 'status': 'unavailable', 'reason': why + ': the repeat guard did not run (no call made)'}
    assert body.get('obvious') and not body.get('judge'), 'the guard makes no model call'
    status, answer = poster(body)
    why = _served(status, answer)
    if why:
        return {**out, 'status': 'unavailable', 'reason': why + ': the repeat guard did not run'}
    results = [r for r in answer.get('results') or [] if isinstance(r, dict)]
    for (ref, o, _t), r in zip(rows, results):
        st = r.get('status')
        out['statuses'][ref] = st
        if st not in FLAG:
            continue
        if st == 'rejected_archive' and isinstance(o.get('divergent'), dict):
            out['statuses'][ref] = 'own_spark'  # the wildcard's own spark is in the archive by design
            continue
        out['findings'].append({'ref': ref, 'status': st, 'why': FLAG[st] + '. For the reviewer, never dropped silently.'})
    out['divergence_index'] = answer.get('divergenceIndex')
    out['status'] = 'flagged' if out['findings'] else 'pass'
    return out


def live_items(sources):
    """Each post that went live on the boards the gather read: its title and its one-line point."""
    out = []
    for p in (sources or {}).get('recent_posts') or []:
        if not isinstance(p, dict) or str(p.get('stage') or '') != 'live' or not p.get('title'):
            continue
        title = _clip(p['title'], 200)
        words = _clip(p.get('words'), 1200)
        if words.lower().startswith(title.lower()):
            words = words[len(title):].strip()
        point = re.split(r'(?<=[.?])\s', words, maxsplit=1)[0][:300] if words else ''
        out.append(title + ('. ' + point if point else ''))
    return _unique(out)


def record(items, *, label=None, poster=post, lane=None):
    """Record items in the archive (zero model calls; the engine skips an item it already holds)."""
    namespace = namespace_for(lane)
    out = {'kind': 'record', 'namespace': namespace, 'items': len(items)}
    if not items:
        return {**out, 'status': 'ok', 'recorded': 0, 'reason': 'nothing to record'}
    if not os.environ.get(TOKEN_ENV) and poster is post:
        return {**out, 'status': 'unavailable', 'reason': TOKEN_ENV + ' is not set: nothing recorded'}
    body = {'op': 'record', 'items': [_clip(i, 4000) for i in items][:MAX_RECORD], 'namespace': namespace}
    if label:
        body['label'] = str(label)[:80]
    status, answer = poster(body)
    why = _served(status, answer)
    if why:
        return {**out, 'status': 'unavailable', 'reason': why + ': nothing recorded'}
    return {**out, 'status': 'ok', 'recorded': answer.get('recorded'), 'skipped_duplicates': answer.get('skippedDuplicates')}


def namespace_for(lane=None):
    """content-engine:<lane>, the default lane `ideas` (what plan-week reads). A lane is lowercase letters, digits and
    hyphens, as the route takes it."""
    lane = (lane or 'ideas').strip().lower()
    if not LANE.match(lane):
        raise ValueError('a lane is lowercase letters, digits and hyphens: %r' % lane)
    return CALLER + ':' + lane


def read_list(path):
    """A file of items: a JSON list of strings (or of objects with a title), or plain text with one item a line."""
    text = Path(path).read_text(encoding='utf-8')
    try:
        data = json.loads(text)
    except ValueError:
        return [line.strip() for line in text.splitlines() if line.strip()]
    if isinstance(data, dict):
        data = data.get('items') or data.get('ideas') or []
    out = []
    for x in data if isinstance(data, list) else []:
        if isinstance(x, dict):
            x = x.get('title') or x.get('text') or x.get('idea')
        if x and str(x).strip():
            out.append(str(x))
    return out


def at_will_body(op, *, problem=None, context=None, idea=None, ideas=None, obvious=None, cliches=None, count=None,
                 target='writing', temperament=None, lane=None, judge=False, kill_list=KILL_LIST):
    """The route's body for one at-will op, inside its limits (control-center api/_divergent.ts, divergentCallSchema).
    `map` takes no namespace, target or word lists: the route refuses any field it does not name."""
    body = {'op': op, 'problem': _clip(problem, 4000)}
    if context:
        body['context'] = str(context)[:8000]
    if op == 'map':
        return body
    body['namespace'] = namespace_for(lane)
    if target:
        if target not in TARGETS:
            raise ValueError('target is one of %s' % ', '.join(TARGETS))
        body['target'] = target
    if temperament:
        if temperament not in TEMPERAMENTS:
            raise ValueError('temperament is one of %s' % ', '.join(TEMPERAMENTS))
        body['temperament'] = temperament
    worn_ground = _unique([_clip(c, MAX_CLICHE_CHARS) for c in cliches or [] if str(c).strip()])[:MAX_CLICHES]
    if worn_ground:
        body['cliches'] = worn_ground
    body['bannedWords'] = banned_words(kill_list)
    if op in ('provoke', 'diverge') and count:
        body['count'] = max(1, min(int(count), 8))
    if op == 'challenge':
        body['idea'] = _clip(idea, 4000)
    if op == 'score':
        body['ideas'] = [_clip(i, MAX_IDEA_CHARS) for i in ideas or [] if str(i).strip()][:MAX_IDEAS]
        given = [_clip(o, MAX_OBVIOUS_CHARS) for o in obvious or [] if str(o).strip()][:MAX_OBVIOUS]
        if given:
            body['obvious'] = given
        if judge:
            body['judge'] = True
    return body


def spends(body):
    """True when the call makes model calls: every op but record, and score unless `obvious` is given with no judge."""
    if body['op'] == 'record':
        return False
    if body['op'] == 'score':
        return not body.get('obvious') or bool(body.get('judge'))
    return True


def at_will(body, *, poster=post, cap=chain_week):
    """One at-will op: the chain cap first when it spends, then the route. Prints for the session; writes no board."""
    op = body['op']
    out = {'kind': op, 'namespace': body.get('namespace'), 'spends': PAID[op] if spends(body) else 'no model call'}
    if op == 'challenge' and not body.get('idea'):
        return {**out, 'status': 'unavailable', 'reason': 'challenge needs --idea: no call made'}
    if op == 'score' and not body.get('ideas'):
        return {**out, 'status': 'unavailable', 'reason': 'score needs at least one idea: no call made'}
    if not os.environ.get(TOKEN_ENV) and poster is post:
        return {**out, 'status': 'unavailable', 'reason': TOKEN_ENV + ' is not set: no call made'}
    if spends(body):
        runs, why = chain_verdict(cap())
        out['chain'] = why
        if not runs:
            return {**out, 'status': 'refused', 'reason': why}
    status, answer = poster(body)
    why = _served(status, answer)
    if why:
        return {**out, 'status': 'unavailable', 'reason': why}
    out['result'] = {k: v for k, v in answer.items() if k != 'ok'}
    if op in ('provoke', 'diverge', 'challenge'):
        out['label'] = ('engine-made: an idea taken from this is source_kind engine, with divergent {"run_id", "spark"};'
                        ' never his, never posed as his')
    if op == 'score':
        flagged = [i for i, r in enumerate(answer.get('results') or []) if isinstance(r, dict) and r.get('status') in FLAG]
        out['flagged'] = flagged
        return {**out, 'status': 'flagged' if flagged else 'pass'}
    return {**out, 'status': 'ok'}


def _load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def _shared(sp, *, problem=True, count=False, idea=False, words=True):
    if problem:
        sp.add_argument('--problem', required=True)
    sp.add_argument('--context')
    if idea:
        sp.add_argument('--idea', required=True)
    if count:
        sp.add_argument('--count', type=int, default=3)
    if words:
        sp.add_argument('--cliche', action='append', default=[], help='worn ground to steer away from (repeatable)')
        sp.add_argument('--target', default='writing', choices=TARGETS)
        sp.add_argument('--temperament', choices=TEMPERAMENTS)
        sp.add_argument('--lane', help='namespace content-engine:<lane> (default ideas)')


def main(argv=None, *, poster=post, cap=chain_week):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)
    w = sub.add_parser('wildcard')
    w.add_argument('--problem', required=True)
    w.add_argument('--sources', required=True)
    w.add_argument('--day')
    w.add_argument('--count', type=int, default=3)
    w.add_argument('--context')
    _shared(sub.add_parser('map'), words=False)
    _shared(sub.add_parser('provoke'), count=True)
    _shared(sub.add_parser('challenge'), idea=True)
    _shared(sub.add_parser('diverge'), count=True)
    s = sub.add_parser('score')
    s.add_argument('ideas', nargs='?', help="the week's ideas.json, with --sources: plan-week's repeat guard")
    s.add_argument('--sources')
    s.add_argument('--problem')
    s.add_argument('--context')
    s.add_argument('--ideas-file')
    s.add_argument('--obvious-file')
    s.add_argument('--judge', action='store_true')
    s.add_argument('--cliche', action='append', default=[])
    s.add_argument('--target', default='writing', choices=TARGETS)
    s.add_argument('--temperament', choices=TEMPERAMENTS)
    s.add_argument('--lane')
    r = sub.add_parser('record')
    r.add_argument('items', nargs='*')
    r.add_argument('--live', metavar='SOURCES')
    r.add_argument('--items-file')
    r.add_argument('--label')
    r.add_argument('--lane')
    a = p.parse_args(argv)
    try:
        if a.cmd == 'wildcard':
            result = wildcard(a.problem, _load(a.sources), count=a.count, context=a.context, day=a.day,
                              poster=poster, cap=cap)
        elif a.cmd == 'score' and a.ideas:
            if not a.sources:
                p.error('the board guard takes IDEAS.json with --sources SOURCES.json')
            result = score(_load(a.ideas), _load(a.sources), poster=poster)
        elif a.cmd == 'score':
            if not (a.problem and a.ideas_file):
                p.error('score at will takes --problem and --ideas-file (or IDEAS.json --sources for the board guard)')
            body = at_will_body('score', problem=a.problem, context=a.context, ideas=read_list(a.ideas_file),
                                obvious=read_list(a.obvious_file) if a.obvious_file else None, cliches=a.cliche,
                                target=a.target, temperament=a.temperament, lane=a.lane, judge=a.judge)
            result = at_will(body, poster=poster, cap=cap)
        elif a.cmd == 'record':
            items = list(a.items) + (live_items(_load(a.live)) if a.live else []) + (read_list(a.items_file) if a.items_file else [])
            if not items and not a.live and not a.items_file:
                p.error('give the item(s) as arguments, --items-file F or --live SOURCES.json')
            result = record(items, label=a.label or ('live' if a.live else None), poster=poster, lane=a.lane)
        else:
            body = at_will_body(a.cmd, problem=a.problem, context=a.context, idea=getattr(a, 'idea', None),
                                count=getattr(a, 'count', None), cliches=getattr(a, 'cliche', None),
                                target=getattr(a, 'target', None), temperament=getattr(a, 'temperament', None),
                                lane=getattr(a, 'lane', None))
            result = at_will(body, poster=poster, cap=cap)
    except ValueError as e:
        p.error(str(e))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return EXIT[result['status']]


if __name__ == '__main__':
    sys.exit(main())
