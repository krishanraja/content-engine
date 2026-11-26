#!/usr/bin/env python3
"""The blind story score: the second of the story engine's three stages (the story engine v5 plan, commits 5 and 6;
config/story-score.json, rubric_version story-score/1).

Every Sunday option that passed the floor is scored on anchored 0 to 10 axes (scale, absurdity_humour, unique_angle,
whys, fit, named_thing, fun_consume, fun_produce, and the per-type ones), weighted per content type to a total out of
100, with hard floors per type. Then the open days are put in that order, and close calls are named.

Ruling (Krish, 2026-11-26): his taste is a floor only. This module never imports the floor's module or the proof
harness, never reads his picks, his words, his verdicts on formats or his likes, and sees an option only through
blind_view(). The floor's JSON output is read for one bit per option, whether it was floored, never its reasons.
tests/story_wall_test.py holds that. The only place where an option came from is read is order(): his option goes
first at equal totals, and only then.

Where each axis comes from (config/story-score.json axes[].source):
  deterministic  fit (beat focus sectors and economics keywords), named_thing, evidence, sourcing, freshness
  probe          whys and mechanism, from scripts/whys-probe-check.ts output (the pre-pick probe)
  humour         absurdity_humour and wonder, the humour engine's labels mapped by humour_map
  divergent_judge unique_angle: angles pooled from the session's lens subagents and divergent provoke, scored blind in
                 one batched divergent `score` with judge:true, then the soundness gate and the funniest-true rule
  blind_judge    scale, fun_consume, fun_produce, uplift and utility: a blind subagent brief, recorded as lines
                 `axis: n/10 because <evidence>`

An axis that was not read abstains (null); an option whose read axes weigh less than abstain.min_read_weight is
unscored. A step that could not run is listed unread and the command exits 2: never a pass.

    python3 scripts/post-pack/story_score.py angles <Monday> [--provoke] [--judge] [--budget-usd N]   (paid)
    python3 scripts/post-pack/story_score.py humour <Monday> [--budget-usd N] [--max N]               (paid)
    python3 scripts/post-pack/story_score.py brief <Monday> [--axes scale,fun_consume,fun_produce]
    python3 scripts/post-pack/story_score.py record <Monday> JUDGE.md
    python3 scripts/post-pack/story_score.py score <Monday> [--floor F] [--probes F] [--write]
    python3 scripts/post-pack/story_score.py order <Monday> (--status F | --fresh)
    python3 scripts/post-pack/story_score.py council-brief <Monday> --day D
    python3 scripts/post-pack/story_score.py council-record <Monday> --day D COUNCIL.md
    python3 scripts/post-pack/story_score.py ledger [--ledger F]

Paid calls go through the spend ledger (.cache/story-score/spend.jsonl): a call is reserved before its transport is
touched, and refused when it would pass budget_usd (or --budget-usd, never above it), the day's dollars or the day's
divergent ops. Divergent calls then pass the weekly chain cap (divergent.at_will) before the route.
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import idea_checks as ic  # noqa: E402

CONFIG = ROOT / 'config' / 'story-score.json'
STYLES = ROOT / 'config' / 'style-references.json'
PLANS = ROOT / 'docs' / 'plans'
SERVED = ('ok', 'pass', 'flagged')
HERO = ('hero_mon', 'hero_wed', 'hero_fri')
DAY_GROUPS = (('days', ('mon', 'wed', 'fri')),)


def rubric(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


RUBRIC = rubric()


def audience():
    a = str(ic.BEAT['reader']['audience_short']).strip()
    return a[:1].lower() + a[1:]


def now_iso(now=None):
    return (now or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------------------------------------------------------------
# What the scorer may see of an option


def _drop(node, drop):
    if isinstance(node, dict):
        return {k: _drop(v, drop) for k, v in node.items() if k not in drop}
    if isinstance(node, list):
        return [_drop(v, drop) for v in node]
    return node


def blind_view(option, cfg=None):
    """The option as the scorer and every blind judge see it: config blind_view.keep fields only, and never a
    drop_nested key at any depth. A copy: the option itself is untouched."""
    cfg = cfg or RUBRIC
    spec = cfg['blind_view']
    keep, drop = set(spec['keep']), set(spec['drop_nested'])
    o = option if isinstance(option, dict) else {}
    return {k: _drop(v, drop) for k, v in o.items() if k in keep}


def key_of(day, o):
    """An option's stable key on a board: <day>/<id> (a place moves when the day is ordered; the id does not)."""
    return f'{day}/{str((o or {}).get("id") or "").lower()}'


def board(ideas):
    """[(key, day, main, option)] for every option, in board order (idea_checks.board_raw)."""
    return [(key_of(day, o), day, main, o) for _ref, day, main, o in ic.board_raw(ideas)]


def _s(x):
    return str(x) if x is not None else ''


def topic_text(view, main):
    return ic.option_topic(view, main)


def body_text(view, main):
    pitch = view.get('pitch') if isinstance(view.get('pitch'), dict) else {}
    parts = [ic.option_text_main(view) if main else ic.option_text_off(view), view.get('fact'), view.get('why_now'),
             view.get('funny'), view.get('dive'), *(view.get('beats') or []), *[pitch.get(k) for k in ('take', 'share')]]
    parts += [st.get('headline') or st.get('title') or st.get('what') for st in view.get('stories') or [] if isinstance(st, dict)]
    return ' '.join(_s(p) for p in parts if p)


