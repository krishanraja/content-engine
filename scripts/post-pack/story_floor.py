#!/usr/bin/env python3
"""The story floor: the first of the story engine's three stages, and the only code that reads Krish's recorded
rejections (the story engine v5 plan, commit 3; config/story-floor.json).

Ruling (Krish, 2026-11-26): his taste is a floor only. So this returns, for each candidate story, pass or refused with
the reasons in plain words. It never returns a number, never ranks and never reorders; the blind scorer
(story_score.py) never imports it and sees only which candidates passed.

What refuses a candidate, each reused from where it already lives:
  - a subject he refused, or the idea itself, while the refusal stands (idea_checks.refusals_from and
    refused_findings: his Reject, not for us, a Drop; a soft refusal only warns until he approves P6, and his own tick
    outranks an older refusal, so neither is a floor);
  - a topic on the beat's avoid list with no focus-sector angle (idea_checks.off_beat; config/beat.json);
  - the kill list and config/rejected-lines.json, on the words we would put in front of a reader only;
  - the rejection-floor standards config/story-floor.json lists, read through scripts/floor.py;
  - a script or production format, or a module of one, he marked not for us (config/style-references.json);
  - the free divergent repeat guard (score with `obvious` given and no judge: zero model calls), when it is served.

A check that cannot run is listed under `unread`, and the command exits 2: never a pass.

    python3 scripts/post-pack/story_floor.py 2026-11-23                 # the week's ideas.json against its sources.json
    python3 scripts/post-pack/story_floor.py 2026-11-23 --pool --json   # the gather pool too (series pools, unassigned)
    python3 scripts/post-pack/story_floor.py 2026-11-23 --ideas F --sources F --no-repeat-guard

Exit 0: every check read (some candidates may be refused). Exit 2: a check did not run.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'scripts'))
import idea_checks as ic  # noqa: E402

CONFIG = ROOT / 'config' / 'story-floor.json'
REJECTED_LINES = ROOT / 'config' / 'rejected-lines.json'
PLANS = ROOT / 'docs' / 'plans'


def config(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


# ---------------------------------------------------------------------------------------------------------------------
# Candidates: what the floor reads of each story, whether a board option or a story still in the gather pool.


def board_candidates(ideas):
    """[(ref, day, main, candidate)] for every option on an ideas board (idea_checks.board_raw)."""
    return ic.board_raw(ideas)


def pool_candidates(sources):
    """[(ref, None, False, candidate)] for every story in the gather pool: the series pools, then the unassigned."""
    out, seen = [], set()
    pool = [c for s in (sources or {}).get('series') or [] if isinstance(s, dict) for c in s.get('pool') or []]
    pool += list((sources or {}).get('unassigned') or [])
    for c in pool:
        if isinstance(c, dict) and c.get('id') and str(c['id']) not in seen:
            seen.add(str(c['id']))
            out.append((f'pool/{c["id"]}', None, False, c))
    return out


def is_pool(ref):
    return str(ref).startswith('pool/')


def text_of(ref, main, c):
    """All the candidate's words, the ones the refusals key on."""
    if is_pool(ref):
        return ' '.join(str(c.get(k)) for k in ('idea', 'thesis') if c.get(k))
    return (ic.option_text_main(c) if main else ic.option_text_off(c)) or str(c.get('hook') or c.get('title') or '')


def topic_of(ref, main, c):
    """What the candidate is about, in its own words (idea_checks.option_topic; a pool story's idea line)."""
    if is_pool(ref):
        return str(c.get('idea') or '')
    return ic.option_topic(c, main)


def own_words(ref, c):
    """The words we would put in front of a reader (idea_checks.option_words); none yet for a pool story."""
    return '' if is_pool(ref) else ic.option_words(c)


def reduce(ref, day, main, c):
    """A candidate as idea_checks' refusal checks read it (idea_checks.reduce_option's shape)."""
    text = text_of(ref, main, c)
    pool = is_pool(ref)
    return {'ref': ref, 'day': day, 'pos': None, 'main': main and not pool,
            'idea_id': str(c['id']).lower() if (main or pool) and c.get('id') else None,
            'off_id': None if (main or pool) else str(c.get('id') or ''), 'names': ic.names(text),
            'covers': [str(x) for x in c.get('covers') or []], 'recommended': False, 'his_tick': ic.his_tick(c),
            'refused_before': c.get('refused_before') if isinstance(c.get('refused_before'), list) else []}


# ---------------------------------------------------------------------------------------------------------------------
# The checks. Each returns {ref: [reason, ...]} for the candidates it refuses; a check that cannot run says so.


def refusal_reasons(cands, sources, shown_text=None, p6=None, cfg=None):
    """His refusals that still stand (idea_checks.refused_findings with his asks, his later words and his presses that
    gave a subject back). Only the refuse codes floor; a warning is a note on the board, never a floor."""
    cfg = cfg or config()
    refused = ic.refusals_from(sources, shown_text)
    opts = [reduce(*c) for c in cands]
    found = ic.refused_findings(opts, refused, ic.his_ids(sources), ic.his_words(sources), (sources or {}).get('unvetoed') or [],
                                ic.P6_APPROVED if p6 is None else p6)
    out = {}
    for f in found:
        if f['code'] in cfg['refuse_codes']:
            out.setdefault(f['ref'], []).append(f['line'])
    return out


