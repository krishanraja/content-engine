#!/usr/bin/env python3
"""Does the joke land? humour-engine, on call for scripts, joke options and the ideas board's funny lines.

Krish asked for humour throughout ("Everything should be tinged with a humorous angle, all scripts for pieces and
all suggestions for off days", 2026-11-16), and two floor standards ask for what a rule cannot grade: "Never include
a joke or dry-wit option in a script that needs outside explanation to be understood on its own", and "Always give
video scripts personality and opinion, self-deprecating dry wit, sarcasm, exaggeration, or analogy; never leave them
flat and purely factual." story_check.py says it plainly: "A rule cannot grade a joke". humour-engine
(krishanraja/humour-engine, the fleet's one definition of humour) can read one: whether a stranger gets it, by what
mechanism, and what outside context it leans on. It holds no taste. The taste stays in the house register
(content-corpus), krish-voice references/humour.md, the floor and his verdicts; whether the wit is good is still his.

Krish, 2026-11-17: "go ahead on both" (content-engine as an on-call consultant).

    python3 humour_check.py script SCRIPT.md          the spoken paragraphs, read once: flat, or where the wit is
    python3 humour_check.py joke "LINE" [...] [--file F]   each joke option read alone, as the floor says
    python3 humour_check.py ideas IDEAS.json [--max N]  each option's `funny` line read alone (at most N calls)
    python3 humour_check.py doctor                      token, package and Control Center's route; no model call

Exit 0: passes. Exit 1: flagged, each finding names its paragraph or line and the floor standard. Exit 2: the
humour engine is unavailable, which is never a pass. Each read is one model call on Control Center's key
(POST /api/humour/content-engine, CONTROL_CENTER_HUMOUR_TOKEN, about half a cent, capped at 200 a day). Install:
pip install -r requirements-humour.txt && pip install --no-deps -r requirements-humour-engine.txt
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

ORIGIN = 'https://controlcenter.krishraja.com'
CALLER = 'content-engine'
TOKEN_ENV = 'CONTROL_CENTER_HUMOUR_TOKEN'
EXIT = {'pass': 0, 'flagged': 1, 'unavailable': 2}
AUDIENCE = 'Leaders and operators who follow AI news: smart, busy, not specialists'
FLAT = 'flat: no wit, opinion, sarcasm, exaggeration or analogy the engine can find (floor: never flat and purely factual)'
EXPLAIN = 'needs explaining: it leans on more than one outside reference to land (floor: never a joke that needs outside explanation)'
MISS = 'does not land: it reads as an attempt at a joke a stranger would not get'
SURFACES = {
    'script': 'Format: a video script Krish speaks to camera, dry and reflective, about AI news',
    'joke': 'Format: one joke or aside offered for a video script, read on its own without the script',
    'funny': "Format: the humorous angle of a story idea for an AI publication, one line, read on its own",
}


def origin():
    return (os.environ.get('CONTROL_CENTER_URL') or ORIGIN).rstrip('/')


def url():
    return origin() + '/api/humour/' + CALLER


def post(body, token=None, timeout=150):
    """(status, json) from Control Center's humour route. Never raises for HTTP errors; never prints the token."""
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


def request(lines, surface, request_id, context=()):
    segs = [{'segment_id': 'p%d' % n, 'text': t, 'sequence': n} for n, t in enumerate(lines, 1)]
    return {
        'request_id': request_id,
        'focus_segment_ids': [s['segment_id'] for s in segs],
        'segments': segs,
        'context': {'provided_facts': [SURFACES[surface]] + [str(c)[:500] for c in context][:5],
                    'audience_description': AUDIENCE},
        'tasks': ['comprehension'],
        'provider_policy': {'allowed_provider_ids': ['controlcenter'], 'allow_external_inference': True},
        'budget': {'max_model_calls': 1, 'max_input_tokens': 14000, 'max_output_tokens': 2000},
    }


def reader(transport=None):
    """lines-request -> analysis dict, or None without the token or the package."""
    if not os.environ.get(TOKEN_ENV) and transport is None:
        return None
    try:
        from humour_engine.analysis.core import EngineDeps, analyse
        from humour_engine.contracts.analysis import AnalysisRequest
        from humour_engine.models.providers import ControlCenterProvider
    except ImportError:
        return None
    os.environ.setdefault(ControlCenterProvider.ENGINE_ENV, CALLER)  # the provider needs it; the transport sets the URL
    deps = EngineDeps(providers={'controlcenter': ControlCenterProvider(transport=transport or (lambda _u, b: post(b)))},
                      max_calls_per_request=1)
    return lambda req: json.loads(analyse(AnalysisRequest.model_validate(req), deps).model_dump_json())