def fact_text(view, main=True):
    """The plain sourced fact: the option's fact, else its story's first sentence, else its hook."""
    for k in ('fact', 'story', 'so_what', 'copy', 'dive'):
        if str(view.get(k) or '').strip():
            return str(view[k]).strip()
    return str(view.get('hook') or view.get('title') or '').strip()


def own_angle(view, main):
    """The option's own angle, as written: a hero's hook or headline, an off day's funny line or hook."""
    pitch = view.get('pitch') if isinstance(view.get('pitch'), dict) else {}
    if main:
        return str(pitch.get('hook') or pitch.get('headline') or view.get('so_what') or '').strip()
    return str(view.get('funny') or view.get('hook') or view.get('title') or '').strip()


# ---------------------------------------------------------------------------------------------------------------------
# Deterministic axes


ECON = ic.keyword_pattern((ic.BEAT.get('economics_keywords') or {}).get('keywords'))
FIGURE = re.compile((ic.BEAT.get('economics_keywords') or {}).get('figure_pattern') or r'(?!)', re.I)


def focus_in(text):
    return bool(ic.BEAT_FOCUS.search(ic.BEAT_FOCUS_EXCEPT.sub(' ', _s(text))))


def fit_axis(view, main):
    """(score, evidence): 10 a focus sector and an economics word or money figure in the topic, 7 a focus sector in
    the topic, 4 a focus sector only in the body, 1 none (the avoid list is the floor's, never a score)."""
    topic, body = topic_text(view, main), body_text(view, main)
    if focus_in(topic):
        if ECON.search(topic) or FIGURE.search(topic):
            return 10, 'focus sector and its economics in the topic'
        return 7, 'focus sector in the topic'
    if focus_in(body):
        return 4, 'focus sector only in the body'
    return 1, 'no focus-sector word'


def _twist(cfg):
    words = (cfg.get('named_thing') or {}).get('twist_words') or []
    return ic.keyword_pattern(words)


def named_axis(view, main, cfg=None):
    """(score, evidence): 10 the hook names a concrete thing plus a number or a twist, 7 named with the number or twist
    in the body only, 4 named with neither, 1 nothing named."""
    cfg = cfg or RUBRIC
    hook, body = topic_text(view, main), body_text(view, main)
    twist = _twist(cfg)
    edge = lambda t: bool(re.search(r'\d', _s(t)) or FIGURE.search(_s(t)) or twist.search(_s(t)))  # noqa: E731
    if ic.names(hook):
        if edge(hook):
            return 10, 'named in the hook, with a number or twist'
        if edge(body):
            return 7, 'named, the number or twist in the body'
        return 4, 'named, no number or twist'
    if ic.names(body):
        return (7, 'named in the body, with a number or twist') if edge(body) else (4, 'named in the body only')
    return 1, 'nothing named'


def money_figure(view):
    """A money or share figure in the sourced fact (the option's fact, else its story)."""
    text = _s(view.get('fact')) or _s(view.get('story'))
    m = FIGURE.search(text)
    return m.group(0) if m else None


def site_of(url, cfg=None):
    cfg = cfg or RUBRIC
    host = re.sub(r'^www\d?\.', '', (re.match(r'^[a-z]+://([^/:?#]+)', _s(url).strip().lower()) or [None, ''])[1])
    parts = host.split('.')
    second = set((cfg.get('primary_sources') or {}).get('second_level') or [])
    n = 3 if len(parts) >= 3 and '.'.join(parts[-2:]) in second else 2
    return '.'.join(parts[-n:]) if host else ''


def urls_of(view):
    out = []
    for s in [view.get('source')] + list(view.get('sources') or []) + [st.get('source') for st in view.get('stories') or [] if isinstance(st, dict)]:
        if isinstance(s, dict) and (s.get('url') or s.get('href')):
            out.append(str(s.get('url') or s.get('href')))
    return list(dict.fromkeys(out))


def primary_sources(view, main=True, cfg=None):
    """How many of the option's sources are primary: on a filing or paper host, or on the actor's own site (a name in
    its topic or fact is the site's name)."""
    cfg = cfg or RUBRIC
    hosts = set((cfg.get('primary_sources') or {}).get('filing_hosts') or [])
    names = {re.sub(r'[^a-z0-9]', '', n.lower()) for n in ic.names(topic_text(view, main) + ' ' + fact_text(view, main))}
    names.discard('')
    n = 0
    for u in urls_of(view):
        site = site_of(u, cfg)
        label = re.sub(r'[^a-z0-9]', '', site.split('.')[0])
        if site in hosts or any(site.endswith('.' + h) or site == h for h in hosts) or (label and label in names):
            n += 1
    return n


def steps_verifiable(view):
    steps = view.get('steps')
    if not isinstance(steps, list) or not steps:
        return False
    return all(isinstance(s, dict) and re.match(r'^https://', _s(s.get('checked') or s.get('source'))) for s in steps)


def evidence_axis(view):
    """A good-news carousel's sourcing: 10 every story has a source and a date, 7 every story a source, one undated, 4
    some without a source, 1 mostly unsourced."""
    stories = [st for st in view.get('stories') or [] if isinstance(st, dict)]
    if not stories:
        return None, 'no stories'
    has = [bool(isinstance(st.get('source'), dict) and st['source'].get('url')) for st in stories]
    dated = [bool(st.get('date') or ic.dates_in(_s((st.get('source') or {}).get('label')) if isinstance(st.get('source'), dict) else '')) for st in stories]
    if all(has):
        undated = sum(1 for d in dated if not d)
        return (10, 'every story sourced and dated') if undated == 0 else (7 if undated == 1 else 4, f'{undated} undated')
    return (4, 'some stories unsourced') if sum(has) * 2 >= len(has) else (1, 'mostly unsourced')


