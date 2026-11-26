#!/usr/bin/env python3
"""edition: the weekly edition's tools, from the week's records to the package Krish approves for send.

Krish, 2026-11-25 (growth-makeyourmindup docs/plans/2026-11-25-weekly-edition/DESIGN.md, approved with every
recommendation): one email a week, "makeyourmindup weekly", every Saturday at 08:00 New York. It carries the week's live
Monday, Wednesday and Friday pieces, then six to ten news items from the creative industries, each checked against its
primary source, then a Pass it on line and one closing line. content-engine produces and drafts it; growth's Substack
step builds the Substack draft from the package and schedules it only on his press. Every setting is a row in
config/weekly-edition.json; the topic heads are the hub's subsectors, read from config/hub-sources.json by key.

    python3 scripts/edition/edition.py gather  --monday YYYY-MM-DD [--fixture DIR] --out FILE
        What the week offers the edition, read and never written: the week's live series pieces from their records
        (GET /api/board/<Monday>/view and GET /api/content-ideas?id=<piece>), the Saturday good-news stories (the view's
        weekly good-news option), and the news candidates from the week's daily hub editions (GET
        /api/board/<Monday>/edition/news, the hub pipeline's hub_snapshots rows), each under its subsector's head,
        inside the news window, off the beat's avoid list, the same story once. The edition runs no gathering of its
        own. --fixture reads the same answers from files (view.json, hub-week.json, pieces/<id>.json), no network.
    python3 scripts/edition/edition.py link    URL --date YYYY-MM-DD --place PLACE
        One link with the edition's four tags (utm_content edition-<date>-<place>), the only way a link is written.
    python3 scripts/edition/edition.py check   DRAFT [--json]
        The draft against the contract (content-engine-edition/1) and the copy rules: section order, word budgets, every
        news item with its primary source address and the quote that supports it, every link with its four tags and
        the right place, no em dash or en dash used as a dash, no exclamation mark, British spelling, never naming
        Krish, mind/make or CTRL, the copy lint and the publication's kill list (vendor/makeyourmindup/kill-list/).
        Exit 0 clean, 1 with problems, 2 unreadable.
    python3 scripts/edition/edition.py render  DRAFT --out preview.html
        A plain, accessible preview: real text throughout, structure only. The v5 Library's newsletter template is
        not approved, so nothing of it is drawn here; render() takes a template name and refuses one that is not
        approved in config/weekly-edition.json and registered in TEMPLATES (the hook it plugs into once he approves).
    python3 scripts/edition/edition.py package DRAFT --out DIR
        The package as the contract says: canonical bytes (UTF-8, keys sorted, two-space indent, a trailing newline)
        with its checks filled in, its sha256 over those exact bytes, the preview beside it, and the library path
        (3 Posts/<edition_date> Sat edition - makeyourmindup weekly/0 Publish/edition.draft.json), laid out in DIR so
        scripts/post-pack/send.py DIR files it. Refused while check finds a problem.

Nothing here sends, schedules, publishes or spends: only Krish's Approve for send on the Saturday card lets growth's
Substack step schedule the edition, and only for the draft whose sha256 his press binds.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CONFIG_PATH = ROOT / 'config' / 'weekly-edition.json'
BEAT_PATH = ROOT / 'config' / 'beat.json'
HUB_SOURCES_PATH = ROOT / 'config' / 'hub-sources.json'
KILL_LIST = ROOT / 'vendor' / 'makeyourmindup' / 'kill-list' / 'kill-list.mjs'
for _path in (ROOT / 'scripts', ROOT / 'scripts' / 'post-pack', ROOT / 'scripts' / 'quick-edit'):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

import copy_lint  # noqa: E402  config/copy-lint.json, the deterministic copy lint
import spelling  # noqa: E402  the British and US spellings of the same word (house rule BRITISH_SPELLING)
from idea_checks import keyword_pattern  # noqa: E402  the beat's one keyword rule, shared with the Sunday gate

DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
DAYS_LONG = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
ISO = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$')
EM_DASH = '\u2014'
EN_DASH = '\u2013'
# An en dash used as a dash: with a space on either side, or at either end of the text. A range ("9\u201313 Nov") is
# not a dash and passes.
EN_DASH_AS_DASH = re.compile(r'(?:^|\s)\u2013|\u2013(?:\s|$)')
DOUBLE_HYPHEN = re.compile(r'(?<!-)--(?!-)')
EXCLAMATION = re.compile(r'[!！ǃ]')
TOP_KEYS = ('schema', 'edition_date', 'week_of', 'name', 'subject', 'preview_text', 'sections', 'checks')
ITEM_KEYS = ('text', 'source_name', 'source_url', 'quote', 'checked_at')
SECTION_KEYS = {
    'opener': ('kind', 'text'),
    'contents': ('kind', 'lines'),
    'piece': ('kind', 'day', 'label', 'title', 'summary', 'url', 'video_url', 'cover'),
    'news': ('kind', 'groups'),
    'pass_it_on': ('kind', 'text', 'url'),
    'close': ('kind', 'text'),
}
CHECK_KEYS = ('voice', 'kill_list', 'sources', 'words')
# The v5 Library's templates, by name, once Krish approves one (config/weekly-edition.json template). None is approved
# on 25 Nov 2026, so none is registered: render() draws structure only until then.
TEMPLATES: dict = {}


class EditionError(ValueError):
    """A reason to stop, in words a person can act on."""


# ---------------------------------------------------------------- settings

def config(path: Path = CONFIG_PATH) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def beat(path: Path = BEAT_PATH) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def hub_sources(path: Path | None = None) -> dict:
    """The hub pipeline's sources and subsectors (config/hub-sources.json), the six rooms of makeyourmindup.ai."""
    path = path or HUB_SOURCES_PATH
    if not path.is_file():
        raise EditionError(f'{path.name} is not here: the hub pipeline (content-engine, hub/daily-pipeline) merges before '
                           'the edition reads its subsectors and its rows')
    return json.loads(path.read_text(encoding='utf-8'))