def _main(result):
    main = [i for i in result.get('interpretations', []) if i.get('supported_reading')]
    return next((i for i in main if i.get('is_main')), main[0]) if main else None


def _labels(i):
    return {k: v for k, v in ((i or {}).get('labels_by_axis') or {}).items() if v}


def _attempted(result):
    return (result.get('humour_attempt') or {}).get('status') in ('reported', 'supported_inference')


def _needs_explaining(result):
    jumps = [d for d in result.get('context_dependencies', [])
             if d.get('required') and d.get('source_kind') in ('cultural', 'topical')]
    return len(jumps) > 1 or bool(result.get('missing_context')) or result.get('comic_reading') == 'insufficient_context'


def _unavailable(result):
    if result.get('comic_reading') is not None:
        return None
    codes = [e.get('code') for e in result.get('errors', []) if isinstance(e, dict) and e.get('code')]
    for t in result.get('task_results', []):
        codes += [e.get('code') for e in t.get('errors', []) if isinstance(e, dict) and e.get('code')]
    return 'no reading: ' + (', '.join(dict.fromkeys(codes)) or 'the engine abstained')


def read_script(paragraphs, read):
    """One call for the whole script. Flat when nothing reads as humour; otherwise where the wit sits."""
    out = {'kind': 'script', 'paragraphs': len(paragraphs), 'findings': []}
    if read is None:
        return {**out, 'status': 'unavailable', 'reason': 'humour engine not reachable: run `humour_check.py doctor`'}
    try:
        result = read(request(paragraphs, 'script', 'ce:script'))
    except Exception as e:  # noqa: BLE001  a failure is never a pass
        return {**out, 'status': 'unavailable', 'reason': 'humour engine failed: ' + type(e).__name__}
    why = _unavailable(result)
    if why:
        return {**out, 'status': 'unavailable', 'reason': why}
    i = _main(result)
    ev = {e['evidence_id']: e for e in result.get('evidence', []) if isinstance(e, dict) and 'evidence_id' in e}
    where = sorted({int(ev[r]['segment_id'][1:]) for r in (i or {}).get('evidence_refs', [])
                    if r in ev and str(ev[r].get('segment_id', '')).startswith('p')})
    out.update(reading=result['comic_reading'], labels=_labels(i), wit_in_paragraphs=where)
    if result['comic_reading'] != 'supported' and not _attempted(result):
        out['findings'].append(FLAT)
    elif _needs_explaining(result):
        out['findings'].append(EXPLAIN + (' (paragraph %s)' % ', '.join(map(str, where)) if where else ''))
    elif result['comic_reading'] != 'supported':
        out['findings'].append(MISS)
    out['status'] = 'flagged' if out['findings'] else 'pass'
    return out


def read_line(line, surface, read, ref):
    """One joke or funny line, read on its own."""
    out = {'kind': surface, 'ref': ref, 'line': line, 'findings': []}
    if read is None:
        return {**out, 'status': 'unavailable', 'reason': 'humour engine not reachable: run `humour_check.py doctor`'}
    try:
        result = read(request([line], surface, 'ce:' + ref))
    except Exception as e:  # noqa: BLE001
        return {**out, 'status': 'unavailable', 'reason': 'humour engine failed: ' + type(e).__name__}
    why = _unavailable(result)
    if why:
        return {**out, 'status': 'unavailable', 'reason': why}
    out.update(reading=result['comic_reading'], labels=_labels(_main(result)))
    if _needs_explaining(result):
        out['findings'].append(EXPLAIN)
    elif result['comic_reading'] != 'supported':
        out['findings'].append(MISS if _attempted(result) else 'not a joke: the engine finds no humour in it')
    out['status'] = 'flagged' if out['findings'] else 'pass'
    return out


def funny_lines(ideas):
    """[(ref, funny)] from an ideas file, in board order (idea_checks.board_raw)."""
    import idea_checks
    return [(ref, str(o.get('funny')).strip()) for ref, _d, _m, o in idea_checks.board_raw(ideas)
            if str(o.get('funny') or '').strip()]