def sourcing_axis(item):
    """An edition item: 10 the actor's own domain or a filing plus an independent second source, 7 own domain or
    filing, 4 a secondary report, 1 aggregator or unsourced."""
    srcs = [s for s in item.get('sources') or [] if isinstance(s, dict) and s.get('url')]
    own = [s for s in srcs if s.get('own_domain') or s.get('kind') in ('primary', 'filing')]
    other = [s for s in srcs if s not in own and s.get('kind') != 'aggregator']
    if own and other:
        return 10, 'primary plus an independent second source'
    if own:
        return 7, 'primary source'
    if other:
        return 4, 'secondary report'
    return 1, 'aggregator or unsourced'


def freshness_axis(item, week):
    """An edition item: 10 dated in the edition week and first reported in it, 7 dated in it, 4 last week with a new
    development this week, 1 older."""
    try:
        start, d = date.fromisoformat(str(week)[:10]), date.fromisoformat(str(item.get('date'))[:10])
    except ValueError:
        return None, 'undated'
    end = start + timedelta(days=7)
    if start <= d < end:
        first = item.get('first_reported')
        try:
            fresh = first is None or start <= date.fromisoformat(str(first)[:10]) < end
        except ValueError:
            fresh = False
        return (10, 'first reported this week') if fresh else (7, 'dated this week')
    if start - timedelta(days=7) <= d < start and item.get('development'):
        return 4, 'last week, developed this week'
    return 1, 'older than the week'


# ---------------------------------------------------------------------------------------------------------------------
# Probe axes (scripts/whys-probe-check.ts output)


def probe_ok(probe):
    return isinstance(probe, dict) and 'error' not in probe and isinstance(probe.get('documented'), int)


def whys_axis(probe):
    if not probe_ok(probe):
        return None, 'not probed'
    return min(10, 2 * probe['documented'] + probe.get('inferred', 0)), f'{probe["documented"]} documented, {probe.get("inferred", 0)} inferred'


def mechanism_axis(probe):
    if not probe_ok(probe):
        return None, 'not probed'
    mech, doc = probe.get('mechanism_rungs', 0), probe['documented']
    if mech >= 1 and doc >= 3:
        return 10, 'a documented mechanism rung in a documented ladder'
    if mech >= 1:
        return 7, 'one documented mechanism rung'
    return (4, 'mechanism asserted, not shown') if doc >= 1 else (1, 'no mechanism')


# ---------------------------------------------------------------------------------------------------------------------
# Humour (humour_check.labels; the number each label is worth is config humour_map)


def humour_score(labels, cfg=None):
    """0 to 10 from one reading's labels, or None when there was no reading (abstains, never a pass)."""
    cfg = cfg or RUBRIC
    hm = cfg['humour_map']
    if not isinstance(labels, dict) or not labels.get('comic_reading'):
        return hm['unavailable']
    reading = labels['comic_reading']
    if reading in hm['base']:
        n = hm['base'][reading]
    else:
        n = hm['base']['not_supported_attempted'] if labels.get('attempted') else hm['base']['not_attempted']
    if reading in ('supported', 'ambiguous'):
        bonus = [int(b) for b, ms in hm['mechanism_bonus'].items() if set(ms) & set(labels.get('mechanism') or [])]
        n += max(bonus or [0])
    if labels.get('needs_explaining'):
        n = min(n, hm['needs_explaining_cap'])
    return max(0, min(hm['cap'], n))


def blend(parts, weights):
    """The weighted mean of the parts that were read; None when none was."""
    read = [(weights[k], v) for k, v in parts.items() if v is not None and weights.get(k)]
    if not read:
        return None
    return round(sum(w * v for w, v in read) / sum(w for w, _v in read), 2)


# ---------------------------------------------------------------------------------------------------------------------
# Angles: pooled, scored blind, the soundness gate and the funniest-true rule


def _norm(text):
    t = _s(text)
    t = re.sub(r'[‘’‚‛]', "'", t)
    t = re.sub(r'[“”„‟]', '"', t)
    t = re.sub(r'[–—]', '-', t)
    return re.sub(r'\s+', ' ', t).strip()


def judge_numbers(result):
    """{originality, usefulness, specificity, status} from one divergent judged-score result, on 0 to 10. The route's
    numbers are read from `scores`, `judge` or the result itself; a 0 to 1 scale is put on 0 to 10."""
    if not isinstance(result, dict):
        return None
    src = next((result[k] for k in ('scores', 'judge', 'judgement') if isinstance(result.get(k), dict)), result)
    out = {}
    for k in ('originality', 'usefulness', 'specificity'):
        v = src.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            out[k] = float(v)
    if not out:
        return {'status': result.get('status')}
    if max(out.values()) <= 1:
        out = {k: v * 10 for k, v in out.items()}
    out['status'] = result.get('status')
    return out


def angle_score(judge, humour, cfg=None):
    """0 to 10: config angle.score_weights over originality, usefulness, specificity and humour (the angle's humour
    read). An archive or gravity status is 0. None when nothing was judged."""
    cfg = cfg or RUBRIC
    ang = cfg['angle']
    if not isinstance(judge, dict):
        return None
    if judge.get('status') in ang['zero_on_status']:
        return 0.0
    parts = {k: judge.get(k) for k in ('originality', 'usefulness', 'specificity')}
    parts['humour'] = humour
    if all(parts[k] is None for k in ('originality', 'usefulness', 'specificity')):
        return None
    return blend(parts, ang['score_weights'])