def topic_heads(cfg: dict | None = None, heads_cfg: dict | None = None) -> list[dict]:
    """The news topic heads in the hub's own order: each subsector's label, read by its key from
    config/hub-sources.json, less any the edition leaves out, then the good-news group's head."""
    cfg = cfg or config()
    heads_cfg = heads_cfg or hub_sources()
    th = cfg['topic_heads']
    out = set(th.get('leave_out') or [])
    heads = [{'key': row[th['key']], 'label': row[th['label']]} for row in heads_cfg[th['list']] if row[th['key']] not in out]
    return heads + [{'key': 'good_news', 'label': cfg['good_news']['topic']}]


def head_labels(cfg: dict | None = None, heads_cfg: dict | None = None) -> list[str]:
    return [h['label'] for h in topic_heads(cfg, heads_cfg)]


# ---------------------------------------------------------------- the week's dates

def as_date(text: str) -> dt.date:
    try:
        return dt.date.fromisoformat(str(text))
    except ValueError as error:
        raise EditionError(f'{text!r} is not a date (YYYY-MM-DD)') from error


def monday_arg(text: str) -> dt.date:
    day = as_date(text)
    if day.weekday() != 0:
        raise EditionError(f'{text} is a {day.strftime("%A")}, not a Monday')
    return day


def edition_date(monday: dt.date) -> dt.date:
    """The Saturday the week's edition sends on."""
    return monday + dt.timedelta(days=DAYS.index(config()['send']['day']))


def news_window(monday: dt.date, cfg: dict | None = None) -> tuple[dt.datetime, dt.datetime]:
    """The seven days to Friday 12:00 New York (DESIGN.md section 3, rule 1), as aware datetimes."""
    cfg = cfg or config()
    w = cfg['news_window']
    zone = ZoneInfo(w['ends']['timezone'])
    hour, minute = (int(x) for x in w['ends']['time'].split(':'))
    end_day = monday + dt.timedelta(days=DAYS.index(w['ends']['day']))
    end = dt.datetime(end_day.year, end_day.month, end_day.day, hour, minute, tzinfo=zone)
    return end - dt.timedelta(days=int(w['days'])), end


def folder_name(date: dt.date | str, cfg: dict | None = None) -> str:
    cfg = cfg or config()
    return cfg['library']['folder'].format(edition_date=str(date), name=cfg['name'])


def library_paths(date: dt.date | str, cfg: dict | None = None) -> dict:
    """Where the package lives in the library (the contract, section 3)."""
    cfg = cfg or config()
    folder = folder_name(date, cfg)
    return {'folder': folder, 'prefix': f'3 Posts/{folder}',
            'draft': f'3 Posts/{folder}/{cfg["library"]["draft"]}', 'preview': f'3 Posts/{folder}/{cfg["library"]["preview"]}'}


# ---------------------------------------------------------------- links

def place_of(role: str, day: str | None = None, cfg: dict | None = None) -> str:
    cfg = cfg or config()
    return cfg['links']['place_of'][role].format(day=day or '')


def tag(url: str, date: dt.date | str, place: str, cfg: dict | None = None) -> str:
    """The link with the edition's four tags, any older ones of the same names replaced."""
    cfg = cfg or config()
    links = cfg['links']
    if place not in links['places']:
        raise EditionError(f'{place!r} is not one of the edition\'s link places: {", ".join(links["places"])}')
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != 'https' or not parts.netloc:
        raise EditionError(f'{url!r} is not an https address')
    names = ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content')
    query = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True) if k not in names]
    query += [('utm_source', links['utm_source']), ('utm_medium', links['utm_medium']), ('utm_campaign', links['utm_campaign']),
              ('utm_content', f'edition-{date}-{place}')]
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(query), ''))


def link_problems(url, date: str, place: str, where: str, cfg: dict) -> list[str]:
    """Why a link of the edition's own does not carry its four tags for this place, or []."""
    links = cfg['links']
    if not isinstance(url, str):
        return [f'{where}: the link is missing']
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != 'https' or not parts.netloc:
        return [f'{where}: {url!r} is not an https address']
    if parts.fragment:
        return [f'{where}: the link carries a #fragment; the four tags must end it']
    pairs = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    out = []
    want = {'utm_source': links['utm_source'], 'utm_medium': links['utm_medium'], 'utm_campaign': links['utm_campaign'],
            'utm_content': f'edition-{date}-{place}'}
    for name, value in want.items():
        got = [v for k, v in pairs if k == name]
        if len(got) != 1:
            out.append(f'{where}: carries {name} {len(got)} times; it carries it once ({name}={value})')
        elif got[0] != value:
            out.append(f'{where}: {name} is {got[0]!r}, not {value!r}')
    content = want['utm_content']
    if not re.fullmatch(links['utm_content_pattern'], content):
        out.append(f'{where}: utm_content {content!r} does not match the route\'s pattern')
    return out


# ---------------------------------------------------------------- words

def words_in(text) -> int:
    return len(str(text or '').split())


SENTENCE_END = re.compile(r'(?<=[.?])["”’)]?\s+(?=["“‘(]?[A-Z0-9])')


def sentences(text) -> list[str]:
    """Sentences, split at a full stop or question mark followed by a capital or a number: 'U.S. labels' stays one."""
    t = ' '.join(str(text or '').split())
    return [s for s in SENTENCE_END.split(t) if s.strip()] if t else []