def offbeat_reasons(cands):
    out = {}
    for ref, _day, main, c in cands:
        if c.get('weekly'):
            continue
        hit = ic.off_beat(topic_of(ref, main, c))
        if hit:
            out.setdefault(ref, []).append(f'off_beat: about "{hit[1]}" ({hit[0].lower()}) with no focus-sector angle (config/beat.json)')
    return out


def kill_reasons(cands, kill=None):
    """The kill list on our own words. A kill list that cannot run is its own veto (idea_checks.kill_list_vetoes)."""
    kill = kill or ic.kill_list_vetoes
    out = {}
    for ref, _day, _main, c in cands:
        words = own_words(ref, c)
        if words.strip():
            vetoes = kill(words)
            if vetoes:
                out.setdefault(ref, []).append('kill list: ' + ', '.join(sorted(set(vetoes))))
    return out


def rejected_line_reasons(cands, path=REJECTED_LINES):
    """config/rejected-lines.json on our own words: a line he read and rejected is never used again."""
    rows = json.loads(Path(path).read_text(encoding='utf-8')).get('rejected') or []
    pats = [(re.compile(r['pattern'], re.I), r) for r in rows if isinstance(r, dict) and r.get('pattern')]
    out = {}
    for ref, _day, _main, c in cands:
        words = own_words(ref, c)
        for rx, r in pats:
            if words and rx.search(words):
                out.setdefault(ref, []).append(f'rejected line ({r.get("on")}): matches {r["pattern"]}; instead, {r.get("instead")}')
    return out


def standard_reasons(cands, cfg=None, floor_doc=None):
    """(reasons, unread): the rejection-floor standards config/story-floor.json lists, each by its pattern, on the
    candidate's topic or our own words. A row whose standard is missing, not approved or outside the read themes is
    unread, never a silent pass."""
    cfg = cfg or config()
    spec = cfg['standards']
    if floor_doc is None:
        import floor as _floor
        floor_doc = _floor.load()
    standards = (floor_doc or {}).get('standards') or {}
    out, unread = {}, []
    for row in spec['rows']:
        s = standards.get(row['standard'])
        if not isinstance(s, dict):
            unread.append(f'standard {row["standard"]} is not in config/rejection-floor.json')
            continue
        if s.get('theme') not in spec['themes'] or s.get('standing') not in spec['standings']:
            unread.append(f'standard {row["standard"]} is {s.get("standing")} in theme {s.get("theme")}; the floor reads only '
                          f'{", ".join(spec["standings"])} standards in {", ".join(spec["themes"])}')
            continue
        rx = re.compile(row['pattern'], re.I)
        for ref, _day, main, c in cands:
            words = topic_of(ref, main, c) if row.get('on') == 'topic' else own_words(ref, c)
            m = rx.search(words or '')
            if m:
                out.setdefault(ref, []).append(f'standard {row["standard"]}: {row["reason"]} ("{m.group(0)}"; never beneath: '
                                               f'{s.get("never_beneath")})')
    return out, unread


def format_reasons(cands, week, styles=None, cfg=None):
    """A style format, an experiment or a bank module he marked not for us (week_plan.style_problems' rule, a verdict
    with not_for_us_from_week binding from that week on)."""
    cfg = cfg or config()
    spec = cfg['formats']
    data = styles if styles is not None else json.loads((ROOT / spec['from']).read_text(encoding='utf-8'))
    formats = {k: {x['id']: x for x in (data.get('formats') or {}).get(k) or [] if isinstance(x, dict)} for k in spec['kinds']}
    bank = {x['id']: x for x in data.get('bank') or [] if isinstance(x, dict) and x.get('id')}
    nfu = spec['not_for_us']
    binds = lambda f: f.get('krish_verdict') == nfu and str(week or '9999') >= str(f.get('not_for_us_from_week') or '')
    out = {}
    for ref, _day, _main, c in cands:
        st = c.get('style') if isinstance(c.get('style'), dict) else {}
        ex = st.get('experiment') if isinstance(st.get('experiment'), dict) else {}
        picked = [(k, st.get(k)) for k in spec['kinds']] + [('experiment', ex.get('format'))]
        for kind, fid in picked:
            if not fid:
                continue
            f = next((formats[k][fid] for k in spec['kinds'] if fid in formats[k]), None) or bank.get(fid)
            if isinstance(f, dict) and binds(f):
                out.setdefault(ref, []).append(f'format: style.{kind} "{fid}" is marked not for us; never offered again')
            for mod in (f or {}).get('modules') or []:
                if isinstance(bank.get(mod), dict) and binds(bank[mod]):
                    out.setdefault(ref, []).append(f'format: style.{kind} "{fid}" carries the module "{mod}", marked not for us')
    return out