def sound(angle, view, probe, *, hero, cfg=None, kill=None, lint=None):
    """(sound, reasons): the angle's claim rests on the sourced fact (its rests_on found verbatim in the option's own
    words), the judge found it useful and specific enough, the humour does not target a named individual, a hero's
    first why climbs, and its words are clean (kill list, copy lint)."""
    cfg = cfg or RUBRIC
    rule = cfg['angle']['soundness']
    why = []
    rests = _norm(angle.get('rests_on'))
    source = _norm(' '.join([fact_text(view), _s(view.get('story')), _s(view.get('so_what')), body_text(view, hero)]))
    if rule.get('rests_on_verbatim') and (not rests or rests not in source):
        why.append('rests on nothing quoted from the sourced fact')
    j = angle.get('judge') or {}
    if j.get('usefulness') is None or j['usefulness'] < rule['usefulness_min']:
        why.append(f'usefulness under {rule["usefulness_min"]}')
    if j.get('specificity') is None or j['specificity'] < rule['specificity_min']:
        why.append(f'specificity under {rule["specificity_min"]}')
    lab = angle.get('read') or {}
    if rule.get('target_not_individual') and set(lab.get('target') or []) & set(rule.get('individual_targets') or []):
        why.append('the humour targets a named individual')
    if hero and rule.get('first_why_climbs'):
        rungs = (probe or {}).get('rungs') if probe_ok(probe) else None
        first = next((r for r in rungs or [] if r.get('n') == 1), None)
        if not first or first.get('counted') not in ('documented', 'inferred'):
            why.append('the first why does not climb')
    words = _s(angle.get('text'))
    if kill is not None and kill(words):
        why.append('kill list')
    if lint is not None and lint(words):
        why.append('copy lint')
    return not why, why


def funny_sound(angle, cfg=None):
    """Whether a sound angle may win on humour: supported, never needs explaining, with an absurd mechanism."""
    cfg = cfg or RUBRIC
    rule = cfg['angle']['soundness']
    lab = angle.get('read') or {}
    return (lab.get('comic_reading') in rule['comic_reading'] and bool(lab.get('needs_explaining')) == rule['needs_explaining']
            and bool(set(lab.get('mechanism') or []) & set(cfg['absurd_mechanisms'])))


def choose_angle(angles, cfg=None):
    """{chosen, best, funniest, rule, sound}: the best sound angle by score, unless the funniest or most absurd true one
    is sound and within humour_margin of it. None when no angle was scored."""
    cfg = cfg or RUBRIC
    scored = [a for a in angles if a.get('score') is not None]
    if not scored:
        return None
    ok = [a for a in scored if a.get('sound')]
    if not ok:
        return {'chosen': None, 'best': None, 'funniest': None, 'rule': 'no sound angle', 'sound': False}
    best = max(ok, key=lambda a: (a['score'], -angles.index(a)))
    funny = [a for a in ok if funny_sound(a, cfg)]
    top = max(funny, key=lambda a: (humour_score(a.get('read'), cfg) or 0, a['score'], -angles.index(a))) if funny else None
    margin = cfg['angle']['humour_margin']
    if top is not None and top is not best and best['score'] - top['score'] <= margin:
        return {'chosen': top, 'best': best, 'funniest': top, 'rule': f'funniest true angle, within {margin} of the best', 'sound': True}
    return {'chosen': best, 'best': best, 'funniest': top, 'rule': 'best sound angle', 'sound': True}


# ---------------------------------------------------------------------------------------------------------------------
# Types, floors and totals


def option_type(day, main, o, cfg=None):
    """config type_rules, first match wins."""
    cfg = cfg or RUBRIC
    if not main and ic.is_template(o):
        return 'offday_meme'
    if ic.is_good_news(o) or (not main and day == 'sat'):
        return 'goodnews'
    if not main and str(o.get('aim') or '') == 'utility':
        return 'explainer'
    return cfg['type_rules']['days'].get(day) if main else 'offday_short'


def _holds(value, op, want):
    if value is None:
        return False
    if op == '==':
        return value == want
    if op == '>=':
        return value >= want
    if op == '<=':
        return value <= want
    if op == 'in':
        return value in want
    raise ValueError(op)


def floors_for(tid, cfg=None):
    cfg = cfg or RUBRIC
    out = list(cfg['types'][tid].get('floors') or [])
    if tid in cfg['hero_floors']['types']:
        out = list(cfg['hero_floors']['floors']) + out
    return out


def floors_failed(tid, axes, checks, cfg=None):
    """The reasons of every floor the option does not hold; a floor whose value was not read fails, said as unread."""
    out = []
    for f in floors_for(tid, cfg):
        value = axes.get(f['axis']) if 'axis' in f else checks.get(f['check'])
        if not _holds(value, f['op'], f['value']):
            out.append(f['reason'] + (' (not read)' if value is None else ''))
    return out


def total_of(tid, axes, cfg=None):
    """(total out of 100 or None, read weight, unread axes). Weights sum to 10; an unread axis abstains and the rest
    are scaled to 100; under abstain.min_read_weight the option is unscored."""
    cfg = cfg or RUBRIC
    weights = {a: w for a, w in cfg['types'][tid]['weights'].items() if w}
    read = {a: w for a, w in weights.items() if axes.get(a) is not None}
    unread = sorted(a for a in weights if a not in read)
    rw = sum(read.values())
    if rw < cfg['abstain']['min_read_weight']:
        return None, rw, unread
    total = sum(w * axes[a] for a, w in read.items()) * (cfg['scale']['weights_sum'] / rw)
    return round(total, 1), rw, unread