def prose_fields(pkg: dict) -> list[tuple[str, str]]:
    """Every line a reader of the edition reads, by where it sits. A news item's quote, its source address and its
    checked_at are the evidence, never the edition's words, so they are not here."""
    out = [('subject', pkg.get('subject')), ('preview_text', pkg.get('preview_text'))]
    for n, s in enumerate(pkg.get('sections') or []):
        if not isinstance(s, dict):
            continue
        kind = s.get('kind')
        at = f'sections[{n}] {kind}'
        if kind in ('opener', 'pass_it_on', 'close'):
            out.append((f'{at} text', s.get('text')))
        elif kind == 'contents':
            out += [(f'{at} line {k + 1}', line) for k, line in enumerate(s.get('lines') or [])]
        elif kind == 'piece':
            cover = s.get('cover') if isinstance(s.get('cover'), dict) else {}
            out += [(f'{at} {s.get("day")} label', s.get('label')), (f'{at} {s.get("day")} title', s.get('title')),
                    (f'{at} {s.get("day")} summary', s.get('summary')), (f'{at} {s.get("day")} cover alt', cover.get('alt'))]
        elif kind == 'news':
            for g, group in enumerate(s.get('groups') or []):
                if not isinstance(group, dict):
                    continue
                out.append((f'{at} group {g + 1} topic', group.get('topic')))
                out += [(f'{at} {group.get("topic")} item {i + 1}', item.get('text'))
                        for i, item in enumerate(group.get('items') or []) if isinstance(item, dict)]
    return [(where, text) for where, text in out if isinstance(text, str)]


def total_words(pkg: dict) -> int:
    """The words a reader reads: every prose line but the subject, the preview text and the cover alt text."""
    return sum(words_in(text) for where, text in prose_fields(pkg)
               if where not in ('subject', 'preview_text') and not where.endswith('cover alt'))


def voice_problems(pkg: dict, cfg: dict) -> list[str]:
    """The copy rules on every line a reader reads: no em dash, no en dash or double hyphen used as a dash, no
    exclamation mark, British spelling, never naming Krish, mind/make or CTRL, and the copy lint's channel_copy rules."""
    out = []
    never = [(name, re.compile(r'(?<![A-Za-z0-9])' + re.escape(name) + r'(?![A-Za-z0-9])', 0 if name.isupper() else re.I))
             for name in cfg['copy']['never_name']]
    surface = cfg['copy']['copy_lint_surface']
    for where, text in prose_fields(pkg):
        if EM_DASH in text:
            out.append(f'{where}: has an em dash')
        if EN_DASH_AS_DASH.search(text) or DOUBLE_HYPHEN.search(text):
            out.append(f'{where}: has a dash used as a dash (an en dash with a space beside it, or "--")')
        if EXCLAMATION.search(text):
            out.append(f'{where}: has an exclamation mark')
        for name, pattern in never:
            if pattern.search(text):
                out.append(f'{where}: names {name}; makeyourmindup never does')
        us = sorted({w for w in re.findall(r"\b[a-z][a-z'’]+\b", text) if spelling.looks_us(w)})
        if us:
            out.append(f'{where}: US spelling ({", ".join(us)}); the edition is written in British spelling')
        for hit in copy_lint.copy_lint(text, surface):
            out.append(f'{where}: the copy lint refuses it ({hit["id"]}: {hit.get("match", "")!r})')
    return out


def kill_list_vetoes(text: str) -> list[str]:
    """The publication's kill list on the edition's words ([] when clean): node vendor/makeyourmindup/kill-list/
    kill-list.mjs --stdin. A kill list that cannot run is a veto, never a pass."""
    try:
        run = subprocess.run(['node', str(KILL_LIST), '--stdin'], input=text, capture_output=True, text=True,
                             encoding='utf-8', timeout=60)
    except (OSError, subprocess.SubprocessError) as error:
        return [f'the kill list could not run ({error})']
    if run.returncode == 0:
        return []
    vetoes = [' '.join(line.split()[2:5]) for line in run.stdout.splitlines() if line.startswith('VETO')]
    return vetoes or ['the kill list refused it']


# ---------------------------------------------------------------- check

