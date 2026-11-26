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
    python3 scripts/post-pack/story_score.py order <Monday> (--status F --before F | --fresh)
    python3 scripts/post-pack/story_score.py council-brief <Monday> --day D
    python3 scripts/post-pack/story_score.py council-record <Monday> --day D COUNCIL.md
    python3 scripts/post-pack/story_score.py ledger [<Monday>] [--ledger F]

Paid calls go through the week's spend ledger (.cache/story-score/<Monday>.jsonl, or --ledger): a call is reserved
before its transport is touched, and refused when it would pass budget_usd (or --budget-usd, never above it), the day's
dollars or the day's divergent ops, all read from that ledger file. Divergent calls then pass the weekly chain cap
(divergent.at_will) before the route. After a served divergent call the reservation is settled to the metered cost: the
route's own figure when its answer gives one, else the chain's change over the call when that is more than the
reservation (never less: the chain may lag). A humour read keeps its reservation: the engine's answer names no cost.
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
WILDCARD = 'wildcard'  # the day's wildcard on a hero day (ruling wildcard, Krish, 2026-11-26): its own type, read as a hero
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


def _strip_rules(cfg):
    spec = (cfg.get('blind_view') or {}).get('strip_text') or {}
    return ([re.compile(p, re.I) for p in spec.get('patterns') or []],
            [re.compile(p, re.I) for p in spec.get('drop_sentences_matching') or []])


def strip_text(text, cfg=None):
    """The words without provenance wording (config blind_view.strip_text): what he saved, asked for or improved is
    taken out where it stands, then a sentence still saying so is dropped. A string no rule touches is returned as it
    was."""
    cfg = cfg or RUBRIC
    if not isinstance(text, str):
        return text
    subs, drops = _strip_rules(cfg)
    if not any(p.search(text) for p in subs + drops):
        return text
    t = text
    for p in subs:
        t = p.sub('', t).strip()
    if any(p.search(t) for p in drops):
        t = ' '.join(s for s in ic.sentences(t) if not any(p.search(s) for p in drops))
    t = re.sub(r'\s{2,}', ' ', t).strip(' ,;:-')
    return t[:1].upper() + t[1:]


def _clean(node, drop, cfg):
    if isinstance(node, dict):
        return {k: _clean(v, drop, cfg) for k, v in node.items() if k not in drop}
    if isinstance(node, list):
        return [_clean(v, drop, cfg) for v in node]
    return strip_text(node, cfg)


def blind_view(option, cfg=None):
    """The option as the scorer and every blind judge see it: config blind_view.keep fields only, never a drop_nested
    key at any depth, and no provenance wording in any string it keeps (strip_text). A copy: the option itself is
    untouched."""
    cfg = cfg or RUBRIC
    spec = cfg['blind_view']
    keep, drop = set(spec['keep']), set(spec['drop_nested'])
    o = option if isinstance(option, dict) else {}
    return {k: _clean(v, drop, cfg) for k, v in o.items() if k in keep}


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
    if not main:
        # An off day's own words as the beat gate reads them (idea_checks.offday_words): its topic, a template's title and
        # why it works, and its cards (ruling offday_beat, Krish, 2026-11-26).
        tpl = view.get('template') if isinstance(view.get('template'), dict) else {}
        parts += [view.get('topic'), tpl.get('title'), tpl.get('why_it_works'), tpl.get('moment'),
                  *[c.get('words') for c in view.get('cards') or [] if isinstance(c, dict)]]
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


FOCUS_ENTITIES = ic.keyword_pattern([e for row in ic.BEAT['focus_sectors'] for e in row.get('entities') or []])


def focus_in(text):
    """A focus-sector keyword or one of a sector's named entities (config/beat.json focus_sectors[].entities) in the
    words, the exception phrases taken out first."""
    bare = ic.BEAT_FOCUS_EXCEPT.sub(' ', _s(text))
    return bool(ic.BEAT_FOCUS.search(bare) or FOCUS_ENTITIES.search(bare))


def _fit_rules(cfg):
    spec = cfg.get('fit') or {}
    return ([re.compile(p, re.I) for p in spec.get('appended') or []],
            [re.compile(p, re.I) for p in spec.get('framing') or []])


def unstuffed(sentence, cfg=None):
    """A topic sentence without what only appends a sector word after the fact (config fit.appended), or '' for a
    sentence that is only a framing (config fit.framing): keyword stuffing never earns fit."""
    appended, framing = _fit_rules(cfg or RUBRIC)
    s = _s(sentence)
    if any(p.search(s) for p in framing):
        return ''
    for p in appended:
        s = p.sub('', s)
    return s


def topic_sentences(view, main):
    """The topic's sentences, part by part (the parts ic.option_topic reads: title, hook, and on a hero its plain
    question, headline, pitch hook and the story's first sentence), so two parts never run into one sentence."""
    pitch = view.get('pitch') if isinstance(view.get('pitch'), dict) else {}
    parts = [view.get('title'), view.get('hook')]
    if main:
        parts += [pitch.get('question'), pitch.get('headline'), pitch.get('hook'), (ic.sentences(view.get('story') or '') or [''])[0]]
    return [s for p in parts if p for s in ic.sentences(_s(p)) if s.strip()]


def fact_marks(view, main):
    """What carries the option's fact: the names and figures in its sourced fact (fact_text), lower-cased."""
    fact = fact_text(view, main)
    marks = {n.lower() for n in ic.names(fact) if len(n) > 2}
    marks |= {m.group(0).lower() for m in FIGURE.finditer(fact)}
    marks |= set(re.findall(r'\d[\d,.]*\d|\d', fact))
    return marks


