#!/usr/bin/env python3
"""The blind proof of the story engine v5 (the plan's step 4; config/story-proof.json; the thresholds are in
docs/plans/proofs/2026-11-26-story-engine-v5/PROTOCOL.md, committed before any paid call).

This is the evaluator, not a scorer. It may read his picks, because it pairs the engine's choice with the board's lead
and with what he picked; story_score.py never imports it (tests/story_wall_test.py). His words never leave the gitignored
proof folder (.cache/proof/story-engine-v5/): results.json holds ids, letters and counts only.

    python3 scripts/post-pack/story_proof.py pool <Monday>                  # the week as he first pressed it, blind
    python3 scripts/post-pack/story_proof.py old <Monday> [--picks F]       # the board's lead and his pick, by idea_id
    python3 scripts/post-pack/story_proof.py run <Monday> --arm S|R [--dry] [--budget-usd N]
    python3 scripts/post-pack/story_proof.py pairs                          # what would pair (no key, no sheet)
    python3 scripts/post-pack/story_proof.py sheet --out FILE [--seed N]     # the sealed key and the answer sheet
    python3 scripts/post-pack/story_proof.py tells [--score GUESSES]        # the blind tells check
    python3 scripts/post-pack/story_proof.py record ANSWERS
    python3 scripts/post-pack/story_proof.py reveal

Arm S selects from the week's whole gather pool (the board's options and every pool story known before the board);
Arm R re-ranks the old options only. --dry runs every step with fake transports and spends nothing.
"""
import argparse
import contextlib
import hashlib
import io
import json
import math
import random
import re
import secrets
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import idea_checks as ic  # noqa: E402
import ideas_history  # noqa: E402
import story_score as ss  # noqa: E402

CONFIG = ROOT / 'config' / 'story-proof.json'
PLANS = ROOT / 'docs' / 'plans'