def overall(results):
    return max((r['status'] for r in results), key=lambda s: EXIT[s]) if results else 'pass'


def render(r):
    head = r['status'].upper() + '  ' + (r.get('ref') or r['kind'])
    rows = [head + ('  "' + r['line'] + '"' if r.get('line') else '')]
    if r.get('reason'):
        rows.append('  ' + r['reason'])
    if r.get('reading'):
        rows.append('  reading: ' + r['reading'])
    for k in ('mechanism', 'rhetorical_mode', 'target'):
        if r.get('labels', {}).get(k):
            rows.append('  %s: %s' % (k, ', '.join(r['labels'][k])))
    if r.get('wit_in_paragraphs'):
        rows.append('  wit in paragraph(s): ' + ', '.join(map(str, r['wit_in_paragraphs'])))
    return '\n'.join(rows + ['  - ' + f for f in r['findings']])


def doctor(poster=post, package=None):
    """(ok, rows). An empty body reaches the route's auth and its count without a model call: 400 means ready."""
    rows, ok = [], True
    token = os.environ.get(TOKEN_ENV, '')
    rows.append('token: %s is set' % TOKEN_ENV if token else 'token: NOT SET. %s holds content-engine\'s humour '
                'bearer (a GitHub Actions secret; Control Center holds it as CONTENT_ENGINE_HUMOUR_TOKEN)' % TOKEN_ENV)
    ok = ok and bool(token)
    if package is None:
        try:
            import humour_engine  # noqa: F401
            package = True
        except ImportError:
            package = False
    rows.append('package: humour-engine installed' if package else
                'package: NOT INSTALLED. pip install -r requirements-humour.txt && pip install --no-deps -r requirements-humour-engine.txt')
    ok = ok and package
    if token:
        try:
            status, body = poster({})
        except (urllib.error.URLError, OSError) as e:
            status, body = None, {'error': type(e).__name__}
        error = (body or {}).get('error')
        if status == 400 and error == 'invalid_input':
            rows.append('route: Control Center serves the humour route to content-engine')
        else:
            ok = False
            rows.append('route: NOT READY (%s%s)' % (status or 'unreachable', ', ' + error if error else ''))
    rows.append('ready: the humour engine can be consulted' if ok else 'ready: NO. Every read will say unavailable, never pass')
    return ok, rows


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('script'); s.add_argument('file'); s.add_argument('--json', action='store_true')
    j = sub.add_parser('joke'); j.add_argument('lines', nargs='*'); j.add_argument('--file'); j.add_argument('--json', action='store_true')
    i = sub.add_parser('ideas'); i.add_argument('file'); i.add_argument('--max', type=int, default=20); i.add_argument('--json', action='store_true')
    sub.add_parser('doctor')
    a = p.parse_args(argv)
    if a.cmd == 'doctor':
        ok, rows = doctor()
        print('\n'.join(rows))
        return 0 if ok else 2
    read = reader()
    if a.cmd == 'script':
        import story_check
        paragraphs = story_check.spoken_paragraphs(Path(a.file).read_text(encoding='utf-8'))
        if not paragraphs:
            p.error('no spoken paragraphs in ' + a.file)
        results = [read_script(paragraphs, read)]
    elif a.cmd == 'joke':
        lines = list(a.lines) + ([x.strip() for x in Path(a.file).read_text(encoding='utf-8').splitlines() if x.strip()] if a.file else [])
        if not lines:
            p.error('give the joke line(s) as arguments or with --file')
        results = [read_line(x, 'joke', read, 'joke-%d' % n) for n, x in enumerate(lines, 1)]
    else:
        pairs = funny_lines(json.loads(Path(a.file).read_text(encoding='utf-8')))
        results = [read_line(f, 'funny', read, ref) for ref, f in pairs[:max(a.max, 0)]]
        if len(pairs) > a.max:
            print('note: %d funny lines, %d read (--max)' % (len(pairs), a.max), file=sys.stderr)
    print(json.dumps(results, ensure_ascii=False, indent=2) if getattr(a, 'json', False) else '\n'.join(map(render, results)))
    return EXIT[overall(results)]


if __name__ == '__main__':
    sys.exit(main())