def fit_axis(view, main, cfg=None):
    """(score, evidence): 10 a focus sector and an economics word or money figure in the same topic sentence, 7 a focus
    sector in the topic, 4 a focus sector only in the body, 1 none (the avoid list is the floor's, never a score).
    A sector counts in the topic only in a sentence that carries the fact (Ruling, Krish, 2026-11-26, floor C1): what
    only appends a sector word is taken out first (unstuffed), and when any topic sentence names a thing or a figure
    from the fact, only those sentences are read, so adding words without the fact changing never earns fit."""
    cfg = cfg or RUBRIC
    sents = [(s, unstuffed(s, cfg)) for s in topic_sentences(view, main)]
    marks = fact_marks(view, main)
    carries = [(s, u) for s, u in sents if u and any(re.search(r'(?<!\w)' + re.escape(m) + r'(?!\w)', u.lower()) for m in marks)]
    read = carries if carries else [(s, u) for s, u in sents if u]
    hits = [u for _s0, u in read if focus_in(u)]
    if hits:
        if any(ECON.search(u) or FIGURE.search(u) for u in hits):
            return 10, 'focus sector and its economics in the sentence that carries the fact'
        return 7, 'focus sector in the sentence that carries the fact'
    if any(focus_in(u) for _s0, u in sents):
        return 4, 'a focus-sector word only beside the fact, never in the sentence that carries it'
    if focus_in(body_text(view, main)):
        return 4, 'focus sector only in the body'
    return 1, 'no focus-sector word or entity'


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


def sources_of(view):
    """[(url, kind)] for every source the option carries, once each by url: its source, sources and stories' sources."""
    out = {}
    for s in [view.get('source')] + list(view.get('sources') or []) + [st.get('source') for st in view.get('stories') or [] if isinstance(st, dict)]:
        if isinstance(s, dict) and (s.get('url') or s.get('href')):
            out.setdefault(str(s.get('url') or s.get('href')), str(s.get('kind') or '').lower() or None)
    return list(out.items())


def urls_of(view):
    return [u for u, _k in sources_of(view)]


def host_of(url):
    return re.sub(r'^www\d?\.', '', (re.match(r'^[a-z]+://([^/:?#]+)', _s(url).strip().lower()) or [None, ''])[1])


def never_primary(url, cfg=None):
    """On config primary_sources.never_primary (an aggregator or syndicator: news.yahoo.com, msn.com and the rest), by
    the whole host or a host under it."""
    host = host_of(url)
    return any(host == h or host.endswith('.' + h) for h in (cfg or RUBRIC).get('primary_sources', {}).get('never_primary') or [])


def first_reported_url(view):
    fr = view.get('first_reported')
    url = fr.get('url') if isinstance(fr, dict) else fr
    return str(url) if isinstance(url, str) and re.match(r'^https?://', url.strip()) else None


def _same_url(a, b):
    norm = lambda u: re.sub(r'[#?].*$', '', host_of(u) + '/' + re.sub(r'^[a-z]+://[^/]+/?', '', _s(u).strip().lower())).rstrip('/')  # noqa: E731
    return norm(a) == norm(b)


def site_names(text, cfg=None):
    """The names a site could carry, squashed (letters and digits, lower case): every name in the words (ic.names), and
    every run of one to three capitalised words, so AI Futures is aifutures though ic.names drops AI. An outlet named
    only as the one that reported it (config primary_sources.attribution: "The Register reported", "according to CNBC")
    is taken out first: the outlet that tells the story is not the actor."""
    text = _s(text)
    for p in (cfg or RUBRIC).get('primary_sources', {}).get('attribution') or []:
        text = re.sub(p, ' ', text)
    out = {re.sub(r'[^a-z0-9]', '', n.lower()) for n in ic.names(text)}
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9&'.-]*", text)
    for i in range(len(words)):
        for j in range(i + 1, min(i + 3, len(words)) + 1):
            run = words[i:j]
            if all(w[0].isupper() for w in run):
                out.add(re.sub(r'[^a-z0-9]', '', ''.join(run).lower()))
    out.discard('')
    return out


def own_site(label, names):
    """The site is the actor's own: its name is a name in the option (warner.com is Warner), or one starts the other and
    both are at least five letters (aifutures.org is the AI Futures Project)."""
    if not label:
        return False
    return label in names or any(len(label) >= 5 and len(n) >= 5 and (n.startswith(label) or label.startswith(n)) for n in names)


def primary_sources(view, main=True, cfg=None):
    """How many of the option's sources are primary (config primary_sources; Ruling, Krish, 2026-11-26, floor C2): the
    actor's own site (a name in its topic or fact is the site's name), a filing or official data host, or the outlet
    that first reported the fact (the option's first_reported url, or a source of kind original). A source on
    never_primary (an aggregator or syndicator) is never primary, whatever else holds."""
    cfg = cfg or RUBRIC
    spec = cfg.get('primary_sources') or {}
    hosts = set(spec.get('filing_hosts') or [])
    original = set(spec.get('original_kinds') or ['original'])
    names = site_names(topic_text(view, main) + ' ' + fact_text(view, main), cfg)
    first = first_reported_url(view)
    rows = sources_of(view)
    if first and not any(_same_url(u, first) for u, _k in rows):
        rows.append((first, 'original'))
    n = 0
    for u, kind in rows:
        if never_primary(u, cfg):
            continue
        site = site_of(u, cfg)
        label = re.sub(r'[^a-z0-9]', '', site.split('.')[0])
        if (site in hosts or any(site.endswith('.' + h) or site == h for h in hosts) or own_site(label, names)
                or kind in original or (first and _same_url(u, first))):
            n += 1
    return n


def goodnews_sector_share(view, main=False):
    """The share of a good-news carousel's stories that are in a focus sector (a keyword or a named entity in what the
    story says happened: its headline, title, what, story or hook; never who it helps, a label that could be written in
    without the fact changing), None when it carries no stories (Ruling, Krish, 2026-11-25: the narrower focus holds on
    every content type)."""
    stories = [st for st in view.get('stories') or [] if isinstance(st, dict)]
    if not stories:
        return None
    words = lambda st: ' '.join(_s(st.get(k)) for k in ('headline', 'title', 'what', 'story', 'hook'))  # noqa: E731
    return round(sum(1 for st in stories if focus_in(words(st))) / len(stories), 2)