def check(pkg, cfg: dict | None = None, heads_cfg: dict | None = None, kill=kill_list_vetoes) -> dict:
    """The draft against the contract. {'problems': [...], 'warnings': [...], 'checks': {voice, kill_list, sources,
    words}}; a draft is ready when problems is empty. Pure but for the kill list, which tests can stand in for."""
    cfg = cfg or config()
    problems: list[str] = []
    warnings: list[str] = []
    if not isinstance(pkg, dict):
        return {'problems': ['the draft is not a JSON object'], 'warnings': [], 'checks': None}
    for k in pkg:
        if k not in TOP_KEYS:
            problems.append(f'{k}: not a key of {cfg["package_schema"]}')
    for k in TOP_KEYS[:-1]:
        if k not in pkg:
            problems.append(f'{k}: missing')
    if pkg.get('schema') != cfg['package_schema']:
        problems.append(f'schema is {pkg.get("schema")!r}, not {cfg["package_schema"]!r}')
    if pkg.get('name') != cfg['name']:
        problems.append(f'name is {pkg.get("name")!r}, not {cfg["name"]!r}')
    date = str(pkg.get('edition_date') or '')
    try:
        sat = dt.date.fromisoformat(date)
        send_day = DAYS.index(cfg['send']['day'])
        if sat.weekday() != send_day:
            problems.append(f'edition_date {date} is a {sat.strftime("%A")}; the edition sends on a {DAYS_LONG[send_day]}')
        elif str(pkg.get('week_of')) != (sat - dt.timedelta(days=send_day)).isoformat():
            problems.append(f'week_of is {pkg.get("week_of")!r}; the Monday of {date} is {(sat - dt.timedelta(days=send_day)).isoformat()}')
    except ValueError:
        problems.append(f'edition_date {date!r} is not a date')
    subject = pkg.get('subject')
    s = cfg['subject']
    if not isinstance(subject, str) or not (s['min_chars'] <= len(subject.strip()) <= s['max_chars']):
        problems.append(f'subject is {len(subject) if isinstance(subject, str) else "not"} characters; it is {s["min_chars"]} to {s["max_chars"]}')
    preview = pkg.get('preview_text')
    p = cfg['preview_text']
    if not isinstance(preview, str) or not (p['min_chars'] <= len(preview.strip()) <= p['max_chars']):
        problems.append(f'preview_text is {len(preview) if isinstance(preview, str) else "not"} characters; it is up to {p["max_chars"]}')

    sections = pkg.get('sections')
    if not isinstance(sections, list) or not sections:
        problems.append('sections: missing or empty')
        sections = []
    order = cfg['sections']
    kinds = [x.get('kind') if isinstance(x, dict) else None for x in sections]
    ranks = []
    for n, kind in enumerate(kinds):
        if kind not in order:
            problems.append(f'sections[{n}]: kind {kind!r} is not one of {", ".join(order)}')
        else:
            ranks.append(order.index(kind))
    if ranks != sorted(ranks):
        problems.append(f'sections are out of order: {", ".join(str(k) for k in kinds)}; the order is {", ".join(order)}')
    for kind in order:
        count = kinds.count(kind)
        if kind == 'piece':
            if not (cfg['pieces']['min'] <= count <= cfg['pieces']['max']):
                problems.append(f'{count} piece sections; an edition carries {cfg["pieces"]["min"]} to {cfg["pieces"]["max"]} '
                                '(a week with no live piece sends no edition)')
        elif count != 1:
            problems.append(f'{count} {kind} sections; there is exactly one')
    for n, x in enumerate(sections):
        if isinstance(x, dict) and x.get('kind') in SECTION_KEYS:
            extra = [k for k in x if k not in SECTION_KEYS[x['kind']]]
            if extra:
                problems.append(f'sections[{n}] {x["kind"]}: unknown keys {", ".join(extra)}')
    words = cfg['words']
    by_kind = {}
    for x in sections:
        if isinstance(x, dict):
            by_kind.setdefault(x.get('kind'), []).append(x)

    opener = (by_kind.get('opener') or [{}])[0]
    o = words['opener']
    n_sent = len(sentences(opener.get('text')))
    if not (o['min_sentences'] <= n_sent <= o['max_sentences']):
        problems.append(f'opener: {n_sent} sentences; it is {o["min_sentences"]} to {o["max_sentences"]}')
    if words_in(opener.get('text')) > o['max_words']:
        problems.append(f'opener: {words_in(opener.get("text"))} words; at most {o["max_words"]}')

    pieces = by_kind.get('piece') or []
    days = [x.get('day') for x in pieces]
    allowed = cfg['pieces']['days']
    if any(d not in allowed for d in days):
        problems.append(f'piece days {days}: each is one of {", ".join(allowed)}')
    elif days != sorted(days, key=allowed.index) or len(set(days)) != len(days):
        problems.append(f'piece days {days}: in day order, each once')
    for x in pieces:
        day = str(x.get('day'))
        where = f'piece {day}'
        word = cfg['pieces']['day_words'].get(day, day)
        label = x.get('label')
        if not isinstance(label, str) or not label.startswith(f'{word}: ') or len(label) <= len(word) + 2:
            problems.append(f'{where}: label {label!r} reads "{word}: " then the day\'s question')
        if not isinstance(x.get('title'), str) or not x['title'].strip():
            problems.append(f'{where}: title missing (the piece\'s own approved title)')
        sw = words_in(x.get('summary'))
        b = words['piece_summary']
        if not (b['min_words'] <= sw <= b['max_words']):
            problems.append(f'{where}: summary is {sw} words; it is {b["min_words"]} to {b["max_words"]}')
        problems += link_problems(x.get('url'), date, place_of('piece', day, cfg), f'{where} url', cfg)
        if x.get('video_url') is not None:
            problems += link_problems(x.get('video_url'), date, place_of('video', day, cfg), f'{where} video_url', cfg)
        elif 'video_url' not in x:
            problems.append(f'{where}: video_url missing (a tagged link, or null)')
        cover = x.get('cover')
        if not isinstance(cover, dict) or not str(cover.get('url') or '').startswith('https://') or not str(cover.get('alt') or '').strip():
            problems.append(f'{where}: cover needs an https url and plain alt text')

    contents = (by_kind.get('contents') or [{}])[0]
    lines = contents.get('lines')
    if not isinstance(lines, list) or not all(isinstance(line, str) and line.strip() for line in lines):
        problems.append('contents: lines missing')
    elif len(lines) != len(pieces) + 1:
        problems.append(f'contents: {len(lines)} lines; one per piece ({len(pieces)}) then one "Also" line')
    elif not lines[-1].startswith('Also'):
        problems.append('contents: the last line is the "Also" line naming the news topics')

    news = (by_kind.get('news') or [{}])[0]
    groups = news.get('groups')
    heads = head_labels(cfg, heads_cfg)
    good = cfg['good_news']
    per_topic = cfg['news']['per_topic_max']
    items_total = 0
    sources_ok = True
    if not isinstance(groups, list) or not groups:
        problems.append('news: groups missing')
        groups = []
        sources_ok = False
    seen = set()
    for g in groups:
        if not isinstance(g, dict):
            problems.append('news: a group is not an object')
            continue
        topic = g.get('topic')
        if topic not in heads:
            problems.append(f'news: topic {topic!r} is not a subsector head from config/hub-sources.json or {good["topic"]!r}')
        if topic in seen:
            problems.append(f'news: topic {topic!r} twice; one group a topic')
        seen.add(topic)
        items = g.get('items')
        if not isinstance(items, list) or not items:
            problems.append(f'news {topic}: no items')
            continue
        if topic == good['topic'] and len(items) > good['max_items']:
            problems.append(f'news {topic}: {len(items)} items; at most {good["max_items"]}')
        elif topic != good['topic'] and len(items) > per_topic:
            problems.append(f'news {topic}: {len(items)} items; at most {per_topic} a subsector')
        for i, item in enumerate(items):
            where = f'news {topic} item {i + 1}'
            items_total += 1
            if not isinstance(item, dict):
                problems.append(f'{where}: not an object')
                sources_ok = False
                continue
            extra = [k for k in item if k not in ITEM_KEYS]
            if extra:
                problems.append(f'{where}: unknown keys {", ".join(extra)}')
            ns = len(sentences(item.get('text')))
            b = words['news_item']
            if not (b['min_sentences'] <= ns <= b['max_sentences']):
                problems.append(f'{where}: {ns} sentences; an item is {b["min_sentences"]} or {b["max_sentences"]}')
            if not str(item.get('source_name') or '').strip():
                problems.append(f'{where}: source_name missing (who published the primary source)')
                sources_ok = False
            url = item.get('source_url')
            parts = urllib.parse.urlsplit(url) if isinstance(url, str) else None
            if not parts or parts.scheme != 'https' or not parts.netloc:
                problems.append(f'{where}: source_url is not an https address of the primary source')
                sources_ok = False
            elif any(k == 'utm_source' and v == cfg['links']['utm_source'] for k, v in urllib.parse.parse_qsl(parts.query)):
                problems.append(f'{where}: source_url carries the edition\'s tags; it is the primary source exactly as published')
                sources_ok = False
            if not str(item.get('quote') or '').strip():
                problems.append(f'{where}: quote missing (the words in the source that support the item)')
                sources_ok = False
            if not ISO.match(str(item.get('checked_at') or '')):
                problems.append(f'{where}: checked_at is not an ISO 8601 time')
                sources_ok = False
    n = cfg['news']
    if items_total > n['max_items']:
        problems.append(f'news: {items_total} items; at most {n["max_items"]}')
    elif items_total < n['send_min_items']:
        problems.append(f'news: {items_total} items; the edition goes with at least {n["send_min_items"]}')
    elif items_total < n['min_items']:
        warnings.append(f'news: {items_total} items, under the {n["min_items"]} an edition aims for (it still sends with {n["send_min_items"]} or more)')

    pio = (by_kind.get('pass_it_on') or [{}])[0]
    if len(sentences(pio.get('text'))) != 1:
        problems.append('pass_it_on: one sentence')
    page = cfg['links']['subscribe_page']
    url = pio.get('url')
    if not isinstance(url, str) or urllib.parse.urlsplit(url)._replace(query='', fragment='').geturl() != page:
        problems.append(f'pass_it_on url: it goes to the one subscribe page, {page}')
    problems += link_problems(url, date, place_of('pass_it_on', None, cfg), 'pass_it_on url', cfg)
    close = (by_kind.get('close') or [{}])[0]
    if len(sentences(close.get('text'))) > words['close']['max_sentences'] or not str(close.get('text') or '').strip():
        problems.append('close: one line')

    voice = voice_problems(pkg, cfg)
    problems += voice
    vetoes = kill('\n'.join(text for _, text in prose_fields(pkg)))
    problems += [f'the kill list vetoes it: {v}' for v in vetoes]
    total = total_words(pkg)
    t = words['total']
    if total > t['max_words']:
        problems.append(f'{total} words; the edition reads in about five minutes, at most {t["max_words"]}')
    elif total < t['min_words']:
        warnings.append(f'{total} words, under the {t["min_words"]} a full week runs to')
    checks = {'voice': 'fail' if voice else 'pass', 'kill_list': 'fail' if vetoes else 'pass',
              'sources': 'pass' if sources_ok and items_total else 'fail', 'words': total}
    if 'checks' in pkg and pkg['checks'] != checks:
        problems.append(f'checks {pkg["checks"]} are not what the check finds ({checks}); package fills them')
    return {'problems': problems, 'warnings': warnings, 'checks': checks}