def config(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


CFG = config()


class ProofError(Exception):
    pass


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def cache_dir(cache=None, cfg=None):
    return Path(cache) if cache else ROOT / (cfg or CFG)['cache_dir']


def docs_dir(docs=None, cfg=None):
    return Path(docs) if docs else ROOT / (cfg or CFG)['docs_dir']


def load(path, default=None):
    p = Path(path)
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default


def save(path, data):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return p


def sha256_of(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# ---------------------------------------------------------------------------------------------------------------------
# Pool: the week as he first pressed it, blind


def taste_left(node, keys=None, path=''):
    """Every path at which a taste key remains (config taste_keys), at any depth."""
    keys = set(keys if keys is not None else CFG['taste_keys'])
    out = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k in keys:
                out.append(f'{path}.{k}')
            out += taste_left(v, keys, f'{path}.{k}')
    elif isinstance(node, list):
        for n, v in enumerate(node):
            out += taste_left(v, keys, f'{path}[{n}]')
    return out


def first_sentence(text, words):
    s = ic.sentences(text)
    first = (s[0] if s else str(text or '')).strip()
    w = first.split()
    return ' '.join(w[:words]) + (CFG['card']['cut_mark'] if len(w) > words else '')


def draft_of(item, cfg=None):
    """A gather-pool story as a draft option: id, title, fact, story, so_what, source. Nothing else is carried."""
    cfg = cfg or CFG
    idea = str(item.get('idea') or '').strip()
    out = {'id': str(item.get('id') or '').lower(), 'title': first_sentence(idea, cfg['pool_draft']['title_words']),
           'fact': idea, 'story': idea, 'so_what': str(item.get('thesis') or '').strip()}
    if item.get('source_url'):
        out['source'] = {'url': item['source_url']}
    return out


def shortlist_score(view):
    """The deterministic shortlist: fit plus named_thing, the two axes that need no call (0 to 20)."""
    return ss.fit_axis(view, True)[0] + ss.named_axis(view, True)[0]


def week_files(week, plans=None):
    """(ideas, sources, first_press, cutoff): the week's board and gather as they stood at his first press on it."""
    plans = Path(plans or PLANS).resolve()
    folder = plans / f'{week}-week'
    first = ideas_history.FIRST_PRESS.get(week, '2100-01-01T00:00:00')
    ideas = ideas_history.as_pressed(folder / 'ideas.json', first)
    sources = ideas_history.as_pressed(folder / 'sources.json', first)
    if not ideas.get('days'):
        raise ProofError(f'{week}: no board at {folder / "ideas.json"}')
    cutoff = ideas_history.BOARDS.get(week) or ic.stamp(sources.get('gathered_at')) or first
    return ideas, sources, first, cutoff


def blind_board(ideas, cfg=None):
    out = {'week_start': ideas.get('week_start')}
    for group in ('days', 'offdays'):
        block = ideas.get(group) if isinstance(ideas.get(group), dict) else {}
        out[group] = {d: [ss.blind_view(o) for o in opts if isinstance(o, dict)] for d, opts in block.items() if isinstance(opts, list)}
    return out


def pool(week, plans=None, cfg=None):
    """{week, first_press, cutoff, board, drafts: {day: [draft]}, dropped_after_cutoff, taste_left}. Raises when a taste
    key survives the blind view."""
    cfg = cfg or CFG
    ideas, sources, first, cutoff = week_files(week, plans)
    board = blind_board(ideas, cfg)
    hero = cfg['slots']['hero']
    seen = {str(o.get('id') or '').lower() for opts in board['days'].values() for o in opts}
    items = [(item, cfg['series_day'].get(str(item.get('lane_slot') or series.get('slug') or '')))
             for series in sources.get('series') or [] if isinstance(series, dict) for item in series.get('pool') or []]
    if cfg['pool_draft'].get('unassigned'):
        items += [(item, None) for item in sources.get('unassigned') or []]
    drafts, spare, dropped = {d: [] for d in hero}, [], []
    for item, day in items:
        if not isinstance(item, dict) or not item.get('id'):
            continue
        if ic.stamp(item.get('created_at')) and ic.stamp(item.get('created_at')) > ic.stamp(cutoff):
            dropped.append(str(item['id']).lower())
            continue
        d = ss.blind_view(draft_of(item, cfg))
        if d['id'] in seen:
            continue
        seen.add(d['id'])
        (drafts[day] if day in drafts else spare).append(d)
    n = cfg['pool_draft']['shortlist_per_day']
    rank = lambda v: sorted(v, key=lambda x: -shortlist_score(x))  # noqa: E731  stable: the gather's order breaks ties
    drafts = {d: rank(v)[:n] for d, v in drafts.items()}
    spare = rank(spare)
    while spare and any(len(v) < n for v in drafts.values()):
        for d in hero:
            if spare and len(drafts[d]) < n:
                drafts[d].append(spare.pop(0))
    drafts = {d: v for d, v in drafts.items() if v}
    doc = {'week': week, 'first_press': first, 'cutoff': cutoff, 'board': board, 'drafts': drafts, 'dropped_after_cutoff': sorted(dropped)}
    left = taste_left({'board': board, 'drafts': drafts}, cfg['taste_keys'])
    doc['taste_left'] = left
    if left:
        raise ProofError(f'{week}: a taste key survived the blind view at {", ".join(left[:5])}: stopped')
    return doc


# ---------------------------------------------------------------------------------------------------------------------
# Old: the board's lead and his pick, by idea_id from the final picks document


def lead_of(board, day, cfg=None):
    """The option the board led with on a day: the first (the first not weekly on an off day or Saturday)."""
    cfg = cfg or CFG
    if day in cfg['slots']['hero']:
        opts = board['days'].get(day) or []
        return opts[0] if opts else None
    return next((o for o in board['offdays'].get(day) or [] if not o.get('weekly')), None)


def picks_from_presses(presses):
    """{day: idea_id} from his final picks documents (picks/<day>), a press taken back leaving nothing."""
    import ideas_scorecard
    out = {}
    for doc, p in ideas_scorecard.final_presses(presses).items():
        m = re.match(r'^picks/(mon|wed|fri)$', doc)
        if m and p.get('outcome') == 'approved' and p.get('idea_id'):
            out[m.group(1)] = str(p['idea_id']).lower()
    return out


def read_picks(week, call=None):
    """His picks on the week's board, read live and read-only (GET /api/board/<Monday>/outcomes)."""
    import board_feed
    import making
    data = board_feed.get(call or making._engine_call, f'/api/board/{week}/outcomes')
    return picks_from_presses(board_feed.presses_from(data))


def old(week, plans=None, picks=None, call=None, cache=None, cfg=None):
    """{week, lead: {slot: id}, picks: {day: id or None}, source, conflicts}. picks: {day: idea_id} to use instead of
    reading the board (a picks file)."""
    cfg = cfg or CFG
    ideas, _sources, _first, _cutoff = week_files(week, plans)
    board = blind_board(ideas, cfg)
    days = [*cfg['slots']['hero'], *cfg['slots']['offday'], *cfg['slots']['saturday']]
    lead = {d: (str((lead_of(board, d, cfg) or {}).get('id') or '').lower() or None) for d in days}
    source = 'file' if picks is not None else 'outcomes'
    got = {str(k): str(v).lower() for k, v in (picks if picks is not None else read_picks(week, call)).items() if v}
    on_board = {d: {str(o.get('id') or '').lower(): n for n, o in enumerate(board['days'].get(d) or [], 1)} for d in cfg['slots']['hero']}
    conflicts, out = [], {}
    for d in cfg['slots']['hero']:
        pid = got.get(d)
        if pid and pid not in on_board[d]:
            conflicts.append(f'{d}: the final pick {pid[:8]} is not an option on the board he pressed; no pick pair')
            pid = None
        out[d] = pid
    card = load(Path(plans or PLANS) / f'{week}-week' / 'scorecard.json', {}) or {}
    for d, ref in sorted((card.get('picks') or {}).items()):
        m = re.match(rf'^{d}-(\d+)$', str(ref or ''))
        sid = str((board['days'].get(d) or [])[int(m.group(1)) - 1].get('id')).lower() if m and int(m.group(1)) <= len(board['days'].get(d) or []) else None
        if sid and out.get(d) and sid != out[d]:
            conflicts.append(f'{d}: scorecard.json says {ref} ({sid[:8]}), the final picks document says {out[d][:8]}; '
                             'the final picks document holds')
    doc = {'week': week, 'lead': lead, 'picks': out, 'source': source, 'conflicts': conflicts,
           'pick_ranks_on_board': {d: on_board[d].get(out[d]) if out[d] else None for d in cfg['slots']['hero']}}
    save(cache_dir(cache, cfg) / week / 'old.json', doc)
    return doc


# ---------------------------------------------------------------------------------------------------------------------
# Run: one arm on one week, in a working copy under the proof folder


def candidates(pooldoc, arm):
    """The ideas.json the arm scores: Arm R the old board; Arm S the board plus every pool story for its hero day."""
    board = json.loads(json.dumps(pooldoc['board']))
    if arm == 'S':
        for day, drafts in (pooldoc.get('drafts') or {}).items():
            board['days'].setdefault(day, []).extend(json.loads(json.dumps(drafts)))
    return board


def estimate(ideas, scfg=None):
    """Dollars a real run would reserve: each hero day's top two provoked, one judged score a hundred angles, a humour
    read for each fact, funny line and pooled angle."""
    scfg = scfg or ss.RUBRIC
    u, spec = scfg['unit_costs'], scfg['angle']['divergent']
    rows = ss.board(ideas)
    hero_days = {d for _k, d, main, _o in rows if main}
    provokes = len(hero_days) * spec['per_hero_day']
    angles = len(rows) + provokes * int(spec.get('count') or 3)
    reads = len(rows) + sum(1 for _k, _d, main, o in rows if not main and o.get('funny')) + angles
    usd = provokes * u['provoke'] + math.ceil(angles / 100) * u['score_judge'] + reads * u['humour_read']
    return {'provokes': provokes, 'judged_batches': math.ceil(angles / 100), 'humour_reads': reads, 'usd': round(usd, 2)}


def frozen_sha(docs=None):
    text = (docs_dir(docs) / 'PROTOCOL.md').read_text(encoding='utf-8') if (docs_dir(docs) / 'PROTOCOL.md').exists() else ''
    m = re.search(r'Frozen engine SHA: `([0-9a-f]{40})`', text)
    return m.group(1) if m else None


def engine_changed(sha, cfg=None):
    """The engine files that differ from the frozen SHA (no tuning on the proof weeks)."""
    cfg = cfg or CFG
    if not sha:
        return ['no frozen SHA in PROTOCOL.md']
    got = subprocess.run(['git', 'diff', '--name-only', sha, '--', *cfg['engine_files']], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if got.returncode != 0:
        return [f'git diff against {sha[:8]} failed']
    return [x for x in got.stdout.splitlines() if x.strip()]


class FakePoster:
    """--dry: a divergent route that answers every op and spends nothing."""

    def __init__(self):
        self.calls = []

    def __call__(self, body):
        self.calls.append(body)
        if body['op'] == 'provoke':
            return 200, {'ok': True, 'runId': 'dry', 'sparks': [{'title': 'A dry-run spark', 'mechanism': 'reversal'}]}
        n = len(body.get('ideas') or [])
        return 200, {'ok': True, 'results': [{'status': 'novel', 'scores': {'originality': 5, 'usefulness': 5, 'specificity': 5}} for _ in range(n)]}


def fake_cap():
    return {'chain_over': False, 'chain_usd': 0, 'chain_cap_usd': 15}


def fake_read(_request):
    return {'comic_reading': 'ambiguous', 'humour_attempt': {'status': 'supported_inference'},
            'interpretations': [{'id': 'i1', 'is_main': True, 'supported_reading': None, 'labels_by_axis': {'mechanism': [], 'target': []},
                                 'evidence_refs': []}], 'evidence': [], 'context_dependencies': [], 'missing_context': []}


def fake_inputs(work, week, ideas, scfg=None):
    """--dry: the in-session inputs a real run makes (the blind judges and the whys probes), as flat middling numbers,
    so every step runs. They say nothing about any story."""
    scfg = scfg or ss.RUBRIC
    story = work / f'{week}-week'
    judged, probes = {}, {}
    for key, _day, _main, o in ss.board(ideas):
        judged[key] = {a['id']: {'score': 5, 'because': 'dry run'} for a in scfg['axes'] if a['source'] == 'blind_judge'}
        probes[str(o.get('id') or '').lower()] = {'schema': 'whys-probe/1', 'documented': 3, 'inferred': 2, 'sites': 2, 'mechanism_rungs': 1,
                                                  'counter_rungs': 1, 'landing_ok': True, 'unreadable': [], 'problems': [], 'rungs': []}
    ss.save(ss.file_of(week, 'judged', work, scfg), judged)
    ss.save(ss.file_of(week, 'probes', work, scfg), probes)
    return story


def _quiet(fn, *args, **kw):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = fn(*args, **kw)
    return code, out.getvalue()


def new_first(ordered, day, cfg=None):
    """The engine's choice for a slot: the first option of the day as ordered (the first not weekly off the hero days)."""
    return lead_of(blind_board(ordered, cfg), day, cfg)


def run(week, arm, *, dry=False, budget_usd=None, plans=None, cache=None, poster=None, cap=None, read=None, kill=None,
        floor_poster=None, cfg=None, docs=None, today=None):
    """(exit code, summary). One arm on one week, in .cache/proof/story-engine-v5/arm-<arm>/. A real run checks the
    frozen engine, the proof budget and the chain first, and needs the session's blind judges and whys probes; a step
    that could not run is listed and the run exits 2, never a pass."""
    import story_floor
    cfg = cfg or CFG
    scfg = ss.RUBRIC
    if arm not in ('S', 'R'):
        raise ProofError('--arm is S or R')
    root = cache_dir(cache, cfg)
    pooldoc = pool(week, plans, cfg)
    save(root / week / 'pool.json', pooldoc)
    ideas = candidates(pooldoc, arm)
    work = root / ('dry' if dry else 'live') / f'arm-{arm}'
    folder = work / f'{week}-week'
    folder.mkdir(parents=True, exist_ok=True)
    save(folder / 'ideas.json', ideas)
    _i, sources, _f, _c = week_files(week, plans)
    save(folder / 'sources.json', sources)
    est = estimate(ideas, scfg)
    summary = {'week': week, 'arm': arm, 'dry': dry, 'estimate': est, 'unread': [], 'steps': {}}

    budget = min(float(budget_usd if budget_usd is not None else cfg['budget_usd']), float(cfg['budget_usd']))
    ledger_path = root / ('dry' if dry else '') / (f'ledger-{arm}-{week}.jsonl' if dry else 'spend.jsonl')
    if dry:
        ledger_path.unlink(missing_ok=True)
        poster, cap, read = poster or FakePoster(), cap or fake_cap, read or fake_read
        fake_inputs(work, week, ideas, scfg)
    else:
        changed = engine_changed(frozen_sha(docs), cfg)
        if changed:
            summary['unread'].append('the engine differs from the frozen SHA: ' + ', '.join(changed))
            return 2, summary
        import divergent
        spent = ss.Ledger(ledger_path, budget, scfg, today, write=False).spent()
        if spent + est['usd'] > budget + 1e-9:
            summary['unread'].append(f'the run would reserve about ${est["usd"]} with ${spent} of ${budget:g} spent: no call made')
            return 2, summary
        week_spend = (cap or divergent.chain_week)()
        runs, why = divergent.chain_verdict(week_spend)
        summary['chain'] = why
        if not runs or (isinstance(week_spend, dict) and float(week_spend.get('chain_cap_usd', 15)) - float(week_spend.get('chain_usd') or 0) < est['usd']):
            summary['unread'].append(f'the chain has no room for about ${est["usd"]}: {why}; no call made')
            return 2, summary
        missing = [n for n in ('judged', 'probes') if not ss.file_of(week, n, work, scfg).exists()]
        if missing:
            ss.main(['brief', week, '--plans', str(work)], plans=work)
            summary['unread'].append('the session has not written ' + ' and '.join(f'story/{n}.json' for n in missing)
                                     + f' in {folder}: the judge brief is in {folder / "story"}')
            return 2, summary

    import board_feed
    shown_text, _ = board_feed.plans_reader(Path(plans or PLANS))
    fl = story_floor.floor(story_floor.board_candidates(ideas), sources, week=week, shown_text=shown_text, kill=kill,
                           poster=floor_poster, repeat_guard=not dry and floor_poster is not False, plans=Path(plans or PLANS))
    save(folder / 'story' / 'floor.json', fl)
    summary['floor_unread'] = fl['unread']
    if not dry:
        summary['unread'] += [f'floor: {u}' for u in fl['unread']]
    common = ['--plans', str(work)]
    paid = ['--budget-usd', str(budget), '--ledger', str(ledger_path)]
    kw = dict(poster=poster, cap=cap, read=read, kill=kill, plans=work, today=today)
    for name, argv in (('angles', ['angles', week, *common, '--provoke', '--judge', *paid]),
                       ('humour', ['humour', week, *common, *paid]),
                       ('score', ['score', week, *common, '--floor', str(folder / 'story' / 'floor.json')]),
                       ('order', ['order', week, *common, '--fresh', '--write'])):
        code, out = _quiet(ss.main, argv, **kw)
        summary['steps'][name] = code
        if code:
            summary['unread'].append(f'{name}: exit {code}')
    ordered = load(folder / 'ideas.json')
    scores = (load(ss.file_of(week, 'scores', work, scfg), {}) or {}).get('options') or {}
    refused = {r['ref'] for r in fl['candidates'] if r['floored']}
    ref_of = {ss.key_of(d, o): ref for ref, d, _m, o in ic.board_raw(ideas)}
    days = [*cfg['slots']['hero'], *cfg['slots']['offday'], *cfg['slots']['saturday']]
    new = {}
    for d in days:
        o = new_first(ordered, d, cfg)
        if not o:
            new[d] = None
            continue
        key = ss.key_of(d, o)
        sc = scores.get(key) or {}
        new[d] = {'id': str(o.get('id')).lower(), 'key': key, 'total': sc.get('total'), 'angle': (sc.get('angle') or {}).get('text'),
                  'refused': ref_of.get(key) in refused, 'from_pool': any(str(x.get('id')).lower() == str(o.get('id')).lower()
                                                                          for x in (pooldoc.get('drafts') or {}).get(d) or [])}
    summary['new'] = new
    olddoc = load(root / week / 'old.json')
    if olddoc:
        summary['pick_rank'] = {}
        for d in cfg['slots']['hero']:
            pid = olddoc['picks'].get(d)
            ids = [str(o.get('id')).lower() for o in (ordered.get('days') or {}).get(d) or []]
            summary['pick_rank'][d] = ids.index(pid) + 1 if pid in ids else None
    summary['ledger'] = ss.Ledger(ledger_path, budget, scfg, today, write=False).summary()
    if dry and isinstance(poster, FakePoster):
        summary['fake_calls'] = {op: sum(1 for b in poster.calls if b['op'] == op) for op in sorted({b['op'] for b in poster.calls})}
    save(work / f'{week}.json', summary)
    return (2 if summary['unread'] else 0), summary


# ---------------------------------------------------------------------------------------------------------------------
# Cards and pairs


def strip_house(text, cfg=None):
    """The words without the board's own labels: whole sentences that talk about the board are dropped, and a house
    label is taken out wherever it stands."""
    cfg = cfg or CFG
    c = cfg['card']
    text = str(text or '').strip()
    for p in c.get('strip_patterns') or []:
        text = re.sub(p, '', text, flags=re.I).strip()
    drop = [re.compile(p, re.I) for p in c['drop_sentences_matching']]
    kept = [s for s in ic.sentences(text) if not any(p.search(s) for p in drop)]
    out = ' '.join(kept) if kept else ''
    for label in c['house_labels']:
        out = re.sub(r'(?<![A-Za-z])' + re.escape(label) + r'(?![A-Za-z])\s*[:,-]?\s*', '', out, flags=re.I)
    out = re.sub(r'\s{2,}', ' ', out).strip(' ,;:-')
    return out[:1].upper() + out[1:]


def clip(text, words, cfg=None):
    w = str(text or '').split()
    return ' '.join(w[:words]) + ((cfg or CFG)['card']['cut_mark'] if len(w) > words else '')


def card(slot, view, main, angle=None, cfg=None):
    """The one renderer for both sides: Slot, What happened, The angle and Source, nothing else."""
    cfg = cfg or CFG
    c = cfg['card']
    what = clip(strip_house(ss.fact_text(view, main), cfg), c['what_happened_words'], cfg)
    ang = clip(strip_house(angle or ss.own_angle(view, main) or view.get('title'), cfg), c['angle_words'], cfg)
    src = ss.site_of(ic.source_of(view).get('url')) or 'no source given'
    return dict(zip(c['fields'], (slot, what, ang, src)))


def render_card(letter, cd):
    return '\n'.join([f'**{letter}**'] + [f'- {k}: {v}' for k, v in cd.items()])


def slot_label(week, day, cfg=None):
    cfg = cfg or CFG
    d = datetime.fromisoformat(week)
    return f'{cfg["slot_names"][day]}, week of {d.day} {d.strftime("%b")}'


def pairs(weeks=None, cache=None, cfg=None, allow_dry=True):
    """(pairs, not_shown): per hero slot the engine's choice against the board's lead and against his pick, and one per
    off day and Saturday against the board's lead. The same story on both sides is a tie, not shown; a pick that is the
    lead is the same pair, not shown twice."""
    cfg = cfg or CFG
    root = cache_dir(cache, cfg)
    out, not_shown = [], []
    for week in weeks or cfg['weeks']:
        pooldoc, olddoc = load(root / week / 'pool.json'), load(root / week / 'old.json')
        runs = [load(root / x / 'arm-S' / f'{week}.json') for x in (('live', 'dry') if allow_dry else ('live',))]
        rundoc = next((r for r in runs if r), None)
        if not (pooldoc and olddoc and rundoc):
            raise ProofError(f'{week}: run pool, old and run --arm S{"" if allow_dry else " (not --dry)"} first')
        ordered = load(root / ('dry' if rundoc.get('dry') else 'live') / 'arm-S' / f'{week}-week' / 'ideas.json')
        by_id = {}
        for group, main in (('days', True), ('offdays', False)):
            for d, opts in (ordered.get(group) or {}).items():
                for o in opts:
                    by_id[(d, str(o.get('id')).lower())] = (o, main)
        for d, opts in (pooldoc['board'].get('days') or {}).items():
            for o in opts:
                by_id.setdefault((d, str(o.get('id')).lower()), (o, True))
        for d, opts in (pooldoc['board'].get('offdays') or {}).items():
            for o in opts:
                by_id.setdefault((d, str(o.get('id')).lower()), (o, False))
        wants = [(d, 'hero_vs_lead', olddoc['lead'].get(d)) for d in cfg['slots']['hero']]
        wants += [(d, 'hero_vs_pick', olddoc['picks'].get(d)) for d in cfg['slots']['hero']]
        wants += [(d, 'offday_vs_lead', olddoc['lead'].get(d)) for d in cfg['slots']['offday']]
        wants += [(d, 'saturday_vs_lead', olddoc['lead'].get(d)) for d in cfg['slots']['saturday']]
        for d, kind, old_id in wants:
            new = (rundoc.get('new') or {}).get(d)
            row = {'week': week, 'day': d, 'kind': kind, 'new_id': (new or {}).get('id'), 'old_id': old_id}
            if not new or not old_id:
                not_shown.append({**row, 'why': 'no pick on the board he pressed' if kind == 'hero_vs_pick' and not old_id else 'nothing to pair'})
                continue
            if kind == 'hero_vs_pick' and old_id == olddoc['lead'].get(d):
                not_shown.append({**row, 'why': 'his pick is the lead: the same pair as hero_vs_lead'})
                continue
            if new['id'] == old_id:
                not_shown.append({**row, 'why': 'the same story on both sides: a tie', 'tie': True})
                continue
            nv, nmain = by_id[(d, new['id'])]
            ov, omain = by_id[(d, old_id)]
            row.update(new_refused=bool(new.get('refused')), new_from_pool=bool(new.get('from_pool')),
                       new_card=card(slot_label(week, d, cfg), nv, nmain, new.get('angle'), cfg),
                       old_card=card(slot_label(week, d, cfg), ov, omain, None, cfg))
            out.append(row)
    return out, not_shown


def half_new_a(n, rng):
    """Exactly half the pairs have New as A (the lower half when n is odd), in a seeded order."""
    flags = [True] * (n // 2) + [False] * (n - n // 2)
    rng.shuffle(flags)
    return flags


def seal(rows, not_shown, seed):
    """The key: which letter is New in each pair, shuffled by the seed. Cards are not in it."""
    rng = random.Random(seed)
    order = list(range(len(rows)))
    rng.shuffle(order)
    flags = half_new_a(len(rows), rng)
    pairs_out = []
    for n, (i, new_a) in enumerate(zip(order, flags), 1):
        r = rows[i]
        new_side = {'side': 'new', 'idea_id': r['new_id'], 'refused': r['new_refused'], 'from_pool': r['new_from_pool']}
        old_side = {'side': 'old', 'idea_id': r['old_id']}
        pairs_out.append({'pair': f'P{n:02d}', 'week': r['week'], 'day': r['day'], 'kind': r['kind'], 'new': 'A' if new_a else 'B',
                          'A': new_side if new_a else old_side, 'B': old_side if new_a else new_side, '_row': i})
    ties = [{k: t[k] for k in ('week', 'day', 'kind', 'new_id', 'old_id', 'why')} for t in not_shown]
    return {'proof': CFG['proof_id'], 'seed': seed, 'made_at': now_iso(), 'pairs': pairs_out, 'not_shown': ties}


def sheet_text(key, rows, digest=None, cfg=None, intro=None, answer_line=True):
    cfg = cfg or CFG
    s = cfg['sheet']
    lines = [f'# {s["title"]}', '', intro or s['intro'], '']
    if answer_line:
        lines += [f'Answer each pair as: `{cfg["answers"]["line"]}`', '']
    for p in key['pairs']:
        r = rows[p['_row']]
        a, b = (r['new_card'], r['old_card']) if p['new'] == 'A' else (r['old_card'], r['new_card'])
        lines += [f'## {p["pair"]}', '', render_card('A', a), '', render_card('B', b), '']
        if answer_line:
            lines += [f'{p["pair"]}: ', '']
    if digest:
        lines += [f'Key sealed: sha256 {digest}', '']
    return '\n'.join(lines)


def sheet(out, seed=None, cache=None, weeks=None, force=False, cfg=None, allow_dry=False):
    """Writes the sealed key (gitignored) and the answer sheet. The sheet carries only the key's sha256."""
    cfg = cfg or CFG
    root = cache_dir(cache, cfg)
    key_path = root / 'key.json'
    if key_path.exists() and not force:
        raise ProofError(f'{key_path} is already sealed: a new key would unblind the old sheet (use --force only before he answers)')
    if (root / 'answers.json').exists():
        raise ProofError('answers are recorded: the key cannot be made again')
    rows, not_shown = pairs(weeks, cache, cfg, allow_dry)
    key = seal(rows, not_shown, seed if seed is not None else secrets.randbits(64))
    key['dry'] = bool(allow_dry)
    save(key_path, key)
    digest = sha256_of(key_path)
    text = sheet_text(key, rows, digest, cfg)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(text, encoding='utf-8')
    save(root / 'sheet.json', {'sha256': digest, 'pairs': [p['pair'] for p in key['pairs']], 'out': str(out), 'made_at': key['made_at']})
    return key, digest


# ---------------------------------------------------------------------------------------------------------------------
# Tells, answers and the reveal


def protocol(docs=None):
    """The thresholds frozen in PROTOCOL.md (its ```json block)."""
    text = (docs_dir(docs) / 'PROTOCOL.md').read_text(encoding='utf-8')
    m = re.search(r'```json\s*(\{.*?\})\s*```', text, re.S)
    if not m:
        raise ProofError('PROTOCOL.md has no ```json thresholds block')
    return json.loads(m.group(1))['thresholds']


def bar(rule, n):
    """At least this many of n: the protocol's count, scaled when fewer pairs formed than it was written for."""
    return rule['at_least'] if n == rule['of'] else math.ceil(rule['at_least'] * n / rule['of'])


def tells(score_file=None, cache=None, docs=None, cfg=None):
    """Without a file: the packet for the blind tells check (cards only). With one (`Pnn: A|B` lines, which card the
    reader thinks is new): (passed, doc), passed when the reader got fewer right than the protocol allows."""
    cfg = cfg or CFG
    root = cache_dir(cache, cfg)
    key = load(root / 'key.json')
    if not key:
        raise ProofError('no sealed key: run sheet first')
    if score_file is None:
        rows, _ = pairs(sorted({p['week'] for p in key['pairs']}), cache, cfg, key.get('dry', False))
        packet = root / 'tells-packet.md'
        packet.write_text(sheet_text(key, rows, None, cfg, cfg['sheet']['tells_intro'], answer_line=False), encoding='utf-8')
        return None, {'packet': str(packet)}
    guesses = {}
    for line in Path(score_file).read_text(encoding='utf-8').splitlines():
        m = re.match(r'^\s*(P\d{2})\s*:\s*([AB])\b', line)
        if m:
            guesses[m.group(1)] = m.group(2)
    rule = protocol(docs)['tells']
    n = len(key['pairs'])
    right = sum(1 for p in key['pairs'] if guesses.get(p['pair']) == p['new'])
    limit = rule['below'] if n == rule['of'] else math.ceil(rule['below'] * n / rule['of'])
    doc = {'right': right, 'of': n, 'answered': len(guesses), 'below': limit, 'passed': right < limit and len(guesses) == n}
    save(root / 'tells.json', doc)
    return doc['passed'], doc


ANSWER = re.compile(r'^\s*(P\d{2})\s*:\s*(A\+\+|A\+|=|B\+\+|B\+)\s*(?:;(.*))?$')


def yn(text, pattern):
    m = re.search(pattern + r'\s*\??\s*(y|n|yes|no)\b', text or '', re.I)
    return None if not m else m.group(1).lower().startswith('y')


def parse_answers(text):
    """({pair: {grade, seen_before, make_a, make_b, note}}, problems)."""
    got, problems = {}, []
    for n, line in enumerate(text.splitlines(), 1):
        if not re.match(r'^\s*P\d{2}\s*:', line):
            continue
        m = ANSWER.match(line)
        if not m:
            if line.split(':', 1)[1].strip():
                problems.append(f'line {n}: not one of A++, A+, =, B+, B++')
            continue
        rest = m.group(3) or ''
        note = re.search(r'note\s*:\s*(.*)$', rest, re.I)
        make = re.search(r'would make a\s*\??\s*(y|n)\w*\s*,?\s*b\s*\??\s*(y|n)', rest, re.I)
        got[m.group(1)] = {'grade': m.group(2), 'seen_before': yn(rest, r'seen before'),
                           'make_a': make.group(1).lower() == 'y' if make else None, 'make_b': make.group(2).lower() == 'y' if make else None,
                           'note': note.group(1).strip() if note else ''}
    return got, problems


def record(answers_file, cache=None, cfg=None):
    cfg = cfg or CFG
    root = cache_dir(cache, cfg)
    got, problems = parse_answers(Path(answers_file).read_text(encoding='utf-8'))
    if got:
        save(root / 'answers.json', {'at': now_iso(), 'answers': got})
    return got, problems


def new_points(grade, new_letter):
    if grade == '=':
        return 0.5
    return 1.0 if grade[0] == new_letter else 0.0


def reveal(cache=None, docs=None, write=True, cfg=None):
    """(results, problems). Refuses on a key that does not match the sheet's hash or any pair left unanswered."""
    cfg = cfg or CFG
    root = cache_dir(cache, cfg)
    key_path, meta, answers = root / 'key.json', load(root / 'sheet.json'), (load(root / 'answers.json') or {}).get('answers') or {}
    if not key_path.exists() or not meta:
        return None, ['no sealed key or sheet: nothing to reveal']
    if sha256_of(key_path) != meta['sha256']:
        return None, ['the key does not match the sha256 printed on the sheet: refused']
    key = load(key_path)
    missing = [p['pair'] for p in key['pairs'] if p['pair'] not in answers]
    if missing:
        return None, [f'unanswered: {", ".join(missing)}: no reveal until every pair is answered']
    th = protocol(docs)
    rows, lead = [], []
    for p in key['pairs']:
        a = answers[p['pair']]
        pts = new_points(a['grade'], p['new'])
        make_new, make_old = (a['make_a'], a['make_b']) if p['new'] == 'A' else (a['make_b'], a['make_a'])
        new_side = p[p['new']]
        rows.append({'pair': p['pair'], 'week': p['week'], 'day': p['day'], 'kind': p['kind'], 'new': p['new'], 'grade': a['grade'],
                     'new_points': pts, 'seen_before': a['seen_before'], 'would_make_new': make_new, 'would_make_old': make_old,
                     'new_id': new_side['idea_id'], 'old_id': p['B' if p['new'] == 'A' else 'A']['idea_id'],
                     'new_refused': bool(new_side.get('refused'))})
        if p['kind'] == 'hero_vs_lead':
            lead.append(pts)
    ties = [t for t in key['not_shown'] if t.get('why', '').startswith('the same story')]
    n = len(rows) + len(ties)
    preferred = sum(r['new_points'] for r in rows) + th['equal_counts'] * len(ties)
    lead_n = len(lead) + sum(1 for t in ties if t['kind'] == 'hero_vs_lead')
    lead_pts = sum(lead) + th['equal_counts'] * sum(1 for t in ties if t['kind'] == 'hero_vs_lead')
    refused = sum(1 for r in rows if r['new_refused'])
    need, need_lead = bar(th['new_preferred'], n), bar(th['hero_vs_lead'], lead_n)
    ok = preferred >= need and lead_pts >= need_lead and refused <= th['new_on_refused_subject']['at_most']
    inconclusive_from = bar({'of': th['new_preferred']['of'], 'at_least': th['new_preferred']['inconclusive_from']}, n)
    verdict = 'pass' if ok else ('inconclusive' if preferred >= inconclusive_from and refused == 0 else 'fail')
    def rate(k):
        vals = [r[k] for r in rows if r[k] is not None]
        return {'yes': sum(vals), 'of': len(vals)}
    results = {
        'proof': key['proof'], 'key_sha256': meta['sha256'], 'engine_sha': frozen_sha(docs), 'revealed_at': now_iso(),
        'pairs': rows, 'not_shown': [{k: t[k] for k in ('week', 'day', 'kind', 'new_id', 'old_id')} | {'tie': t['why'].startswith('the same story')}
                                     for t in key['not_shown']],
        'counts': {'pairs': n, 'new_preferred': preferred, 'needed': need, 'hero_vs_lead': {'points': lead_pts, 'of': lead_n, 'needed': need_lead},
                   'new_on_refused_subject': refused, 'seen_before': rate('seen_before'), 'would_make_new': rate('would_make_new'),
                   'would_make_old': rate('would_make_old')},
        'tells': {k: v for k, v in (load(root / 'tells.json') or {}).items() if k in ('right', 'of', 'passed')},
        'verdict': verdict,
    }
    results['arm_r_pick_rank'] = {w: (load(root / 'live' / 'arm-R' / f'{w}.json') or {}).get('pick_rank')
                                  for w in sorted({p['week'] for p in key['pairs']})}
    if write:
        save(docs_dir(docs, cfg) / 'results.json', results)
    return results, []


# ---------------------------------------------------------------------------------------------------------------------
# CLI


def main(argv=None, *, poster=None, cap=None, read=None, kill=None, call=None, plans=None, cache=None, docs=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('pool')
    p.add_argument('week')
    o = sub.add_parser('old')
    o.add_argument('week')
    o.add_argument('--picks', help='a JSON file {day: idea_id} of his picks, instead of reading the board')
    r = sub.add_parser('run')
    r.add_argument('week')
    r.add_argument('--arm', required=True, choices=['S', 'R'])
    r.add_argument('--dry', action='store_true', help='fake transports: spends nothing')
    r.add_argument('--budget-usd', type=float)
    sub.add_parser('pairs')
    s = sub.add_parser('sheet')
    s.add_argument('--out', required=True, help="the answer sheet's path (his notes folder, never the board)")
    s.add_argument('--seed', type=int)
    s.add_argument('--force', action='store_true')
    t = sub.add_parser('tells')
    t.add_argument('--score', help='the blind reader\'s guesses, `Pnn: A|B` lines')
    rc = sub.add_parser('record')
    rc.add_argument('file')
    sub.add_parser('reveal')
    a = ap.parse_args(argv)
    try:
        if a.cmd == 'pool':
            doc = pool(a.week, plans)
            save(cache_dir(cache) / a.week / 'pool.json', doc)
            print(json.dumps({'week': a.week, 'cutoff': doc['cutoff'], 'first_press': doc['first_press'],
                              'board': {g: {d: len(v) for d, v in doc['board'][g].items()} for g in ('days', 'offdays')},
                              'drafts': {d: len(v) for d, v in doc['drafts'].items()}, 'dropped_after_cutoff': len(doc['dropped_after_cutoff'])}, indent=1))
            return 0
        if a.cmd == 'old':
            picks = load(a.picks) if a.picks else None
            doc = old(a.week, plans, picks, call, cache)
            print(json.dumps(doc, indent=1))
            return 0
        if a.cmd == 'run':
            code, summary = run(a.week, a.arm, dry=a.dry, budget_usd=a.budget_usd, plans=plans, cache=cache, poster=poster, cap=cap, read=read,
                                kill=kill, docs=docs)
            print(json.dumps(summary, indent=1, ensure_ascii=False))
            return code
        if a.cmd == 'pairs':
            rows, not_shown = pairs(None, cache)
            print(json.dumps({'pairs': [{k: r[k] for k in ('week', 'day', 'kind', 'new_id', 'old_id', 'new_from_pool', 'new_refused')} for r in rows],
                              'not_shown': not_shown, 'shown': len(rows)}, indent=1))
            return 0
        if a.cmd == 'sheet':
            key, digest = sheet(a.out, a.seed, cache, force=a.force)
            print(f'{len(key["pairs"])} pairs ({sum(1 for p in key["pairs"] if p["new"] == "A")} with the new card as A), '
                  f'{len(key["not_shown"])} not shown; key sealed, sha256 {digest}; sheet at {a.out}')
            return 0
        if a.cmd == 'tells':
            passed, doc = tells(a.score, cache, docs)
            print(json.dumps(doc, indent=1))
            return 0 if passed in (None, True) else 1
        if a.cmd == 'record':
            got, problems = record(a.file, cache)
            print(json.dumps({'recorded': sorted(got), 'problems': problems}, indent=1))
            return 2 if problems or not got else 0
        results, problems = reveal(cache, docs)
        if problems:
            print('\n'.join(problems), file=sys.stderr)
            return 2
        print(json.dumps({'verdict': results['verdict'], 'counts': results['counts']}, indent=1))
        return 0
    except ProofError as e:
        print(f'story_proof {a.cmd}: {e}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