def steps_verifiable(view):
    """True when every step carries an https vendor document it was checked on, False when one does not, None when the
    option gives no steps (not read: the explainer floor holds only steps that are there)."""
    steps = view.get('steps')
    if not isinstance(steps, list) or not steps:
        return None
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


def is_wildcard(day, main, o, cfg=None):
    """Whether an option is the day's wildcard: a Monday, Wednesday or Friday option carrying a wildcard object (config
    wildcard.days). Only the label is read here; what it says (why_unexpected, the spark) never reaches the scorer."""
    cfg = cfg or RUBRIC
    return bool(main) and day in (cfg.get('wildcard') or {}).get('days', ()) and isinstance((o or {}).get('wildcard'), dict)


def option_type(day, main, o, cfg=None):
    """config type_rules, first match wins."""
    cfg = cfg or RUBRIC
    if is_wildcard(day, main, o, cfg):
        return WILDCARD
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


def floors_for(tid, cfg=None, wildcard=False):
    """The type's floors, a hero's shared floors first. On a wildcard option (option.wildcard true: the protected
    strange-story slot) a floor naming a hero_floors row in `wildcard` takes that row's value instead (wildcard_fit_min:
    fit 4, not 7); every other floor stands."""
    cfg = cfg or RUBRIC
    out = list(cfg['types'][tid].get('floors') or [])
    if tid in cfg['hero_floors']['types']:
        out = list(cfg['hero_floors']['floors']) + out
    if wildcard:
        out = [dict(f, value=cfg['hero_floors'][f['wildcard']], reason=f.get('wildcard_reason') or f['reason'])
               if f.get('wildcard') else f for f in out]
    return out


def floor_lines(tid, axes, checks, cfg=None, wildcard=False):
    """(failed, noted): the reasons of every hard floor the option does not hold (a floor whose value was not read
    fails, said as unread, unless the floor is if_read), and of every floor marked hard false that it does not hold,
    which are reported beside the score and never fail it."""
    failed, noted = [], []
    for f in floors_for(tid, cfg, wildcard):
        value = axes.get(f['axis']) if 'axis' in f else checks.get(f['check'])
        if value is None and f.get('if_read'):
            continue
        if not _holds(value, f['op'], f['value']):
            (failed if f.get('hard', True) else noted).append(f['reason'] + (' (not read)' if value is None else ''))
    return failed, noted