def repeat_reasons(cands, sources, week, *, poster=None, cfg=None, plans=None):
    """(reasons, unread): the free divergent repeat guard, `obvious` given and no judge (zero model calls). A candidate
    the engine finds in the archive or pulled to what went out is refused, except an engine wildcard's own spark."""
    import divergent
    cfg = cfg or config()
    spec = cfg['repeat_guard']
    obvious = divergent.worn(sources, plans)
    if not cands:
        return {}, []
    if not obvious:
        return {}, ['repeat guard: no recent posts or earlier options to hold the candidates against (no call made)']
    out = {}
    texts = [(ref, c, divergent._clip(text_of(ref, main, c) or ref, divergent.MAX_IDEA_CHARS)) for ref, _d, main, c in cands]
    step = divergent.MAX_IDEAS
    for i in range(0, len(texts), step):
        chunk = texts[i:i + step]
        body = divergent.at_will_body('score', problem=spec['problem'].format(week=week or ''), ideas=[t for _r, _c, t in chunk],
                                      obvious=obvious, lane=None)
        assert not divergent.spends(body), 'the repeat guard makes no model call'
        got = divergent.at_will(body, **({'poster': poster} if poster else {}))
        if got.get('status') not in ('pass', 'flagged'):
            return {}, ['repeat guard: ' + str(got.get('reason') or got.get('status'))]
        results = (got.get('result') or {}).get('results') or []
        for (ref, c, _t), r in zip(chunk, results):
            st = r.get('status') if isinstance(r, dict) else None
            if st not in spec['refuse_statuses']:
                continue
            if st == spec['own_spark_status'] and isinstance(c.get('divergent'), dict):
                continue
            out.setdefault(ref, []).append(f'repeat guard: {st}, {divergent.FLAG.get(st, st)}')
    return out, []


# ---------------------------------------------------------------------------------------------------------------------
# The floor


def floor(cands, sources, *, week=None, shown_text=None, p6=None, kill=None, styles=None, floor_doc=None, poster=None,
          repeat_guard=True, plans=None, cfg=None):
    """{'week', 'candidates': [{'ref', 'floored', 'reasons'}], 'unread': [...]}. Pass or refused with reasons, in the
    order given; never a number, never reordered."""
    cfg = cfg or config()
    unread = []
    parts = [refusal_reasons(cands, sources, shown_text, p6, cfg), offbeat_reasons(cands), kill_reasons(cands, kill),
             rejected_line_reasons(cands), format_reasons(cands, week, styles, cfg)]
    got, why = standard_reasons(cands, cfg, floor_doc)
    parts.append(got)
    unread += why
    if repeat_guard:
        got, why = repeat_reasons(cands, sources, week, poster=poster, cfg=cfg, plans=plans)
        parts.append(got)
        unread += why
    else:
        unread.append('repeat guard: not asked for (--no-repeat-guard)')
    rows = []
    for ref, _day, _main, _c in cands:
        reasons = [r for p in parts for r in p.get(ref, [])]
        rows.append({'ref': ref, 'floored': bool(reasons), 'reasons': reasons})
    return {'week': week, 'candidates': rows, 'unread': unread}


def passed(result):
    """The refs that passed the floor: all the scorer may know of it."""
    return [r['ref'] for r in result['candidates'] if not r['floored']]


def render(result):
    lines = []
    for r in result['candidates']:
        lines.append(('REFUSED  ' if r['floored'] else 'pass     ') + r['ref'])
        lines += ['  - ' + x for x in r['reasons']]
    lines += ['UNREAD   ' + u for u in result['unread']]
    return '\n'.join(lines)


def main(argv=None, *, poster=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('week', help='the Monday, YYYY-MM-DD')
    ap.add_argument('--ideas', help='ideas.json (default docs/plans/<Monday>-week/ideas.json)')
    ap.add_argument('--sources', help='sources.json (default docs/plans/<Monday>-week/sources.json)')
    ap.add_argument('--plans', help='the plans folder (default docs/plans)')
    ap.add_argument('--pool', action='store_true', help='also floor every story in the gather pool')
    ap.add_argument('--no-repeat-guard', action='store_true', help='skip the free divergent repeat guard (listed unread)')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    plans = Path(a.plans) if a.plans else PLANS
    folder = plans / f'{a.week}-week'
    read = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
    ideas = read(a.ideas or folder / 'ideas.json') if (a.ideas or (folder / 'ideas.json').exists()) else {}
    sources = read(a.sources or folder / 'sources.json')
    import board_feed
    shown_text, _ = board_feed.plans_reader(plans)
    cands = board_candidates(ideas) + (pool_candidates(sources) if a.pool else [])
    result = floor(cands, sources, week=a.week, shown_text=shown_text, poster=poster, repeat_guard=not a.no_repeat_guard, plans=plans)
    print(json.dumps(result, indent=1, ensure_ascii=False) if a.json else render(result))
    return 2 if result['unread'] else 0


if __name__ == '__main__':
    sys.exit(main())