def score_option(key, day, main, o, inputs=None, cfg=None, at=None):
    """One option's story_score: {total, axes, type, floors_failed, unread, checks, angle, rubric_version, at}.
    inputs: {probes: {id: probe}, reads: {key: {fact, line, angles}}, angles: {key: [pooled angle]}, judged: {key:
    {axis: {score, because}}}, checks: {key: {check: value}}, floored: {key, ...}, kill, lint}."""
    cfg = cfg or RUBRIC
    inputs = inputs or {}
    view = blind_view(o, cfg)
    tid = option_type(day, main, o, cfg)
    probe = (inputs.get('probes') or {}).get(str(view.get('id') or '').lower()) or (inputs.get('probes') or {}).get(_s(view.get('id')))
    reads = (inputs.get('reads') or {}).get(key) or {}
    judged = (inputs.get('judged') or {}).get(key) or {}
    hero = tid in HERO

    axes, why = {}, {}
    axes['fit'], why['fit'] = fit_axis(view, main)
    axes['named_thing'], why['named_thing'] = named_axis(view, main, cfg)
    axes['whys'], why['whys'] = whys_axis(probe)
    axes['mechanism'], why['mechanism'] = mechanism_axis(probe)
    axes['evidence'], why['evidence'] = evidence_axis(view)
    for axis in ('scale', 'fun_consume', 'fun_produce', 'uplift', 'utility'):
        j = judged.get(axis)
        axes[axis] = float(j['score']) if isinstance(j, dict) and j.get('score') is not None else None
        why[axis] = j.get('because') if isinstance(j, dict) else 'not judged'

    angles = []
    for a in (inputs.get('angles') or {}).get(key) or []:
        a = dict(a)
        a['read'] = (reads.get('angles') or {}).get(a.get('id'))
        a['score'] = angle_score(a.get('judge'), humour_score(a['read'], cfg), cfg)
        a['sound'], a['unsound'] = sound(a, view, probe, hero=hero, cfg=cfg, kill=inputs.get('kill'), lint=inputs.get('lint'))
        angles.append(a)
    choice = choose_angle(angles, cfg)
    chosen = (choice or {}).get('chosen')
    if choice is None:
        axes['unique_angle'] = None
    else:
        axes['unique_angle'] = chosen['score'] if chosen else 0.0
    why['unique_angle'] = (choice or {}).get('rule') or 'no angle judged'

    line_read = reads.get('line')
    angle_read = chosen.get('read') if chosen else None
    fact_score = humour_score(reads.get('fact'), cfg)
    angle_part = humour_score(angle_read if angle_read is not None else line_read, cfg)
    axes['absurdity_humour'] = blend({'fact': fact_score, 'angle': angle_part}, axis_cfg('absurdity_humour', cfg)['blend'])
    axes['wonder'] = fact_score
    why['absurdity_humour'] = 'humour engine: fact %s, angle %s' % (fact_score, angle_part)

    comic = next((r for r in (line_read, angle_read, reads.get('fact')) if isinstance(r, dict)), None)
    checks = {
        'probe_documented': probe['documented'] if probe_ok(probe) else None,
        'probe_rungs': probe['documented'] + probe.get('inferred', 0) if probe_ok(probe) else None,
        'landing_ok': bool(probe.get('landing_ok')) if probe_ok(probe) else None,
        'primary_sources': primary_sources(view, main, cfg),
        'sound_angle': None if choice is None else bool(choice.get('sound')),
        'money_figure_sourced': money_figure(view) is not None,
        'mechanism_rungs': probe.get('mechanism_rungs', 0) if probe_ok(probe) else None,
        'counter_rungs': probe.get('counter_rungs', 0) if probe_ok(probe) else None,
        'comic_reading': comic.get('comic_reading') if comic else None,
        'needs_explaining': bool(comic.get('needs_explaining')) if comic else None,
        'steps_verifiable': steps_verifiable(view),
    }
    checks.update((inputs.get('checks') or {}).get(key) or {})

    weights = cfg['types'][tid]['weights']
    scored_axes = {a: axes.get(a) for a in weights}
    total, rw, unread = total_of(tid, scored_axes, cfg)
    failed = floors_failed(tid, scored_axes, checks, cfg)
    floored = key in set(inputs.get('floored') or ())
    humour_unread = fact_score is None and angle_part is None
    return {
        'total': total, 'axes': scored_axes, 'type': tid, 'floors_failed': failed, 'unread': unread,
        'floored': floored, 'humour_unread': humour_unread, 'read_weight': rw, 'checks': checks,
        'why': {a: why.get(a) for a in weights},
        'angle': {'id': chosen.get('id'), 'lens': chosen.get('lens'), 'text': chosen.get('text'), 'rule': choice['rule']} if chosen else None,
        'rubric_version': cfg['rubric_version'], 'at': at or now_iso(),
    }


def axis_cfg(aid, cfg=None):
    cfg = cfg or RUBRIC
    return next(a for a in cfg['axes'] if a['id'] == aid)


def score_board(ideas, inputs=None, cfg=None, at=None):
    """{key: story_score} for every option on the board."""
    at = at or now_iso()
    return {key: score_option(key, day, main, o, inputs, cfg, at) for key, day, main, o in board(ideas)}


def floored_keys(floor_doc, ideas):
    """The keys the floor refused, from its JSON (only `ref` and `floored` are read)."""
    by_ref = {ref: key_of(day, o) for ref, day, _m, o in ic.board_raw(ideas)}
    return {by_ref[r['ref']] for r in (floor_doc or {}).get('candidates') or [] if r.get('floored') and r.get('ref') in by_ref}