# ---------------------------------------------------------------- render

def render(pkg: dict, template: str | None = None, cfg: dict | None = None) -> str:
    """The preview page: plain HTML, real text throughout, structure only. A template is drawn only once Krish approves
    it (config/weekly-edition.json template.approved) and it is registered in TEMPLATES; that is the hook the v5
    Library's newsletter-weekly-edition plugs into, and nothing of it is copied or invented here."""
    cfg = cfg or config()
    if template is not None:
        if not cfg['template']['approved'] or template != cfg['template']['name'] or template not in TEMPLATES:
            raise EditionError(f'the template {template!r} is not approved (config/weekly-edition.json template); the preview '
                               'draws structure only until Krish approves the Library')
        return TEMPLATES[template](pkg, cfg)
    e = html.escape
    heads = cfg['section_heads']
    by_kind: dict = {}
    for s in pkg.get('sections') or []:
        by_kind.setdefault(s.get('kind'), []).append(s)
    out = ['<!doctype html>', '<html lang="en-GB">', '<head>', '<meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width, initial-scale=1">',
           f'<title>{e(pkg.get("subject", ""))}</title>',
           '<style>body{font:17px/1.6 Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#111;background:#fff}'
           'h1,h2,h3{font-family:Arial,Helvetica,sans-serif;line-height:1.25}img{max-width:100%;height:auto}'
           '.note{font:14px/1.5 Arial,Helvetica,sans-serif;color:#444;border:1px solid #999;padding:.5rem .75rem}'
           'a{color:#0645ad}</style>',
           '</head>', '<body>',
           '<!-- The v5 Library newsletter template is not approved (config/weekly-edition.json template): this preview is the '
           'edition\'s structure only, in plain HTML. edition.py render(template=...) is where an approved template plugs in. -->',
           '<p class="note">Preview of the weekly edition, structure only. Nothing here is sent until Krish presses Approve for send.</p>',
           '<header>', f'<p>{e(pkg.get("name", ""))}, {e(_long_date(pkg.get("edition_date")))}</p>',
           f'<h1>{e(pkg.get("subject", ""))}</h1>', f'<p><em>{e(pkg.get("preview_text", ""))}</em></p>', '</header>', '<main>']
    for s in by_kind.get('opener', []):
        out.append(f'<section aria-label="Opener"><p>{e(s.get("text", ""))}</p></section>')
    for s in by_kind.get('contents', []):
        out.append(f'<section aria-labelledby="contents"><h2 id="contents">{e(heads["contents"])}</h2><ul>')
        out += [f'<li>{e(line)}</li>' for line in s.get('lines') or []]
        out.append('</ul></section>')
    for s in by_kind.get('piece', []):
        day = e(str(s.get('day')))
        cover = s.get('cover') or {}
        out.append(f'<section aria-labelledby="piece-{day}"><h2 id="piece-{day}">{e(s.get("label", ""))}</h2>')
        out.append(f'<h3>{e(s.get("title", ""))}</h3>')
        if cover.get('url'):
            out.append(f'<p><img src="{e(cover["url"])}" alt="{e(cover.get("alt", ""))}"></p>')
        out.append(f'<p>{e(s.get("summary", ""))}</p>')
        links = [f'<a href="{e(s["url"])}">Read the full piece</a>'] if s.get('url') else []
        if s.get('video_url'):
            links.append(f'<a href="{e(s["video_url"])}">Watch the 5-minute video</a>')
        out.append(f'<p>{" | ".join(links)}</p></section>')
    for s in by_kind.get('news', []):
        out.append(f'<section aria-labelledby="news"><h2 id="news">{e(heads["news"])}</h2>')
        for g in s.get('groups') or []:
            out.append(f'<h3>{e(g.get("topic", ""))}</h3><ul>')
            for item in g.get('items') or []:
                out.append(f'<li>{e(item.get("text", ""))} <a href="{e(item.get("source_url", ""))}">{e(item.get("source_name", ""))}</a></li>')
            out.append('</ul>')
        out.append('</section>')
    for s in by_kind.get('pass_it_on', []):
        out.append(f'<section aria-labelledby="pass"><h2 id="pass">{e(heads["pass_it_on"])}</h2>'
                   f'<p>{e(s.get("text", ""))} <a href="{e(s.get("url", ""))}">Subscribe</a></p></section>')
    for s in by_kind.get('close', []):
        out.append(f'<footer><p>{e(s.get("text", ""))}</p></footer>')
    out.append('</main>')
    # For Krish, never the email: what each news item was checked against.
    evidence = [(g.get('topic', ''), item) for s in by_kind.get('news', []) for g in s.get('groups') or [] for item in g.get('items') or []]
    if evidence:
        out.append('<aside class="note" aria-labelledby="checked"><h2 id="checked">Checked against the source (not in the email)</h2><ol>')
        for topic, item in evidence:
            out.append(f'<li>{e(topic)}: <a href="{e(item.get("source_url", ""))}">{e(item.get("source_name", ""))}</a>, '
                       f'checked {e(str(item.get("checked_at", "")))}: <q>{e(item.get("quote", ""))}</q></li>')
        out.append('</ol></aside>')
    out += ['</body>', '</html>', '']
    return '\n'.join(out)