def floors_failed(tid, axes, checks, cfg=None, wildcard=False):
    """The reasons of every hard floor the option does not hold (floor_lines)."""
    return floor_lines(tid, axes, checks, cfg, wildcard)[0]


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
    hero = tid in HERO or tid == WILDCARD

    axes, why = {}, {}
    axes['fit'], why['fit'] = fit_axis(view, main, cfg)
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
        'goodnews_sector_share': goodnews_sector_share(view, main) if tid == 'goodnews' else None,
    }
    checks.update((inputs.get('checks') or {}).get(key) or {})

    weights = cfg['types'][tid]['weights']
    scored_axes = {a: axes.get(a) for a in weights}
    total, rw, unread = total_of(tid, scored_axes, cfg)
    # The wildcard's relaxed fit floor comes from its type, never from the blind view: the scorer never sees the label.
    failed, noted = floor_lines(tid, scored_axes, checks, cfg, wildcard=tid == WILDCARD)
    floored = key in set(inputs.get('floored') or ())
    humour_unread = fact_score is None and angle_part is None
    return {
        'total': total, 'axes': scored_axes, 'type': tid, 'floors_failed': failed, 'notes': noted, 'unread': unread,
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
    """What goes into ideas.json beside the option: the total, the axes, the type and the floors it failed, and the bits
    the Sunday gate (idea_checks.story_findings) needs to check the order again: floored, humour unread, the close call,
    the council read that decided a pair and the thin-week line."""
    out = {k: s[k] for k in ('total', 'axes', 'type', 'floors_failed', 'rubric_version', 'at')}
    for k in ('floored', 'humour_unread', 'close_call', 'council', 'notes', 'thin_week'):
        if s.get(k):
            out[k] = s[k]
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Order: open days only, his option first at equal totals only, close calls named


def status_key(group, day, o):
    oid = str((o or {}).get('id') or '').lower()
    return f'idea:{oid}' if group == 'days' else f'off:{day}:{oid}'


def day_open(group, day, opts, status, before=None):
    """Whether a day may be ordered: the board was never shown (status None), or every option on it is unanswered
    (idea_checks.option_open, as the Sunday gate reads it: open or held in board_feed option_status, or new on a `days`
    re-run, on neither the status nor the board before it). before: idea_checks.keys_on(the board before the run)."""
    return all(ic.option_open(status_key(group, day, o), status, before) for o in opts if isinstance(o, dict))


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


def passes(s):
    """A scored option that holds every hard floor and the floor did not refuse."""
    return isinstance(s, dict) and not s.get('floored') and not s.get('floors_failed') and s.get('total') is not None


def thin_says(ideas, group, day, opts, scores, cfg=None):
    """The thin-week line for a hero day (config hero_floors.thin_week), or None: fewer than min_passing of its options
    pass every floor, the session marked the day regathered (ideas.json thin_week.<day>.regathered: one re-gather was
    run), and at least thin_min pass. The floors are never relaxed: an option under one still fails the gate."""
    cfg = cfg or RUBRIC
    rule = cfg['hero_floors'].get('thin_week') or {}
    if group != 'days' or day not in ('mon', 'wed', 'fri') or not rule:
        return None
    marked = ((ideas or {}).get('thin_week') or {}).get(day) if isinstance((ideas or {}).get('thin_week'), dict) else None
    n = sum(1 for o in opts if isinstance(o, dict) and not o.get('weekly') and passes(scores.get(key_of(day, o))))
    if isinstance(marked, dict) and marked.get('regathered') is True and rule['thin_min'] <= n < rule['min_passing']:
        return rule['says']
    return None


def order_board(ideas, scores, status, council=None, cfg=None, before=None):
    """(new ideas, report). Only open days are ordered; the first movable option is recommended. before: the board as it
    stood before a `days` re-run (an option on neither it nor the status is new, so open). report: {ordered, kept,
    close_calls, moved}."""
    cfg = cfg or RUBRIC
    had = ic.keys_on(before) if before is not None else None
    new = json.loads(json.dumps(ideas))
    report = {'ordered': [], 'kept': [], 'close_calls': [], 'moved': []}
    for group in ('days', 'offdays'):
        block = new.get(group) if isinstance(new.get(group), dict) else {}
        for day, opts in block.items():
            if not isinstance(opts, list) or not opts:
                continue
            if not day_open(group, day, opts, status, had):
                report['kept'].append(day)
                continue
            keys = [key_of(day, o) for o in opts]
            if not any((scores.get(k) or {}).get('total') is not None for k in keys):
                report['kept'].append(day)
                report.setdefault('unscored', []).append(day)
                continue
            ordered, call = order_day(opts, scores, keys, (council or {}).get(day), cfg)
            thin = thin_says(new, group, day, ordered, scores, cfg)
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
                        if call and key_of(day, o) in call['keys'] and call.get('council'):
                            s['council'] = {'pair': list(call['keys']), 'winner': call['council']}
                        if thin:
                            s['thin_week'] = thin
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


# ---------------------------------------------------------------------------------------------------------------------
# Transports (paid): divergent provoke and judged score, humour reads. Each reserves first; a refusal or an engine that
# is not served is returned as skipped with its reason, never a pass. A served divergent call is settled to its metered
# cost (meter).

METER_KEYS = ('cost_usd', 'usd', 'spent_usd', 'costUsd', 'spentUsd', 'cost')


def metered_usd(reply):
    """The dollars the route says one call cost, from its reply (`cost_usd` and the like, at the top or under `usage`
    or `cost`), or None when it says nothing."""
    if not isinstance(reply, dict):
        return None
    for node in (reply, reply.get('usage'), reply.get('cost'), reply.get('meter')):
        if isinstance(node, dict):
            for k in METER_KEYS:
                v = node.get(k)
                if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0:
                    return float(v)
    return None


def _chain_usd(cap):
    try:
        week = cap()
    except Exception:  # noqa: BLE001  an unread chain meters nothing, and says so
        return None
    v = week.get('chain_usd') if isinstance(week, dict) else None
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def meter(entry, got, chain_before, cap, ledger):
    """Settle a served call's reservation to what it cost. The route's own figure settles it exactly; with none, the
    chain's change over the call settles it only when that is more than the reservation (the chain may lag, so it never
    lowers it). Returns how it was metered."""
    usd = metered_usd((got or {}).get('result'))
    if usd is not None:
        ledger.settle(entry, usd)
        return {'by': 'route', 'usd': usd}
    after = _chain_usd(cap) if chain_before is not None else None
    if after is not None:
        delta = round(after - chain_before, 4)
        if delta > entry['usd'] + 1e-9:
            ledger.settle(entry, delta)
            return {'by': 'chain', 'usd': delta}
        return {'by': 'reservation', 'usd': entry['usd'], 'chain_delta': delta}
    return {'by': 'reservation', 'usd': entry['usd'], 'note': 'no metered figure: the reservation stands'}


def provoke(view, main, worn, ledger, *, poster=None, cap=None, cfg=None):
    import divergent
    cfg = cfg or RUBRIC
    spec = cfg['angle']['divergent']
    body = divergent.at_will_body('provoke', problem=spec['problem'].format(audience=audience(), what=fact_text(view, main)[:1500]),
                                  context=render_view(view, main)[:4000], cliches=worn, count=spec['count'],
                                  temperament=spec['temperament']['hero' if main else 'offday'], lane=spec['lane'])
    entry, why = ledger.reserve('provoke', cfg['unit_costs']['provoke'], divergent=True, note=view.get('id'))
    if entry is None:
        return {'status': 'skipped', 'reason': why}
    chain = cap or divergent.chain_week
    before = _chain_usd(chain)
    got = divergent.at_will(body, **{k: v for k, v in (('poster', poster), ('cap', cap)) if v is not None})
    if got.get('status') not in SERVED:
        ledger.settle(entry, 0)
        return {'status': 'skipped', 'reason': got.get('reason') or got.get('status')}
    metered = meter(entry, got, before, chain, ledger)
    sparks = [s for s in (got.get('result') or {}).get('sparks') or [] if isinstance(s, dict)]
    return {'status': 'ok', 'sparks': sparks, 'run_id': (got.get('result') or {}).get('runId'), 'metered': metered}


def judge(texts, obvious, ledger, *, poster=None, cap=None, cfg=None):
    """One batched divergent `score` with judge:true over every pooled angle (chunks of the route's limit, each its own
    reservation). [result or None per text], plus the reasons for any chunk skipped."""
    import divergent
    cfg = cfg or RUBRIC
    spec = cfg['angle']['divergent']
    out, skipped = [None] * len(texts), []
    for i in range(0, len(texts), divergent.MAX_IDEAS):
        chunk = texts[i:i + divergent.MAX_IDEAS]
        body = divergent.at_will_body('score', problem=spec['score_problem'].format(audience=audience()), ideas=chunk,
                                      obvious=obvious, judge=True, lane=spec['lane'])
        entry, why = ledger.reserve('score_judge', cfg['unit_costs']['score_judge'], divergent=True)
        if entry is None:
            skipped.append(why)
            continue
        chain = cap or divergent.chain_week
        before = _chain_usd(chain)
        got = divergent.at_will(body, **{k: v for k, v in (('poster', poster), ('cap', cap)) if v is not None})
        if got.get('status') not in SERVED:
            ledger.settle(entry, 0)
            skipped.append(got.get('reason') or got.get('status'))
            continue
        meter(entry, got, before, chain, ledger)
        for n, r in enumerate((got.get('result') or {}).get('results') or []):
            if i + n < len(out):
                out[i + n] = r
    return out, skipped


def humour(text, surface, ref, ledger, read, cfg=None):
    """(labels or None, why). One humour-engine read on its own."""
    import humour_check
    cfg = cfg or RUBRIC
    if read is None:
        return None, 'humour engine not reachable: run humour_check.py doctor'
    if not str(text or '').strip():
        return None, 'nothing to read'
    entry, why = ledger.reserve('humour_read', cfg['unit_costs']['humour_read'], note=ref)
    if entry is None:
        return None, why
    got = humour_check.read_line(str(text)[:500], surface, read, ref)
    if got.get('status') == 'unavailable':
        ledger.settle(entry, 0)
        return None, got.get('reason')
    return got.get('engine'), 'read'


# ---------------------------------------------------------------------------------------------------------------------
# The weekly edition (the contract for PR 980; that branch is not touched from here)


def score_item(item, week=None, reads=None, judged=None, cfg=None, at=None):
    """One edition news item as edition_item. The adapter for scripts/edition/edition.py (PR 980): give each candidate
    as {id, title, summary, topic, date, first_reported?, development?, sources: [{url, kind: primary|filing|
    secondary|aggregator, own_domain?: bool}], angle_score?: 0-10}; reads: the humour engine's labels for the item's
    fact ({fact, angle}); judged: {scale: {score, because}}. Returns the same story_score shape as a board option."""
    cfg = cfg or RUBRIC
    reads, judged = reads or {}, judged or {}
    view = {'title': item.get('title'), 'hook': item.get('title'), 'fact': item.get('summary'), 'sources': item.get('sources') or []}
    axes = {}
    axes['fit'], _ = fit_axis(view, False)
    axes['named_thing'], _ = named_axis(view, False, cfg)
    axes['sourcing'], _ = sourcing_axis(item)
    axes['freshness'], _ = freshness_axis(item, week) if week else (None, 'no week')
    j = judged.get('scale')
    axes['scale'] = float(j['score']) if isinstance(j, dict) and j.get('score') is not None else None
    axes['absurdity_humour'] = blend({'fact': humour_score(reads.get('fact'), cfg), 'angle': humour_score(reads.get('angle'), cfg)},
                                     axis_cfg('absurdity_humour', cfg)['blend'])
    axes['unique_angle'] = float(item['angle_score']) if isinstance(item.get('angle_score'), (int, float)) else None
    weights = cfg['types']['edition_item']['weights']
    scored = {a: axes.get(a) for a in weights}
    srcs = [s for s in item.get('sources') or [] if isinstance(s, dict)]
    checks = {'primary_source_own_domain': any(s.get('own_domain') or s.get('kind') in ('primary', 'filing') for s in srcs),
              'in_edition_week': (axes['freshness'] or 0) >= 7 if axes.get('freshness') is not None else None}
    total, rw, unread = total_of('edition_item', scored, cfg)
    return {'total': total, 'axes': scored, 'type': 'edition_item', 'floors_failed': floors_failed('edition_item', scored, checks, cfg),
            'unread': unread, 'checks': checks, 'rubric_version': cfg['rubric_version'], 'at': at or now_iso()}


def select_edition(items, week=None, reads=None, judged=None, cfg=None):
    """{items: [(item, story_score)], short, notes}: the best items by total, floored ones left out, at most per_topic a
    topic and at most the topics' upper bound, up to edition.max; short when fewer than edition.min or topics pass."""
    cfg = cfg or RUBRIC
    ed = cfg['edition']
    reads, judged = reads or {}, judged or {}
    scored = [(it, score_item(it, week, reads.get(it.get('id')), judged.get(it.get('id')), cfg)) for it in items]
    ok = [(it, s) for it, s in scored if not s['floors_failed'] and s['total'] is not None]
    ok.sort(key=lambda p: -p[1]['total'])
    chosen, per = [], {}
    for it, s in ok:
        topic = str(it.get('topic') or 'other')
        if per.get(topic, 0) >= ed['per_topic'] or (topic not in per and len(per) >= ed['topics'][1]):
            continue
        chosen.append((it, s))
        per[topic] = per.get(topic, 0) + 1
        if len(chosen) >= ed['max']:
            break
    notes = []
    if len(chosen) < ed['min']:
        notes.append(f'{len(chosen)} items pass; an edition has at least {ed["min"]}')
    if len(per) < ed['topics'][0]:
        notes.append(f'{len(per)} topic(s); an edition spans at least {ed["topics"][0]}')
    return {'items': chosen, 'short': bool(notes), 'notes': notes, 'left_out': [it.get('id') for it, s in scored if (it, s) not in chosen]}


# ---------------------------------------------------------------------------------------------------------------------
# CLI


def ledger_of(week, cfg=None):
    """The week's spend ledger (config files.ledger, with {week} its Monday): budget_usd is a cap per week's run, so
    each week has its own file. An explicit --ledger (the blind proof's) is read whole."""
    cfg = cfg or RUBRIC
    return ROOT / cfg['files']['ledger'].format(week=week)


def week_dir(week, plans=None):
    return Path(plans or PLANS) / f'{week}-week'


def file_of(week, name, plans=None, cfg=None):
    cfg = cfg or RUBRIC
    return week_dir(week, plans) / cfg['files'][name]


def load(path, default=None):
    p = Path(path)
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default


def save(path, data):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')


def board_checks(ideas, week, kill=None):
    """The checks that need the whole board or the kill list: template_ok, goodnews_checks and carousel_format (the
    3-second carousel format, config/carousel-format.json; Krish, 2026-11-26: enforce the carousel format)."""
    out = {}
    gn = ic.goodnews_findings(ideas, week) if week else []
    cf = ic.carousel_format_findings(ideas, week) if week else []
    for key, day, main, o in board(ideas):
        c = {}
        if not main and ic.is_carousel_option(o):
            oid = str(o.get('id') or '')
            c['carousel_format'] = not any(f.get('ref') == f'off-{day}-{oid}' for f in cf) if oid else None
        if not main and ic.is_template(o):
            c['template_ok'] = not ic.template_problems(o, kill)
        if ic.is_good_news(o) or (not main and day == 'sat'):
            oid = str(o.get('id') or '')
            c['goodnews_checks'] = not any(re.search(r'(?<![A-Za-z0-9_-])' + re.escape(oid) + r'(?![A-Za-z0-9_-])', str(f.get('ref'))) for f in gn) if oid else None
        out[key] = c
    return out


def inputs_for(week, ideas, plans=None, *, floor=None, probes=None, kill=None, lint=None, cfg=None):
    cfg = cfg or RUBRIC
    angles = load(file_of(week, 'angles', plans, cfg), {}) or {}
    return {'probes': {str(k).lower(): v for k, v in (load(probes or file_of(week, 'probes', plans, cfg), {}) or {}).items()},
            'reads': load(file_of(week, 'reads', plans, cfg), {}) or {},
            'angles': angles.get('pooled') or {},
            'judged': load(file_of(week, 'judged', plans, cfg), {}) or {},
            'checks': board_checks(ideas, week, kill),
            'floored': floored_keys(load(floor, {}) if floor else {}, ideas),
            'kill': kill, 'lint': lint}


def _lint(text):
    import copy_lint
    return copy_lint.copy_lint(text, 'channel_copy')


def angle_id(key, lens, text):
    """An angle's id: <key>#<a hash of its lens and words>, so a judge or humour read keyed by it belongs to those words
    and to no other angle when the pool changes."""
    return f'{key}#' + hashlib.sha256(f'{key}|{_s(lens)}|{_norm(text)}'.encode('utf-8')).hexdigest()[:12]


def cmd_angles(a, ideas, plans, ledger, poster, cap, kill, cfg):
    """Pool the session's lens angles, each option's own angle and (with --provoke) divergent sparks for each hero
    day's top two, then (with --judge) score the pool blind in one batched judged call."""
    import divergent
    path = file_of(a.week, 'angles', plans, cfg)
    doc = load(path, {}) or {}
    lens = doc.get('options') or {}
    pooled, unread = {}, []
    sources = load(week_dir(a.week, plans) / 'sources.json', {}) or {}
    worn = divergent.worn(sources, plans)
    provisional = score_board(ideas, inputs_for(a.week, ideas, plans, kill=kill, cfg=cfg), cfg)
    tops = set()
    for day in ('mon', 'wed', 'fri'):
        rows = [(k, s) for k, s in provisional.items() if k.startswith(day + '/') and not s['floors_failed'] and s['total'] is not None]
        rows += [(k, s) for k, s in provisional.items() if k.startswith(day + '/') and (s['floors_failed'] or s['total'] is None)]
        rows.sort(key=lambda r: (bool(r[1]['floors_failed']), r[1]['total'] is None, -(r[1]['total'] or 0)))
        tops |= {k for k, _s in rows[:cfg['angle']['divergent']['per_hero_day']]}
        # The day's wildcard is always provoked: its type leans on unique_angle, and it need not be in the day's top two.
        tops |= {k for k, s in provisional.items() if k.startswith(day + '/') and s['type'] == WILDCARD}
    earlier = doc.get('pooled') or {}
    provoked = []
    for key, day, main, o in board(ideas):
        view = blind_view(o, cfg)
        pool = []
        own = own_angle(view, main)
        if own:
            pool.append({'lens': 'own', 'text': own, 'rests_on': _s(view.get('fact')) or None})
        pool += [dict(x) for x in lens.get(key) or [] if isinstance(x, dict) and x.get('text')]
        # Sparks already paid for are carried forward with their run id; a key that has them is not provoked again.
        sparks = [dict(x) for x in earlier.get(key) or [] if isinstance(x, dict) and x.get('lens') == 'divergent' and x.get('text')]
        if a.provoke and key in tops and not sparks:
            provoked.append(key)
            got = provoke(view, main, worn, ledger, poster=poster, cap=cap, cfg=cfg)
            if got['status'] != 'ok':
                unread.append(f'{key} provoke: {got["reason"]}')
            for s in got.get('sparks') or []:
                text = ' '.join(_s(s.get(k)) for k in ('title', 'mechanism') if s.get(k)).strip()
                if text:
                    sparks.append({'lens': 'divergent', 'text': text, 'rests_on': s.get('rests_on'), 'run_id': got.get('run_id')})
        pool += [{k: v for k, v in x.items() if k not in ('id', 'judge')} for x in sparks]
        seen = {}
        for x in pool:
            x['id'] = angle_id(key, x.get('lens'), x['text'])
            seen.setdefault(x['id'], x)
        pooled[key] = list(seen.values())
    if a.judge:
        flat = [x for k in pooled for x in pooled[k]]
        results, skipped = judge([x['text'] for x in flat], doc.get('obvious') or [], ledger, poster=poster, cap=cap, cfg=cfg)
        unread += [f'judged score: {w}' for w in skipped]
        for x, r in zip(flat, results):
            x['judge'] = judge_numbers(r) if r is not None else None
    else:
        # A judge read stays with the words it judged: the id is a hash of the key, the lens and the text.
        old = {x.get('id'): x.get('judge') for k in earlier for x in earlier[k] if isinstance(x, dict)}
        for k in pooled:
            for x in pooled[k]:
                x['judge'] = old.get(x['id'])
    doc.update(pooled=pooled, unread=unread, at=now_iso())
    save(path, doc)
    print(json.dumps({'angles': sum(len(v) for v in pooled.values()), 'provoked': provoked,
                      'unread': unread, 'ledger': ledger.summary()}, indent=1, ensure_ascii=False))
    return 2 if unread else 0


def cmd_humour(a, ideas, plans, ledger, read, cfg):
    """Read each option's plain fact (surface fact), an off day's funny line, and every pooled angle."""
    path = file_of(a.week, 'reads', plans, cfg)
    reads = load(path, {}) or {}
    pooled = (load(file_of(a.week, 'angles', plans, cfg), {}) or {}).get('pooled') or {}
    unread, n = [], 0
    for key, day, main, o in board(ideas):
        view = blind_view(o, cfg)
        r = reads.setdefault(key, {'fact': None, 'line': None, 'angles': {}})
        jobs = [('fact', fact_text(view, main), 'fact', None)]
        if not main and view.get('funny'):
            jobs.append(('line', view['funny'], 'funny', None))
        jobs += [('angle', x['text'], 'funny', x['id']) for x in pooled.get(key) or []]
        for slot, text, surface, aid in jobs:
            if a.max is not None and n >= a.max:
                unread.append(f'{key} {slot}: over --max {a.max}')
                continue
            labels, why = humour(text, surface, f'{key}:{aid or slot}', ledger, read, cfg)
            n += 1
            if labels is None:
                unread.append(f'{key} {slot}{" " + aid if aid else ""}: {why}')
            if aid:
                r.setdefault('angles', {})[aid] = labels
            else:
                r[slot] = labels
    save(path, reads)
    print(json.dumps({'reads': n, 'unread': unread, 'ledger': ledger.summary()}, indent=1, ensure_ascii=False))
    return 2 if unread else 0


def cmd_brief(a, ideas, plans, cfg):
    axes = [x.strip() for x in a.axes.split(',') if x.strip()]
    for x in axes:
        if axis_cfg(x, cfg)['source'] != 'blind_judge':
            raise SystemExit(f'{x} is not a blind-judge axis')
    items = []
    for key, day, main, o in board(ideas):
        tid = option_type(day, main, o, cfg)
        want = [x for x in axes if cfg['types'][tid]['weights'].get(x)]
        if want:
            items.append((key, blind_view(o, cfg), main, want))
    out = week_dir(a.week, plans) / cfg['files']['dir'] / 'judge-brief.md'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(judge_brief(items, axes, cfg), encoding='utf-8')
    print(out)
    return 0


def cmd_record(a, plans, cfg):
    axes = [x['id'] for x in cfg['axes'] if x['source'] == 'blind_judge']
    got, problems = parse_judge(Path(a.file).read_text(encoding='utf-8'), axes)
    path = file_of(a.week, 'judged', plans, cfg)
    judged = load(path, {}) or {}
    for k, v in got.items():
        judged.setdefault(k, {}).update(v)
    if got:
        save(path, judged)
    print(json.dumps({'recorded': {k: sorted(v) for k, v in got.items()}, 'problems': problems}, indent=1, ensure_ascii=False))
    return 2 if problems or not got else 0


def read_status(a):
    if a.fresh:
        return None, None
    if not a.status:
        return False, 'give --status (board_feed status JSON) or --fresh (the board was never shown): nothing is ordered blind'
    import board_feed
    try:
        return board_feed.merged_status(a.status), None
    except ValueError as e:
        return False, str(e)


def cmd_score(a, ideas, ideas_path, plans, kill, cfg):
    scores = score_board(ideas, inputs_for(a.week, ideas, plans, floor=a.floor, probes=a.probes, kill=kill, lint=_lint, cfg=cfg), cfg)
    unscored = sorted(k for k, s in scores.items() if s['total'] is None and not s['floored'])
    save(file_of(a.week, 'scores', plans, cfg), {'rubric_version': cfg['rubric_version'], 'week': a.week, 'at': now_iso(),
                                                 'options': scores, 'unscored': unscored})
    print(json.dumps({k: {'total': s['total'], 'type': s['type'], 'floors_failed': s['floors_failed'], 'unread': s['unread'],
                          'floored': s['floored']} for k, s in scores.items()}, indent=1, ensure_ascii=False))
    return 2 if unscored else 0


def cmd_order(a, ideas, ideas_path, plans, cfg):
    status, why = read_status(a)
    if status is False:
        print(why, file=sys.stderr)
        return 2
    doc = load(file_of(a.week, 'scores', plans, cfg))
    if not doc:
        print('no scores.json: run story_score.py score first', file=sys.stderr)
        return 2
    council = {d: v for d, v in (load(file_of(a.week, 'council', plans, cfg), {}) or {}).items() if isinstance(v, dict)}
    before = load(a.before) if a.before else None
    if status is not None and before is None:
        print('order --status without --before (the ideas.json copied before the run): an option the status does not name '
              'reads as not known, and its day is kept', file=sys.stderr)
    new, report = order_board(ideas, doc['options'], status, council, cfg, before)
    if a.write:
        save(ideas_path, new)
    doc['close_calls'] = report['close_calls']
    save(file_of(a.week, 'scores', plans, cfg), doc)
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0


def cmd_council_brief(a, ideas, plans, cfg):
    doc = load(file_of(a.week, 'scores', plans, cfg), {}) or {}
    call = next((c for c in doc.get('close_calls') or [] if c.get('day') == a.day), None)
    if not call:
        print(f'{a.day}: no close call in scores.json (run order first)', file=sys.stderr)
        return 2
    rows = {key: (day, main, o) for key, day, main, o in board(ideas)}
    k_a, k_b = ab_pair(a.day, *call['keys'])
    views = [(blind_view(rows[k][2], cfg), rows[k][1]) for k in (k_a, k_b)]
    angles = tuple(((doc['options'].get(k) or {}).get('angle') or {}).get('text') for k in (k_a, k_b))
    text = council_brief(a.day, views[0][0], views[1][0], views[0][1], views[1][1], angles, cfg)
    out = week_dir(a.week, plans) / cfg['files']['dir'] / f'council-{a.day}.md'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding='utf-8')
    path = file_of(a.week, 'council', plans, cfg)
    council = load(path, {}) or {}
    council[a.day] = {'A': k_a, 'B': k_b, 'pair': [k_a, k_b], 'status': 'asked', 'cleared': bool(cfg['council'].get('cleared'))}
    save(path, council)
    print(out)
    if not cfg['council'].get('cleared'):
        print(f'the council has not cleared this caller: the card says "{cfg["council"]["barred_says"]}" unless Krish asks for the read',
              file=sys.stderr)
    return 0