def compact(s):
    """What goes into ideas.json beside the option: the total, the axes, the type and the floors it failed."""
    out = {k: s[k] for k in ('total', 'axes', 'type', 'floors_failed', 'rubric_version', 'at')}
    if s.get('close_call'):
        out['close_call'] = s['close_call']
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Order: open days only, his option first at equal totals only, close calls named


def status_key(group, day, o):
    oid = str((o or {}).get('id') or '').lower()
    return f'idea:{oid}' if group == 'days' else f'off:{day}:{oid}'


def day_open(group, day, opts, status, remake=('open', 'held')):
    """Whether a day may be ordered: the board was never shown (status None), or every option on it is unanswered
    (board_feed option_status, the REMAKE statuses, read as keep_problems reads them)."""
    if status is None:
        return True
    return all(status.get(status_key(group, day, o), 'unknown') in remake for o in opts if isinstance(o, dict))


def his(o, cfg=None):
    cfg = cfg or RUBRIC
    return str((o or {}).get('source_kind') or '') in cfg['ties']['his_kinds']


def rank_key(item, cfg):
    n, o, s = item
    s = s or {}
    bad = bool(s.get('floored') or s.get('floors_failed'))
    t = s.get('total')
    return (bad, t is None, -(t or 0), t is None or not his(o, cfg), n)


def close_call(a, b, cfg=None):
    """Why the top two are a close call (margin, or the fun-versus-weight fork), or None."""
    cfg = cfg or RUBRIC
    c = cfg['close']
    ta, tb = a.get('total'), b.get('total')
    if ta is None or tb is None:
        return None
    diff = abs(ta - tb)
    if diff <= c['margin']:
        return f'within {c["margin"]} of 100 ({ta} and {tb})'
    f = c['fork']
    if diff <= f['within']:
        lead = lambda x, y, axes: any((x['axes'].get(k) or 0) - (y['axes'].get(k) or 0) >= f['lead'] for k in axes)  # noqa: E731
        if (lead(a, b, f['fun_axes']) and lead(b, a, f['weight_axes'])) or (lead(b, a, f['fun_axes']) and lead(a, b, f['weight_axes'])):
            return f'a fork within {f["within"]}: one leads on fun, the other on weight'
    return None


def order_day(opts, scores, keys, council=None, cfg=None):
    """(ordered options, close call or None). Weekly series keep their place; the rest go by total."""
    cfg = cfg or RUBRIC
    fixed = {n: o for n, o in enumerate(opts) if isinstance(o, dict) and o.get('weekly')}
    movable = [(n, o, scores.get(k)) for n, (o, k) in enumerate(zip(opts, keys)) if n not in fixed]
    movable.sort(key=lambda it: rank_key(it, cfg))
    tids = {(s or {}).get('type') for _n, _o, s in movable}
    if movable and tids & set(cfg['humour_map']['unread_never_first_on']) and (movable[0][2] or {}).get('humour_unread'):
        alt = next((i for i, it in enumerate(movable) if not (it[2] or {}).get('humour_unread')
                    and not (it[2] or {}).get('floored') and not (it[2] or {}).get('floors_failed')), None)
        if alt:
            movable.insert(0, movable.pop(alt))
    call = None
    ok = [it for it in movable if it[2] and not it[2].get('floored') and not it[2].get('floors_failed') and it[2].get('total') is not None]
    if len(ok) >= 2 and movable[0] is ok[0] and movable[1] is ok[1]:
        why = close_call(ok[0][2], ok[1][2], cfg)
        if why:
            k0, k1 = keys[ok[0][0]], keys[ok[1][0]]
            decided = (council or {}).get('winner')
            if decided in (k0, k1) and set((council or {}).get('pair') or ()) == {k0, k1}:
                if decided == k1:
                    movable[0], movable[1] = movable[1], movable[0]
                call = {'keys': [k0, k1], 'why': why, 'council': decided, 'says': None}
            else:
                call = {'keys': [k0, k1], 'why': why, 'council': None, 'says': cfg['council']['barred_says']}
    out, it = [], iter(movable)
    for n in range(len(opts)):
        out.append(fixed[n] if n in fixed else next(it)[1])
    return out, call


def order_board(ideas, scores, status, council=None, cfg=None):
    """(new ideas, report). Only open days are ordered; the first movable option is recommended. report: {ordered,
    kept, close_calls, moved}."""
    cfg = cfg or RUBRIC
    new = json.loads(json.dumps(ideas))
    report = {'ordered': [], 'kept': [], 'close_calls': [], 'moved': []}
    for group in ('days', 'offdays'):
        block = new.get(group) if isinstance(new.get(group), dict) else {}
        for day, opts in block.items():
            if not isinstance(opts, list) or not opts:
                continue
            if not day_open(group, day, opts, status):
                report['kept'].append(day)
                continue
            keys = [key_of(day, o) for o in opts]
            if not any((scores.get(k) or {}).get('total') is not None for k in keys):
                report['kept'].append(day)
                report.setdefault('unscored', []).append(day)
                continue
            ordered, call = order_day(opts, scores, keys, (council or {}).get(day), cfg)
            before = [key_of(day, o) for o in opts]
            after = [key_of(day, o) for o in ordered]
            if before != after:
                report['moved'].append(day)
            first = next((o for o in ordered if isinstance(o, dict) and not o.get('weekly')), None)
            for o in ordered:
                if isinstance(o, dict) and not o.get('weekly'):
                    if o is first:
                        o['recommended'] = True
                    else:
                        o.pop('recommended', None)
                    s = scores.get(key_of(day, o))
                    if s:
                        s = dict(s)
                        if call and key_of(day, o) in call['keys'] and call.get('says'):
                            s['close_call'] = call['says']
                        o['story_score'] = compact(s)
            block[day] = ordered
            report['ordered'].append(day)
            if call:
                report['close_calls'].append({'day': day, **call})
    return new, report