def _long_date(text) -> str:
    try:
        d = dt.date.fromisoformat(str(text))
    except ValueError:
        return str(text or '')
    return f'{d.strftime("%A")} {d.day} {d.strftime("%B %Y")}'


# ---------------------------------------------------------------- package

def canonical(pkg: dict) -> bytes:
    """The contract's exact bytes: UTF-8, keys sorted, two-space indent, a trailing newline."""
    return (json.dumps(pkg, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def package(draft: dict, out: Path, cfg: dict | None = None, kill=kill_list_vetoes) -> dict:
    """Writes the package and its preview into out, laid out as the library has them, with send.py's pack manifest,
    and returns what was written. Refused while the check finds a problem."""
    cfg = cfg or config()
    body = {k: v for k, v in draft.items() if k != 'checks'}
    result = check(body, cfg, kill=kill)
    if result['problems']:
        raise EditionError('the draft is not ready, so nothing was packaged:\n  ' + '\n  '.join(result['problems']))
    pkg = {**body, 'checks': result['checks']}
    data = canonical(pkg)
    if len(data) > cfg['library']['max_bytes']:
        raise EditionError(f'the package is {len(data)} bytes; the board reads at most {cfg["library"]["max_bytes"]}')
    paths = library_paths(pkg['edition_date'], cfg)
    draft_rel, preview_rel = cfg['library']['draft'], cfg['library']['preview']
    (out / draft_rel).parent.mkdir(parents=True, exist_ok=True)
    (out / draft_rel).write_bytes(data)
    (out / preview_rel).write_bytes(render(pkg, cfg=cfg).encode('utf-8'))
    # send.py reads this (its MANIFEST): where in the library the files go and what each is for.
    pack = {'library_prefix': paths['prefix'], 'files': [
        {'path': draft_rel, 'purpose': f'The weekly edition draft ({cfg["package_schema"]}) for {pkg["edition_date"]}: what Krish approves for send, bound to its sha256.'},
        {'path': preview_rel, 'purpose': f'The weekly edition preview for {pkg["edition_date"]}, structure only: read it before Approve for send.'}]}
    (out / '.pack.json').write_text(json.dumps(pack, indent=2) + '\n', encoding='utf-8')
    return {'sha256': sha256(data), 'bytes': len(data), 'edition_date': pkg['edition_date'], 'folder': paths['folder'],
            'draft_path': paths['draft'], 'preview_path': paths['preview'], 'warnings': result['warnings'], 'out': str(out)}


# ---------------------------------------------------------------- gather

def _engine_reader():
    import engine  # scripts/engine.py: the engine's address and key, never printed
    token = engine.operator_key()

    def read(path: str):
        status, text = engine.call('GET', path, token=token, timeout=180)
        if status != 200:
            raise EditionError(f'GET {path.split("?")[0]} answered {status}')
        return json.loads(text)
    return read


def _fixture_reader(folder: Path):
    def read(path: str):
        if path.endswith('/edition/news'):
            name = 'hub-week.json'
        elif '/view' in path:
            name = 'view.json'
        elif path.startswith('/api/content-ideas?id='):
            name = f'pieces/{path.split("=", 1)[1]}.json'
        else:
            raise EditionError(f'the fixture has no answer for {path}')
        target = folder / name
        if not target.is_file():
            raise EditionError(f'the fixture has no {name}')
        return json.loads(target.read_text(encoding='utf-8'))
    return read


def avoid_of(text: str, beat_cfg: dict | None = None) -> str | None:
    """Why a story is on the beat's avoid list (config/beat.json: governance, regulation, security, privacy), read as
    the headline gate reads it (apps/control-plane/api/_beat.ts), its own exception phrases included; None when it is
    not. The hub has already placed the story in a subsector, so only the avoid list is read here."""
    b = beat_cfg or beat()
    avoid_text = keyword_pattern(b.get('avoid_not_when')).sub(' ', text)
    for row in b['avoid']:
        hit = keyword_pattern(row.get('keywords')).search(avoid_text)
        if hit:
            return f'on the avoid list ({row["label"].lower()}: "{hit.group(0)}")'
    return None


def _when(text) -> dt.datetime | None:
    try:
        t = dt.datetime.fromisoformat(str(text).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


HUB_FIELDS = ('id', 'subsector', 'date', 'source', 'url', 'headline', 'dek')


def _story_key(url: str) -> str:
    """The same story's address however a feed wrote it: no fragment, no query, no trailing slash, lower-case host."""
    parts = urllib.parse.urlsplit(url.strip())
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip('/'), '', ''))


def hub_candidates(answer: dict, start: dt.datetime, end: dt.datetime, cfg: dict, heads_cfg: dict | None = None,
                   beat_cfg: dict | None = None) -> tuple[list[dict], dict, dict]:
    """The week's daily hub items as the edition's news candidates: each under its subsector's head, inside the news
    window, off the avoid list, and the same story once however many days carried it (its coverage the most outlets
    any day counted, its days every daily edition that ran it). Ordered by head, then coverage, days and date."""
    heads = {h['key']: h['label'] for h in topic_heads(cfg, heads_cfg) if h['key'] != 'good_news'}
    order = list(heads)
    left_out = {'outside_window': 0, 'avoid_list': 0, 'no_subsector': 0, 'unreadable': 0, 'repeat': 0}
    days = [d for d in answer.get('days') or [] if isinstance(d, dict) and isinstance(d.get('edition_date'), str)]
    by_key: dict[str, dict] = {}
    for day in sorted(days, key=lambda d: d['edition_date']):
        left_out['unreadable'] += _count(day.get('skipped'), 0)
        for it in day.get('items') or []:
            if not isinstance(it, dict) or any(not isinstance(it.get(k), str) or not it[k].strip() for k in HUB_FIELDS) \
                    or not it['url'].startswith('https://'):
                left_out['unreadable'] += 1
                continue
            key = _story_key(it['url'])
            seen = by_key.get(key) or next((c for c in by_key.values() if c['id'] == it['id']), None)
            if seen:
                left_out['repeat'] += 1
                seen['coverage'] = max(seen['coverage'], _coverage(it))
                if day['edition_date'] not in seen['days']:
                    seen['days'].append(day['edition_date'])
                continue
            if it['subsector'] not in heads:
                left_out['no_subsector'] += 1
                continue
            at = _when(it['date'])
            if not at or not (start <= at <= end):
                left_out['outside_window'] += 1
                continue
            if avoid_of(' '.join((it['headline'], it['dek'])), beat_cfg):
                left_out['avoid_list'] += 1
                continue
            by_key[key] = {'id': it['id'], 'topic': heads[it['subsector']], 'subsector': it['subsector'],
                           'headline': it['headline'], 'dek': it['dek'], 'why': it.get('why') or None,
                           'report_source': it['source'], 'report_url': it['url'], 'date': it['date'],
                           'coverage': _coverage(it), 'days': [day['edition_date']]}
    candidates = sorted(by_key.values(), key=lambda c: (order.index(c['subsector']), -c['coverage'], -len(c['days']), c['date']))
    hub = {'from': answer.get('from'), 'to': answer.get('to'),
           'days_read': [d['edition_date'] for d in sorted(days, key=lambda d: d['edition_date'])],
           'days_missing': list(answer.get('missing') or [])}
    return candidates, left_out, hub


def _count(n, floor: int) -> int:
    return n if isinstance(n, int) and not isinstance(n, bool) and n >= floor else floor


def _coverage(item: dict) -> int:
    return _count(item.get('coverage'), 1)


def gather(monday: dt.date, read, cfg: dict | None = None, heads_cfg: dict | None = None, beat_cfg: dict | None = None) -> dict:
    """What the week offers the edition, from the engine's own read routes (or a fixture of them). Reads only."""
    cfg = cfg or config()
    heads_cfg = heads_cfg or hub_sources()
    beat_cfg = beat_cfg or beat()
    sat = edition_date(monday)
    start, end = news_window(monday, cfg)
    view = read(f'/api/board/{monday.isoformat()}/view')
    days = {d.get('day'): d for d in view.get('days') or [] if isinstance(d, dict)}
    pieces, not_live = [], []
    for day in cfg['pieces']['days']:
        d = days.get(day) or {}
        pid = str(d.get('piece_id') or '').lower()
        entry = next((p for p in d.get('pieces') or [] if str(p.get('id', '')).lower() == pid), None) if pid else None
        stage = (entry or {}).get('stage') or {}
        if not pid or stage.get('state') != 'live':
            not_live.append({'day': day, 'piece_id': pid or None, 'title': d.get('title'),
                             'why': f'its stage is {stage.get("state")}' if pid else 'no piece on the day'})
            continue
        record = read(f'/api/content-ideas?id={pid}').get('piece') or {}
        links = [x for x in stage.get('links') or [] if isinstance(x, dict) and str(x.get('href', '')).startswith('https://')]
        links += [{'label': p.get('label'), 'href': p['href']} for p in d.get('posted') or []
                  if isinstance(p, dict) and str(p.get('href', '')).startswith('https://') and p['href'] not in {x.get('href') for x in links}]
        pieces.append({'day': day, 'day_word': cfg['pieces']['day_words'][day], 'piece_id': pid, 'title': entry.get('title') or d.get('title'),
                       'series': d.get('series'), 'live_at': stage.get('at'), 'links': links,
                       'idea': record.get('idea'), 'thesis': record.get('thesis'), 'body': str(record.get('body') or '')[:6000],
                       'place_piece': place_of('piece', day, cfg), 'place_video': place_of('video', day, cfg)})
    good = []
    for o in (days.get('sat') or {}).get('options') or []:
        if isinstance(o, dict) and isinstance(o.get('stories'), list) and o.get('stories'):
            good += [{'headline': st.get('headline'), 'what': st.get('what'), 'date': st.get('date'), 'source': st.get('source'),
                      'href': st.get('href'), 'option': o.get('id'), 'stories_fresh': o.get('stories_fresh')}
                     for st in o['stories'] if isinstance(st, dict)]
    answer = read(f'/api/board/{monday.isoformat()}/edition/news')
    candidates, left_out, hub = hub_candidates(answer, start, end, cfg, heads_cfg, beat_cfg)
    return {'week_of': monday.isoformat(), 'edition_date': sat.isoformat(), 'name': cfg['name'],
            'news_window': {'from': start.isoformat(), 'to': end.isoformat()},
            'pieces': pieces, 'not_live': not_live, 'good_news': good, 'candidates': candidates, 'left_out': left_out,
            'hub': hub, 'heads': head_labels(cfg, heads_cfg), 'per_topic_max': cfg['news']['per_topic_max'],
            'library': library_paths(sat, cfg), 'send_holds': not pieces,
            'rule': cfg['news']['from_hub']['rule']}


# ---------------------------------------------------------------- the command line

def _load(path: str) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        raise EditionError(f'{path}: cannot read it as JSON ({error})') from error


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    g = sub.add_parser('gather')
    g.add_argument('--monday', required=True)
    g.add_argument('--fixture', help='a folder holding view.json, hub-week.json and pieces/<id>.json: no network')
    g.add_argument('--out', required=True)
    lk = sub.add_parser('link')
    lk.add_argument('url')
    lk.add_argument('--date', required=True, help='the edition date, the Saturday, YYYY-MM-DD')
    lk.add_argument('--place', required=True)
    c = sub.add_parser('check')
    c.add_argument('draft')
    c.add_argument('--date', help='the Saturday the draft must be for, YYYY-MM-DD')
    c.add_argument('--json', action='store_true')
    r = sub.add_parser('render')
    r.add_argument('draft')
    r.add_argument('--out', required=True)
    r.add_argument('--template', help='an approved v5 Library template (none is approved yet)')
    p = sub.add_parser('package')
    p.add_argument('draft')
    p.add_argument('--out', required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'gather':
            monday = monday_arg(args.monday)
            read = _fixture_reader(Path(args.fixture)) if args.fixture else _engine_reader()
            found = gather(monday, read)
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(json.dumps(found, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f'edition gather, week of {monday}: {len(found["pieces"])} live piece(s), {len(found["good_news"])} good-news '
                  f'stories, {len(found["candidates"])} news candidates from {len(found["hub"]["days_read"])} daily hub '
                  f'edition(s) ({found["left_out"]}); written to {args.out}')
            if found['send_holds']:
                print('No piece went live this week: the edition holds and asks Krish (DESIGN.md section 1).')
            return 0
        if args.command == 'link':
            as_date(args.date)
            print(tag(args.url, args.date, args.place))
            return 0
        try:
            draft = _load(args.draft)
        except EditionError as error:
            print(f'edition: {error}', file=sys.stderr)
            return 2
        if args.command == 'check':
            result = check(draft)
            if args.date and str(draft.get('edition_date')) != as_date(args.date).isoformat():
                result['problems'].append(f'edition_date is {draft.get("edition_date")!r}; this run drafts the edition of {args.date}')
            # A package (it carries its checks) is filed as the contract's exact bytes, which its sha256 is over.
            if 'checks' in draft and Path(args.draft).read_bytes() != canonical(draft):
                result['problems'].append('the file is not the contract\'s canonical bytes (UTF-8, keys sorted, two-space indent, '
                                          'a trailing newline): make it with package')
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                for line in result['problems']:
                    print(f'PROBLEM  {line}')
                for line in result['warnings']:
                    print(f'warning  {line}')
                print(f'{len(result["problems"])} problem(s), {len(result["warnings"])} warning(s); checks {result["checks"]}')
            return 1 if result['problems'] else 0
        if args.command == 'render':
            Path(args.out).write_text(render(draft, args.template), encoding='utf-8')
            print(f'preview written to {args.out}')
            return 0
        if args.command == 'package':
            done = package(draft, Path(args.out))
            print(json.dumps(done, indent=2))
            return 0
    except EditionError as error:
        print(f'edition: {error}', file=sys.stderr)
        return 1 if args.command in ('check', 'package', 'render') else 2
    return 2


if __name__ == '__main__':
    sys.exit(main())