def cmd_council_record(a, plans, cfg):
    path = file_of(a.week, 'council', plans, cfg)
    council = load(path, {}) or {}
    asked = council.get(a.day)
    if not isinstance(asked, dict) or not asked.get('A'):
        print(f'{a.day}: no council brief was written', file=sys.stderr)
        return 2
    got, problems = parse_council(Path(a.file).read_text(encoding='utf-8'), cfg)
    if problems:
        print(json.dumps({'problems': problems}, indent=1), file=sys.stderr)
        return 2
    winner = asked.get(got['chair']) if got['chair'] in ('A', 'B') else None
    asked.update(seats=got['seats'], chair=got['chair'], because=got['because'], winner=winner, status='read',
                 says=None if winner else cfg['council']['barred_says'], at=now_iso())
    council[a.day] = asked
    save(path, council)
    print(json.dumps(asked, indent=1, ensure_ascii=False))
    return 0


def main(argv=None, *, poster=None, cap=None, read=None, kill=None, plans=None, today=None):
    cfg = RUBRIC
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)

    def wk(p):
        p.add_argument('week', help='the Monday, YYYY-MM-DD')
        p.add_argument('--ideas', help='ideas.json (default docs/plans/<Monday>-week/ideas.json)')
        p.add_argument('--plans', help='the plans folder (default docs/plans)')
        return p

    def paid(p):
        p.add_argument('--budget-usd', type=float, help=f'at most this, never above budget_usd ({cfg["budget_usd"]})')
        p.add_argument('--ledger', help="the spend ledger (default the week's .cache/story-score/<Monday>.jsonl)")
        return p

    g = paid(wk(sub.add_parser('angles')))
    g.add_argument('--provoke', action='store_true')
    g.add_argument('--judge', action='store_true')
    h = paid(wk(sub.add_parser('humour')))
    h.add_argument('--max', type=int)
    b = wk(sub.add_parser('brief'))
    b.add_argument('--axes', default='scale,fun_consume,fun_produce,uplift,utility')
    r = wk(sub.add_parser('record'))
    r.add_argument('file')
    s = wk(sub.add_parser('score'))
    s.add_argument('--floor', help="the floor's --json output")
    s.add_argument('--probes', help='whys-probe-check.ts output (default story/probes.json)')
    s.add_argument('--write', action='store_true', help='accepted for symmetry; score writes scores.json only')
    o = wk(sub.add_parser('order'))
    o.add_argument('--status', nargs='+', help='board_feed status JSON read(s) of the week')
    o.add_argument('--fresh', action='store_true', help='the board was never shown: every day is open')
    o.add_argument('--before', help='with --status: the ideas.json copied before a days re-run (an option on neither it nor the status is new, so open)')
    o.add_argument('--write', action='store_true', help='write the ordered ideas.json (default: print the report only)')
    cb = wk(sub.add_parser('council-brief'))
    cb.add_argument('--day', required=True)
    cr = wk(sub.add_parser('council-record'))
    cr.add_argument('--day', required=True)
    cr.add_argument('file')
    lg = sub.add_parser('ledger')
    lg.add_argument('week', nargs='?', help="the Monday whose ledger to read (default: --ledger)")
    lg.add_argument('--ledger')
    a = ap.parse_args(argv)

    if a.cmd == 'ledger':
        if not (a.ledger or a.week):
            print('give the Monday or --ledger: each week has its own ledger', file=sys.stderr)
            return 2
        print(json.dumps(Ledger(a.ledger or ledger_of(a.week, cfg), cfg=cfg, today=today, write=False).summary(), indent=1))
        return 0
    plans_dir = Path(a.plans) if a.plans else Path(plans) if plans else PLANS
    ideas_path = Path(a.ideas) if a.ideas else week_dir(a.week, plans_dir) / 'ideas.json'
    if a.cmd in ('record', 'council-record'):
        return cmd_record(a, plans_dir, cfg) if a.cmd == 'record' else cmd_council_record(a, plans_dir, cfg)
    if not ideas_path.exists():
        print(f'no ideas at {ideas_path}', file=sys.stderr)
        return 2
    ideas = load(ideas_path)
    kill = kill or ic.kill_list_vetoes
    if a.cmd in ('angles', 'humour'):
        ledger = Ledger(a.ledger or ledger_of(a.week, cfg), a.budget_usd, cfg, today)
        if a.cmd == 'angles':
            return cmd_angles(a, ideas, plans_dir, ledger, poster, cap, kill, cfg)
        if read is None:
            import humour_check
            read = humour_check.reader()
        return cmd_humour(a, ideas, plans_dir, ledger, read, cfg)
    if a.cmd == 'brief':
        return cmd_brief(a, ideas, plans_dir, cfg)
    if a.cmd == 'score':
        return cmd_score(a, ideas, ideas_path, plans_dir, kill, cfg)
    if a.cmd == 'order':
        return cmd_order(a, ideas, ideas_path, plans_dir, cfg)
    return cmd_council_brief(a, ideas, plans_dir, cfg)


if __name__ == '__main__':
    sys.exit(main())