# ---------------------------------------------------------------------------------------------------------------------
# Blind judges and the council: briefs out, records in


def render_view(view, main):
    pitch = view.get('pitch') if isinstance(view.get('pitch'), dict) else {}
    rows = []
    for label, value in (('Headline', pitch.get('headline') or view.get('title')), ('Hook', pitch.get('hook') or view.get('hook')),
                         ('What happened', fact_text(view, main)), ('So what', view.get('so_what')), ('Format', view.get('format')),
                         ('Aim', view.get('aim')), ('Funny line', view.get('funny'))):
        if str(value or '').strip():
            rows.append(f'{label}: {_s(value).strip()}')
    for b in view.get('beats') or []:
        rows.append(f'- {_s(b)}')
    for st in view.get('stories') or []:
        if isinstance(st, dict):
            rows.append(f'- {_s(st.get("headline") or st.get("title") or st.get("what"))}')
    src = ic.source_of(view)
    if src.get('label') or src.get('url'):
        rows.append(f'Source: {src.get("label") or ""} {src.get("url") or ""}'.rstrip())
    return '\n'.join(rows)


def catalogue(styles, cfg=None):
    """The format catalogue the fun_produce judge may see: format and bank rows reduced to config format_catalogue
    fields, nothing else."""
    cfg = cfg or RUBRIC
    cat = cfg['format_catalogue']
    formats = []
    for kind, rows in ((styles or {}).get('formats') or {}).items():
        if isinstance(rows, list):
            formats += [{f: r[f] for f in cat['format_fields'] if f in r} for r in rows if isinstance(r, dict)]
    bank = [{f: r[f] for f in cat['bank_fields'] if f in r} for r in (styles or {}).get('bank') or [] if isinstance(r, dict)]
    return {'formats': formats, 'bank': bank}


def judge_brief(items, axes, cfg=None, styles=None):
    """The blind judges' brief: the rules, the fun_produce context when asked, then each option's blind text and the
    anchors of the axes it is judged on. items: [(key, view, main, [axes])]."""
    cfg = cfg or RUBRIC
    out = ['# Blind judge brief', ''] + list(cfg['briefs']['judge']) + ['']
    if 'fun_produce' in axes:
        cat = catalogue(styles if styles is not None else json.loads(STYLES.read_text(encoding='utf-8')), cfg)
        rows = [{k: r[k] for k in ('id', 'kind', 'line', 'metric') if k in r} for r in cfg['growth_evidence']['rows']]
        out += [cfg['briefs']['fun_produce'], '', '```json', json.dumps({'catalogue': cat, 'growth_evidence': rows}, ensure_ascii=False, indent=1), '```', '']
    out += ['## Anchors', '']
    for a in axes:
        ax = axis_cfg(a, cfg)
        out.append(f'{a} ({ax["label"]}): ' + '; '.join(f'{k}: {v}' for k, v in sorted(ax['anchors'].items(), key=lambda kv: -int(kv[0]))))
    out.append('')
    for key, view, main, want in items:
        out += [f'## {key}', '', render_view(view, main), '', 'Score: ' + ', '.join(want), '']
    return '\n'.join(out)


JUDGE_LINE = re.compile(r'^\s*(?:[-*]\s*)?`?(?P<axis>[a-z_]+)`?\s*:\s*(?P<n>\d+(?:\.\d+)?)\s*/\s*10\b[\s,.;:-]*because\s+(?P<why>.+?)\s*$', re.I)
KEY_LINE = re.compile(r'^\s*#{1,6}\s*(?P<key>[a-z]{3}/[A-Za-z0-9_.-]+)\s*$')


def parse_judge(text, axes):
    """({key: {axis: {score, because}}}, problems). A score with no evidence after `because`, out of 0 to 10, or on an
    axis not asked for is a problem and is not counted."""
    out, problems, key = {}, [], None
    for n, line in enumerate(_s(text).splitlines(), 1):
        k = KEY_LINE.match(line)
        if k:
            key = k.group('key').lower()
            continue
        m = JUDGE_LINE.match(line)
        if not m:
            if re.match(r'^\s*(?:[-*]\s*)?[a-z_]+\s*:\s*\d', line):
                problems.append(f'line {n}: a score without "n/10 because <evidence>"')
            continue
        axis, score, because = m.group('axis').lower(), float(m.group('n')), m.group('why').strip()
        if key is None:
            problems.append(f'line {n}: a score before any "## <key>" line')
        elif axis not in axes:
            problems.append(f'line {n}: {axis} was not asked for')
        elif not 0 <= score <= 10:
            problems.append(f'line {n}: {axis} {score} is outside 0 to 10')
        elif len(because.split()) < 3:
            problems.append(f'line {n}: {axis} has no evidence after because')
        else:
            out.setdefault(key, {})[axis] = {'score': score, 'because': because}
    return out, problems


def ab_pair(day, k0, k1):
    """A/B for a council brief, from a hash of the pair: the letters never say which scored higher."""
    flip = int(hashlib.sha256(f'{day}|{k0}|{k1}'.encode()).hexdigest(), 16) % 2
    return (k1, k0) if flip else (k0, k1)


def council_brief(day, a_view, b_view, a_main, b_main, angles=(None, None), cfg=None):
    cfg = cfg or RUBRIC
    out = [f'# Council brief: {day}', ''] + list(cfg['briefs']['council']) + ['']
    for letter, view, main, angle in (('A', a_view, a_main, angles[0]), ('B', b_view, b_main, angles[1])):
        out += [f'## {letter}', '', render_view(view, main)]
        if angle:
            out.append(f'The angle: {angle}')
        out.append('')
    return '\n'.join(out)


def parse_council(text, cfg=None):
    """({seats: {seat: {A: {score, basis}, B: {...}}}, chair, because}, problems). Every seat must be there."""
    cfg = cfg or RUBRIC
    seats, problems = {}, []
    one = r'(?P<{l}>A|B)\s*:?\s*Score\s+(?P<{l}n>\d+(?:\.\d+)?)\s*/\s*10\s*\(?\s*(?P<{l}b>fact|assumption)\s*\)?'
    for seat in cfg['council']['seats']:
        rx = re.compile(r'^\s*(?:[-*]\s*)?\**' + re.escape(seat) + r'\**\s*:\s*' + one.format(l='x') + r'\s*[;,]?\s*' + one.format(l='y'),
                        re.I | re.M)
        m = rx.search(_s(text))
        if not m:
            problems.append(f'{seat}: no "A Score n/10 (fact|assumption); B Score n/10 (fact|assumption)" line')
            continue
        got = {m.group('x').upper(): {'score': float(m.group('xn')), 'basis': m.group('xb').lower()},
               m.group('y').upper(): {'score': float(m.group('yn')), 'basis': m.group('yb').lower()}}
        if set(got) != {'A', 'B'} or any(not 0 <= v['score'] <= 10 for v in got.values()):
            problems.append(f'{seat}: needs one A and one B score, each 0 to 10')
            continue
        seats[seat] = got
    ch = re.search(r'^\s*(?:[-*]\s*)?\**Chair\**\s*:\s*(?P<c>A|B|unknown)\b[\s,.;:-]*(?:because\s+)?(?P<why>.*)$', _s(text), re.I | re.M)
    if not ch:
        problems.append('Chair: no "Chair: A, B or unknown, because ..." line')
    chair = (ch.group('c').upper() if ch.group('c').lower() != 'unknown' else 'unknown') if ch else None
    return {'seats': seats, 'chair': chair, 'because': ch.group('why').strip() if ch else ''}, problems


# ---------------------------------------------------------------------------------------------------------------------
# The spend ledger


class Ledger:
    """Reserve before a paid call, settle after. A reservation that would pass the budget (or the day's dollars, or the
    day's divergent ops) is refused, and then the transport is never touched."""

    def __init__(self, path=None, budget_usd=None, cfg=None, today=None, write=True):
        self.cfg = cfg or RUBRIC
        self.path = Path(path) if path else None
        cap = float(self.cfg['budget_usd'])
        self.budget = cap if budget_usd is None else min(float(budget_usd), cap)
        self.today = today or datetime.now(timezone.utc).date().isoformat()
        self.write = write
        self.rows = []
        if self.path and self.path.exists():
            self.rows = [json.loads(x) for x in self.path.read_text(encoding='utf-8').splitlines() if x.strip()]

    def _settled(self):
        return {r['settle']: r['usd'] for r in self.rows if 'settle' in r}

    def _cost(self, r, settled):
        return settled.get(r['id'], r['usd'])

    def spent(self, day=None):
        settled = self._settled()
        return round(sum(self._cost(r, settled) for r in self.rows if 'id' in r and (day is None or r['day'] == day)), 4)

    def ops(self, day):
        """Divergent calls reserved on a day, less those released unspent."""
        settled = self._settled()
        return sum(1 for r in self.rows if 'id' in r and r.get('divergent') and r['day'] == day and self._cost(r, settled) > 0)

    def reserve(self, op, usd, *, divergent=False, note=None):
        """(entry or None, why)."""
        spend = self.cfg['spend']
        usd = float(usd)
        if self.spent() + usd > self.budget + 1e-9:
            return None, f'{op} would pass the budget of ${self.budget:g} (${self.spent():g} spent): no call made'
        if self.spent(self.today) + usd > float(spend['usd_per_day']) + 1e-9:
            return None, f'{op} would pass ${spend["usd_per_day"]} today (${self.spent(self.today):g} spent): no call made'
        if divergent and self.ops(self.today) + 1 > int(spend['divergent_ops_per_day']):
            return None, f'{op} would pass {spend["divergent_ops_per_day"]} divergent ops today: no call made'
        entry = {'id': f'{self.today}-{len(self.rows) + 1}', 'at': now_iso(), 'day': self.today, 'op': op, 'usd': usd,
                 'divergent': bool(divergent), **({'note': str(note)[:120]} if note else {})}
        self._add(entry)
        return entry, 'reserved'

    def settle(self, entry, usd):
        if entry:
            self._add({'settle': entry['id'], 'usd': float(usd), 'at': now_iso()})

    def _add(self, row):
        self.rows.append(row)
        if self.write and self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open('a', encoding='utf-8') as f:
                f.write(json.dumps(row, ensure_ascii=False) + '\n')

    def summary(self):
        return {'budget_usd': self.budget, 'spent_usd': self.spent(), 'today': self.today, 'today_usd': self.spent(self.today),
                'today_divergent_ops': self.ops(self.today), 'calls': sum(1 for r in self.rows if 'id' in r)}
