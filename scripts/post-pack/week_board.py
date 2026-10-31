#!/usr/bin/env python3
"""week_board: the week's one publish board. Three tabs, Monday, Wednesday
and Friday, and a tick box beside every step, saved where it is recorded.

Krish, 2026-10-12: "just give me one ... Publish Manager for the ... whole
week with 3 tabs on it for Mon / Weds / Fri, which we need to get to 100%.
Give me a tick box next to each one so I can tick as I go and you can
durably record that completion where it needs to be recorded. That Publish
Manager is what you create every Sunday and let me iterate inside until
we're done, and then I check off the list what I have done as I do it."

    python week_board.py --week 2026-10-12 --day mon=monday-publish.html --day fri=friday-publish.html \\
        [--piece mon=UUID] [--piece fri=UUID] [--teleprompter ids.json | --teleprompter mon=record.json] \\
        [--options options.json | --live] [--pending wed="Title"] [--previous BOARD] [--unpick DAY] \\
        --out week-board.html
    python week_board.py --show BOARD [--json]
    python week_board.py --self-test

From the week of 26 October 2026 (config/board-layout.json, layout_from) every week is drawn in one fixed
layout: five tabs, Ideas, Queue, Monday, Wednesday and Friday, and in each day the same four steps, Brief, Drafts,
Record and Publish, each filled from data (--brief, --review, --teleprompter, the publish page, --materials) in the
same place every week. verify() refuses a board in any other shape, and npm run check:board-layout holds it to
fixtures/week-board/fixed-layout.json (Krish, 2026-10-21: "the rest of the content engine needs to know how to feed
it and not be permitted to change random parts of the UI and UX"). docs/PUBLISH_BOARDS.md, "The fixed layout".
In it a made day's Publish step is one run-sheet drawn from data (run_sheet): Download first, then a card per place to
post in the layout's order. Weeks before keep the layout below, the one they were published in.

--week is the Monday. Each tab is one of:

  - made: a piece's whole publish page (publish_manager.py's page, given
    with --day), its ids namespaced by day ("mon-c5") and its script scoped
    to its own tab, with three cards added at the top: Record (each cut's
    script in Teleprompter, by its title, and its folder, from the making
    record's teleprompter field, and how the take comes back: dropped at the
    top of the Video Engine Inbox), the two scripts to copy, and the tick
    checklist. A tick also sits beside each channel's heading.
  - picked, not made yet: names the piece and points to the week page,
    where "Make it in Claude Code" starts it; its checklist already works.
  - not picked: says so and points to the week page.

Which piece a day holds: --piece, else the publish page's data-piece, else
the week's picks (a day's piece is the one scheduled for its date, in any
picked state, published included: the options' `scheduled` list, or
`in_flight` from an engine that has none), read from a saved GET
/api/week/options answer (--options) or live (--live). --pending
wed="Title" names a picked piece by hand.

--keep DAY carries a made day over from --previous (the board's page as
`Artifact read` saved it) exactly as it stands, ticks and Record card
included, when its publish page cannot be read any more (Krish, 2026-10-14:
"why are Wednesday and Friday built differently to Monday?" Monday's page
link was gone, and only the board still held its tab).

A rebuild never loses a day. --previous is the board being replaced: its
manifest (week-board.json) or its page as `Artifact read` saved it. A day
it held as made or picked that this build would show as not picked is
refused, and so is a made day this build has no publish page for; --unpick
DAY says a day really has no piece now (Krish moved or dropped it). With
--live, a picked piece whose making record has a publish page
(publish_manager.url) must come with that page (--day), or the build is
refused: its tab would lose every Copy card while he is still posting.
--show BOARD prints the days a board holds (each day's state and piece),
which is how a session knows whose ticks are whose.

The ticks. Seven steps make a day 100% (the two cuts recorded, then
Substack, YouTube, Shorts, TikTok and Instagram, the standing order of
docs/AMPLIFICATION.md); LinkedIn, WhatsApp and Substack Notes are optional
and never counted. The week bar counts every picked day. Each tick is saved
at once in the page's own store (the artifact's db capability):

    ticks/<day>-<step>   {done, at, day, piece_id, step, channel, label}
    links/<day>          {article, youtube, at}

with <day> mon, wed or fri and <step> record-long, record-short, substack,
youtube, shorts, tiktok, reels, linkedin or spotify (whatsapp and notes were dropped on 14 October). These are the
documents of the board published on 12 October, so a rebuilt board
republished to the same page keeps every tick and link: the store lives
with the page, and the ids depend only on the day and the step. A tick
saved for another piece (the day picked again) is not shown as done.

A tick is Krish's own record on the page. A session copies it onto the
piece's making record in the engine: a channel with `making.py <piece>
posted <channel> [url]`, and the Publish step is done once the standing
five are on the record. Record is done from the takes on the record, never
from a tick. Beside the page it writes <out>.json, a manifest for the
skills: the week, each day's state and piece, every tick id and the command
that records it, and the Artifact publish call.

Nothing here publishes, posts, sends, spends or writes to the engine,
Teleprompter or Drive; --live only reads (GET /api/week/options and GET
/api/content-ideas/<id>/making). Descript was retired on 2026-10-12 (Krish:
"Descript is permanently gone, teleprompter.com is permanently in"), and
its links with it; a tick saved under the old Record labels keeps its id.
"""
import argparse
import contextlib
import hashlib
import html
import io
import json
import re
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import engine_stamp  # noqa: E402  the engine's stamp on a page it built
import publish_kit  # noqa: E402
import publish_manager  # noqa: E402
import board_today  # noqa: E402
import board_materials  # noqa: E402
import story_check  # noqa: E402  which cut a script's label names

TEMPLATES = HERE / 'week_board'
TITLE = "This Week's Publish Board"
WEEK_PAGE = 'https://controlcenter.krishraja.com/#/week'
MAX_BYTES = 16 * 1024 * 1024  # an artifact page's limit, embedded pictures included
WARN_BYTES = 14 * 1024 * 1024
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
DASHES = ('\u2014', '\u2013')  # the em and en dash, never in the board's own words

# The publishing days (docs/CADENCE.md): key, tab id, name, days after Monday, series slug, series as written.
DAYS = (
    ('mon', 'monday', 'Monday', 0, 'follow_the_money', 'follow.the.money'),
    ('wed', 'wednesday', 'Wednesday', 2, 'under_the_hood', 'under.the.hood'),
    ('fri', 'friday', 'Friday', 4, 'mind_the_gap', 'mind.the.gap'),
)
DAY_KEYS = {k: k for k, *_ in DAYS} | {name: k for k, name, *_ in DAYS}

# The steps Krish ticks: key, label, the engine's channel (making.py posted), counts toward 100%.
# The keys are the published board's: a tick is saved under <day>-<key>, so changing a key orphans the
# ticks saved under it. A label may change (the two Record labels did on 2026-10-12, when Descript was
# retired): a saved tick counts by its id and piece, never its label.
STEPS = (
    ('record-long', 'Record the 3-minute cut (Teleprompter)', None, True),
    ('record-short', 'Record the 90-second cut (Teleprompter)', None, True),
    ('substack', 'Substack: video post with the article', 'substack', True),
    ('youtube', 'YouTube: the 3-minute video', 'youtube', True),
    ('shorts', 'YouTube Shorts', 'shorts', True),
    ('tiktok', 'TikTok', 'tiktok', True),
    ('reels', 'Instagram Reels', 'reels', True),
    ('linkedin', 'LinkedIn', 'linkedin', False),
    # WhatsApp and Substack Notes dropped 2026-10-14 (Krish: "I don't think I need Substack notes or WhatsApp").
    ('spotify', 'Spotify: the video episode, its clip and chapters', 'spotify', False),
)
LABEL = {k: label for k, label, *_ in STEPS}
# The week's deep cut (house rule DEEP_CUT, config/deep-cuts.json) is recorded in place of the 3-minute cut,
# so its day's two long-cut steps say so (15 October: Friday's checklist said "3-minute" for an 11-minute cut).
DEEP_LABEL = {'record-long': 'Record the deep cut, 8 to 12 minutes (Teleprompter)', 'youtube': 'YouTube: the deep cut'}
DEEP_CUTS = Path(__file__).resolve().parents[2] / 'config' / 'deep-cuts.json'


def deep_cut_piece(monday, path=DEEP_CUTS):
    """The piece that has the week's deep cut, or None."""
    try:
        week = (json.loads(Path(path).read_text(encoding='utf-8')).get('weeks') or {}).get(monday.isoformat()) or {}
    except (OSError, ValueError):
        return None
    return week.get('piece') if isinstance(week, dict) else None
STANDING = sum(1 for *_, s in STEPS if s)
# A channel section of the day page, by its heading (publish_kit.steps "where"), and the step it ticks.
SECTION_STEP = {
    'Substack': 'substack', 'YouTube (the 5-minute video)': 'youtube', 'YouTube Shorts': 'shorts',
    'TikTok': 'tiktok', 'Instagram Reels': 'reels', 'LinkedIn': 'linkedin', 'Spotify': 'spotify',
}
# The two cuts (house rule TWO_CUTS): the cut, its tick, its name, how it is filmed.
CUTS = (
    ('long', 'record-long', '3-minute cut', 'Wide shot, 16:9'),
    ('short', 'record-short', '90-second cut', 'Sit in the centre, cut tall 9:16'),
)
# What the day page's buttons do; the board's script handles these and only these.
KNOWN_ACTS = {'text', 'article', 'image', 'download', 'done'}

# ------------------------------------------------------------------ the fixed layout
# Krish, 2026-10-21: "how do you recommend we standardise and lock in this publish board so the content engine can
# just feed it? ... For each publish session things move around." From layout_from on, every week is drawn from
# config/board-layout.json: five tabs (Ideas, Queue, Monday, Wednesday, Friday), and in each day the same four steps
# (Brief, Drafts, Record, Publish), each with its own slots. A session feeds the slots; it never adds a section, moves
# one or brings its own styles, and verify() refuses a board that does. Weeks before layout_from keep the layout they
# were published in, so a rebuild of one changes nothing he has seen.
LAYOUT_FILE = Path(__file__).resolve().parents[2] / 'config' / 'board-layout.json'
FEATURES_FILE = Path(__file__).resolve().parents[2] / 'config' / 'features.json'
TOP_TABS = ('ideas', 'queue', 'monday', 'wednesday', 'friday')
DAY_TABS = TOP_TABS[2:]
# Layout v3 (from the week of 9 November 2026, W2.1) adds the Archive: every piece since the Launch, with his scores.
ARCHIVE_TAB = 'archive'
TODAY_TAB = 'today'  # layout A's first tab, from today.from (board_today.py)
DAY_STEPS = ('brief', 'drafts', 'record', 'publish')


def load_layout(path=LAYOUT_FILE):
    """config/board-layout.json, checked: the tabs and the day's steps in their one order, the cuts, and every
    publish step with a key the saved ticks already use."""
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise BoardError(f'{path}: the board layout cannot be read ({error})')
    tabs = tuple(t.get('key') for t in data.get('tabs') or [])
    steps = tuple(s.get('key') for s in data.get('day_steps') or [])
    if tabs != TOP_TABS or steps != DAY_STEPS:
        raise BoardError(f'{path}: the tabs must be {TOP_TABS} and the day steps {DAY_STEPS}, in that order')
    keys = [s.get('key') for s in (data.get('publish_steps') or {}).get('steps') or []]
    for need in ('record-long', 'record-short', 'substack', 'youtube', 'shorts', 'tiktok', 'reels'):
        if need not in keys:
            raise BoardError(f'{path}: the publish step {need} is missing; its saved ticks would be orphaned')
    for cut in ('long', 'short', 'feature'):
        if not isinstance((data.get('cuts') or {}).get(cut), dict):
            raise BoardError(f'{path}: no {cut} cut')
    date.fromisoformat(data['layout_from'])
    v3 = data.get('v3')
    if v3 is not None:
        try:
            v3_from = date.fromisoformat(v3['from'])
        except (KeyError, TypeError, ValueError):
            raise BoardError(f'{path}: v3 needs from, the Monday its boards start')
        rhythm = v3.get('rhythm') or {}
        if (v3_from.weekday() != 0 or v3_from <= date.fromisoformat(data['layout_from'])
                or tuple(t.get('key') for t in v3.get('add_tabs') or []) != (ARCHIVE_TAB,)
                or rhythm.get('rule') != 'recording_sunday'
                or any((rhythm.get(k) or {}).get('on') != 'recording_sunday' for k in ('brief', 'drafts'))):
            raise BoardError(f'{path}: v3 starts on a Monday after layout_from, adds the {ARCHIVE_TAB} tab alone and keeps the '
                             'recording_sunday rhythm for the brief and the drafts')
    return data


LAYOUT = load_layout()
LAYOUT_FROM = date.fromisoformat(LAYOUT['layout_from'])
V3 = LAYOUT.get('v3') or {}
TODAY = LAYOUT.get('today') or {}
TODAY_FROM = date.fromisoformat(TODAY['from']) if TODAY else None
TODAY_ON = False  # whether the board being built opens on Today; set by use_layout()
V3_FROM = date.fromisoformat(V3['from']) if V3 else None
FIXED = False  # whether the board being built is in the fixed layout; set by use_layout()
# The tabs, the steps' rhythm and the layout version of the board being built; set by use_layout(). Version 2 from
# layout_from, version 3 from v3.from (the Archive, the Scores press and the recording_sunday rhythm).
TABS, RHYTHM, VERSION = TOP_TABS, LAYOUT['rhythm'], 2
FEATURE_ONLY = set()
LEGACY_LAYOUT = {'STEPS': STEPS, 'SECTION_STEP': SECTION_STEP, 'CUTS': CUTS,
                 'DROPPED_CHANNELS': {'whatsapp': 'WhatsApp', 'notes': 'Substack Notes'}}


def fixed_layout(monday):
    return monday >= LAYOUT_FROM


def use_layout(monday):
    """Point the module's step and cut tables at the layout of this week: the fixed one from layout_from, else the
    one the week was published in. Every function below reads them, so one switch keeps a week in one layout."""
    global STEPS, LABEL, STANDING, SECTION_STEP, CUTS, FIXED, FEATURE_ONLY, DROPPED_CHANNELS, TABS, RHYTHM, VERSION, TODAY_ON
    FIXED = fixed_layout(monday)
    TODAY_ON = FIXED and bool(TODAY_FROM) and monday >= TODAY_FROM
    v3 = bool(V3_FROM) and monday >= V3_FROM
    TABS = ((TODAY_TAB,) if TODAY_ON else ()) + TOP_TABS + ((ARCHIVE_TAB,) if v3 else ())
    RHYTHM = V3['rhythm'] if v3 else LAYOUT['rhythm']
    VERSION = V3['version'] if v3 else 2
    if FIXED:
        ps = LAYOUT['publish_steps']
        STEPS = tuple((s['key'], s['label'], s.get('channel'), bool(s.get('counted'))) for s in ps['steps'])
        FEATURE_ONLY = {s['key'] for s in ps['steps'] if s.get('feature_only')}
        SECTION_STEP = dict(ps['sections'])
        DROPPED_CHANNELS = dict(ps['dropped_channels'])
        cuts = LAYOUT['cuts']
        CUTS = (('long', 'record-long', cuts['long']['short_name'], cuts['long']['shape']),
                ('short', 'record-short', cuts['short']['short_name'], cuts['short']['shape']),
                ('feature', 'record-feature', cuts['feature']['short_name'], cuts['feature']['shape']))
    else:
        STEPS, SECTION_STEP, CUTS = LEGACY_LAYOUT['STEPS'], LEGACY_LAYOUT['SECTION_STEP'], LEGACY_LAYOUT['CUTS']
        DROPPED_CHANNELS = dict(LEGACY_LAYOUT['DROPPED_CHANNELS'])
        FEATURE_ONLY = set()
    LABEL = {k: label for k, label, *_ in STEPS}
    STANDING = sum(1 for *_, s in STEPS if s)


def feature_piece(piece_id, path=None):
    """True when Krish called a 15-minute feature for this piece (config/features.json). Krish, 2026-10-21: "From
    time to time I might do a special 15 min feature"; it replaced the weekly deep cut ("Yes, replace it")."""
    if not piece_id:
        return False
    try:
        data = json.loads(Path(path or FEATURES_FILE).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return False
    return isinstance((data.get('pieces') or {}).get(piece_id), dict)

E = html.escape


class BoardError(Exception):
    pass


# ------------------------------------------------------------------ templates

MARKER = re.compile(r'\{\{([A-Z_]+)\}\}')


def template(name):
    return (TEMPLATES / name).read_text(encoding='utf-8')


def fill(text, values, name):
    """Every {{MARKER}} in the template replaced once, in one pass, so text
    put in is never read as a marker. A marker with no value, or a value
    with no marker, is a mistake in this file."""
    found = set(MARKER.findall(text))
    if found != set(values):
        raise BoardError(f'{name}: markers {sorted(found)} do not match the values {sorted(values)}')
    return MARKER.sub(lambda m: values[m.group(1)], text)


def script(conf):
    js = template('week.js')
    if js.count('__WEEK_BOARD_CONF__') != 1:
        raise BoardError('week.js must hold __WEEK_BOARD_CONF__ once')
    # "<" escaped, so no title can close the script element.
    return js.replace('__WEEK_BOARD_CONF__', json.dumps(conf, ensure_ascii=False).replace('<', '\\u003c'))


# ------------------------------------------------------------------ dates

def monday_of(text):
    try:
        d = date.fromisoformat(str(text))
    except ValueError:
        raise BoardError(f'--week must be a date, YYYY-MM-DD, not {text!r}')
    if d.weekday() != 0:
        raise BoardError(f'--week must be the Monday the week starts on; {d.isoformat()} is a {d.strftime("%A")}')
    return d


def short_date(d):
    return f'{d.strftime("%a")} {d.day} {d.strftime("%b")}'


def week_span(monday):
    """'12 to 16 October 2026', '28 September to 2 October 2026', or across
    a year, '29 December 2025 to 2 January 2026'."""
    friday = monday + timedelta(days=4)
    if monday.year != friday.year:
        return f'{monday.day} {monday.strftime("%B %Y")} to {friday.day} {friday.strftime("%B %Y")}'
    if monday.month != friday.month:
        return f'{monday.day} {monday.strftime("%B")} to {friday.day} {friday.strftime("%B %Y")}'
    return f'{monday.day} to {friday.day} {friday.strftime("%B %Y")}'


# ------------------------------------------------------------------ the day page

ID_ATTR = re.compile(r'(\s)(id|for|data-ref)="([^"]+)"')
IDREF_ATTR = re.compile(r'(\s)(aria-labelledby|aria-controls|aria-describedby)="([^"]+)"')
HREF = re.compile(r'(\s)href="#([^"]+)"')


def board_title(monday):
    """Krish, 2026-10-18: "This Week's Publish Board (wC 19 Oct)", the week it is for in its name."""
    return f'{TITLE} (wC {monday.day} {monday.strftime("%b")})'


def prefix(markup, p):
    """Every id in a day page and every reference to one carries the day's
    prefix, so two days' pages share one document without a clash."""
    markup = ID_ATTR.sub(lambda m: f'{m[1]}{m[2]}="{p}{m[3]}"', markup)
    markup = IDREF_ATTR.sub(lambda m: f'{m[1]}{m[2]}="{" ".join(p + x for x in m[3].split())}"', markup)
    return HREF.sub(lambda m: f'{m[1]}href="#{p}{m[2]}"', markup)


def attr(attrs, name):
    m = re.search(rf'\s{re.escape(name)}="([^"]*)"', attrs)
    return html.unescape(m.group(1)) if m else None


def parse_day_page(text, where):
    """The parts of a publish_manager.py page the board uses: its styles, its
    main's attributes and body, its title and its scripts section."""
    if text.count('<main id="pm"') != 1:
        raise BoardError(f'{where}: not a publish page from publish_manager.py (it needs one <main id="pm">)')
    m = re.search(r'<main id="pm"([^>]*)>(.*?)</main>', text, re.S)
    if not m:
        raise BoardError(f'{where}: its <main id="pm"> is never closed')
    css = re.search(r'<style>\s*(:root\{--bg.*?)</style>', text, re.S)
    if not css:
        raise BoardError(f'{where}: no publish page styles (a <style> starting :root{{--bg)')
    body = m.group(2)
    acts = set(re.findall(r'data-act="([^"]+)"', body))
    if acts - KNOWN_ACTS:
        raise BoardError(f'{where}: buttons this board does not know how to run: {sorted(acts - KNOWN_ACTS)}; '
                         'teach week_board/week.js first')
    h1 = re.search(r'<h1>(.*?)</h1>', body, re.S)
    piece = attr(m.group(1), 'data-piece')
    # The page's words and its pictures' roles, as data (publish_manager.page_data): the run-sheet is built from them.
    words, images = None, []
    block = PM_DATA.search(text)
    if block:
        try:
            data = json.loads(block.group(1))
        except ValueError as error:
            raise BoardError(f'{where}: its words (pm-data) cannot be read ({error})')
        if isinstance(data, dict) and isinstance(data.get('words'), dict):
            words = data['words']
            images = [i for i in data.get('images') or [] if isinstance(i, dict) and i.get('id')]
    return {'css': css.group(1).strip(), 'post': attr(m.group(1), 'data-post') or '', 'body': body,
            'title': html.unescape(re.sub(r'<[^>]+>', '', h1.group(1))).strip() if h1 else '',
            'piece': piece if piece and UUID.match(piece) else None, 'words': words, 'images': images}


def tick_box(tid, label):
    return (f'<input type="checkbox" data-tick="{tid}" aria-label="{E(label)}" disabled>'
            '<span class="box" aria-hidden="true"></span>')


TICK_TAIL = '<span class="t-when"></span><span class="t-err" aria-live="polite"></span>'


def row_tick(day, key, deep=False):
    # deep: the week's deep cut in a week before the fixed layout; in the fixed layout, a 15-minute feature piece,
    # whose own steps carry their own labels.
    label = DEEP_LABEL.get(key, LABEL[key]) if deep and not FIXED else LABEL[key]
    return (f'<label class="tick row-tick">{tick_box(f"{day}-{key}", label)}'
            f'<span class="t-label">{E(label)}</span>{TICK_TAIL}</label>')


def section_tick(day, key):
    return (f'<label class="tick sec-tick">{tick_box(f"{day}-{key}", LABEL[key])}'
            f'<span class="t-hint">Tick when done</span>{TICK_TAIL}</label>')


def checklist(day, p, deep=False):
    shown = [(k, s) for k, _, _, s in STEPS if k not in FEATURE_ONLY or deep]
    standing = ''.join(row_tick(day, k, deep) for k, s in shown if s)
    optional = ''.join(row_tick(day, k, deep) for k, s in shown if not s)
    n = STANDING
    return (f'<div class="ticks" id="{p}ticks" role="region" aria-labelledby="{p}ticks-h">'
            f'<div class="ticks-head"><h2 id="{p}ticks-h">Publish checklist</h2>'
            f'<span class="ticks-count" data-count="{day}">{n} steps</span></div>'
            f'<div class="meter" aria-hidden="true"><span data-meter="{day}"></span></div>'
            f'<p class="tick-note" data-note="{day}">Loading saved ticks.</p>'
            f'<div class="tick-list">{standing}</div>'
            '<div class="lab opt-h">When you want them, not counted toward 100%</div>'
            f'<div class="tick-list">{optional}</div></div>')


INBOX = 'makeyourmindup > Video Engine > Inbox'

DRIVE_ID = re.compile(r'drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=download&)?id=)([A-Za-z0-9_-]{20,})')
VIDEO_CUTS = (('long', 'Long video (wide, 16:9)', 'YouTube, Substack and Spotify'),
              ('short', '90-second video (tall, 9:16)', 'Shorts, Reels, TikTok and LinkedIn'))


def video_cuts(feature=False):
    """(cut, label, where it goes) for each finished video: the fixed layout's cuts from config/board-layout.json,
    with the feature only on a feature piece; before it, the cuts the week was published with."""
    if not FIXED:
        return VIDEO_CUTS
    c = LAYOUT['cuts']
    rows = [('long', f'{c["long"]["name"]} (wide, 16:9)', c['long']['for']),
            ('short', f'{c["short"]["name"]} (tall, 9:16)', c['short']['for'])]
    if feature:
        rows.append(('feature', f'{c["feature"]["name"]} (wide, 16:9)', c['feature']['for']))
    return tuple(rows)


def videos_card(day, p, videos, deep=False):
    """The finished videos at the top of a made day: each cut's Drive file,
    to open, to download straight to the computer, and its link to copy.
    Krish, 2026-10-14: "You should always link the Google Drive videos
    because I need to actually download them onto my computer and then
    upload them into Substack or YouTube". videos: the making record's
    video_assets; a video's "url" is its Drive link once it is in Drive."""
    by_cut = {}
    for v in videos or []:
        if isinstance(v, dict) and v.get('cut') in ('long', 'short', 'feature'):
            by_cut[v['cut']] = v
    if not by_cut:
        return ''
    rows = []
    for cut, label, where in video_cuts(deep):
        if deep and cut == 'long' and not FIXED:
            label = 'deep cut, 8 minutes or more (wide, 16:9)'
        v = by_cut.get(cut)
        if not v:
            rows.append(f'<div class="rec-row"><span class="rec-cut"><span class="rec-name">{E(label)}</span></span>'
                        '<div class="rec-links"><span class="rec-none">Not made yet</span></div></div>')
            continue
        secs = v.get('seconds')
        length = f'{int(secs) // 60} min {int(secs) % 60:02d} s' if isinstance(secs, (int, float)) and secs else ''
        m = DRIVE_ID.search(str(v.get('url') or ''))
        if m:
            fid = m.group(1)
            view = f'https://drive.google.com/file/d/{fid}/view'
            down = f'https://drive.usercontent.google.com/download?id={fid}&export=download'
            cid = f'{p}video-{cut}'
            links = (f'<a class="btnlink" href="{E(down)}" target="_blank" rel="noopener">Download</a> '
                     f'<a class="btnlink ghost" href="{E(view)}" target="_blank" rel="noopener">Open in Drive</a>'
                     f'<div class="btns"><button data-act="text" data-ref="{cid}">Copy link</button></div>'
                     f'<pre class="txt" id="{cid}" data-raw="{E(view)}">{E(view)}</pre><div class="status" aria-live="polite"></div>')
        else:
            links = (f'<span class="rec-none">Not in Drive yet: it is in the post\'s folder as {E(v.get("name") or "")}, '
                     'and its link joins this card once Library Sync has written it</span>')
        # Its thumbnail, beside it: Krish, 2026-10-12: "I always want a video thumbnail for all video sizes produced
        # as an asset every time"; 2026-10-14: "I do not see any video thumbnail assets anywhere".
        thumb = v.get('thumbnail') if isinstance(v.get('thumbnail'), dict) else {}
        tm = DRIVE_ID.search(str(thumb.get('url') or ''))
        if tm:
            tid = tm.group(1)
            links += (f'<div class="vid-thumb"><span class="rec-shape">Thumbnail</span> '
                      f'<a class="btnlink" href="{E(f"https://drive.usercontent.google.com/download?id={tid}&export=download")}" target="_blank" rel="noopener">Download thumbnail</a> '
                      f'<a class="btnlink ghost" href="{E(f"https://drive.google.com/file/d/{tid}/view")}" target="_blank" rel="noopener">Open thumbnail</a></div>')
        elif thumb.get('path'):
            links += f'<div class="vid-thumb"><span class="rec-none">Thumbnail: in the same folder as {E(Path(thumb["path"]).name)}; its link joins this card once recorded</span></div>'
        rows.append(f'<div class="rec-row vid-row"><span class="rec-cut"><span class="rec-name">{E(label)}</span>'
                    f'<span class="rec-shape">For {E(where)}{". " + E(length) if length else ""}</span></span>'
                    f'<div class="rec-links">{links}</div></div>')
    return (f'<div class="rec" id="{p}videos" role="region" aria-labelledby="{p}videos-h"><div class="rec-head">'
            f'<h2 id="{p}videos-h">Finished videos</h2><span class="kick">In Drive, 3 Video</span></div>'
            + ''.join(rows) + '<p class="rec-how">Download each to your computer, then upload it where its line says.</p></div>')


def record_card(day, p, scripts, feature=False):
    """The Record card: each cut's script in Teleprompter (its title, and
    whether it holds the current words), the folder, and the one way a take
    comes back. scripts is teleprompter_info's answer, or {}."""
    rows, any_script = [], False
    cuts = scripts.get('cuts') or {}
    for cut, key, name, shape in CUTS:
        if cut == 'feature' and not feature:
            continue
        got = cuts.get(cut) or {}
        if got.get('title'):
            any_script = True
            older = {'older': ' (it holds older words; the next session updates it)',
                     'failed': ' (the last send failed; the next session sends it again)'}.get(got.get('state'), '')
            where = f'<span class="rec-tp">Read from Teleprompter: {E(got["title"])}{E(older)}</span>'
        else:
            where = '<span class="rec-none">Not in Teleprompter yet</span>'
        rows.append(
            f'<div class="rec-row"><label class="tick rec-tick">{tick_box(f"{day}-{key}", LABEL[key])}'
            f'<span class="rec-cut"><span class="rec-name">{name}</span><span class="rec-shape">{shape}</span></span>'
            f'{TICK_TAIL}</label><div class="rec-links">{where}</div></div>')
    back = (f'Then drop each take at the top of the Video Engine Inbox in Drive ({INBOX}), any name, never in a subfolder: '
            'the home computers send it and place it on its piece and cut by themselves, within about fifteen minutes.')
    if any_script:
        folder = scripts.get('folder_name')
        how = ('Open teleprompter.com on your phone or laptop' + (f', folder "{folder}"' if folder else '')
               + f', and read each cut from its own script. The {CUTS[0][2]} is a wide shot; for the {CUTS[1][2]} sit in the centre, '
               'as it is cut tall. ' + back)
    else:
        how = (f'These scripts are not in Teleprompter yet. Copy one just below into your teleprompter and record. The {CUTS[0][2]} is '
               f'a wide shot; for the {CUTS[1][2]} sit in the centre, as it is cut tall. ' + back)
    return (f'<div class="rec" id="{p}record" role="region" aria-labelledby="{p}record-h"><div class="rec-head">'
            f'<h2 id="{p}record-h">Record</h2><span class="kick">{"Three cuts" if feature and FIXED else "Two cuts"}</span></div>'
            + ''.join(rows) + f'<p class="rec-how">{E(how)}</p></div>')


# ------------------------------------------------------------------ his decisions on a day's tab (the fixed layout)
# Approve scripts (Drafts), Titles (Record), and Approve for publish and Reject asset (Publish): each saved at once in
# picks/<day>-<decision> by his press alone (api/board/_contracts.ts hisOnlyRefusal), never by a session.
TP_CONFIG = Path(__file__).resolve().parents[2] / 'config' / 'teleprompter.json'


def tp_cut_name(cut):
    """A cut's name in Teleprompter (config/teleprompter.json cuts): "5-minute", "90-second", "15-minute feature"."""
    try:
        name = ((json.loads(TP_CONFIG.read_text(encoding='utf-8')).get('cuts') or {}).get(cut) or {}).get('name')
    except (OSError, ValueError):
        name = None
    return name or {'long': '5-minute', 'short': '90-second', 'feature': '15-minute feature'}[cut]


def subject_line(text, most=60):
    """A short subject for the Teleprompter folder and script names: one line, cut on a word at most characters."""
    words, out = ' '.join(str(text or '').split()), ''
    for w in words.split(' '):
        if len(out) + len(w) + (1 if out else 0) > most:
            break
        out = f'{out} {w}' if out else w
    return out.rstrip('.,;:') or words[:most]


def tp_names(piece, when, series_label, subject, cuts):
    """(folder, {cut: title}, subject): the names teleprompter_send.py gives the piece's folder and scripts, so the
    server's send and a session's send look for the same folder and never make a second one (Krish's terms of
    2026-10-12: "One script per cut, in a folder per piece"). They come from the piece's post.json in docs/plans when
    there is one, as the session reads it; until then from the day on the board, its series and the board's subject.
    (None, {}, '') when nothing names the subject."""
    import teleprompter_send as tps  # noqa: E402  its names, never a second copy of how they are made
    try:
        post = tps.find_post(piece) if piece else None
        from_post = tps.names_from_post(json.loads(post.read_text(encoding='utf-8-sig'))) if post else None
    except (OSError, ValueError, tps.TeleprompterError):
        from_post = None  # a post.json the session could not name the piece from either
    cfg = {'cuts': {c: {'name': tp_cut_name(c)} for c in cuts}}
    for names in (from_post, {'day': short_date(when), 'series': series_label, 'subject': subject_line(subject)}):
        if not names or not names.get('subject'):
            continue
        try:
            return tps.folder_name(names), {c: tps.script_title(names, c, cfg) for c in cuts}, names['subject']
        except tps.TeleprompterError:
            continue
    return None, {}, ''


def script_cuts(items, feature):
    """({cut: review slug}, {cuts named twice}) for the scripts among a day's drafts, by their labels as edit_sweep.py
    reads them (story_check.cut_of; a deep cut is the long one). An article or an outline is no script."""
    found, twice = {}, set()
    for slug, label, _ in items or []:
        cut = story_check.cut_of(label)
        if cut not in ('long', 'short', 'feature', 'deep') or not ('script' in label.lower() or cut in ('deep', 'feature')):
            continue
        cut = 'long' if cut == 'deep' else cut
        if cut == 'feature' and not feature:
            continue
        if cut in found:
            twice.add(cut)
        found[cut] = slug
    return found, twice


def approve_card(day, p, weekday, items, piece, tp, when, series_label, subject, feature, warnings):
    """Approve scripts, under the drafts: his press records the exact words of each script as the Drafts step shows
    them (his saved edits included), and the server sends them to Teleprompter once the scripts' check passed on those
    words and two fresh readers heard them, else holds them for a session (Krish, 2026-10-28: "Once I approve, the
    two scripts will go to teleprompter"; "Server sends directly"). Each cut's draft, and the names it goes under in
    Teleprompter (tp_names), ride on the card."""
    cuts, twice = script_cuts(items, feature)
    if twice:
        warnings.append(f'{weekday}: two drafts read as the {" and ".join(sorted(twice))} script; Approve scripts is left out '
                        'until each script\'s label names its cut once')
        return ''
    if not cuts or not piece:
        return ''
    order = [c for c in ('long', 'short', 'feature') if c in cuts]
    named, titles, subj = tp_names(piece, when, series_label, subject, order)
    if not subj:
        warnings.append(f'{weekday}: nothing names the piece\'s subject, so Approve scripts is left out; give --pending {day}="<title>"')
        return ''
    held = (tp or {}).get('cuts') or {}
    folder = (tp or {}).get('folder_name') or named
    attrs = ''.join(
        f' data-box-{c}="{E(f"{day}-{cuts[c]}")}" data-title-{c}="{E((held.get(c) or {}).get("title") or titles[c])}"'
        + (f' data-script-id-{c}="{E(held[c]["script_id"])}"' if (held.get(c) or {}).get('script_id') else '') for c in order)
    names = ' and the '.join(tp_cut_name(c) for c in order)
    return (f'<div class="rec ap" id="{p}approve" role="region" aria-labelledby="{p}approve-h" data-approve-day="{day}" '
            f'data-piece="{E(piece)}" data-cuts="{" ".join(order)}" data-folder-title="{E(folder)}"'
            + (f' data-folder-id="{E(tp["folder_id"])}"' if (tp or {}).get('folder_id') else '') + attrs + '>'
            f'<div class="rec-head"><h2 id="{p}approve-h">Approve scripts</h2></div>'
            f'<p class="rec-how">Approving sends the {E(names)} script{"s" if len(order) > 1 else ""} above, as they stand, '
            'to Teleprompter. Words changed since the scripts check are checked first.</p>'
            f'<button type="button" class="btn-s" data-act="approve-scripts" data-day="{day}" disabled>Approve scripts</button>'
            f'<p class="tri-state" data-approvestate="{day}" aria-live="polite"></p></div>')


# The Titles press (Krish, 2026-10-28: "Sunday evening press"): three options a surface, best first, from --titles.
TITLE_SURFACES = (('long_title', 'long', 'title'), ('short_title', 'short', 'title'),
                  ('long_thumbnail', 'long', 'thumbnail'), ('short_thumbnail', 'short', 'thumbnail'))


def read_titles(data, where='--titles'):
    """{'piece_id', 'surfaces': {surface: [option]}}: 1 to 5 options a surface, best first, each a line of up to 300
    characters, from {"piece_id"?, "long_title": [...], "short_title": [...], "long_thumbnail": [...],
    "short_thumbnail": [...]} (an option may be {"text": ...})."""
    if not isinstance(data, dict):
        raise BoardError(f'{where}: give {{"long_title": [options], "short_title": [...], "long_thumbnail": [...], "short_thumbnail": [...]}}')
    known = {k for k, *_ in TITLE_SURFACES}
    problems = [f'{k} is not a surface ({", ".join(sorted(known))})' for k in data if k not in known | {'piece_id'}]
    if data.get('piece_id') is not None and not UUID.match(str(data['piece_id'])):
        problems.append('piece_id is the content_ideas uuid')
    out = {}
    for key, *_ in TITLE_SURFACES:
        opts = data.get(key)
        if opts is None:
            continue
        lines = [' '.join(str(o.get('text') if isinstance(o, dict) else o or '').split()) for o in opts] if isinstance(opts, list) else []
        if not 1 <= len(lines) <= 5 or not all(0 < len(t) <= 300 for t in lines) or len(set(lines)) != len(lines):
            problems.append(f'{key}: give 1 to 5 different options, each one line of up to 300 characters')
            continue
        out[key] = lines
    if not out and not problems:
        problems.append('no surface has options')
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return {'piece_id': data.get('piece_id'), 'surfaces': out}


def titles_card(day, p, piece, titles):
    """Titles, on the Record step: his pick on each surface, saved with one press, or one plain line until the options
    are there."""
    head = (f'<div class="rec tt" id="{p}titles" role="region" aria-labelledby="{p}titles-h" data-titles-day="{day}"'
            + (f' data-piece="{E(piece)}"' if piece else '') + f'><div class="rec-head"><h2 id="{p}titles-h">Titles</h2></div>')
    if not titles or not titles.get('surfaces'):
        return head + '<p class="rec-how">The title options are not here yet. They come once your takes are in.</p></div>'
    cuts = LAYOUT['cuts']
    sets = []
    for key, cut, what in TITLE_SURFACES:
        opts = titles['surfaces'].get(key)
        if not opts:
            continue
        sets.append(f'<fieldset class="tt-set" data-surface="{key}"><legend>{E(cuts[cut]["name"][0].upper() + cuts[cut]["name"][1:])} {what}</legend>'
                    + ''.join(f'<label class="pick"><input type="radio" name="{p}tt-{key}" value="{E(t)}" data-title-surface="{key}" '
                              f'data-titles-for="{day}" disabled><span class="box" aria-hidden="true"></span><span class="t-label">{E(t)}</span></label>'
                              for t in opts) + '</fieldset>')
    return (head + ''.join(sets)
            + f'<button type="button" class="btn-s" data-act="save-titles" data-day="{day}" disabled>Save titles</button>'
            f'<p class="tri-state" data-titlesstate="{day}" aria-live="polite"></p></div>')


def signoff_card(day, p, piece, manifest_sha=None):
    """Approve for publish, on a made day's Publish step after Download first (Krish, 2026-10-28: "Approve each day
    Monday"). Data only in Wave 1: the day, the piece, and the hash of its manifest when the build has one."""
    return (f'<div class="rec so" id="{p}signoff" role="region" aria-labelledby="{p}signoff-h" data-signoff-day="{day}" '
            f'data-piece="{E(piece or "")}"' + (f' data-manifest-sha256="{manifest_sha}"' if manifest_sha else '') + '>'
            f'<div class="rec-head"><h2 id="{p}signoff-h">Approve for publish</h2></div>'
            '<p class="rec-how">Watch each cut at full size first. To send a file back, press Reject beside it above and say why.</p>'
            f'<button type="button" class="btn-s" data-act="approve-publish" data-day="{day}" disabled>Approve for publish</button>'
            f'<p class="tri-state" data-signoffstate="{day}" aria-live="polite"></p></div>')


SCORE_BASES = (('at_publish', 'At publish'), ('hindsight', 'Looking back'))


def scores_card(p, piece, basis='at_publish', shown=None):
    """His Scores press (layout v3, W2.1; Krish, 2026-10-29: "allow me to add a score out of 10 for narrative quality and
    production quality"): narrative and production out of 10, when he scored it, and his note, saved as
    picks/score-<piece>; the server files each save as a piece_scores row. Only his scores count."""
    marks = ''.join(f'<option value="{n}">{n}</option>' for n in range(1, 11))
    sel = lambda key, label, opts: (f'<label class="sc-field"><span>{label}</span><select data-score="{key}" disabled>{opts}</select></label>')
    bases = ''.join(f'<option value="{k}"{" selected" if k == basis else ""}>{t}</option>' for k, t in SCORE_BASES)
    return (f'<div class="rec sc" id="{p}scores" role="region" aria-labelledby="{p}scores-h" data-scores-piece="{E(piece)}" '
            f'data-scores-basis="{basis}"><div class="rec-head"><h2 id="{p}scores-h">Your scores</h2></div>'
            '<p class="rec-how">Out of 10: how strong the story is, and how well it was made. Only your scores count.</p>'
            + (f'<p class="sc-now">{E(shown)}</p>' if shown else '')
            + sel('narrative', 'Narrative', '<option value="">Pick</option>' + marks)
            + sel('production', 'Production', '<option value="">Pick</option>' + marks)
            + sel('basis', 'When', bases)
            + '<label class="sc-field sc-note"><span>Note (optional)</span><input type="text" data-score="note" maxlength="4000" disabled></label>'
            f'<button type="button" class="btn-s" data-act="save-scores" data-for="{p}scores" disabled>Save scores</button>'
            f'<p class="tri-state" data-scoresstate="{p}scores" aria-live="polite"></p></div>')


SERIES_LABEL = {'follow_the_money': 'follow.the.money', 'under_the_hood': 'under.the.hood', 'mind_the_gap': 'mind.the.gap'}


def read_archive(data, where='--archive'):
    """[row]: every piece from the Launch on, newest first, from GET /api/board/<Monday>/archive (board_feed.py archive):
    {"rows": [{"piece_id", "date", "series", "title", "links": [{"label", "url"}], "scores": {"at_publish"?,
    "hindsight"?: {"narrative", "production", "note", "scored_at"}}}]}. A row may have no piece_id (a post the record does
    not hold yet), and then it has no Scores press."""
    rows = data.get('rows') if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise BoardError(f'{where}: give {{"rows": [...]}} from GET /api/board/<Monday>/archive')
    out, problems = [], []
    for n, r in enumerate(rows, 1):
        if not isinstance(r, dict):
            problems.append(f'row {n} is not an object')
            continue
        piece = r.get('piece_id')
        try:
            day = date.fromisoformat(str(r.get('date')))
        except ValueError:
            problems.append(f'row {n}: date is YYYY-MM-DD')
            continue
        title = ' '.join(str(r.get('title') or '').split())
        links = [x for x in r.get('links') or [] if isinstance(x, dict) and str(x.get('url', '')).startswith('https://') and x.get('label')]
        if piece is not None and not UUID.match(str(piece)):
            problems.append(f'row {n}: piece_id is the content_ideas uuid or null')
        if not title or len(title) > 300:
            problems.append(f'row {n}: a title of up to 300 characters')
        if r.get('series') is not None and r['series'] not in SERIES_LABEL:
            problems.append(f'row {n}: series is one of {", ".join(SERIES_LABEL)} or null')
        scores = {}
        for basis, _ in SCORE_BASES:
            sc = (r.get('scores') or {}).get(basis)
            if sc is None:
                continue
            if not all(isinstance(sc.get(k), int) and 1 <= sc[k] <= 10 for k in ('narrative', 'production')):
                problems.append(f'row {n}: {basis} scores are whole numbers from 1 to 10')
                continue
            scores[basis] = {'narrative': sc['narrative'], 'production': sc['production'], 'note': sc.get('note'), 'scored_at': sc.get('scored_at')}
        out.append({'piece_id': piece, 'date': day, 'series': r.get('series'), 'title': title, 'links': links, 'scores': scores})
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return sorted(out, key=lambda r: (r['date'], r['piece_id'] or ''), reverse=True)


def score_line(scores):
    """His latest scores in one line: looking back first, else at publish."""
    for basis, label in (('hindsight', 'looking back'), ('at_publish', 'at publish')):
        sc = scores.get(basis)
        if sc:
            return f'Narrative {sc["narrative"]}/10, production {sc["production"]}/10, {label}'
    return 'Not scored yet'


def archive_panel(rows, hidden):
    """The Archive tab (layout v3, W2.1): every piece from the Launch on 6 October, newest first, each with its date,
    series, title, live links, his two scores and the Scores press."""
    items = []
    for n, r in enumerate(rows or [], 1):
        p = f'ar{n}-'
        links = ''.join(f'<a class="btnlink" href="{E(x["url"])}" target="_blank" rel="noopener">{E(x["label"])}</a>' for x in r['links'])
        piece = r['piece_id']
        items.append(f'<li class="ar-row" id="{p}row"' + (f' data-piece="{E(piece)}"' if piece else '') + '>'
                     f'<p class="ar-meta">{E(short_date(r["date"]))}' + (f' · {E(SERIES_LABEL[r["series"]])}' if r['series'] else '') + '</p>'
                     f'<h2 class="ar-title">{E(r["title"])}</h2>'
                     + (f'<p class="ar-links">{links}</p>' if links else '<p class="ar-links">No live link on the record yet.</p>')
                     + f'<p class="ar-scores">{E(score_line(r["scores"]))}</p>'
                     + (scores_card(p, piece, 'hindsight') if piece else '<p class="rec-how">Scores open once this piece is on the record.</p>')
                     + '</li>')
    body = (f'<ol class="ar-list">{"".join(items)}</ol>' if items else
            '<p class="slot-empty">The Archive fills from the record once the week\'s archive is fed (board_feed.py archive).</p>')
    return (f'<div class="pm fixed" id="panel-{ARCHIVE_TAB}" role="tabpanel" aria-labelledby="tab-{ARCHIVE_TAB}" data-day="{ARCHIVE_TAB}" '
            f'tabindex="-1"{" hidden" if hidden else ""}><div class="day-head">'
            + fixed_head('Every piece since the Launch', 'Archive') + '</div>' + body + '</div>')


def asset_formats(iid):
    """The rejection engine's formats (inspirationhouse src/rejection/vocab.ts) for a file in Download first."""
    if iid in ('video-long', 'video-feature'):
        return ['long_video']
    if iid == 'video-short':
        return ['short_video']
    if iid.startswith('thumb-'):
        return ['thumbnail']
    if iid.startswith('img-') and any(r in iid for r in ('cover', 'share')):
        return ['cover']
    return ['article']


def reject_parts(p, iid, name, actions):
    """(the dl-item's attributes, its Reject button, its reason box): Reject asset, with his reason, required, and on
    a video where in it, optional. The server files his reason in the rejection inbox with the file's Drive id; the
    file itself is never copied anywhere."""
    drive = DRIVE_ID.search(actions)
    attrs = (f' data-asset="{E(iid)}" data-asset-label="{E(name)}" data-formats="{",".join(asset_formats(iid))}"'
             + (f' data-drive-id="{drive.group(1)}"' if drive else ''))
    button = f'<button type="button" class="ghost" data-act="reject-asset" data-for="{p}dl-{iid}">Reject</button>'
    box = (f'<div class="tri-why rj" data-reject-for="{p}dl-{iid}" hidden><input type="text" data-reject-reason maxlength="4000" '
           'placeholder="Why? (required)" aria-label="Why you reject it (required)">'
           + ('<input type="text" data-reject-at maxlength="8" inputmode="numeric" placeholder="At 1:23 (optional)" '
              'aria-label="Where in the video, for example 1:23 (optional)">' if iid.startswith('video-') else '')
           + f'<button type="button" class="btn-s" data-act="save-reject" data-for="{p}dl-{iid}">Reject it</button></div>'
           f'<p class="tri-state" data-rejectstate="{p}dl-{iid}" aria-live="polite"></p>')
    return attrs, button, box


REVIEW_START, REVIEW_END = '<!--review-->', '<!--/review-->'


def review_card(day, items, built_at=None, kept_at=None):
    """The words Krish reviews on the board: each block (the article, each
    script) as text he can edit and save, or comment on. Krish, 2026-10-15:
    "get Fridays publish board ready in the artifact, and enable me to make
    comments or edit text myself, and then you can either iterate based on my
    comments or observe my text edits." A save goes to the board's own store
    (edits/<day>-<item>); a session reads it back with ArtifactData. Comment
    opens the page's comment box on that block.

    Each block carries the time this board was built (data-built-at). The
    page shows a save from the store only when it is newer than that: a
    session that folds his saved edit into a new version and rebuilds must
    not have his older save shown over the new words (2026-10-15, Friday v3
    over his 13:58 save), where a Save would then put the old words back.

    kept_at: {review id: time} from the board being replaced, for blocks
    whose words have not changed. Those keep their old time, so a rebuild
    that changes nothing in them (a scheduled one, say) never hides a save
    Krish made after the last build behind "is in this version"."""
    if not items:
        return ''
    if FIXED:
        return editor_card(day, items, built_at, kept_at)
    kept_at = kept_at or {}
    parts = [f'{REVIEW_START}<div class="rec rv" id="{day}-review">'
             '<div class="rec-head"><h2>Review the words</h2></div>'
             '<p class="rv-how">Change any word below and press Save, or press Comment to say what to change. '
             'Claude reads your saved words and your comments and comes back with the next version.</p>']
    for slug, label, text in items:
        rid = f'{day}-{slug}'
        words = len(text.split())
        at = kept_at.get(rid) or built_at
        parts.append(
            f'<section class="rv-item" id="rvs-{E(rid)}" data-review="{E(rid)}"><div class="sec-head"><h3>{E(label)}</h3>'
            f'<span class="rv-n">{words:,} words</span></div>'
            f'<textarea class="rv-text" id="rv-{E(rid)}" data-review-id="{E(rid)}" data-day="{day}" data-item="{E(slug)}" '
            + (f'data-built-at="{E(at)}" ' if at else '') +
            f'rows="14" spellcheck="true" aria-label="{E(label)}">{E(text)}</textarea>'
            f'<div class="rv-bar"><button type="button" class="btn-s" data-act="save-review" data-for="{E(rid)}">Save my edits</button>'
            f'<button type="button" class="btn-s ghost" data-act="comment-review" data-for="{E(rid)}">Comment</button>'
            f'<span class="rv-state" data-state-for="{E(rid)}" aria-live="polite"></span></div></section>')
    parts.append(f'</div>{REVIEW_END}')
    return ''.join(parts)


# ------------------------------------------------------------------ the Drafts step's editor (the fixed layout)
# Krish, 2026-10-21: "On Monday, Wednesday, and Friday mornings I need to be able to see the draft video scripts and the
# draft article. I need to be able to comment on them to iterate or just edit in line myself and save changes to get
# picked up", and "The Comment and Save Changes UIs are not that nice right now ... On mobile it's just a desktop site
# on mobile." So each draft is a clean read view (its Markdown drawn, no # signs); tapping a paragraph edits it,
# selecting words offers "Comment on this", and one bar at the bottom says how many changes are unsaved and saves them.
# The raw words stay in the same textarea (hidden), so the store (edits/<day>-<item>), its fields, the built-at guard
# and a rebuild's REVIEW_BOX read are unchanged. week.js splits and draws paragraphs exactly as below.

PARA_SPLIT = re.compile(r'(\n(?:[ \t]*\n)+)')


def paragraphs(text):
    """A draft's paragraphs, numbered as the editor numbers them (week.js splits on the same blank lines)."""
    return PARA_SPLIT.split(text)[0::2]


_INLINE = (
    (re.compile(r'`([^`\n]+)`'), r'<code>\1</code>'),
    (re.compile(r'\*\*([^*\n]+)\*\*'), r'<strong>\1</strong>'),
    (re.compile(r'(^|[^\w*])\*([^*\n]+)\*(?![\w*])'), r'\1<em>\2</em>'),
    (re.compile(r'(^|[^\w_])_([^_\n]+)_(?![\w_])'), r'\1<em>\2</em>'),
    (re.compile(r'\[([^\]\n]+)\]\((https?://[^\s)]+)\)'), r'<a href="\2" rel="noopener" target="_blank">\1</a>'),
)


def md_inline(line):
    out = E(line)
    for pattern, repl in _INLINE:
        out = pattern.sub(repl, out)
    return out


def md_block(text):
    """One paragraph of a draft drawn as it reads: headings without their # signs, lists, quotes, a rule, and
    plain lines kept as he wrote them. The same rules as mdBlock() in week.js."""
    out, run, kind = [], [], None

    def flush():
        if not run:
            return
        if kind in ('ul', 'ol'):
            out.append(f'<{kind}>' + ''.join(f'<li>{md_inline(x)}</li>' for x in run) + f'</{kind}>')
        elif kind == 'q':
            out.append('<blockquote><p>' + '<br>'.join(md_inline(x) for x in run) + '</p></blockquote>')
        else:
            out.append('<p>' + '<br>'.join(md_inline(x) for x in run) + '</p>')
        run.clear()
    for line in text.split('\n'):
        heading = re.match(r'^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$', line)
        rule = re.match(r'^\s*([-*_])\s*(?:\1\s*){2,}$', line)
        item = re.match(r'^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$', line)
        quote = re.match(r'^\s*>\s?(.*)$', line)
        if heading or rule:
            flush()
            kind = None
            out.append(f'<h4 class="rv-h">{md_inline(heading.group(2))}</h4>' if heading else '<hr>')
            continue
        k = ('ol' if item.group(1) else 'ul') if item else 'q' if quote else 'p'
        if k != kind:
            flush()
            kind = k
        run.append(item.group(2) if item else quote.group(1) if quote else line)
    flush()
    return ''.join(out)


def editor_card(day, items, built_at=None, kept_at=None):
    """The Drafts step's words: each draft as a read view whose paragraphs he taps to edit, the raw words in the
    hidden textarea the store and a rebuild read (its id, data-built-at and words as review_card writes them), and
    one Save bar for the day."""
    kept_at = kept_at or {}
    parts = [f'{REVIEW_START}<div class="rec rv ed" id="{day}-review">'
             '<div class="rec-head"><h2>Your drafts</h2><span class="kick">Tap a paragraph to edit it</span></div>'
             '<p class="rv-how">Tap any paragraph to change it, or select some words and press Comment on this. Save keeps '
             'your changes; Claude carries a changed number or fact into every other draft, and lists each place under '
             'Also changed, where you can undo it.</p>']
    for slug, label, text in items:
        rid = f'{day}-{slug}'
        at = kept_at.get(rid) or built_at
        paras = ''.join(f'<div class="rv-p" id="rvp-{E(rid)}-{n}" data-para="{n}" tabindex="0">{md_block(para)}</div>'
                        for n, para in enumerate(paragraphs(text)))
        parts.append(
            f'<section class="rv-item rv-ed" id="rvs-{E(rid)}" data-review="{E(rid)}"><div class="sec-head"><h3>{E(label)}</h3>'
            f'<span class="rv-n">{len(text.split()):,} word{"" if len(text.split()) == 1 else "s"}</span></div>'
            f'<div class="rv-read" data-read-for="{E(rid)}">{paras}</div>'
            f'<textarea class="rv-text" id="rv-{E(rid)}" data-review-id="{E(rid)}" data-day="{day}" data-item="{E(slug)}" '
            + (f'data-built-at="{E(at)}" ' if at else '') +
            f'data-base-sha256="{hashlib.sha256(text.encode("utf-8")).hexdigest()}" rows="14" spellcheck="true" '
            f'aria-label="{E(label)}" hidden>{E(text)}</textarea>'
            f'<div class="rv-bar"><button type="button" class="btn-s ghost" data-act="comment-review" data-for="{E(rid)}">'
            f'Comment on the whole draft</button><span class="rv-state" data-state-for="{E(rid)}" aria-live="polite"></span></div></section>')
    parts.append(f'<div class="rv-save" data-save-day="{day}"><span class="rv-count" data-unsaved-count="{day}" aria-live="polite">'
                 f'No unsaved changes</span><button type="button" class="btn-s" data-act="save-all" data-day="{day}" disabled>Save</button></div>'
                 f'</div>{REVIEW_END}')
    return ''.join(parts)


# What edit_sweep.py writes (scripts/post-pack/edit_sweep.py): Krish, 2026-10-21, "If I make a statistical change or a
# narrative style change in one place, just make sure that those changes propagate and the next draft is consistent";
# asked how, he chose to apply the change everywhere in the piece and in later drafts and to be shown "also changed
# in" with an undo. The kinds are the classes the sweep and the ledger use (reason_code on content_edit_events).
EDIT_KINDS = {'number_fact': 'Number or fact', 'claim': 'Claim', 'structure': 'Structure', 'tone': 'Tone', 'wording': 'Wording'}
SWEEP_ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,39}$')
SWEEP_GATES = {'story_check': 'the story check', 'voice_check': 'the voice check'}
LESSON_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$')


def read_sweep(data, where='--sweep'):
    """One day's sweep: {day?, piece_id?, swept_at?, also_changed: [change], suggestions: [change], held: [{where, why,
    from?, to?}], gates: [{where, check, ok, problems}]}. A change is {id, where, kind, from, to, context?, applied?}.
    Fed, never shaped: a field the board has no place for is refused."""
    if not isinstance(data, dict):
        raise BoardError(f'{where}: give the JSON edit_sweep.py wrote ({{"also_changed": [...], ...}})')
    unknown = set(data) - {'day', 'piece_id', 'swept_at', 'also_changed', 'suggestions', 'held', 'gates', 'ledger', 'edits'}
    if unknown:
        raise BoardError(f'{where}: fields the board has no place for: {sorted(unknown)}')
    text = lambda v, n: isinstance(v, str) and len(v) <= n
    seen = set()

    def change(c, applied, i):
        if not isinstance(c, dict):
            raise BoardError(f'{where}: change {i} is not an object')
        cid = str(c.get('id') or '')
        if not SWEEP_ID.match(cid) or cid in seen:
            raise BoardError(f'{where}: change {i} needs its own id (a-z, 0-9 and -), not {cid!r}')
        seen.add(cid)
        if c.get('kind') not in EDIT_KINDS:
            raise BoardError(f'{where}: change {cid} has kind {c.get("kind")!r}, not one of {sorted(EDIT_KINDS)}')
        if not (text(c.get('where'), 200) and c['where'].strip()):
            raise BoardError(f'{where}: change {cid} does not say where it is')
        a, b = c.get('from', ''), c.get('to', '')
        if not (text(a, 600) and text(b, 600)) or a == b:
            raise BoardError(f'{where}: change {cid} needs from and to (at most 600 characters each, not the same)')
        if c.get('context') is not None and not text(c['context'], 600):
            raise BoardError(f'{where}: change {cid} has a context over 600 characters')
        return {'id': cid, 'where': c['where'].strip(), 'kind': c['kind'], 'from': a, 'to': b,
                'context': (c.get('context') or '').strip(), 'applied': applied}
    lists = {}
    for key, applied in (('also_changed', True), ('suggestions', False)):
        value = data.get(key) or []
        if not isinstance(value, list) or len(value) > 60:
            raise BoardError(f'{where}: {key} must be a list of at most 60 changes')
        lists[key] = [change(c, applied, i) for i, c in enumerate(value)]
    held = []
    for i, h in enumerate(data.get('held') or []):
        if not (isinstance(h, dict) and text(h.get('where'), 200) and text(h.get('why'), 300) and h['where'].strip() and h['why'].strip()):
            raise BoardError(f'{where}: held {i} needs where and why')
        held.append({'where': h['where'].strip(), 'why': h['why'].strip(), 'from': str(h.get('from') or '')[:600], 'to': str(h.get('to') or '')[:600]})
    gates = []
    for i, g in enumerate(data.get('gates') or []):
        if not (isinstance(g, dict) and text(g.get('where'), 200) and g.get('check') in SWEEP_GATES and isinstance(g.get('ok'), bool)):
            raise BoardError(f'{where}: gate {i} needs where, check ({", ".join(SWEEP_GATES)}) and ok')
        gates.append({'where': g['where'].strip(), 'check': g['check'], 'ok': g['ok'],
                      'problems': [str(x)[:300] for x in (g.get('problems') or [])[:10]]})
    return {'day': data.get('day') if data.get('day') in DAY_KEYS.values() else None,
            'piece_id': data.get('piece_id') if UUID.match(str(data.get('piece_id') or '')) else None,
            'swept_at': data.get('swept_at') if isinstance(data.get('swept_at'), str) else None,
            'also_changed': lists['also_changed'], 'suggestions': lists['suggestions'], 'held': held, 'gates': gates}


def _diff(c):
    a, b = E(c['from']), E(c['to'])
    if not c['from']:
        return f'<p class="ac-diff"><span class="ac-w">added</span> <ins>{b}</ins></p>'
    if not c['to']:
        return f'<p class="ac-diff"><span class="ac-w">taken out</span> <del>{a}</del></p>'
    return f'<p class="ac-diff"><del>{a}</del> <span class="ac-w">is now</span> <ins>{b}</ins></p>'


def sweep_card(p, sweep):
    """Also changed: where his saved change was carried, each with Undo; what is worth changing too, each with Change
    it too; what was left alone because he has recorded it; and what the checks said after."""
    rows = []
    for i, c in enumerate(sweep['also_changed'], 1):
        rows.append(
            f'<li class="ac-row" id="{p}also-{i}" data-also="{E(c["id"])}"><div class="ac-where"><strong>{E(c["where"])}</strong> '
            f'<span class="chip">{E(EDIT_KINDS[c["kind"]])}</span></div>{_diff(c)}'
            + (f'<p class="ac-ctx">{E(c["context"])}</p>' if c['context'] else '') +
            f'<div class="btns"><button type="button" class="btn-s ghost" data-act="undo-also" data-for="{E(c["id"])}">Undo</button>'
            f'<span class="ac-state" data-also-state="{E(c["id"])}" aria-live="polite"></span></div></li>')
    tips = []
    for i, c in enumerate(sweep['suggestions'], 1):
        tips.append(
            f'<li class="ac-row" id="{p}tip-{i}" data-also="{E(c["id"])}"><div class="ac-where"><strong>{E(c["where"])}</strong> '
            f'<span class="chip">{E(EDIT_KINDS[c["kind"]])}</span></div>{_diff(c)}'
            + (f'<p class="ac-ctx">{E(c["context"])}</p>' if c['context'] else '') +
            f'<div class="btns"><button type="button" class="btn-s ghost" data-act="apply-also" data-for="{E(c["id"])}">Change it too</button>'
            f'<span class="ac-state" data-also-state="{E(c["id"])}" aria-live="polite"></span></div></li>')
    n = len(rows)
    out = [f'<div class="card also" id="{p}also"><div class="row"><span class="lab">Also changed</span>'
           f'<span class="chip">{n} place{"" if n == 1 else "s"}</span></div>'
           '<p class="ac-how">Your saved changes, carried into the other drafts of this piece and into later drafts. '
           'Undo puts one back in the next version.</p>']
    out.append(f'<ol class="ac-list">{"".join(rows)}</ol>' if rows else
               '<p class="ac-none">Nothing else needed changing: your edit was the only place it appeared.</p>')
    if tips:
        out.append('<h3 class="ac-h">Worth changing too? Not changed yet</h3>'
                   '<p class="ac-how">A change of tone or wording is only suggested elsewhere, never made for you.</p>'
                   f'<ol class="ac-list">{"".join(tips)}</ol>')
    if sweep['held']:
        out.append('<h3 class="ac-h">Left alone: already recorded</h3><ul class="ac-held">'
                   + ''.join(f'<li><strong>{E(h["where"])}</strong>: {E(h["why"])}</li>' for h in sweep['held']) + '</ul>')
    if sweep['gates']:
        said = []
        for g in sweep['gates']:
            said.append(f'<li class="{"ok" if g["ok"] else "bad"}">{E(g["where"])}: '
                        + (f'passes {SWEEP_GATES[g["check"]]}' if g['ok'] else
                           f'fails {SWEEP_GATES[g["check"]]}: ' + E('; '.join(g['problems']) or 'see the session'))
                        + '</li>')
        out.append(f'<h3 class="ac-h">The checks, run again after the change</h3><ul class="ac-gates">{"".join(said)}</ul>')
    out.append('</div>')
    return ''.join(out)


MYMU = 'Make Your Mind Up'  # the ledger's publication venture, as he reads it
# Each venture's plain name, the same as VENTURE_LABELS in apps/control-plane/api/_taste.ts; a slug with no name here
# is shown as it is, never hidden.
VENTURE_LABELS = {'publication': MYMU, 'mindmake': 'Mindmake', 'heartside': 'Heartside', 'full_time': 'Full Time',
                  'legibility': 'Legibility', 'mm_ctrl': 'CTRL', 'fractionl_pulse': 'Pulse', 'fractionl_circle': 'Circle',
                  'signal_noise': 'Signal & Noise', 'investor': 'Investor'}


def read_lessons(data, where='--lessons'):
    """What the weekly compiler proposed from his board edits, and what the taste ledger (krishanraja/inspirationhouse)
    proposed from what he saved and said: GET /api/video-studio/learning-proposals's answer (only proposals whose
    scope.key starts board_edit: or taste:), or a list of {id, assertion, evidence_count, kind?, status?}.
    Each stays a proposal until he approves it (AGENTS.md: every durable taste rule needs his explicit approval).
    At most three taste lessons show, the cap the ledger keeps to. Each says the venture it is for (the route's
    venture_label, or scope.venture; none is Make Your Mind Up's, Krish, 2026-10-28: "The ledger is keyed by venture
    not repository"), and none is left out for its venture: this board is the only place he rewords a rule."""
    rows = data.get('proposals', data.get('lessons')) if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise BoardError(f'{where}: give the saved answer of GET /api/video-studio/learning-proposals, or a list of lessons')
    out = []
    for i, r in enumerate(rows):
        if not isinstance(r, dict):
            raise BoardError(f'{where}: lesson {i} is not an object')
        key = str((r.get('scope') or {}).get('key') or '') if isinstance(r.get('scope'), dict) else ''
        taste = key.startswith('taste:')
        if 'scope' in r and not (key.startswith('board_edit:') or taste):
            continue  # another surface's proposal: it is ruled on where it came from
        if taste and sum(1 for o in out if o['kind'] == 'taste') >= 3:
            continue
        kind = 'taste' if taste else r.get('kind') or (key.split(':', 1)[1] if key.startswith('board_edit:') else None)
        lid, says = str(r.get('id') or ''), str(r.get('assertion') or '').strip()
        count = r.get('evidence_count', r.get('independent_session_count'))
        status = r.get('status') or 'proposed'
        scope = r.get('scope') if isinstance(r.get('scope'), dict) else {}
        slug = str(r.get('venture') or scope.get('venture') or '').strip() or 'publication'
        venture = str(r.get('venture_label') or '').strip() or VENTURE_LABELS.get(slug, slug)
        if not venture or len(venture) > 60:
            raise BoardError(f'{where}: lesson {i} names a venture the board cannot show: {venture!r}')
        if not LESSON_ID.match(lid) or not says or len(says) > 1600 or not isinstance(count, int) or count < 1:
            raise BoardError(f'{where}: lesson {i} needs an id, its assertion (at most 1600 characters) and how often it was seen')
        if (kind != 'taste' and kind not in EDIT_KINDS) or status not in ('proposed', 'approved', 'rejected', 'corrected'):
            raise BoardError(f'{where}: lesson {lid} has kind {kind!r} or status {status!r} the board does not know')
        out.append({'id': lid, 'assertion': says, 'evidence_count': count, 'kind': kind, 'status': status, 'venture': venture})
    if len(out) > 12:
        raise BoardError(f'{where}: {len(out)} lessons; give the 12 newest at most')
    return out


def lessons_card(p, lessons):
    items = []
    for i, ls in enumerate(lessons, 1):
        chip = {'proposed': 'Proposed: yours to approve', 'approved': 'Approved: a standing rule', 'rejected': 'Not a rule',
                'corrected': 'Reworded: a standing rule, in your words'}[ls['status']]
        seen_line = (f'From what you saved and said, across {ls["evidence_count"]} days' if ls['kind'] == 'taste'
                else f'{E(EDIT_KINDS[ls["kind"]])} edits, seen {ls["evidence_count"]} times in 28 days')
        buttons = (f'<div class="btns"><button type="button" class="btn-s" data-act="lesson-yes" data-for="{E(ls["id"])}">Make it a rule</button>'
                   f'<button type="button" class="btn-s ghost" data-act="lesson-no" data-for="{E(ls["id"])}">Not a rule</button>'
                   f'<span class="ls-state" data-lesson-state="{E(ls["id"])}" aria-live="polite"></span></div>') if ls['status'] == 'proposed' else ''
        items.append(f'<article class="ls-item" id="{p}lesson-{i}" data-lesson="{E(ls["id"])}"><p class="ls-says">{E(ls["assertion"])}</p>'
                     f'<p class="ls-meta"><span class="chip{" ok" if ls["status"] in ("approved", "corrected") else ""}">{E(chip)}</span> '
                     f'For {E(ls.get("venture") or MYMU)}. {seen_line}</p>{buttons}</article>')
    return (f'<div class="card lessons" id="{p}lessons"><div class="row"><span class="lab">What I learned from your edits</span></div>'
            '<p class="ls-how">Patterns in the changes you saved on this board. Each stays a proposal until you say yes; only then '
            'does it become a rule the drafts follow.</p>' + ''.join(items) + '</div>')


def previous_sweeps(text):
    """{day: sweep} the board being replaced carries in its CONF (or manifest)."""
    data = None
    stripped = text.lstrip()
    if stripped.startswith('{'):
        try:
            data = json.loads(stripped).get('sweeps')
        except (ValueError, AttributeError):
            data = None
    else:
        m = CONF_RE.search(text)
        if m:
            try:
                data = json.loads(m.group(1)).get('sweeps')
            except ValueError:
                data = None
    out = {}
    for k, s in (data or {}).items() if isinstance(data, dict) else []:
        if k in DAY_KEYS.values():
            try:
                out[k] = read_sweep(s, f'the previous board\'s {k} sweep')
            except BoardError:
                continue
    return out


MIN_IDEAS = 4  # Krish, 2026-10-18: "at least three content ideas for each day", then "give me more than 3 from all my
# suggested sources and the ones I threw at other sessions last week"
# Where an idea came from, as its chip says it (GET /api/week/options?include=sources, _weekSources.ts).
SOURCE_KINDS = {'his': 'Your idea', 'inspo': 'From your inspo folder', 'engine': 'Engine research'}


STYLES_PATH = HERE.parents[1] / 'config' / 'style-references.json'


def style_formats(path=None):
    """{'script': {id: format}, 'production': {id: format}, 'divergence': {...}} from the style bank's formats
    (config/style-references.json). Krish, 2026-10-24: "suggest script and production styles that I can choose from
    or that it recommends for specific content"."""
    data = json.loads(Path(path or STYLES_PATH).read_text(encoding='utf-8'))
    f = data.get('formats') or {}
    return {'script': {x['id']: x for x in f.get('script') or []}, 'production': {x['id']: x for x in f.get('production') or []},
            'divergence': f.get('divergence') or {}}


def style_problems(data, formats=None):
    """What is wrong with the ideas' styles, [] when none. Every idea in a fixed week carries
    style {script, production, experiment: {format, why}}, each a format id from the bank; none he marked not for us;
    and the week diverges (Krish, 2026-10-24: "we still need to be producing better and more divergent work")."""
    formats = formats or style_formats()
    rules = formats['divergence']
    out, week_production = [], []
    for key, _, weekday, *_ in DAYS:
        ideas = ((data or {}).get('days') or {}).get(key) or []
        scripts, experiments = set(), 0
        for n, idea in enumerate(ideas, 1):
            st = idea.get('style') if isinstance(idea, dict) else None
            if not isinstance(st, dict):
                out.append(f'{weekday} idea {n}: no style; give style.script, style.production and style.experiment from config/style-references.json formats')
                continue
            for kind in ('script', 'production'):
                fid = st.get(kind)
                fmt = formats[kind].get(fid)
                if not fmt:
                    out.append(f'{weekday} idea {n}: style.{kind} {fid!r} is not a {kind} format in the bank')
                elif fmt.get('krish_verdict') == 'not for us':
                    out.append(f'{weekday} idea {n}: style.{kind} {fid!r} is marked not for us; never offer it again')
            scripts.add(st.get('script'))
            week_production.append(st.get('production'))
            ex = st.get('experiment')
            if not isinstance(ex, dict) or not str(ex.get('why') or '').strip():
                out.append(f'{weekday} idea {n}: style.experiment needs a format and a why: the bolder version the engine would try')
                continue
            fmt = formats['script'].get(ex.get('format')) or formats['production'].get(ex.get('format'))
            if not fmt:
                out.append(f'{weekday} idea {n}: style.experiment {ex.get("format")!r} is not a format in the bank')
            elif fmt.get('krish_verdict') == 'not for us':
                out.append(f'{weekday} idea {n}: style.experiment {ex.get("format")!r} is marked not for us')
            elif fmt.get('status') in ('experimental', 'trial') and ex.get('format') not in (st.get('script'), st.get('production')):
                experiments += 1
        if ideas and len(scripts - {None}) < rules.get('min_script_formats_per_day', 2):
            out.append(f'{weekday}: {len(scripts - {None})} script format(s) across its ideas; give at least {rules.get("min_script_formats_per_day", 2)}')
        if ideas and experiments < rules.get('experiments_per_day', 1):
            out.append(f'{weekday}: no idea offers an untried format as its experiment; push at least {rules.get("experiments_per_day", 1)}')
    used = [p for p in week_production if p]
    if used:
        if len(set(used)) < rules.get('min_production_formats_per_week', 3):
            out.append(f'the week: {len(set(used))} production format(s); recommend at least {rules.get("min_production_formats_per_week", 3)}')
        top = max(used.count(p) for p in set(used)) / len(used)
        if top > rules.get('max_share_of_one_production_format', 0.5):
            out.append(f'the week: one production format is {round(top * 100)}% of the recommendations; at most {round(rules.get("max_share_of_one_production_format", 0.5) * 100)}%')
    return out


def coverage_problems(data, sources):
    """Every id the gather says the board owes him (sources.json must_cover: Inspiration cards he routed to Make a
    piece, board items holding his words) is in some idea's `covers`, or in ideas.json `accounted` with a reason.
    Krish, 2026-10-24: "Double check my inspirationhouse gets read properly when ideas are being built"."""
    owed = [m for m in (sources or {}).get('must_cover') or [] if isinstance(m, dict) and m.get('id')]
    # An off-day option covers too (Krish, 2026-10-29: an idea he drops in may be a Tuesday, Thursday, Saturday or
    # Sunday piece).
    offdays = (data or {}).get('offdays') if isinstance((data or {}).get('offdays'), dict) else {}
    options = [i for ideas in ((data or {}).get('days') or {}).values() for i in ideas or []] + \
              [o for opts in offdays.values() if isinstance(opts, list) for o in opts]
    covered = {str(c) for i in options if isinstance(i, dict) for c in (i.get('covers') or [])}
    accounted = (data or {}).get('accounted') or {}
    out = []
    if not isinstance(accounted, dict):
        out.append('accounted is an object, {"<must_cover id>": "why it is not on the board"}')
        accounted = {}
    for m in owed:
        mid = str(m['id'])
        if mid in covered:
            continue
        why = accounted.get(mid)
        if isinstance(why, str) and len(why.strip()) >= 12:
            continue
        out.append(f'not on the board: {m.get("what") or mid} ({mid}); put it in an idea\'s covers, or say why in accounted')
    return out


def read_ideas(data, monday, where='--ideas'):
    """{day: [idea]} from an ideas file (docs/plans/<week>/ideas.json). Every
    idea is checked before it reaches him: what a business person finds out
    (so_what, in plain English, first: Krish, 2026-10-19, "Would I consider
    this story or angle?" needs the consequence, not the mechanism), its one-line story, why now with
    its date, its strongest fact, and the source that fact came from, linked.
    No titles: those are his, after he records (TITLES_AFTER_RECORDING)."""
    if not isinstance(data, dict) or not isinstance(data.get('days'), dict):
        raise BoardError(f'{where}: give {{"week_start": ..., "days": {{"mon": [ideas], "wed": [...], "fri": [...]}}}}')
    if data.get('week_start') and data['week_start'] != monday.isoformat():
        raise BoardError(f'{where} is for the week of {data["week_start"]}, not {monday.isoformat()}')
    out, problems = {}, []
    for key, _, weekday, *_ in DAYS:
        ideas = data['days'].get(key) or []
        if len(ideas) < MIN_IDEAS:
            problems.append(f'{weekday}: {len(ideas)} idea(s); give at least {MIN_IDEAS} to pick from')
        rows, seen = [], set()
        for n, idea in enumerate(ideas, 1):
            idea = idea if isinstance(idea, dict) else {}
            src = idea.get('source') if isinstance(idea.get('source'), dict) else {}
            missing = [f for f in ('so_what', 'story', 'why_now', 'fact') if not str(idea.get(f) or '').strip()]
            if not str(src.get('url') or '').startswith('https://'):
                missing.append('source.url (https)')
            if missing:
                problems.append(f'{weekday} idea {n}: no {", ".join(missing)}')
                continue
            if idea.get('id') and not UUID.match(str(idea['id'])):
                problems.append(f'{weekday} idea {n}: id {idea["id"]!r} is not a piece id')
            if idea.get('title'):
                problems.append(f'{weekday} idea {n}: a title; titles are signed off after he records (TITLES_AFTER_RECORDING)')
            # Where it came from, why it is here and its sketch (Krish, 2026-10-21; board_feed.py gather): in the fixed
            # layout every idea names its source, his own, his inspo folder or the engine's research.
            kind = idea.get('source_kind')
            if kind is not None and kind not in SOURCE_KINDS:
                problems.append(f'{weekday} idea {n}: source_kind {kind!r} is not one of {", ".join(SOURCE_KINDS)}')
            elif kind is None and fixed_layout(monday):
                problems.append(f'{weekday} idea {n}: no source_kind (his, inspo or engine); every idea says where it came from')
            if idea.get('why_here') is not None and not str(idea['why_here']).strip():
                problems.append(f'{weekday} idea {n}: why_here is empty; leave it out or say which of his marks it is close to')
            beats = idea.get('beats')
            if beats is not None and (not isinstance(beats, list) or not 3 <= len(beats) <= 5
                                      or not all(isinstance(b, str) and b.strip() for b in beats)):
                problems.append(f'{weekday} idea {n}: beats are 3 to 5 lines of the narrative sketch')
            covers = idea.get('covers')
            if covers is not None and (not isinstance(covers, list) or not all(isinstance(c, str) and c.strip() for c in covers)):
                problems.append(f'{weekday} idea {n}: covers is a list of the must_cover ids (sources.json) this idea answers')
            pick = f'{key}-{n}'
            if pick in seen:
                problems.append(f'{weekday}: {pick} twice')
            seen.add(pick)
            rows.append(dict(idea, pick=pick, source=src))
        out[key] = rows
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return out


TRIAGE = (('story', 'Story', 'I would run it'), ('angle', 'Angle', 'I would run it from this angle'),
          ('cute', 'Cute', 'I like it, I would not run it'), ('curious', 'Curious', 'curious but not convinced'),
          ('drop', 'Drop', 'not for me'))


def queue_for(queue, slug):
    """The queued ideas (GET /api/idea-queue's `queue`) that fit a series: the series they carry, or none."""
    return [q for q in queue or [] if (q.get('series') or '').replace('.', '_').replace('-', '_') in ('', slug)]


def queue_block(queue, key, slug):
    """"From your queue", first in a day's ideas: what he queued earlier that fits the day. Read-only here;
    he triages it in Control Center's Queue page."""
    fit = queue_for(queue, slug)
    if not fit:
        return ''
    items = ''.join(
        f'<li class="qd-item" data-queued-id="{E(q.get("id") or "")}"><span class="qd-sowhat">{E(q.get("so_what") or q.get("idea") or "")}</span>'
        + (f'<span class="qd-triage">{E(((q.get("triage") or {}).get("verdict") or "").title())}</span>' if (q.get('triage') or {}).get('verdict') else '')
        + '</li>' for q in fit[:12])
    return (f'<div class="qd" data-queue-day="{key}"><h3>From your queue</h3>'
            f'<p class="qd-how">Ideas you queued earlier that fit this day. Ask Claude to start one, or pick from the new ideas below.</p>'
            f'<ul>{items}</ul></div>')


def triage_row(pid):
    """The four triage buttons, Drop, and the Queue mark, beside an idea's Pick box. Krish, 2026-10-19: "Would I
    consider this story or angle? If not would I consider it cute or am I curious but not convinced for some
    specific reason". Saved at once in queue/<pick>, posted as a comment ("QUEUE <pick> <verdict> <reason>")."""
    buttons = ''.join(f'<button type="button" class="tri" data-triage="{v}" data-for="{pid}" aria-pressed="false" title="{E(t)}">{E(l)}</button>'
                      for v, l, t in TRIAGE)
    return (f'<div class="tri-row" data-tri-for="{pid}" role="group" aria-label="Triage this idea">{buttons}</div>'
            f'<label class="qmark"><input type="checkbox" data-queue-mark="{pid}" disabled><span class="box sq" aria-hidden="true"></span>'
            f'<span class="t-label">Queue it for later</span><span class="t-when"></span></label>'
            f'<div class="tri-why" data-why-for="{pid}" hidden><input type="text" data-why-input="{pid}" maxlength="500" '
            f'aria-label="Your reason or angle"><button type="button" class="btn-s" data-act="save-why" data-for="{pid}">Save</button></div>'
            f'<p class="tri-state" data-tristate="{pid}" aria-live="polite"></p>')


# Krish's five presses on an idea, from the fixed layout on (Krish, 2026-10-28: "pick an idea for a specific day AND
# add any optional comments easily, which can be saved, or I can: mark an idea as being useful in a future wider piece
# OR mark it as being an idea that should be stored for a future trend OR queue it for next week OR reject it"). The
# pick is the pick box (picks/<day>, with his optional note); the other four are these, each saved at once in
# queue/<pick> as its use, his optional words beside it. They replace Story, Angle, Cute, Curious and Drop; weeks
# before the fixed layout keep their triage.
PRESSES = (('wider_piece_context', 'Wider piece'), ('track_over_time', 'Future trend'), ('next_week', 'Next week'),
           ('not_for_us', 'Reject'))


def presses_row(pid, key, monday):
    """The pick's optional note and the four presses beside an idea's pick box. Next week names the Monday after
    this board's week."""
    nxt = (monday + timedelta(days=7)).isoformat()
    buttons = ''.join(
        f'<button type="button" class="tri" data-press="{use}" data-for="{pid}" aria-pressed="false"'
        + (f' data-target-week="{nxt}"' if use == 'next_week' else '') + f' disabled>{E(label)}</button>'
        for use, label in PRESSES)
    return (f'<div class="tri-why" data-pick-note-for="{pid}" hidden><input type="text" data-pick-note="{key}" maxlength="2000" '
            f'placeholder="Add a note (optional)" aria-label="A note on your pick (optional)">'
            f'<button type="button" class="btn-s" data-act="save-pick-note" data-day="{key}" data-for="{pid}">Save</button></div>'
            f'<div class="tri-row" data-presses-for="{pid}" role="group" aria-label="Or keep it for later">{buttons}</div>'
            f'<div class="tri-why" data-press-note-for="{pid}" hidden><input type="text" data-press-note="{pid}" maxlength="2000" '
            f'aria-label="Your words (optional)"><button type="button" class="btn-s" data-act="save-press-note" data-for="{pid}">'
            f'Save</button></div><p class="tri-state" data-pressstate="{pid}" aria-live="polite"></p>')


# The off days (Krish, 2026-10-28: "I'm happy to plan the Tuesday, Thursday, Saturday, and Sunday content within the
# Sunday ideas session if you give me a few options to approve as you do the Mon/wed/fri"): two or three options a
# day, from ideas.json's `offdays`, each with its format, its source and its draft copy, and his Approve or Skip, saved
# in queue/off-<day>-<option> bound to the copy he saw (copy_sha256). Growth makes and schedules what he approved.
OFF_DAYS = (('tue', 'Tuesday', 1), ('thu', 'Thursday', 3), ('sat', 'Saturday', 5), ('sun', 'Sunday', 6))
OFF_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,59}$')
# Growth's off-day lane runs every day (Krish, 2026-10-29, choosing between two rulings: "Mix wins: every day"), so its
# options (growth.py mix offdays, schema growth-offdays/1) may name Monday, Wednesday and Friday too; the series slot on
# those days stays reserved for the piece's own cut, which is Growth's to keep. A piece he records stays an off-day
# piece: Tuesday, Thursday, Saturday or Sunday.
MIX_DAYS = (('mon', 'Monday', 0), ('tue', 'Tuesday', 1), ('wed', 'Wednesday', 2), ('thu', 'Thursday', 3),
            ('fri', 'Friday', 4), ('sat', 'Saturday', 5), ('sun', 'Sunday', 6))
# An off-day piece he records (Ruling, Krish, 2026-10-29: an idea he drops in can be a Tuesday, Thursday, Saturday or
# Sunday piece, and it is one short cut: "could be a short with motion designed subtitles and branding, or voiceover
# with motion designed infographics"). Its option carries the exact words he would read; his Approve is his approval
# of those words, and the server then schedules the piece and sends the script to Teleprompter
# (apps/control-plane/api/board/_presses.ts, offdayRecorded).
RECORDED_STYLES = {'to_camera': 'Said to camera', 'voiceover': 'Voiceover with motion graphics'}
RECORDED_WORDS = (160, 195)  # a 90-second cut that finishes under 89 seconds (story_check's short cut)
SERIES_LABELS = {slug: label for *_, slug, label in DAYS}


def read_offdays(data, where='ideas.json offdays'):
    """{day: [{'id', 'format', 'source', 'url', 'copy', 'copy_sha256'}]}, or None when there are none. Each day given
    holds 2 to 3 options; a day left out is said on the tab."""
    if data is None:
        return None
    if not isinstance(data, dict):
        raise BoardError(f'{where}: give {{"tue": [options], "thu": [...], "sat": [...], "sun": [...]}}')
    days = {k for k, *_ in MIX_DAYS}
    problems = [f'{k} is not a day ({", ".join(d for d, *_ in MIX_DAYS)})' for k in data if k not in days]
    out = {}
    for key, weekday, _ in MIX_DAYS:
        opts = data.get(key)
        if opts is None:
            continue
        if not isinstance(opts, list) or not 2 <= len(opts) <= 3:
            problems.append(f'{weekday}: give 2 to 3 options')
            continue
        rows, seen = [], set()
        for n, o in enumerate(opts, 1):
            o = o if isinstance(o, dict) else {}
            src = o.get('source')
            label, url = (src.get('label') or src.get('url'), src.get('url')) if isinstance(src, dict) else (src, None)
            missing = [f for f, v in (('format', o.get('format')), ('source', label), ('copy', o.get('copy'))) if not str(v or '').strip()]
            if missing:
                problems.append(f'{weekday} option {n}: no {", ".join(missing)}')
                continue
            if url and not str(url).startswith('https://'):
                problems.append(f'{weekday} option {n}: source.url is https')
            oid = str(o.get('id') or n)
            if not OFF_ID.match(oid) or oid in seen:
                problems.append(f'{weekday} option {n}: id {oid!r} is one short word, once a day')
            seen.add(oid)
            copy = str(o['copy']).strip()
            row = {'id': oid, 'format': str(o['format']).strip(), 'source': str(label).strip(), 'url': url or None,
                   'copy': copy, 'copy_sha256': hashlib.sha256(copy.encode('utf-8')).hexdigest()}
            for k in ('share_line', 'needs'):
                v = o.get(k)
                if v not in (None, '', []):
                    if k == 'needs' and isinstance(v, list) and all(isinstance(x, str) for x in v):
                        row[k] = [x.strip() for x in v if x.strip()]
                    elif k == 'share_line' and isinstance(v, str):
                        row[k] = ' '.join(v.split())
                    else:
                        problems.append(f'{weekday} option {n}: {k} is ' + ('a list of lines' if k == 'needs' else 'one line'))
            covers = o.get('covers')
            if covers is not None:
                if not isinstance(covers, list) or not all(isinstance(c, str) and c.strip() for c in covers):
                    problems.append(f'{weekday} option {n}: covers is a list of must_cover ids')
                else:
                    row['covers'] = [c.strip() for c in covers]
            if o.get('kind') == 'recorded' and key not in {k for k, *_ in OFF_DAYS}:
                problems.append(f'{weekday} option {n}: a piece he records is a Tuesday, Thursday, Saturday or Sunday piece')
            elif o.get('kind') == 'recorded':
                found = recorded_problems(o)
                problems.extend(f'{weekday} option {n}: {p}' for p in found)
                if not found:
                    row.update(recorded_fields(o))
            elif o.get('kind') is not None:
                problems.append(f'{weekday} option {n}: kind is "recorded" or left out')
            rows.append(row)
        out[key] = rows
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return out


def read_growth_offdays(data, monday, where='--offdays-plan'):
    """(offdays for read_offdays, warnings) from Growth's Sunday Off-days section (growth.py mix offdays, schema
    growth-offdays/1): {week_of, days: {date: [{concept_id, lane, formats, source_url, draft, share_line, needs, ready}]},
    short}. Each option is his to approve or skip with one press; its copy is Growth's draft, bound by its hash. A day
    with fewer than two options is left off and said."""
    if not isinstance(data, dict) or data.get('schema') != 'growth-offdays/1' or not isinstance(data.get('days'), dict):
        raise BoardError(f'{where}: give the growth-offdays/1 file growth.py mix offdays wrote')
    if str(data.get('week_of')) != monday.isoformat():
        raise BoardError(f'{where}: it is for the week of {data.get("week_of")}, not {monday.isoformat()}')
    by_offset = {off: k for k, _, off in MIX_DAYS}
    out, warnings = {}, []
    for day, opts in sorted(data['days'].items()):
        try:
            key = by_offset.get((date.fromisoformat(day) - monday).days)
        except ValueError:
            key = None
        if not key:
            raise BoardError(f'{where}: {day} is not a day of the week of {monday.isoformat()}')
        opts = [o for o in opts or [] if isinstance(o, dict)][:3]
        if len(opts) < 2:
            warnings.append(f'{where}: {day} has {len(opts)} option(s) from Growth, under the two the board shows')
            continue
        out[key] = [{'id': o.get('concept_id'), 'format': ', '.join(o.get('formats') or []) or o.get('lane'),
                     'source': {'label': 'Source', 'url': o['source_url']} if str(o.get('source_url') or '').startswith('https://') else (o.get('lane') or 'Growth'),
                     'copy': o.get('draft'), 'share_line': o.get('share_line'),
                     'needs': list(o.get('needs') or []) + ([] if o.get('ready') else ['not ready yet'] if not o.get('needs') else [])}
                    for o in opts]
    return out, warnings


def previous_option(o):
    """An off-day option as the previous board kept it, back in the shape read_offdays takes."""
    row = {'id': o['id'], 'format': o['format'], 'source': {'label': o['source'], 'url': o.get('url')} if o.get('url') else o['source'], 'copy': o['copy']}
    for k in ('covers', 'kind', 'style', 'piece_id', 'series', 'title', 'script', 'share_line', 'needs'):
        if o.get(k) is not None:
            row[k] = o[k]
    if o.get('kind') == 'recorded':
        row['read_back'] = dict(o.get('read_back') or {}, script_sha256=o.get('script_sha256'))
    return row


def recorded_problems(o):
    """Why a recorded off-day option is not ready to show, or []. It names his idea (piece_id), its series, its style,
    a title, and the exact words, which pass the story check as a short cut (all but the article close, since an off-day
    piece has no article: house rule SCRIPT_CLOSE names the deep dive) and were read back by two fresh readers with
    nothing lost (house rule R7)."""
    import making
    import story_check
    import teleprompter_send as tps
    out = []
    if o.get('style') not in RECORDED_STYLES:
        out.append(f'style is one of {", ".join(RECORDED_STYLES)}')
    if not UUID.match(str(o.get('piece_id') or '')):
        out.append('piece_id is the content_ideas uuid of the idea it makes (his own, for an idea he dropped in)')
    if o.get('series') not in SERIES_LABELS:
        out.append(f'series is one of {", ".join(SERIES_LABELS)}')
    title = ' '.join(str(o.get('title') or '').split())
    if not 0 < len(title) <= 120:
        out.append('title is the piece\'s subject in one line of up to 120 characters (it names the Teleprompter script)')
    script = tps.spoken_text(str(o.get('script') or ''))
    words = len(script.split())
    if not RECORDED_WORDS[0] <= words <= RECORDED_WORDS[1]:
        out.append(f'script is the exact words he reads, {RECORDED_WORDS[0]} to {RECORDED_WORDS[1]} words (it has {words})')
    else:
        found = [p for p in story_check.problems(script, 'short') if 'SCRIPT_CLOSE' not in p]
        out.extend(f'script: {p}' for p in found[:5])
    rb = o.get('read_back') if isinstance(o.get('read_back'), dict) else {}
    readers = rb.get('readers') if isinstance(rb.get('readers'), list) else []
    if rb.get('found') != 'nothing lost' or not 2 <= len(readers) <= 6 or not all(isinstance(r, str) and r.strip() for r in readers):
        out.append('read_back is {"readers": [two to six fresh readers], "found": "nothing lost"} for these exact words (house rule R7)')
    elif rb.get('script_sha256') not in (None, making.script_hash(script)):
        out.append('read_back.script_sha256 is not the hash of these words: they changed after the readers heard them')
    return out


def recorded_fields(o):
    """What a ready recorded option adds to its row: the words as Teleprompter shows them, their hash (making.py
    script_hash, the same as the server's scriptHash), and the rest it needs."""
    import making
    import teleprompter_send as tps
    script = tps.spoken_text(str(o['script']))
    rb = o['read_back']
    return {'kind': 'recorded', 'style': o['style'], 'piece_id': str(o['piece_id']).lower(), 'series': o['series'],
            'title': ' '.join(str(o['title']).split()), 'script': script, 'script_sha256': making.script_hash(script),
            'read_back': {'readers': [str(r).strip() for r in rb['readers']], 'found': 'nothing lost'}}


def recorded_names(monday, key, o):
    """(folder, script title) in Teleprompter for a recorded off-day option, named as every piece is (tp_names)."""
    offset = next(off for k, _, off in OFF_DAYS if k == key)
    folder, titles, _ = tp_names(None, monday + timedelta(days=offset), SERIES_LABELS[o['series']], o['title'], ['short'])
    return folder, (titles or {}).get('short')


def week_mix(offdays):
    """The week's mix Growth proposes, {day: [format, ...]}, from every option Growth fills (a piece he records is not
    in it: his Approve on its exact words stays its own press), with the sha256 his one press is bound to."""
    days = {}
    for key, *_ in MIX_DAYS:
        kinds = sorted({str(o.get('format') or 'post') for o in (offdays or {}).get(key) or [] if o.get('kind') != 'recorded'})
        if kinds:
            days[key] = kinds
    return days, hashlib.sha256(json.dumps(days, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def mix_bar(monday, offdays):
    """One press for the week's filler (Ruling, Krish, 2026-10-30: "approve the week's mix once, let Growth fill it"):
    the mix by day, and Approve, saved in picks/mix bound to the mix's hash. Growth then makes and posts within it."""
    days, sha = week_mix(offdays)
    if not days:
        return ''
    names = {k: n for k, n, _ in MIX_DAYS}
    rows = ''.join(f'<li><b>{E(names[k])}</b> {E(", ".join(v))}</li>' for k, v in days.items())
    return (f'<div class="mix" id="ideas-offdays-mix" data-mix-week="{monday.isoformat()}" data-mix-sha256="{sha}" '
            f'data-mix="{E(json.dumps(days, sort_keys=True, separators=(",", ":")))}"><h3>This week\'s mix</h3>'
            f'<p class="id-how">Approve once and Growth makes and posts these, filling each day from the options below. '
            f'Nothing outside this mix goes out.</p><ul class="mix-days">{rows}</ul>'
            f'<div class="tri-row"><button type="button" class="tri" data-act="mix" aria-pressed="false" disabled>Approve this week\'s mix</button></div>'
            f'<p class="tri-state" data-mixstate aria-live="polite"></p></div>')


def offdays_section(monday, offdays):
    """The Off days part of the Ideas tab: the week's mix with its one Approve, each day's options under it (a piece
    he records keeps its own Approve and Skip, on its exact words), or one plain line."""
    head = f'<section class="off-days" id="ideas-offdays" data-week="{monday.isoformat()}"><div class="sec-head"><h2>Off days</h2></div>'
    if not offdays:
        return head + slot_empty('No options for Tuesday, Thursday, Saturday or Sunday yet.') + '</section>'
    parts = [head, mix_bar(monday, offdays)]
    # Tuesday, Thursday, Saturday and Sunday always; Monday, Wednesday and Friday only when Growth's mix fed them.
    shown = [d for d in MIX_DAYS if d[0] in {k for k, *_ in OFF_DAYS} or offdays.get(d[0])]
    for key, weekday, offset in shown:
        when = monday + timedelta(days=offset)
        parts.append(f'<div class="off-day" id="offdays-{key}" data-off-day="{key}"><h3>{weekday} {when.day} {when.strftime("%B")}</h3>')
        opts = offdays.get(key)
        if not opts:
            parts.append(f'<p class="id-how">No options for {weekday} yet.</p></div>')
            continue
        for o in opts:
            did = f'off-{key}-{o["id"]}'
            src = (f'<a href="{E(o["url"])}" target="_blank" rel="noopener">{E(o["source"])}</a>' if o['url'] else E(o['source']))
            rec_attrs, rec_body = '', ''
            if o.get('kind') == 'recorded':
                folder, title = recorded_names(monday, key, o)
                rec_attrs = (f' data-kind="recorded" data-piece="{E(o["piece_id"])}" data-series="{E(o["series"])}" data-style="{E(o["style"])}"'
                             f' data-script-sha256="{o["script_sha256"]}" data-folder-title="{E(folder or "")}" data-tp-title="{E(title or "")}"'
                             f' data-readers="{E("|".join(o["read_back"]["readers"]))}"')
                rec_body = (f'<p class="id-why"><span class="id-why-k">How it is made</span> {E(RECORDED_STYLES[o["style"]])}, one 90-second cut, '
                            f'{E(SERIES_LABELS[o["series"]])}</p>'
                            f'<div class="off-script" data-offscript="{E(did)}">{E(o["script"])}</div>'
                            f'<p class="id-how">Approve puts this piece on {weekday} and sends these exact words to Teleprompter'
                            + (f' as "{E(title)}"' if title else '') + '. Skip leaves it for another week.</p>')
            covers = f' data-covers="{E(" ".join(o["covers"]))}"' if o.get('covers') else ''
            parts.append(
                f'<article class="off-card" id="{E(did)}" data-offday="{E(did)}" data-off-day="{key}" data-option-id="{E(o["id"])}" '
                f'data-format="{E(o["format"])}" data-source="{E(o["source"])}" data-copy-sha256="{o["copy_sha256"]}"{covers}{rec_attrs}>'
                f'<div class="id-flags"><span class="id-flag">{E(o["format"])}</span></div>'
                f'<p class="off-copy">{E(o["copy"])}</p>{rec_body}'
                + (f'<p class="id-why"><span class="id-why-k">Share line</span> {E(o["share_line"])}</p>' if o.get('share_line') else '')
                + (f'<p class="id-how">Still needs: {E("; ".join(o["needs"]))}</p>' if o.get('needs') else '')
                + f'<p class="id-why"><span class="id-why-k">Source</span> {src}</p>'
                + ('' if o.get('kind') != 'recorded' else
                f'<div class="tri-row" role="group" aria-label="Approve or skip this option">'
                f'<button type="button" class="tri" data-act="offday" data-value="approve" data-for="{E(did)}" aria-pressed="false" disabled>Approve</button>'
                f'<button type="button" class="tri" data-act="offday" data-value="skip" data-for="{E(did)}" aria-pressed="false" disabled>Skip</button></div>'
                f'<p class="tri-state" data-offstate="{E(did)}" aria-live="polite"></p>') + '</article>')
        parts.append('</div>')
    parts.append('</section>')
    return ''.join(parts)


def style_line(style):
    """The suggested styles on an idea card: the recommended script and production format, and the bolder try."""
    if not isinstance(style, dict):
        return ''
    try:
        formats = style_formats()
    except (OSError, ValueError):
        return ''
    name = lambda kind, fid: (formats[kind].get(fid) or {}).get('name') or fid
    ex = style.get('experiment') if isinstance(style.get('experiment'), dict) else {}
    ex_name = (formats['script'].get(ex.get('format')) or formats['production'].get(ex.get('format')) or {}).get('name') or ex.get('format')
    out = (f'<dt>Suggested style</dt><dd data-style-script="{E(style.get("script") or "")}" data-style-production="{E(style.get("production") or "")}">'
           f'{E(name("script", style.get("script")))} · {E(name("production", style.get("production")))}</dd>')
    if ex_name:
        out += f'<dt>Or try something new</dt><dd data-style-experiment="{E(ex.get("format") or "")}">{E(ex_name)}: {E(ex.get("why") or "")}</dd>'
    return out


def ideas_panel(monday, ideas, hidden, queue=None, offdays=None):
    """The Ideas tab, first: each day's ideas with a pick box. Krish,
    2026-10-18: "refresh This Week's Publish Board by adding a 4th tab at the
    front: Ideas. Cementing Ideas and basic narrative is Sunday's job." A pick
    is saved at once in the page's own store (picks/<day>) and posted as a
    comment ("PICK <day>"), which either of his accounts can read; a session
    writes it onto the pieces through /api/week/options. In the fixed layout
    each idea also has his four other presses (presses_row) and the tab ends
    with the off days (offdays_section)."""
    head = f'<div class="kick">{E(week_span(monday))}</div><h1>Ideas</h1>'
    how = ('Pick one idea for each day, with a note if you like. Or keep an idea for a wider piece, a future trend or next '
           'week, or reject it. Every fact here was checked against the source linked beside it.' if FIXED else
           'Pick one idea for each day. Your pick is saved as soon as you tick it, and Claude starts '
           'that day\'s piece from it. Every fact here was checked against the source linked beside it. '
           'There are no titles yet: you choose those after you record.')
    parts = [f'<div class="pm{" fixed" if FIXED else ""}" id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" data-day="ideas" data-state="ideas" '
             f'tabindex="-1"{" hidden" if hidden else ""}>'
             + (f'<div class="day-head">{head}</div>' if FIXED else head) + f'<p class="id-how">{E(how)}</p>']
    for key, name, weekday, offset, slug, series_label in DAYS:
        when = monday + timedelta(days=offset)
        parts.append(f'<section class="id-day" id="ideas-{key}" data-ideas-day="{key}">'
                     f'<div class="sec-head"><h2>{weekday} {when.day} {when.strftime("%B")}</h2>'
                     f'<span class="id-series">{E(series_label)}</span></div>'
                     f'<p class="id-state" data-pickstate="{key}" aria-live="polite"></p>' + queue_block(queue, key, slug))
        for idea in ideas.get(key, []):
            pid, src = idea['pick'], idea['source']
            kind = idea.get('source_kind')
            flags = (f'<span class="id-flag id-src {E(kind)}" data-source-kind="{E(kind)}">{E(SOURCE_KINDS[kind])}</span>' if kind else '') + ''.join(
                f'<span class="id-flag{c}">{t}</span>' for c, t, on in (
                    (' his', 'Your idea', idea.get('his') and not kind), ('', 'Recommended', idea.get('recommended'))) if on)
            beats = ''.join(f'<li>{E(b.strip())}</li>' for b in idea.get('beats') or [])
            parts.append(
                f'<article class="id-card" id="idea-{pid}" data-pick-card="{pid}" data-series="{slug}" data-week="{monday.isoformat()}">'
                f'<label class="pick"><input type="radio" name="pick-{key}" data-pick="{key}" value="{pid}" '
                f'data-idea-id="{E(idea.get("id") or "")}" data-series="{slug}" disabled>'
                f'<span class="box" aria-hidden="true"></span><span class="t-label">Pick this for {weekday}</span>'
                f'<span class="t-when"></span><span class="t-err"></span></label>'
                + (f'<div class="id-flags">{flags}</div>' if flags else '') +
                f'<p class="id-sowhat">{E(idea["so_what"])}</p>'
                f'<p class="id-story">{E(idea["story"])}</p>'
                + (f'<ol class="id-beats" aria-label="The story, beat by beat">{beats}</ol>' if beats else '')
                + (f'<p class="id-why"><span class="id-why-k">Why it is here</span> {E(str(idea["why_here"]).strip())}</p>' if idea.get('why_here') else '') +
                f'<dl class="id-facts"><dt>Why now</dt><dd>{E(idea["why_now"])}</dd>'
                f'<dt>Strongest checked fact</dt><dd>{E(idea["fact"])}</dd>'
                f'<dt>Source</dt><dd><a href="{E(src["url"])}" target="_blank" rel="noopener">{E(src.get("label") or src["url"])}</a></dd>'
                + (f'<dt>Where it came from</dt><dd>{E(idea["from"])}</dd>' if idea.get('from') else '')
                + style_line(idea.get('style')) +
                '</dl>' + (presses_row(pid, key, monday) if FIXED else triage_row(pid)) + '</article>')
        parts.append('</section>')
    if FIXED:
        parts.append(offdays_section(monday, offdays))
    parts.append('</div>')
    return ''.join(parts)


REVIEW_BOX = re.compile(r'<textarea class="rv-text" id="rv-([^"]+)"[^>]*?\sdata-built-at="([^"]+)"[^>]*>(.*?)</textarea>', re.S)


def previous_review_times(page, review):
    """{review id: its build time} on the board being replaced (its page, or
    its manifest), for each block this build gives again with the same words."""
    now = {f'{day}-{slug}': text for day, items in (review or {}).items() for slug, _, text in items}
    try:
        manifest = json.loads(page) if page.lstrip().startswith('{') else None
    except ValueError:
        manifest = None
    if isinstance(manifest, dict):
        out = {}
        for day, items in (manifest.get('review') or {}).items():
            for it in items if isinstance(items, list) else []:
                rid = f'{day}-{it.get("item")}'
                if rid in now and it.get('built_at') and it.get('sha256') == hashlib.sha256(now[rid].encode('utf-8')).hexdigest():
                    out[rid] = it['built_at']
        return out
    return {rid: at for rid, at, text in REVIEW_BOX.findall(page) if rid in now and html.unescape(text) == now[rid]}


def previous_draft(page, key):
    """(review ids, calls) of a day the board being replaced holds in draft:
    its page, or its manifest. ([], []) when it holds none."""
    try:
        manifest = json.loads(page) if page.lstrip().startswith('{') else None
    except ValueError:
        manifest = None
    if isinstance(manifest, dict):
        day = next((d for d in manifest.get('days') or [] if isinstance(d, dict) and d.get('day') == key), {})
        if day.get('state') != 'draft':
            return [], []
        return ([f'{key}-{it.get("item")}' for it in (manifest.get('review') or {}).get(key) or []], list(day.get('waiting') or []))
    name = next(n for k, n, *_ in DAYS if k == key)
    start = page.find(f'id="panel-{name}"')
    start = page.rfind('<div class="pm', 0, start) if start >= 0 else -1
    if start < 0 or 'data-state="draft"' not in page[start:start + 400]:
        return [], []
    panel = div_at(page, start)
    calls = re.search(r'<ol class="do">(.*?)</ol>', panel, re.S)
    return ([rid for rid, _, _ in REVIEW_BOX.findall(panel)],
            [html.unescape(c) for c in re.findall(r'<li>(.*?)</li>', calls.group(1), re.S)] if calls else [])


def with_review(panel, card, after_heading=False):
    """The panel with its review card replaced (or added after its opening
    tag, or for a day in draft after its status line and heading, so the tab
    says "in review, not ready to post" before the words)."""
    panel = re.sub(re.escape(REVIEW_START) + r'.*?' + re.escape(REVIEW_END), '', panel, flags=re.S)
    if not card:
        return panel
    if after_heading and '</h1>' in panel:
        at = panel.index('</h1>') + len('</h1>')
        return panel[:at] + card + panel[at:]
    m = re.match(r'<div class="pm"[^>]*>', panel)
    return panel[:m.end()] + card + panel[m.end():] if m else card + panel


def made_parts(page, day, name, p, links, warnings, videos=None, deep=False):
    """The parts of a made day, from its publish page: its heading (kick, title, chips), the publish page from its
    links card on, the scripts to record, and the cards the board adds."""
    body = page['body']
    # The Scripts section's cards, copied to the top beside the Record card.
    sec = re.search(r'<section id="scripts"><h2>[^<]*</h2>(?:<p class="why">[^<]*</p>)?(.*?)</section>', body, re.S)
    scripts = ''
    if sec:
        cards = re.sub(r'<div class="btns"><button class="ghost" data-act="done" data-ref="[^"]+">Mark done</button></div>', '', sec.group(1))
        scripts = '<div class="rec-scripts" aria-label="Scripts to record">' + prefix(cards, p + 'rec-') + '</div>'
    else:
        warnings.append(f'{name}: its publish page has no Scripts section, so no script is at the top')
    # The page's own Mark done buttons kept their ticks in one browser only; the ticks replace them.
    body = re.sub(r'<div class="btns"><button class="ghost" data-act="done" data-ref="[^"]+">Mark done</button></div>', '', body)
    if 'data-act="done"' in body:
        raise BoardError(f'{name}: a Mark done button in a shape this board does not know; it would keep a tick in one browser only')
    found = set()

    def heading(m):
        head = m.group(2)
        where = re.sub(r'^\d+\.\s*', '', html.unescape(re.sub(r'<[^>]+>', '', head))).strip()
        key = SECTION_STEP.get(where) or ('youtube' if re.fullmatch(r'YouTube \(the .+\)', where) else None)
        if not key:
            return m.group(0)
        found.add(key)
        return f'<section id="{m.group(1)}"><div class="sec-head"><h2>{head}</h2>{section_tick(day, key)}</div>'

    body = re.sub(r'<section id="([^"]+)"><h2>(.*?)</h2>', heading, body, flags=re.S)
    for key, _, channel, standing in STEPS:
        if channel and standing and key not in found:
            warnings.append(f'{name}: no {LABEL[key]} section on its publish page; its tick is in the checklist only')
    body = prefix(body, p)
    links_line = '<div class="files">Paste each link once; every Copy button below carries it.</div>'
    if links_line in body:
        body = body.replace(links_line, links_line[:-6] + ' <span class="link-state" data-linkstate></span></div>', 1)
    anchor = '<div class="card links">'
    if body.count(anchor) != 1:
        raise BoardError(f'{name}: its publish page needs one links card ({anchor}); is it from publish_manager.py?')
    head, rest = body.split(anchor, 1)
    return {'head': head, 'publish': anchor + rest, 'scripts': scripts,
            'videos': videos_card(day, p, videos, deep), 'record': record_card(day, p, links, deep),
            'checklist': checklist(day, p, deep),
            'link_state': '' if links_line in page['body'] else '<p class="files"><span class="link-state" data-linkstate></span></p>'}


SAVE_NOTE = ('<p class="save-note">Each tick saves here at once. Claude copies them onto the piece&#x27;s record in the engine, '
             'which updates the board and Control Center.</p>')


def made_panel(page, day, name, p, links, hidden, warnings, videos=None, deep=False):
    """A made day in a week before the fixed layout: its publish page with the cards added at the top."""
    parts = made_parts(page, day, name, p, links, warnings, videos, deep)
    body = (parts['head'] + parts['videos'] + parts['record'] + parts['scripts'] + parts['checklist'] + parts['link_state']
            + parts['publish'] + SAVE_NOTE)
    return (f'<div class="pm" id="panel-{name}" role="tabpanel" aria-labelledby="tab-{name}" data-prefix="{p}" '
            f'data-day="{day}" data-state="made" data-post="{E(page["post"])}" tabindex="-1"{" hidden" if hidden else ""}>'
            + body + '</div>')


def not_made_panel(day, name, weekday, when, series_label, pick, hidden, draft=False, calls=(), deep=False, moved=None):
    """A tab with no publish page: a day not picked, a day picked and not
    made, or a day in draft. A day in draft is a piece whose words are in
    review (--draft, with --review): its tab is the review card, a line
    saying it is not ready, the calls waiting on Krish (--waiting) and its
    checklist. Never an older publish page under new words: on 15 October
    Friday v3 sat on top of its first version's page, whose chips said the
    new words were fact-checked and in Teleprompter when neither was true."""
    p = f'{day}-'
    if draft:
        values = {
            'STATE': 'draft', 'KICK': E(f'{series_label} · {when} · in review, not ready to post'),
            'HEADING': E(f'{weekday}\'s words, in review'),
            'LINE': E('Change or comment on the words above. Nothing in this tab is ready to record or post yet: it gets '
                      'its publish page, with every Copy card, once the words are signed off, the fact check has passed '
                      'on them and the title is picked.'),
            'CALLS': ('<h2>Waiting on you</h2><ol class="do">' + ''.join(f'<li>{E(c)}</li>' for c in calls) + '</ol>') if calls else '',
            'CHECKLIST': checklist(day, p, deep),
        }
    elif pick:
        # The heading is the weekday, as on a day not picked, and the idea is said once in plain words beneath it. The
        # engine's own line for a piece can be long and is never a title (Krish, 2026-10-19: "too aggressive").
        said = pick.get('plain') or pick.get('title') or f'{weekday}\'s piece'
        values = {
            'STATE': 'picked', 'KICK': E(f'{series_label} · {when} · picked, not made yet'), 'HEADING': E(weekday),
            'LINE': E(f'{said} Picked for {weekday} and not made yet. Its publish board appears in this tab once it is made.'),
            'CALLS': '',
            'CHECKLIST': checklist(day, p, deep),
        }
    elif moved:
        # A piece that moved to another day says where it went and links to it, as the fixed layout does (--moved).
        to, href = moved_link(moved)
        values = {
            'STATE': 'not_picked', 'KICK': E(f'{series_label} · {when} · moved to {to}'), 'HEADING': E(weekday),
            'LINE': E(f'This piece moved to {to}.'),
            'CALLS': f'<p class="id-how"><a href="{E(href)}">Open it on its board</a></p>',
            'CHECKLIST': '',
        }
    else:
        values = {
            'STATE': 'not_picked', 'KICK': E(f'{series_label} · {when} · not picked'), 'HEADING': E(weekday),
            'LINE': E(f'{weekday}\'s {series_label} piece is not picked yet. Pick it on the week page and it will be made here.'),
            'CALLS': '',
            'CHECKLIST': '',
        }
    values.update({'DAYNAME': name, 'DAY': day, 'PREFIX': p, 'HIDDEN': ' hidden' if hidden else ''})
    return fill(template('not-made.html'), values, 'not-made.html')


# ------------------------------------------------------------------ the fixed layout's parts
# Every part below has one place in the day and one look; a session fills it from data and never adds markup.

BRIEF_FIELDS = (('idea', 'The idea'), ('flow', 'The story, beat by beat'), ('ending', 'The ending'),
                ('takeaway', 'The takeaway'), ('angle', 'The angle'), ('tone', 'The tone'), ('reader', 'Who it is for'))


def read_brief(data, where='--brief'):
    """A day's record-ready brief (Krish, 2026-10-21: "we've agreed on the idea in the previous step but now we've
    also agreed on the narrative flow, the end of the story, the takeaway, and the rough angle and tone"):
    {idea, flow: [3 to 6 beats], ending, takeaway, angle, tone, reader?, agreed?, agreed_at?}. No title: titles are
    his, after he records (TITLES_AFTER_RECORDING)."""
    if not isinstance(data, dict):
        raise BoardError(f'{where}: give {{"idea", "flow": [beats], "ending", "takeaway", "angle", "tone"}}')
    problems = [f'no {f}' for f in ('idea', 'ending', 'takeaway', 'angle', 'tone') if not str(data.get(f) or '').strip()]
    flow = data.get('flow')
    if not isinstance(flow, list) or not 3 <= len([b for b in flow if str(b).strip()]) <= 6:
        problems.append('flow must be 3 to 6 beats')
    if data.get('title'):
        problems.append('a title; titles are signed off after he records (TITLES_AFTER_RECORDING)')
    unknown = set(data) - {f for f, _ in BRIEF_FIELDS} - {'agreed', 'agreed_at', 'piece_id'}
    if unknown:
        problems.append(f'fields the board has no place for: {sorted(unknown)}')
    if problems:
        raise BoardError(f'{where}: ' + '; '.join(problems))
    return {**{f: data.get(f) for f, _ in BRIEF_FIELDS}, 'flow': [str(b).strip() for b in flow if str(b).strip()],
            'agreed': data.get('agreed') is True, 'agreed_at': data.get('agreed_at') if isinstance(data.get('agreed_at'), str) else None,
            'piece_id': data.get('piece_id') if UUID.match(str(data.get('piece_id') or '')) else None}


def brief_card(p, brief):
    rows = []
    for field, label in BRIEF_FIELDS:
        value = brief.get(field)
        if not value:
            continue
        shown = ('<ol class="br-flow">' + ''.join(f'<li>{E(b)}</li>' for b in value) + '</ol>') if field == 'flow' else E(str(value))
        rows.append(f'<dt>{E(label)}</dt><dd>{shown}</dd>')
    state = (f'Agreed{" " + E(short_when(brief["agreed_at"])) if brief.get("agreed_at") else ""}' if brief.get('agreed')
             else 'Waiting for your yes: comment on anything to change')
    return (f'<div class="card brief" id="{p}brief-card"><div class="row"><span class="lab">Record-ready brief</span>'
            f'<span class="chip{" ok" if brief.get("agreed") else ""}">{state}</span></div><dl class="br">{"".join(rows)}</dl></div>')


def short_when(at):
    when = parse_time(at)
    return f'{when.day} {when.strftime("%b")}' if when else ''


def slot_empty(text):
    return f'<div class="slot-empty"><p>{E(text)}</p></div>'


def due(when, rule):
    """When a step is due, from config/board-layout.json's rhythm: "Sun 25 Oct, midday". A rule is either days_before
    the publishing day, or on "sunday_before": the Sunday that starts the publishing week, his recording day
    (Krish, 2026-10-24: "Yes, Sunday is my recording day")."""
    if rule.get('on') == 'sunday_before':
        d = when - timedelta(days=when.weekday() + 1)
    elif rule.get('on') == 'recording_sunday':
        # Layout v3: the board for week W is recorded on Sunday W-8 and goes live on Monday W.
        d = when - timedelta(days=when.weekday() + 8)
    else:
        d = when - timedelta(days=int(rule['days_before']))
    return f'{short_date(d)}, {rule["when"]}'


def step_nav(p, weekday, opened, notes):
    buttons = []
    for n, step in enumerate(LAYOUT['day_steps'], 1):
        k = step['key']
        on = k == opened
        buttons.append(
            f'<button type="button" role="tab" class="st" id="{p}st-{k}" aria-controls="{p}sub-{k}" data-sub="{k}" '
            f'aria-selected="{"true" if on else "false"}" tabindex="{"0" if on else "-1"}">'
            f'<span class="st-n">{n}</span><span class="st-label">{E(step["label"])}</span>'
            f'<span class="st-note">{E(notes.get(k) or "")}</span></button>')
    return (f'<div class="steps" role="tablist" aria-label="{E(weekday)}: {", ".join(s["label"] for s in LAYOUT["day_steps"])}">'
            + ''.join(buttons) + '</div>')


def step_panel(p, k, opened, inner):
    what = next(s['what'] for s in LAYOUT['day_steps'] if s['key'] == k)
    return (f'<div class="subpanel" role="tabpanel" id="{p}sub-{k}" aria-labelledby="{p}st-{k}" data-sub="{k}" tabindex="-1"'
            f'{"" if k == opened else " hidden"}><p class="st-what">{E(what)}</p>{inner}</div>')


def fixed_day_panel(day, name, weekday, when, series_label, state, hidden, head, slots, notes, attrs=''):
    """One day in the fixed layout: its heading, then its four steps, always Brief, Drafts, Record, Publish, each a
    tab of its own. The step that is open first is where the day is: the brief until it is drafted, the drafts while
    they are in review, and Publish once it is made."""
    p = f'{day}-'
    opened = {'not_picked': 'brief', 'picked': 'brief', 'draft': 'drafts', 'made': 'publish'}[state]
    return (f'<div class="pm fixed" id="panel-{name}" role="tabpanel" aria-labelledby="tab-{name}" data-prefix="{p}" '
            f'data-day="{day}" data-state="{state}"{attrs} tabindex="-1"{" hidden" if hidden else ""}>'
            f'<div class="day-head">{head}</div>' + step_nav(p, weekday, opened, notes)
            + ''.join(step_panel(p, k, opened, slots.get(k) or '') for k in DAY_STEPS) + '</div>')


def fixed_head(kick, heading, calls=()):
    waiting = ('<div class="notice" role="note"><h2>Waiting on you</h2><ol class="do">'
               + ''.join(f'<li>{E(c)}</li>' for c in calls) + '</ol></div>') if calls else ''
    return f'<div class="kick">{E(kick)}</div><h1>{E(heading)}</h1>{waiting}'


# ------------------------------------------------------------------ the Publish step's run-sheet (the fixed layout)
# Krish, 2026-10-21: "have a think about where I publish, how I publish, what I need to download, when, and in what
# order. Just make everything as beautiful and user-friendly as possible." So a made day's Publish step is one ordered
# run-sheet, drawn here from data: the day's progress at the top, then Download first (every file for the day, in the
# order he uses them, each with one big Download), then one card per place to post, in config/board-layout.json's
# order, each with the same parts in the same order: the files it needs (links back to Download first), its words to
# copy, what to do, its link box where it has one, and its tick. The words, the files and what to do come from
# publish_kit.steps() on the page's own words (its pm-data block); the pictures and the copy are the publish page's,
# under the ids they always had, so a saved comment or a copy_updates refresh still finds its box. Nothing in it comes
# from a session's markup.

PM_DATA = re.compile(r'<script type="application/json" id="pm-data">(.*?)</script>', re.S)
PM_SECTION = re.compile(r'<section id="([^"]+)"><h2>(.*?)</h2><p class="why">(.*?)</p>(.*?)'
                        r'<div class="btns"><button class="ghost" data-act="done" data-ref="\1">Mark done</button></div></section>', re.S)
PM_COPY = re.compile(r'<div class="card"><div class="row"><span class="lab">(?P<label>[^<]*)</span><div class="btns">'
                     r'<button data-act="text" data-ref="(?P<cid>c\d+)">Copy</button></div></div>'
                     r'<pre class="txt" id="(?P=cid)" data-raw="(?P<raw>[^"]*)">'
                     r'|<div class="card"><span class="lab">(?P<missing>[^<]*)</span><span class="missing">')
PM_PIC = re.compile(r'<div class="card pic"><div class="row"><span class="lab">([^<]*)</span><div class="btns">.*?'
                    r'data-name="([^"]*)">Download</button></div></div><img id="img-([^"]+)" src="([^"]+)" alt="([^"]*)">'
                    r'(?:<div class="files">([^<]*)</div>)?', re.S)
PM_ARTICLE = re.compile(r'<div class="article" id="art">(.*?)</div>\n<pre id="art-text" hidden>(.*?)</pre>', re.S)
# A picture's role on the publish page (publish_manager.COVER_ROLES, and "cover"), and the file name each stands for.
COVER_ORDER = ('cover', 'vertical-cover', 'square-cover', 'share-card-cover')
ROLE_FILE = {'cover': 'cover', 'vertical-cover': 'vertical_cover', 'square-cover': 'square', 'share-card-cover': 'share_card'}
ROLE_LABEL = {'cover': ('Substack cover (1200 x 630)', "Substack: the post's cover image and the email thumbnail"),
              'vertical-cover': ('Vertical cover (1080 x 1920)', 'Shorts, TikTok and Reels: the cover of the 90-second video'),
              'square-cover': ('Square cover (1080 x 1080)', 'The Instagram feed, when you want it'),
              'share-card-cover': ('Share card (1200 x 675)', 'LinkedIn, when you post a picture with the link')}
LINK_BOX = {'substack': ('article', 'Article link, once the post is live', 'https://...'),
            'youtube': ('youtube', 'YouTube link, once the video is public', 'https://youtu.be/...')}


def publish_data(page, name, warnings):
    """A made day's publish page as data: its words (for publish_kit.steps), the copy of each of its sections by the
    ids the page gave them, its pictures with their roles and bytes, and the article as Substack takes it."""
    body = page['body']
    words = page.get('words')
    if words is None:
        warnings.append(f'{name}: its publish page was made before it carried its words as data, so the run-sheet names '
                        'the standing files; make the page again with publish_manager.py to name its own')
        words = {'title': page.get('title') or ''}
    sections, headings = {}, []
    for m in PM_SECTION.finditer(body):
        if m.group(1) == 'substack' or re.fullmatch(r's\d+', m.group(1)):
            headings.append((m.group(1), re.sub(r'^\d+\.\s*', '', html.unescape(re.sub(r'<[^>]+>', '', m.group(2)))).strip()))
        copy = []
        for c in PM_COPY.finditer(m.group(4)):
            if c.group('cid'):
                copy.append({'label': html.unescape(c.group('label')), 'cid': c.group('cid'), 'text': html.unescape(c.group('raw'))})
            else:
                copy.append({'label': html.unescape(c.group('missing')), 'cid': None, 'text': None})
        sections[m.group(1)] = copy
    meta = {i['id']: i for i in page.get('images') or []}
    guess = {v: k for k, v in publish_manager.COVER_ROLES.items()}
    pictures, seen = [], set()
    for label, fname, iid, src, alt, caption in PM_PIC.findall(body):
        if iid in seen:
            continue
        seen.add(iid)
        label = html.unescape(label)
        role = (meta.get(iid) or {}).get('role') or guess.get(label) or ('cover' if label.startswith('Cover and email thumbnail') else None)
        if role and role not in ROLE_FILE:
            role = None
        shown = re.sub(r'^Picture \d+: ', '', label)
        pictures.append({'id': iid, 'role': role, 'label': shown, 'name': html.unescape(fname), 'src': src,
                         'alt': html.unescape(alt), 'caption': html.unescape(caption) if caption else ''})
    art = PM_ARTICLE.search(body)
    return {'words': words, 'sections': sections, 'headings': headings, 'pictures': pictures,
            'article': {'html': art.group(1), 'text': art.group(2)} if art else None}


def post_folder(folder, videos):
    """The post's folder in his library, '3 Posts/<post folder>': the record's pack, else a video's library path."""
    if isinstance(folder, str) and folder.strip():
        return folder.strip().removeprefix('3 Posts/').strip('/')
    for v in videos or []:
        m = re.match(r'3 Posts/([^/]+)/', str((v or {}).get('path') or '') if isinstance(v, dict) else '')
        if m:
            return m.group(1)
    return None


def drive_links(url):
    """(download, view) for a Drive file link, or None."""
    m = DRIVE_ID.search(str(url or ''))
    if not m:
        return None
    fid = m.group(1)
    return f'https://drive.usercontent.google.com/download?id={fid}&export=download', f'https://drive.google.com/file/d/{fid}/view'


def dl_item(p, iid, name, used_for, actions, state, extra=''):
    # A file that is ready takes Reject asset in the fixed layout (reject_parts).
    attrs, button, box = reject_parts(p, iid, name, actions) if FIXED and state == 'ready' else ('', '', '')
    return (f'<li class="dl-item" id="{p}dl-{iid}" data-dl="{iid}" data-state="{state}"{attrs}><div class="dl-what">'
            f'<span class="dl-name">{E(name)}</span><span class="dl-for">{E(used_for)}</span></div>'
            f'<div class="dl-act">{actions}{button}</div>{extra}{box}</li>')


def drive_actions(url, what='Download'):
    down, view = drive_links(url)
    return (f'<a class="btnlink dl-btn" href="{E(down)}" target="_blank" rel="noopener">{E(what)}</a>'
            f'<a class="btnlink ghost" href="{E(view)}" target="_blank" rel="noopener">Open in Drive</a>')


def immutable_video_download(video):
    """Accept only the exact library version named by the making record.

    This formats a link; board activation independently verifies qualification.
    """
    url = video.get('url') or ''
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    digest = video.get('sha256') or ''
    if (parsed.scheme == 'https' and parsed.netloc == 'content.krishraja.com'
            and parsed.path == '/api/library/file' and not parsed.fragment
            and re.fullmatch(r'[a-f0-9]{64}', digest)
            and query == {'path': [video.get('path')], 'sha256': [digest], 'download': ['1']}):
        return f'<a class="btnlink dl-btn" href="{E(url)}" target="_blank" rel="noopener">Download</a>'
    return None


def material_rows(videos, delivery, feature):
    """{row: material file} for the Download first rows the day's materials fill (board_materials.FILLS): a cut, or its
    thumbnail, that the making record does not hold. The record wins whenever it holds the cut."""
    held = {v['cut'] for v in videos or [] if isinstance(v, dict) and v.get('cut') in ('long', 'short', 'feature')}
    cuts = {cut for cut, _, _ in video_cuts(feature)}
    return {row: item for row, item in board_materials.fills(delivery).items()
            if row.split('-', 1)[1] in cuts and row.split('-', 1)[1] not in held}


def material_actions(item):
    return f'<a class="btnlink dl-btn" href="{E(item["url"])}" target="_blank" rel="noopener">Download</a>'


def material_extra(item):
    return f'<img class="dl-pic" src="{E(item["preview"])}" alt="{E(item["label"])} preview">' if item.get('preview') else ''


def dl_videos(p, videos, feature, materials=None):
    """The first files in Download first: each finished video, then each one's thumbnail, from the making record.
    Krish, 2026-10-14: "You should always link the Google Drive videos because I need to actually download them onto
    my computer"; 2026-10-12: "I always want a video thumbnail for all video sizes produced as an asset every time".
    Its own group, so a kept day's videos are drawn again from the record (board(), --keep). A cut the record does
    not hold takes the day's materials file that fills its row (material_rows), so a finished cut that is not on the
    record yet still downloads from its own row; it never marks the cut made on the record."""
    by_cut = {v['cut']: v for v in videos or [] if isinstance(v, dict) and v.get('cut') in ('long', 'short', 'feature')}
    materials = materials or {}
    cuts = LAYOUT['cuts']
    rows, thumbs = [], []
    for cut, label, where in video_cuts(feature):
        v = by_cut.get(cut)
        name = cuts[cut]['name']
        if not v and (f'video-{cut}' in materials or f'thumb-{cut}' in materials):
            for row, out, title in ((f'video-{cut}', rows, label), (f'thumb-{cut}', thumbs, f'Thumbnail for the {name}')):
                item = materials.get(row)
                out.append(dl_item(p, row, title, f'For {where}', material_actions(item), 'ready', material_extra(item)) if item else
                           dl_item(p, row, title, f'For {where}', '<span class="rec-none">Not made yet</span>', 'waiting'))
            continue
        if not v:
            rows.append(dl_item(p, f'video-{cut}', label, f'For {where}', '<span class="rec-none">Not made yet</span>', 'waiting'))
            thumbs.append(dl_item(p, f'thumb-{cut}', f'Thumbnail for the {name}', f'For {where}',
                                  '<span class="rec-none">Not made yet</span>', 'waiting'))
            continue
        secs = v.get('seconds')
        length = f'. {int(secs) // 60} min {int(secs) % 60:02d} s' if isinstance(secs, (int, float)) and secs else ''
        immutable = immutable_video_download(v)
        if immutable:
            rows.append(dl_item(p, f'video-{cut}', label, f'For {where}{length}', immutable, 'ready'))
        elif drive_links(v.get('url')):
            rows.append(dl_item(p, f'video-{cut}', label, f'For {where}{length}', drive_actions(v['url']), 'ready'))
        else:
            rows.append(dl_item(p, f'video-{cut}', label, f'For {where}{length}',
                                f'<span class="rec-none">Not in Drive yet: it is in the post\'s folder as {E(v.get("name") or "")}, '
                                'and its link joins this list once Library Sync has written it</span>', 'pending'))
        thumb = v.get('thumbnail') if isinstance(v.get('thumbnail'), dict) else {}
        if drive_links(thumb.get('url')):
            thumbs.append(dl_item(p, f'thumb-{cut}', f'Thumbnail for the {name}', f'For {where}', drive_actions(thumb['url']), 'ready'))
        elif thumb.get('path'):
            thumbs.append(dl_item(p, f'thumb-{cut}', f'Thumbnail for the {name}', f'For {where}',
                                  f'<span class="rec-none">In the same folder as {E(Path(thumb["path"]).name)}; its link joins this '
                                  'list once recorded</span>', 'pending'))
        else:
            thumbs.append(dl_item(p, f'thumb-{cut}', f'Thumbnail for the {name}', f'For {where}',
                                  '<span class="rec-none">No thumbnail on the record yet; its link joins this list once recorded</span>', 'pending'))
    return '<div class="dl-group" data-dl-group="videos"><ol class="dl-list">' + ''.join(rows + thumbs) + '</ol></div>'


def run_sheet(day, p, page, data, videos, delivery, feature, folder, warnings):
    """A made day's Publish step in the fixed layout: its progress, Download first, Approve for publish, and a card per
    place to post. data is the page's data (publish_data), with the record's piece and manifest hash beside it."""
    words, sections, pictures = data['words'], data['sections'], data['pictures']
    names = publish_kit.file_names(words)
    slug = re.sub(r'[^a-z0-9]+', '-', (page.get('title') or 'post').lower()).strip('-')[:40] or 'post'
    item_of = {names['long_video']: 'video-long', names['short_video']: 'video-short', names['wide_thumbnail']: 'thumb-long'}
    label_of = {'video-long': LAYOUT['cuts']['long']['name'], 'video-short': LAYOUT['cuts']['short']['name'],
                'thumb-long': f'Thumbnail for the {LAYOUT["cuts"]["long"]["name"]}', 'video-feature': LAYOUT['cuts']['feature']['name'],
                'article': 'The article (HTML)'}
    if feature:
        # The feature's two cards name its video and its own wide thumbnail; both are in Download first on a feature piece.
        item_of.setdefault(names['feature_video'], 'video-feature')
        item_of.setdefault(names['feature_thumbnail'], 'thumb-feature')
        label_of['thumb-feature'] = f'Thumbnail for the {LAYOUT["cuts"]["feature"]["name"]}'
    # The files after the videos, in the order he uses them: the Substack cover, the vertical cover, the covers for
    # the other places, then the article and the pictures in it. Each picture once, wherever the page showed it.
    files = []
    covers = sorted((x for x in pictures if x['role']), key=lambda x: COVER_ORDER.index(x['role']))
    for x in covers:
        name, used_for = ROLE_LABEL[x['role']]
        iid = f'img-{x["id"]}'
        item_of.setdefault(names[ROLE_FILE[x['role']]], iid)
        label_of[iid] = name
        files.append(dl_item(p, iid, name, f'For {used_for}', pic_actions(p, x), 'ready', pic_extra(p, x)))
    if names['spotify_thumbnail'] != names['wide_thumbnail']:
        link = ((words.get('links') or {}).get(names['spotify_thumbnail']) or '')
        item_of[names['spotify_thumbnail']] = 'thumb-spotify'
        label_of['thumb-spotify'] = 'Spotify thumbnail (1920 x 1080)'
        files.append(dl_item(p, 'thumb-spotify', 'Spotify thumbnail (1920 x 1080)', 'For Spotify: the episode thumbnail',
                             drive_actions(link) if drive_links(link) else
                             f'<span class="rec-none">In the post\'s folder as {E(names["spotify_thumbnail"])}</span>',
                             'ready' if drive_links(link) else 'pending'))
    article = data['article']
    if article:
        item_of[names['substack_copy']] = 'article'
        files.append(dl_item(p, 'article', 'The article (HTML)', 'For Substack, if pasting it from the Substack card does not work, and to keep',
                             f'<button type="button" class="dl-btn" data-act="download" data-ref="{p}art" data-name="{E(slug)}-article.html" '
                             f'data-title="{E(page.get("title") or "")}">Download</button>', 'ready', '<div class="status" aria-live="polite"></div>'))
    else:
        warnings.append(f'{day}: its publish page has no article to copy; the Substack card says so')
    for n, x in enumerate((x for x in pictures if not x['role']), 1):
        iid = f'img-{x["id"]}'
        label_of[iid] = f'Picture {n} in the article'
        files.append(dl_item(p, iid, f'Picture {n} in the article: {x["label"]}', 'For Substack, if a picture does not come through with the article',
                             pic_actions(p, x), 'ready', pic_extra(p, x)))
    filled = material_rows(videos, delivery, feature) if delivery else {}
    groups = dl_videos(p, videos, feature, filled) + ('<div class="dl-group" data-dl-group="files"><ol class="dl-list">' + ''.join(files) + '</ol></div>'
                                                     if files else '')
    if delivery:
        groups += board_materials.render_group(day, delivery, set(filled))
    on_page = len(re.findall(r'data-act="download"', groups))
    where = (f'In Drive: makeyourmindup, 3 Posts, {folder}.' if folder else
             'In Drive: makeyourmindup, 3 Posts, in the post\'s own folder.')
    every = (f'<div class="dl-all">' + (f'<button type="button" class="dl-btn" data-act="download-all" data-ref="{p}download">'
                                         f'Download all {on_page} files on this page</button><div class="status" aria-live="polite"></div>'
                                         if on_page >= 2 else '')
             + f'<p class="dl-note">The videos and thumbnails download from Drive, one tap each. Everything for this post is also '
               f'in its library folder. {E(where)} Download that folder to get every file at once.</p></div>')
    download_first = (f'<div class="rec dl" id="{p}download" role="region" aria-labelledby="{p}download-h"><div class="rec-head">'
                      f'<h2 id="{p}download-h">Download first</h2><span class="kick">In the order you use them</span></div>'
                      '<p class="rec-how">Everything you need today, before you open Substack. The videos come first, then the pictures, '
                      'then the article.</p>' + groups + every + '</div>')
    # The places to post, in config/board-layout.json's order; the optional ones under their own heading.
    kit_steps = publish_kit.steps(words, on_board=True)
    if feature and not any(x['where'] == publish_kit.FEATURE_YOUTUBE for x in kit_steps):
        # The board knows the piece is a feature (config/features.json) even when its page's words do not name the
        # piece: the feature's two cards still take their files, words and do-steps from the kit.
        kit_steps += publish_kit.feature_steps(words, words.get('files') or {}, words.get('comment_question') or '', on_board=True)
    kit = section_kit(day, kit_steps, data.get('headings') or [])
    standing, optional, jump, n = [], [], [], 0
    group = standing
    for key, label, channel, counted in STEPS:
        if not counted and key in FEATURE_ONLY and not feature:
            continue
        if not channel and key not in FEATURE_ONLY:
            # A recording: its tick is under Record, and the list at the top points there.
            jump.append(f'<li><a href="#{p}record" data-tickstate="{day}-{key}">{E(label.split(" (")[0])}</a></li>')
            continue
        n += 1
        card = run_card(day, p, n, key, label, kit.get(key), sections, article, item_of, label_of, feature, warnings)
        # A feature's posting card is never counted and sits right after the card it follows (its YouTube long-form
        # after the 5-minute YouTube, its episode after Spotify), so he posts in one order; every other card by counted.
        group = group if key in FEATURE_ONLY and channel else (standing if counted else optional)
        group.append(card)
        if counted:
            jump.append(f'<li><a href="#{p}{kit[key][2] if key in kit else "run-" + key}" data-tickstate="{day}-{key}">'
                        f'{E(label.split(":")[0])}</a></li>')
    top = (f'<div class="ticks rs-top" id="{p}ticks" role="region" aria-labelledby="{p}ticks-h">'
           f'<div class="ticks-head"><h2 id="{p}ticks-h">Publish checklist</h2>'
           f'<span class="ticks-count" data-count="{day}">{STANDING} steps</span></div>'
           f'<div class="meter" aria-hidden="true"><span data-meter="{day}"></span></div>'
           f'<p class="tick-note" data-note="{day}">Loading saved ticks.</p>'
           f'<ol class="rs-jump" aria-label="The steps that make 100%">{"".join(jump)}</ol></div>')
    piece = data.get('piece') or page.get('piece')
    # Layout v3: his Scores press, last on the made day (W2.1), at publish by default.
    scores = scores_card(p, piece, 'at_publish') if VERSION >= 3 and piece and UUID.match(str(piece)) else ''
    return (top + download_first + signoff_card(day, p, piece, data.get('manifest_sha256'))
            + '<h2 class="run-h">Then post, in this order</h2>' + ''.join(standing)
            + ('<h2 class="run-h">When you want them</h2><p class="run-how">Not counted toward 100%.</p>' + ''.join(optional) if optional else '')
            + scores + SAVE_NOTE)


def step_where(a, b):
    """Whether a page section's heading and a publish step's where name one place: the same words, or both the long
    cut's YouTube ("YouTube (the 5-minute video)", or the deep cut's on an older page)."""
    yt = r'YouTube \(the .+\)'
    return a == b or bool(re.fullmatch(yt, a) and re.fullmatch(yt, b))


def section_kit(day, steps, headings):
    """{step key: (n, step, the page section id holding its copy)}. Each section of the publish page is matched to its
    step by its heading (the step's where), never by its place: a page made before the feature's two steps were added
    keeps every caption on its own card. A section no step names, or two sections for one step, is refused."""
    dropped = set(DROPPED_CHANNELS.values())
    sid_of = {}
    for sid, where in headings:
        if where in dropped:
            continue
        match = next((s['where'] for s in steps if step_where(where, s['where'])), None)
        if match is None:
            raise BoardError(f'{day}: its publish page has a section "{where}" that no publish step names; make the page '
                             'again with publish_manager.py, so no card takes another place\'s words')
        if match in sid_of:
            raise BoardError(f'{day}: its publish page has two sections for "{match}"; make the page again with publish_manager.py')
        sid_of[match] = sid
    kit = {}
    for k, s in enumerate(steps, 1):
        key = SECTION_STEP.get(s['where']) or ('youtube' if re.fullmatch(r'YouTube \(the .+\)', s['where']) else None)
        if key:
            kit[key] = (k, s, sid_of.get(s['where'], f'run-{key}'))
    return kit


def pic_actions(p, x):
    return (f'<button type="button" class="dl-btn" data-act="download" data-ref="{p}img-{x["id"]}" data-name="{E(x["name"])}">Download</button>'
            f'<button type="button" class="ghost" data-act="image" data-ref="{p}img-{x["id"]}">Copy picture</button>')


def pic_extra(p, x):
    return (f'<img class="dl-pic" id="{p}img-{x["id"]}" src="{x["src"]}" alt="{E(x["alt"])}">'
            + (f'<p class="dl-note">{E(x["caption"])}</p>' if x['caption'] else '') + '<div class="status" aria-live="polite"></div>')


def run_card(day, p, n, key, label, kit, sections, article, item_of, label_of, feature, warnings):
    """One place to post: the files it needs, its words to copy, what to do, its link box where it has one, its tick."""
    recording = key in FEATURE_ONLY and not next(ch for k2, _, ch, _ in STEPS if k2 == key)
    if recording:
        c = LAYOUT['cuts']['feature']
        sid, where, tag = 'run-feature', c['name'][0].upper() + c['name'][1:], c['shape']
        why = 'Only on a piece you called a feature. Record it from its script under Record, then post it where it goes.'
        copy = []
        do = ['Record it from Teleprompter: its script is under Record.',
              f'Then post it from its own cards above: YouTube long-form and Spotify.']
        files = [('video-feature', label_of['video-feature'])]
    else:
        if not kit:
            raise BoardError(f'{day}: publish_kit.steps() has no step for {key}; the run-sheet cannot draw its card')
        k, s, sid = kit
        where, tag, why, do = s['where'], s['tag'], s['why'], s['do']
        files = []
        for f in s['files']:
            iid = item_of.get(f)
            if (iid, label_of.get(iid)) not in files:
                files.append((iid, label_of.get(iid) if iid else f))
        copy = sections.get(sid)
        if copy is None:
            warnings.append(f'{day}: its publish page has no {where} section, so its copy comes from its words')
            copy = [{'label': lab, 'cid': None, 'text': t if isinstance(t, str) and t.strip() else None} for lab, t in s['copy']]
    links = ''.join((f'<li><a class="run-file" href="#{p}dl-{iid}">{E(name)}</a></li>' if iid else
                     f'<li><span class="run-nofile">{E(name)}, in the post\'s folder</span></li>') for iid, name in files)
    cards = []
    for i, c in enumerate(copy):
        cid = f'{p}{c["cid"]}' if c['cid'] else f'{p}run-{key}-{i}'
        if c['text'] and str(c['text']).strip():
            text = str(c['text']).strip()
            cards.append(f'<div class="card"><div class="row"><span class="lab">{E(c["label"])}</span><div class="btns">'
                         f'<button data-act="text" data-ref="{cid}">Copy</button></div></div>'
                         f'<pre class="txt" id="{cid}" data-raw="{E(text)}">{E(text)}</pre><div class="status" aria-live="polite"></div></div>')
        else:
            cards.append(f'<div class="card"><span class="lab">{E(c["label"])}</span><span class="missing">Not written yet: ask the '
                         'engine for it before publishing.</span></div>')
    if key == 'substack':
        if article:
            cards.append(f'<div class="card"><div class="row"><span class="lab">The article, with its pictures in place</span><div class="btns">'
                         f'<button data-act="article" data-ref="{p}art">Copy article</button></div></div>'
                         f'<div class="article" id="{p}art">{article["html"]}</div><pre id="{p}art-text" hidden>{article["text"]}</pre>'
                         '<div class="status" aria-live="polite"></div><p class="files">Pastes as formatted text with headings and every '
                         'picture in place. If a picture does not come through, download it from Download first.</p></div>')
        else:
            cards.append('<div class="card"><span class="lab">The article</span><span class="missing">Not on its publish page: '
                         'make the page again before publishing.</span></div>')
    box = ''
    if key in LINK_BOX:
        field, said, hint = LINK_BOX[key]
        box = (f'<div class="run-part run-link"><label for="{p}link-{field}">{E(said)}'
               f'<input id="{p}link-{field}" type="url" inputmode="url" autocomplete="off" placeholder="{E(hint)}"></label>'
               '<p class="files">Paste it once: every Copy button on this day carries it. <span class="link-state" data-linkstate></span></p></div>')
    opt = '' if next(c for k2, _, _, c in STEPS if k2 == key) else ' opt'
    return (f'<section class="run{opt}" id="{p}{sid}" data-run="{key}" aria-labelledby="{p}{sid}-h">'
            f'<div class="run-head"><span class="run-n" aria-hidden="true">{n}</span><div class="run-t">'
            f'<h3 id="{p}{sid}-h">{E(where)}</h3><p class="run-tag">{E(tag)}</p></div></div><p class="why">{E(why)}</p>'
            + (f'<div class="run-part"><span class="lab">Files</span><ul class="run-files">{links}</ul></div>' if links else '')
            + (f'<div class="run-part"><span class="lab">Copy</span>{"".join(cards)}</div>' if cards else '')
            + f'<div class="run-part"><span class="lab">Do</span><ol class="do">{"".join(f"<li>{E(d)}</li>" for d in do)}</ol></div>'
            + box
            + f'<label class="tick run-tick">{tick_box(f"{day}-{key}", label)}<span class="t-label">'
              f'{"Recorded: tick it" if recording else "Done: tick it once it is live"}</span>{TICK_TAIL}</label></section>')


def run_sheet_problems(name, panel, tag):
    """Why a made day's Publish step in the fixed layout is not its run-sheet: Download first, before every card; one
    card per place to post in config/board-layout.json's order; each card's one tick its own; no tick outside a card;
    and each finished video and its thumbnail with their Drive links."""
    out = []
    p = (re.search(r'data-prefix="([^"]*)"', tag) or [None, ''])[1]
    day = p.rstrip('-')
    at = panel.find(f'<div class="subpanel" role="tabpanel" id="{p}sub-publish"')
    if at < 0:
        return [f'{name}: no Publish step']
    publish = div_at(panel, at)
    dl = publish.find(f'<div class="rec dl" id="{p}download"')
    runs = list(re.finditer(r'<section class="run(?: opt)?" id="[^"]+" data-run="([^"]+)"[^>]*>(.*?)</section>', publish, re.S))
    if dl < 0:
        out.append(f'{name}: its Publish step has no Download first')
    elif runs and dl > runs[0].start():
        out.append(f'{name}: Download first is not above the places to post')
    feature = 'data-feature="true"' in tag
    want = [s['key'] for s in LAYOUT['publish_steps']['steps'] if (feature if s.get('feature_only') else s.get('channel'))]
    got = [m.group(1) for m in runs]
    if got != want:
        out.append(f'{name}: the places to post are {got}, not {want}, the order of config/board-layout.json')
    for m in runs:
        ticks = re.findall(r'data-tick="([^"]+)"', m.group(2))
        if ticks != [f'{day}-{m.group(1)}']:
            out.append(f'{name}: the {m.group(1)} card holds the ticks {ticks}, not its own one')
    rest = re.sub(r'<section class="run(?: opt)?" id="[^"]+" data-run="[^"]+"[^>]*>.*?</section>', '', publish, flags=re.S)
    loose = re.findall(r'data-tick="([^"]+)"', rest)
    if loose:
        out.append(f'{name}: {len(loose)} tick(s) in its Publish step with no card: {loose[:4]}')
    if dl >= 0:
        box = div_at(publish, dl)
        if 'Not in Drive yet' in box:
            out.append(f'{name}: a finished video with no Drive link; record it (making.py PIECE drive-link CUT URL --thumb-url URL)')
        for cut in re.findall(r'data-dl="video-(long|short|feature)" data-state="ready"', box):
            if f'data-dl="thumb-{cut}" data-state="ready"' not in box:
                out.append(f'{name}: a finished video with no thumbnail link; record it (making.py PIECE drive-link CUT URL --thumb-url URL)')
                break
    return out


def ideas_waiting_panel(monday, hidden, offdays=None):
    sunday = monday - timedelta(days=1)
    return (f'<div class="pm fixed" id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" data-day="ideas" '
            f'data-state="ideas-waiting" tabindex="-1"{" hidden" if hidden else ""}>'
            f'<div class="day-head"><div class="kick">{E(week_span(monday))}</div><h1>Ideas</h1></div>'
            + slot_empty(f'This week\'s ideas arrive by {short_date(sunday)}: fresh ones from the ideas you drop in Control Center, '
                         'Content Inspo (once Cold Ideas and Inspo) and the engine\'s own research, with what you queued earlier first.')
            + offdays_section(monday, offdays) + '</div>')


COMBINE_MIN, COMBINE_MAX = 2, 5


def read_combine(data, queue, where='--combine'):
    """The groups the session judged worth combining (docs/plans/<week>/combine.json): each two to five queued ideas,
    the higher-level argument that threads them (thesis) and the 3 to 5 beats that join them. Proposed from
    GET /api/idea-queue?combine=1; nothing is combined until Krish taps Combine or says so (Krish, 2026-10-21)."""
    groups = data.get('combine') if isinstance(data, dict) else data
    if not isinstance(groups, list):
        raise BoardError(f'{where}: give a list of {{"members": [queued ids], "series": ..., "thesis": ..., "joins": [3 to 5 beats]}}')
    if queue is None:
        raise BoardError(f'{where}: give --queue too; a group is made of queued ideas and the board shows each one')
    queued = {str(q.get('id')): q for q in queue if isinstance(q, dict) and q.get('id')}
    series = {slug for *_, slug, _ in DAYS}
    out, problems = [], []
    for n, g in enumerate(groups, 1):
        g = g if isinstance(g, dict) else {}
        members = g.get('members') if isinstance(g.get('members'), list) else []
        ids = [str(m.get('id') if isinstance(m, dict) else m) for m in members]
        if not COMBINE_MIN <= len(ids) <= COMBINE_MAX or len(set(ids)) != len(ids):
            problems.append(f'group {n}: {len(ids)} member(s); a group is {COMBINE_MIN} to {COMBINE_MAX} different queued ideas')
        bad = [i for i in ids if not UUID.match(i) or i not in queued]
        if bad:
            problems.append(f'group {n}: {", ".join(bad)} {"is" if len(bad) == 1 else "are"} not in the queue')
        if g.get('series') not in (None, '', *series):
            problems.append(f'group {n}: series {g.get("series")!r} is not one of {", ".join(sorted(series))}')
        if not str(g.get('thesis') or '').strip():
            problems.append(f'group {n}: no thesis, the one bigger argument the ideas make together')
        joins = g.get('joins')
        if not isinstance(joins, list) or not 3 <= len(joins) <= 5 or not all(isinstance(j, str) and j.strip() for j in joins):
            problems.append(f'group {n}: joins are 3 to 5 beats that thread the ideas into one piece')
        out.append({'id': f'combine-{n}', 'members': ids, 'series': g.get('series') or None,
                    'thesis': str(g.get('thesis') or '').strip(), 'joins': [str(j).strip() for j in joins or [] if isinstance(j, str)]})
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return out


def combine_card(group, queued):
    """One "Could combine" card: the members, the thesis, the beats that join them, and his Combine button. The tap
    saves queue/combine-<n> ({combine: true, members, pick}); the next session runs synthesize on his word."""
    label = {slug: lab for *_, slug, lab in DAYS}
    cid = group['id']
    members = ''.join(f'<li class="q-member" data-queued-id="{E(m)}">{E((queued.get(m) or {}).get("so_what") or (queued.get(m) or {}).get("idea") or m)}</li>'
                      for m in group['members'])
    joins = ''.join(f'<li>{E(j)}</li>' for j in group['joins'])
    return (f'<article class="q-combo" id="{cid}" data-combine="{cid}" data-members="{E(",".join(group["members"]))}">'
            + (f'<p class="q-meta"><span class="chip">{E(label.get(group["series"], group["series"]))}</span></p>' if group.get('series') else '')
            + f'<p class="q-sowhat">{E(group["thesis"])}</p>'
            f'<h3 class="q-h">The ideas</h3><ul class="q-members">{members}</ul>'
            f'<h3 class="q-h">What joins them</h3><ol class="q-joins">{joins}</ol>'
            f'<button type="button" class="btn-s" data-act="combine" data-for="{cid}" disabled>Combine these</button>'
            f'<p class="q-state" data-combinestate="{cid}" aria-live="polite"></p></article>')


def queue_panel(monday, queue, hidden, combine=None):
    """The Queue tab: every idea Krish saved for later, by series, with his verdict and his reason or angle, and
    the ideas that could combine into one bigger piece (Krish, 2026-10-21: "I need to see that queue somewhere. You
    also need to pick up on whether there are multiple things in the queue that could be consolidated")."""
    queue = [q for q in queue or [] if isinstance(q, dict)]
    groups = [(label, slug) for _, _, _, _, slug, label in DAYS] + [('Any day', '')]
    norm = lambda q: (q.get('series') or '').replace('.', '_').replace('-', '_')
    queued = {str(q.get('id')): q for q in queue if q.get('id')}
    combos = ''.join(combine_card(g, queued) for g in combine or [])
    parts = [f'<div class="pm fixed" id="panel-queue" role="tabpanel" aria-labelledby="tab-queue" data-day="queue" '
             f'data-state="queue" tabindex="-1"{" hidden" if hidden else ""}>'
             f'<div class="day-head"><div class="kick">{E(week_span(monday))}</div><h1>Queue</h1></div>'
             '<p class="st-what">Ideas you saved for later. Mark them on the Ideas tab or in Control Center; '
             'each week\'s ideas start with the ones here that fit.</p>'
             '<section class="q-combine" id="queue-combine"><h2>Could combine</h2>'
             + (f'<p class="q-how">Each card is queued ideas that would make one bigger piece together. Tap Combine and Claude '
                f'writes them up as one; nothing is combined until you do.</p>{combos}' if combos else
                slot_empty('When two or more queued ideas would thread into one bigger piece, they appear here with what joins them. '
                           'Nothing is combined until you say so.')) + '</section>']
    known = {slug for _, slug in groups}
    for label, slug in groups:
        fit = [q for q in queue if norm(q) == slug or (slug == '' and norm(q) not in known)]
        items = []
        for q in fit:
            t = q.get('triage') if isinstance(q.get('triage'), dict) else {}
            verdict = str(t.get('verdict') or '')
            why = t.get('angle') or t.get('reason')
            items.append(
                f'<li class="q-item" data-queued-id="{E(str(q.get("id") or ""))}"><p class="q-sowhat">{E(q.get("so_what") or q.get("idea") or "")}</p>'
                + (f'<p class="q-meta"><span class="chip">{E(verdict.title())}</span>{" " + E(why) if why else ""}</p>' if verdict else
                   '<p class="q-meta"><span class="chip">Not marked yet</span></p>')
                + '</li>')
        parts.append(f'<section class="q-day" id="queue-{slug or "any"}"><div class="sec-head"><h2>{E(label)}</h2>'
                     f'<span class="rv-n">{len(fit)} saved</span></div>'
                     + (f'<ul class="q-list">{"".join(items)}</ul>' if items else slot_empty('Nothing saved for this series.'))
                     + '</section>')
    parts.append('</div>')
    return ''.join(parts)


# ------------------------------------------------------------------ inputs

TP_ID = re.compile(r'^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$')


def teleprompter_info(data, piece_id, warnings=None, where='teleprompter'):
    """{'folder_name', 'folder_id', 'cuts': {cut: {'title', 'script_id',
    'state'}}} for one piece, from any of: the engine's answer for a piece's
    making record, a making record, its teleprompter field, or a small JSON
    of ids ({folder_id, folder_name, cuts: {long: {script_id, title}}}),
    alone or under "pieces" by piece id. state is 'in', 'older' or 'failed'
    when the record holds the scripts' hashes, else None. {} when it holds
    no script."""
    node = data
    if isinstance(node, dict) and isinstance(node.get('pieces'), dict):
        node = node['pieces'].get(piece_id) if piece_id else None
    elif isinstance(node, dict) and piece_id and isinstance(node.get(piece_id), dict):
        node = node[piece_id]
    record = None
    for key in ('piece', 'meta', 'making'):
        if isinstance(node, dict) and isinstance(node.get(key), dict):
            node = node[key]
    if isinstance(node, dict) and isinstance(node.get('teleprompter'), dict):
        record, node = node, node['teleprompter']
    if not isinstance(node, dict) or not isinstance(node.get('cuts'), dict):
        return {}
    check = (record or {}).get('script_check') if isinstance((record or {}).get('script_check'), dict) else {}
    hashes = check.get('hashes') if check.get('passed') is True and isinstance(check.get('hashes'), dict) else {}
    out = {'folder_name': node.get('folder_name') if isinstance(node.get('folder_name'), str) else None,
           'folder_id': node.get('folder_id') if TP_ID.match(str(node.get('folder_id') or '')) else None, 'cuts': {}}
    for cut, *_ in CUTS:
        c = node['cuts'].get(cut)
        if not isinstance(c, dict):
            continue
        title, script_id = c.get('title'), c.get('script_id')
        if not (isinstance(title, str) and title.strip() and TP_ID.match(str(script_id or ''))):
            if c.get('error') and warnings is not None:
                warnings.append(f'{where}: the {cut} cut\'s last Teleprompter send failed ({c["error"]}); its script is not on the board yet')
            elif warnings is not None and (title or script_id):
                warnings.append(f'{where}: the {cut} cut has no title and uppercase script id; left out')
            continue
        state = None
        if c.get('error'):
            state = 'failed'
        elif hashes.get(cut):
            state = 'in' if c.get('script_sha256') == hashes[cut] else 'older'
        out['cuts'][cut] = {'title': ' '.join(title.split()), 'script_id': script_id, 'state': state}
    return out if out['cuts'] else {}


def picks_from_options(data, monday, warnings):
    """{day: {'id', 'title', 'state'}}: a day's piece is the one of its
    series scheduled for its date, in any picked state, published included
    (Control Center's weekPlan). The options' `scheduled` list holds those;
    an engine from before it has only `in_flight`, which drops a piece once
    its Substack post is live, so that is said."""
    if not isinstance(data, dict) or not isinstance(data.get('series'), list):
        raise BoardError('the week options are not GET /api/week/options\'s answer (no "series")')
    if data.get('week_start') and data['week_start'] != monday.isoformat():
        raise BoardError(f'the week options are for {data["week_start"]}, not {monday.isoformat()}')
    picks = {}
    old_engine = any(isinstance(s, dict) and not isinstance(s.get('scheduled'), list) for s in data['series'])
    if old_engine:
        warnings.append('the week options have no "scheduled" list (an engine from before it), so a day whose piece is published '
                        'reads as not picked: give --previous, or --piece for that day')
    for key, _, weekday, offset, slug, _label in DAYS:
        when = (monday + timedelta(days=offset)).isoformat()
        series = next((s for s in data['series'] if isinstance(s, dict) and s.get('slug') == slug), None) or {}
        pool = series.get('scheduled') if isinstance(series.get('scheduled'), list) else series.get('in_flight')
        found = [i for i in pool or [] if isinstance(i, dict)
                 and i.get('scheduled_for') == when and UUID.match(str(i.get('id') or ''))]
        if len(found) > 1:
            warnings.append(f'{weekday}: {len(found)} pieces are scheduled for {when}; the board takes the first')
        if found:
            picks[key] = {'id': found[0]['id'], 'title': str(found[0].get('idea') or '').strip(), 'state': found[0].get('state')}
    return picks


CONF_RE = re.compile(r'const CONF = (\{.*?\});\n', re.S)


def board_days(text, where='the board'):
    """{'week': Monday or None, 'days': {day: {'state', 'piece_id'}}} of a
    board: its manifest (week-board.json), or its page as published (the
    HTML, as Artifact read saves it; the board of 12 October carries its
    pieces as CONF.pieces, later ones as CONF.days)."""
    data = None
    if isinstance(text, dict):
        data = text
    else:
        stripped = text.lstrip()
        if stripped.startswith('{'):
            try:
                data = json.loads(stripped)
            except ValueError:
                data = None
    if isinstance(data, dict) and data.get('kind') == 'week_board' and isinstance(data.get('days'), list):
        days = {}
        for d in data['days']:
            if isinstance(d, dict) and d.get('day') in DAY_KEYS.values():
                days[d['day']] = {'state': d.get('state') or 'not_picked', 'piece_id': d.get('piece_id')}
        return {'week': data.get('week_start'), 'days': days}
    if not isinstance(text, str):
        raise BoardError(f'{where} is neither a board page nor its manifest (week-board.json)')
    m = CONF_RE.search(text)
    if not m:
        raise BoardError(f'{where} is neither a board page (no CONF in its script) nor its manifest (week-board.json)')
    try:
        conf = json.loads(m.group(1))
    except ValueError:
        raise BoardError(f'{where}: its CONF is not JSON')
    days = {}
    if isinstance(conf.get('days'), list):
        for d in conf['days']:
            if isinstance(d, dict) and d.get('key') in DAY_KEYS.values():
                days[d['key']] = {'state': d.get('state') or ('picked' if d.get('picked') else 'not_picked'), 'piece_id': d.get('piece_id')}
    elif isinstance(conf.get('pieces'), dict):
        for key, piece in conf['pieces'].items():
            if key in DAY_KEYS.values():
                days[key] = {'state': 'picked' if piece else 'not_picked', 'piece_id': piece or None}
    else:
        raise BoardError(f'{where}: its CONF names no days')
    for key in days:
        # A made tab is a whole publish page: its panel carries the day's id prefix.
        tag = re.search(rf'<div class="pm" id="panel-[a-z]+"[^>]*\sdata-prefix="{key}-"[^>]*>', text)
        if tag and ('data-state=' not in tag[0] or 'data-state="made"' in tag[0]):
            days[key]['state'] = 'made'
    return {'week': conf.get('week'), 'days': days}


def div_at(text, start):
    """The whole <div ...>...</div> that opens at start, nested divs included."""
    depth = 0
    for m in re.finditer(r'<div\b|</div>', text[start:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0:
            return text[start:start + m.end()]
    raise BoardError('a day\'s panel on the previous board is never closed')


def kept_panel(text, key):
    """A made day's whole panel from a board's page (--keep), as it stands.
    A banner any session laid over it by hand (class "stage") is dropped:
    the board draws its own."""
    name = next(n for k, n, *_ in DAYS if k == key)
    start = text.find(f'id="panel-{name}"')
    start = text.rfind('<div class="pm', 0, start) if start >= 0 else -1
    if start < 0 or f'data-prefix="{key}-"' not in text[start:start + 400]:
        raise BoardError(f'--keep {key}: the previous board has no made {name} tab to keep')
    panel = div_at(text, start)
    while True:
        m = re.search(r'<div class="stage[ "]', panel)
        if not m:
            break
        panel = panel.replace(div_at(panel, m.start()), '', 1)
    return drop_channels(panel, key)


DAY_ATTR = re.compile(r'(?<=["\'#\s])((?:rvs?|rvp)-)?(mon|wed|fri)-')


def carried_panel(text, src, dst, when, where='--carry'):
    """A day's whole panel from another week's board page, moved to day dst of this week (Krish, 2026-10-29: the
    Monday, Wednesday and Friday cadence restarts on 2 November, and a piece keeps its page, his words and his notes
    when it moves). Every id, reference and day attribute moves from src to dst, and the head names the new date and
    the new day's series. A made day comes as --keep takes it, a draft day as --keep-draft does; the state is the
    panel's own. Returns (state, panel)."""
    sname = next(n for k, n, *_ in DAYS if k == src)
    start = text.find(f'id="panel-{sname}"')
    start = text.rfind('<div class="pm', 0, start) if start >= 0 else -1
    if start < 0:
        raise BoardError(f'{where}: that board has no {sname} tab')
    head = text[start:start + 400]
    if 'data-state="draft"' in head:
        state, panel = 'draft', kept_draft_panel(text, src)
    elif f'data-prefix="{src}-"' in head:
        state, panel = 'made', kept_panel(text, src)
    else:
        raise BoardError(f'{where}: the {sname} tab there is neither made nor in review, so there is nothing to carry')
    if not panel.startswith('<div class="pm fixed"'):
        raise BoardError(f'{where}: that {sname} tab is in the old layout; build the day from its record (--piece) instead')
    _, dname, dweekday, _, _, dlabel = next(d for d in DAYS if d[0] == dst)
    sweekday = next(w for k, _, w, *_ in DAYS if k == src)
    if src != dst:
        panel = panel.replace(f'panel-{sname}', f'panel-{dname}').replace(f'tab-{sname}', f'tab-{dname}')
        panel = DAY_ATTR.sub(lambda m: (m[1] or '') + dst + '-', panel)
        panel = re.sub(rf'(data-day=")({src})(")', rf'\g<1>{dst}\3', panel)
        left = re.findall(rf'="[^"]*(?<![a-z]){src}-[^"]*"', panel)
        if left:
            raise BoardError(f'{where}: {len(left)} {src} reference(s) could not be moved, e.g. {left[0][:60]}')
    # The head: the new day's series and date, and its day name in the heading.
    dh = panel.find('<div class="day-head">')
    if dh >= 0:
        old = div_at(panel, dh)
        new = re.sub(r'(<div class="kick">)[^<·]*·\s*[^<·]*?(?=\s*·|<)',
                     lambda m: f'{m[1]}{dlabel} · {when.strftime("%a")} {when.day} {when.strftime("%b")}', old, count=1)
        new = new.replace(f'{sweekday}&#x27;s', f'{dweekday}&#x27;s').replace(f"{sweekday}'s", f"{dweekday}'s")
        panel = panel.replace(old, new, 1)
    return state, panel


def kept_draft_panel(text, key):
    """Carry an unrelated draft tab from the verified previous board verbatim."""
    name = next(n for k, n, *_ in DAYS if k == key)
    start = text.find(f'id="panel-{name}"')
    start = text.rfind('<div class="pm', 0, start) if start >= 0 else -1
    if start < 0:
        raise BoardError(f'--keep-draft {key}: the previous board has no {name} tab')
    panel = div_at(text, start)
    if 'data-state="draft"' not in panel.split('>', 1)[0]:
        raise BoardError(f'--keep-draft {key}: the previous {name} tab is not in review')
    return panel


# Channels Krish dropped (2026-10-14: "I don't think I need Substack notes or WhatsApp to be honest, right now"):
# a kept panel loses their ticks, their sections and their contents links, so no carried day still shows them.
DROPPED_CHANNELS = {'whatsapp': 'WhatsApp', 'notes': 'Substack Notes'}


def drop_channels(panel, key):
    keys = '|'.join(DROPPED_CHANNELS)
    names = '|'.join(re.escape(n) for n in DROPPED_CHANNELS.values())
    panel = re.sub(rf'<label class="tick row-tick"><input type="checkbox" data-tick="{key}-(?:{keys})".*?</label>', '', panel, flags=re.S)
    panel = re.sub(rf'<section id="{key}-s\d+">(?:<div class="sec-head">)?<h2>\d+\. (?:{names})</h2>.*?</section>', '', panel, flags=re.S)
    return re.sub(rf'<a href="#{key}-s\d+">(?:{names})</a>', '', panel)


def keep_previous(previous, days, unpick, monday, fresh=()):
    """Refusals for a rebuild that would lose a day the board it replaces
    held: a made or picked day now not picked, a made day now without its
    publish page, or a day in draft given a publish page the engine has not
    shown to be newer than its words. unpick: the days Krish moved or
    dropped; fresh: the days whose publish page --live showed is newer than
    their words."""
    if previous.get('week') and previous['week'] != monday.isoformat():
        raise BoardError(f'--previous is the board of the week of {previous["week"]}, not {monday.isoformat()}; '
                         'a new week gets a new board')
    problems = []
    for d in days:
        was = previous['days'].get(d['day']) or {}
        if was.get('state') not in ('made', 'picked', 'draft') or d['day'] in unpick:
            continue
        held = was.get('piece_id')
        if was['state'] == 'draft' and d['state'] == 'picked' and (not held or d['piece_id'] == held):
            problems.append(f'{d["name"]}: the board being replaced holds its words in review; give --draft {d["day"]} with its '
                            f'--review files, or --day {d["day"]}=<its publish page> once it is made from those words')
        if was['state'] == 'draft' and d['state'] == 'made' and d['day'] not in fresh and (not held or d['piece_id'] == held):
            problems.append(f'{d["name"]}: the board being replaced holds its words in review, and nothing shows this publish page '
                            f'was made from them: build with --live, which reads when the page was made and when the words last '
                            f'changed, or keep it in review with --draft {d["day"]}')
        if d['state'] == 'not_picked':
            problems.append(f'{d["name"]}: the board being replaced holds piece {held or "(unnamed)"} ({was["state"]}), and this build has no '
                            f'piece for it. A piece posted on Substack is published, and an engine from before the week options\' '
                            f'"scheduled" list leaves it out: give --piece {d["day"]}={held}'
                            + (f' and --day {d["day"]}=<its publish page>' if was['state'] == 'made' else '')
                            + f'. Only if Krish moved or dropped it, give --unpick {d["day"]}')
        elif was['state'] == 'made' and d['state'] not in ('made', 'draft') and (not held or d['piece_id'] == held):
            problems.append(f'{d["name"]}: the board being replaced has its publish page, and this build has none: Artifact read its '
                            f'publish_manager link and give --day {d["day"]}=<the saved file>')
    if problems:
        raise BoardError('this rebuild would lose a day the board holds:\n  ' + '\n  '.join(problems))


def show_board(info):
    lines = [f'week of {info.get("week") or "(not said)"}']
    for key, _, weekday, *_ in DAYS:
        d = info['days'].get(key) or {'state': 'not_picked', 'piece_id': None}
        lines.append(f'  {weekday:<9} {d["state"]:<10} {d.get("piece_id") or ""}')
    return '\n'.join(lines)


def live_reader():
    """A read-only GET on the engine key, through making.py's caller."""
    import making  # noqa: E402  (only --live needs the engine)

    def get(path):
        try:
            status, text = making._engine_call('GET', path, None)
        except making.MakingError as error:
            raise BoardError(str(error))
        if status != 200:
            raise BoardError(f'the engine answered {status} to GET {path.split("?")[0]}: {text[:200]}')
        try:
            return json.loads(text)
        except ValueError:
            raise BoardError(f'the engine answered GET {path.split("?")[0]} with something that is not JSON')
    return get


def read_json(path, what):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except OSError as error:
        raise BoardError(f'{what}: cannot read {path}: {error.strerror}')
    except ValueError:
        raise BoardError(f'{what}: {path} is not JSON')


def by_day(values, what, has_value=True):
    """['mon=x', 'wed=y'] as {'mon': 'x', 'wed': 'y'}."""
    out = {}
    for v in values or []:
        k, sep, rest = str(v).partition('=')
        key = DAY_KEYS.get(k.strip().lower())
        if not sep or not key or (has_value and not rest.strip()):
            raise BoardError(f'{what} takes DAY=VALUE with DAY mon, wed or fri, not {v!r}')
        if key in out:
            raise BoardError(f'{what} names {key} twice')
        out[key] = rest.strip()
    return out


# ------------------------------------------------------------------ the board

def posted_kick(panel, at, weekday, warnings):
    """A made tab's status line, from the record once its piece is posted.
    The publish page wrote "nothing has been posted" when it was made, and a
    kept tab carried that on after Krish posted (Monday and Wednesday, 15
    October). Each channel stays in the checklist's ticks."""
    m = re.search(r'<div class="kick">([^<]*)</div>', panel)
    parts = html.unescape(m.group(1)).split(' · ') if m else []
    when = parse_time(at)
    if len(parts) < 3 or not when:
        warnings.append(f'{weekday}: posted, but its tab has no status line this board knows; it still says what it said')
        return panel
    line = ' · '.join(parts[:2] + [f'posted on Substack {when.day} {when.strftime("%b")}; the ticks below show each channel'])
    return panel[:m.start(1)] + E(line) + panel[m.end(1):]


def parse_time(value):
    """An engine time ("...Z", any number of decimals) as a datetime, or None."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        when = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError:
        return None
    # A time with no zone is the engine's UTC; comparing it with one that has a zone would crash the build.
    return when if when.tzinfo else when.replace(tzinfo=timezone.utc)


def previous_briefs(text):
    """{day: brief} the board being replaced carries: its manifest's briefs, or its page's CONF.briefs."""
    data = None
    stripped = text.lstrip()
    if stripped.startswith('{'):
        try:
            data = json.loads(stripped).get('briefs')
        except (ValueError, AttributeError):
            data = None
    else:
        m = CONF_RE.search(text)
        if m:
            try:
                data = json.loads(m.group(1)).get('briefs')
            except ValueError:
                data = None
    out = {}
    for k, b in (data or {}).items() if isinstance(data, dict) else []:
        if k in DAY_KEYS.values():
            try:
                out[k] = read_brief(b, f'the previous board\'s {k} brief')
            except BoardError:
                continue
    return out


def previous_conf(text, field):
    """One field the board being replaced carries in its CONF (its page) or its manifest, or None."""
    stripped = text.lstrip()
    try:
        if stripped.startswith('{'):
            return json.loads(stripped).get(field)
        m = CONF_RE.search(text)
        return json.loads(m.group(1)).get(field) if m else None
    except (ValueError, AttributeError):
        return None


def fixed_day(key, name, weekday, when, series_label, page, piece, pick, title, pending, draft, calls, review, materials,
              briefs, teleprompter, videos, ideas, hidden, panels, warnings, built_at, kept_at, sweeps=None, lessons=None,
              folders=None, titles=None, manifests=None, moved=None):
    """A day in the fixed layout, appended to panels; its state. Each step is filled from data, in the same place every
    week: Brief (the agreed brief), Drafts (the words to review), Record (Teleprompter, the scripts), Publish (the
    files first, then each place to post, each with its tick)."""
    p = f'{key}-'
    feature = feature_piece(piece)
    brief = briefs.get(key)
    if brief and brief.get('piece_id') and piece and brief['piece_id'] != piece:
        # A brief carried from the board being replaced was for another piece: never shown under a new pick.
        warnings.append(f'{weekday}: the brief on the board was for piece {brief["piece_id"]}, not {piece}; it is dropped')
        briefs.pop(key)
        brief = None
    if brief and piece and not brief.get('piece_id'):
        brief['piece_id'] = piece
    rv = (review or {}).get(key)
    tp = teleprompter.get(key) or {}
    delivery = None
    if (materials or {}).get(key):
        try:
            delivery = board_materials.validate(materials[key], piece)
        except ValueError as error:
            raise BoardError(str(error)) from error
    brief_due, drafts_due = due(when, RHYTHM['brief']), due(when, RHYTHM['drafts'])
    files = board_materials.render(key, delivery) if delivery else ''
    attrs = ' data-feature="true"' if feature else ''
    sweep = (sweeps or {}).get(key)
    if sweep and not (rv and (page or key in draft)):
        raise BoardError(f'--sweep {key}: {weekday} has no drafts in review, so where the change was carried would not show; '
                         f'give it with --draft {key} and --review')
    if sweep and sweep.get('piece_id') and piece and sweep['piece_id'] != piece:
        raise BoardError(f'--sweep {key}: the sweep is for piece {sweep["piece_id"]}, and {weekday} holds {piece}')
    # Below the drafts, in this order: Approve scripts, where his change was carried, then what was learned from his edits.
    plain = next((i['so_what'] for i in (ideas or {}).get(key, [])
                  if (piece and i.get('id') == piece) or (title and i['story'].strip() == str(title).strip())), None)
    approve = approve_card(key, p, weekday, rv, piece, tp, when, series_label, title or (brief or {}).get('idea') or plain,
                           feature, warnings) if rv else ''
    after = approve + (sweep_card(p, sweep) if sweep else '') + (lessons_card(p, lessons) if lessons and rv else '')
    held_titles = (titles or {}).get(key)
    if held_titles and held_titles.get('piece_id') and piece and held_titles['piece_id'] != piece:
        raise BoardError(f'--titles {key}: the options are for piece {held_titles["piece_id"]}, and {weekday} holds {piece}')
    if page:
        if not piece:
            raise BoardError(f'{weekday} is made but has no piece id: give --piece {key}=<uuid>, or --options or --live '
                             'so the week\'s pick names it; every tick carries it')
        state = 'made'
        parts = made_parts(page, key, name, p, tp, warnings, (videos or {}).get(key), feature)
        head = parts['head']
        slots = {
            'brief': brief_card(p, brief) if brief else slot_empty('This piece was made before its brief was kept on the board.'),
            'drafts': (review_card(key, rv, built_at, kept_at) + after if rv else
                       slot_empty('The words are signed off. The article is under Publish, in its first step; the scripts are under Record.')),
            'record': parts['record'] + parts['scripts'] + (titles_card(key, p, piece, held_titles) if held_titles else ''),
            # One ordered run-sheet, drawn from the page's data: never the page's own sections, ticks or contents.
            'publish': run_sheet(key, p, page, dict(publish_data(page, weekday, warnings), piece=piece,
                                                    manifest_sha256=(manifests or {}).get(key)),
                                 (videos or {}).get(key), delivery, feature,
                                 post_folder((folders or {}).get(key), (videos or {}).get(key)), warnings),
        }
        notes = {'brief': 'agreed' if brief and brief['agreed'] else '', 'drafts': 'in review' if rv else 'signed off',
                 'record': '', 'publish': f'{STANDING} steps'}
        attrs += f' data-post="{E(page["post"])}"'
    else:
        state = 'draft' if key in draft else 'picked' if (piece or key in pending or pick) else 'not_picked'
        if state == 'draft' and not piece:
            raise BoardError(f'{weekday} is in draft but has no piece id: give --piece {key}=<uuid>')
        if rv and state != 'draft':
            raise BoardError(f'--review {key}: {weekday} is {state.replace("_", " ")}, so its words would not show; '
                             f'give --draft {key} while they are in review')
        if delivery and state != 'draft':
            raise BoardError('Publishing materials need a made or draft day')
        when_s = short_date(when)
        said = plain or (pick or {}).get('plain') or title
        record = (record_card(key, p, tp, feature) if tp.get('cuts') else
                  slot_empty('The scripts go to Teleprompter once you approve them. How to record and send each take back is here then.'))
        if state != 'not_picked':
            record += titles_card(key, p, piece, held_titles)
        if state == 'not_picked' and key in (moved or {}):
            to, href = moved_link(moved[key])
            head = fixed_head(f'{series_label} · {when_s} · moved to {to}', weekday)
            gone = slot_empty(f'This piece moved to {to}.') + f'<p class="id-how"><a href="{E(href)}">Open it on its board</a></p>'
            slots = {'brief': gone, 'drafts': gone, 'record': gone, 'publish': gone}
            notes = {'brief': f'moved to {to}'}
        elif state == 'not_picked':
            head = fixed_head(f'{series_label} · {when_s} · not picked', weekday)
            slots = {'brief': slot_empty(f'{weekday}\'s {series_label} piece is not picked yet. Pick one on the Ideas tab.'),
                     'drafts': slot_empty(f'The draft article and scripts arrive by {drafts_due}, once a piece is picked and its brief agreed.'),
                     'record': record, 'publish': slot_empty('The publish steps appear here once the piece is picked.')}
            notes = {'brief': 'not picked'}
        elif state == 'picked':
            head = fixed_head(f'{series_label} · {when_s} · picked, not made yet', weekday)
            slots = {'brief': ((f'<p class="day-idea">{E(said)}</p>' if said else '')
                               + (brief_card(p, brief) if brief else
                                  slot_empty(f'The record-ready brief is due by {brief_due}: the story beat by beat, the ending, '
                                             'the takeaway, the angle and the tone.'))),
                     'drafts': slot_empty(f'The draft article and scripts arrive by {drafts_due}.'),
                     'record': record, 'publish': checklist(key, p, feature)}
            notes = {'brief': 'agreed' if brief and brief['agreed'] else f'due {brief_due}', 'drafts': f'by {drafts_due}',
                     'publish': f'{STANDING} steps'}
        else:
            head = fixed_head(f'{series_label} · {when_s} · in review, not ready to post', f'{weekday}\'s words, in review',
                              calls.get(key) or ())
            slots = {'brief': brief_card(p, brief) if brief else slot_empty('No brief is on the board for this piece.'),
                     'drafts': (review_card(key, rv or [], built_at, kept_at) or slot_empty('No words are on the board for review yet.')) + after,
                     'record': record, 'publish': files + checklist(key, p, feature)}
            notes = {'brief': 'agreed' if brief and brief['agreed'] else '', 'drafts': 'in review', 'publish': f'{STANDING} steps'}
    panel = fixed_day_panel(key, name, weekday, when, series_label, state, hidden, head, slots, notes, attrs)
    if delivery:
        panel = board_materials.update_copy(panel, key, delivery)
    panels.append(panel)
    return state


# ------------------------------------------------------------------ layout A: Today

# The boxes a post goes out on, the same lists Growth reads (apps/control-plane/api/board/_posted.ts).
SERIES_CHANNELS = ('substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'spotify', 'x', 'threads', 'facebook', 'substack-notes')
OFF_CHANNELS = ('shorts', 'tiktok', 'reels', 'instagram', 'linkedin', 'x', 'threads', 'facebook', 'substack-notes')
OFF_KINDS = {'meme': 'meme', 'carousel': 'carousel', 'good_news': 'news', 'news': 'news', 'level_up': 'levelup', 'levelup': 'levelup',
             'explainer': 'explainer', 'short': 'short'}


def moved_of(values):
    """{day: date} from --moved DAY=YYYY-MM-DD: the day Krish moved this day's piece to (Krish, 2026-10-30: "make sure
    that the publish board posts are calibrated to their new dates"). The day leaves this board and says where it went."""
    out = {}
    for v in values or []:
        k, sep, when = v.partition('=')
        key = DAY_KEYS.get(k.strip().lower())
        try:
            day = date.fromisoformat(when.strip()) if sep else None
        except ValueError:
            day = None
        if not (key and day):
            raise BoardError(f'--moved {v}: give DAY=YYYY-MM-DD, the date the piece moved to')
        out[key] = day
    return out


def moved_link(day):
    """The board and the day a moved piece now sits on, e.g. ("Mon 9 Nov", "/board/2026-11-09#monday")."""
    names = {0: 'monday', 2: 'wednesday', 4: 'friday'}
    monday = day - timedelta(days=day.weekday())
    tab = names.get(day.weekday())
    return short_date(day), f'/board/{monday.isoformat()}' + (f'#{tab}' if tab else '')


def gates_of(values):
    """{day: https link} from --gate DAY=URL: the cut a day waits on his Gate 2 verdict for."""
    out = {}
    for v in values or []:
        k, sep, url = v.partition('=')
        key = DAY_KEYS.get(k.strip().lower())
        if not (sep and key and re.match(r'^https://\S+$', url.strip())):
            raise BoardError(f'--gate {v}: give DAY=URL, the https link to the cut he judges')
        out[key] = url.strip()
    return out


def today_model(monday, days, videos, posted, offdays, parsed, now=None, gates=None):
    """The Today view's model (board_today.check) from what the board already holds: each day's piece and its state,
    its finished videos, whether Substack went out, Sunday's off-day options and the publish page's pictures. Every
    ask is one short line and one button linking to the step it approves; nothing here invents a word of the post."""
    today = (now or datetime.now(timezone.utc)).date()
    sunday = monday + timedelta(days=6)
    label = ('This week' if monday <= today <= sunday else 'Next week' if monday - timedelta(days=7) <= today < monday
             else f'Week of {monday.day} {monday.strftime("%b")}')
    short = lambda d: f'{d.strftime("%a")} {d.day} {d.strftime("%b")}'
    keys = [k for k, *_ in board_today.DAYS]
    out = {'week': monday.isoformat(), 'label': label, 'range': f'{short(monday)} to {short(sunday)}',
           'today': keys[(today - monday).days] if monday <= today <= sunday else None, 'asks': [], 'days': []}
    by_day = {d['day']: d for d in days}
    names = {k: name for k, name, *_ in DAYS}
    for i, key in enumerate(keys):
        when = monday + timedelta(days=i)
        posts = []
        d = by_day.get(key)
        if d and d['state'] != 'not_picked':
            name, state = names[key], d['state']
            vids = {v.get('cut'): v for v in (videos.get(key) or []) if isinstance(v, dict)}
            assets = []
            for cut in ('long', 'short'):
                v = vids.get(cut)
                if v and (drive_links(v.get('url')) or str(v.get('url') or '').startswith('/api/board/')):
                    assets.append({'slot': cut, 'state': 'ready', 'href': f'#{name}/publish'})
                elif state in ('draft', 'made'):
                    assets.append({'slot': cut, 'state': 'making'})
            if state == 'draft':
                assets.append({'slot': 'article', 'state': 'making', 'href': f'#{name}/drafts'})
            elif state == 'made':
                assets.append({'slot': 'article', 'state': 'ready', 'href': f'#{name}/publish'})
                covers = [im for im in ((parsed.get(key) or {}).get('images') or []) if im.get('role') in ('cover', 'substack-cover')]
                assets.append({'slot': 'cover', 'state': 'ready', 'href': f'#{name}/publish'} if covers else {'slot': 'cover', 'state': 'missing'})
            live = key in posted
            cuts_ready = sum(1 for a in assets if a['slot'] in ('long', 'short') and a['state'] == 'ready') == 2
            stage, status = ((4, 'live') if live else (3 if cuts_ready else 2, 'approved') if state == 'made'
                             else (1, 'making') if state == 'draft' else (0, 'making'))
            step = 'publish' if state == 'made' else 'drafts' if state == 'draft' else 'brief'
            act = {'label': 'Approve' if state == 'made' and not live else 'Open', 'href': f'#{name}/{step}'}
            gate = (gates or {}).get(key)
            if gate:
                # His Gate 2 verdict on a cut the piece waits on (--gate): the card's one button and an ask open that cut.
                act = {'label': 'Watch cut', 'href': gate}
            posts.append({'kind': 'piece', 'series': d['series'], 'title': d.get('title') or 'Picked, not made yet',
                          'piece_id': d.get('piece_id'), 'status': status, 'stage': stage, 'time': '12:30',
                          'waiting': 'Your call waits on the Drafts step' if d.get('waiting') else None,
                          'channels': list(SERIES_CHANNELS), 'assets': assets, 'action': act})
            if gate:
                out['asks'].append({'what': f'Gate 2, {short(when)}', 'detail': 'Judge the long cut',
                                    'cta': 'Watch cut', 'href': gate, 'day': key})
            if state == 'draft' and d.get('waiting'):
                n = len(d['waiting'])
                out['asks'].append({'what': f'Words, {short(when)}', 'detail': f'{n} call{"s" if n != 1 else ""} wait on you',
                                    'cta': 'Open', 'href': f'#{name}/drafts', 'day': key})
            elif state == 'made' and not live:
                out['asks'].append({'what': f'Publish, {short(when)}', 'detail': 'Approve, then post it',
                                    'cta': 'Approve', 'href': f'#{name}/publish', 'day': key})
        opts = (offdays or {}).get(key) or []
        for o in opts:
            copy = ' '.join(str(o.get('copy') or '').split())
            posts.append({'kind': 'short' if o.get('kind') == 'recorded' else OFF_KINDS.get(str(o.get('format') or '').lower(), 'note'),
                          'title': copy[:120] or str(o.get('format') or 'Off-day post'), 'claim': f'From: {o.get("source")}' if o.get('source') else None,
                          'status': 'concept', 'stage': 0, 'time': '12:30', 'channels': list(OFF_CHANNELS),
                          'assets': [{'slot': 'still', 'state': 'making'}], 'piece_id': o.get('piece_id'),
                          'action': {'label': 'Approve', 'href': f'#offdays-{key}'} if o.get('kind') == 'recorded'
                          else {'label': 'See mix', 'href': '#ideas-offdays-mix'}})
        mine = [o for o in opts if o.get('kind') == 'recorded']
        if mine:
            out['asks'].append({'what': f'Record, {short(when)}', 'detail': f'{len(mine)} piece{"s" if len(mine) != 1 else ""} to approve',
                                'cta': 'Choose', 'href': f'#offdays-{key}', 'day': key})
        # A series day has its own page on the board; the calendar's day opens it (Krish, 2026-10-30: "I should be able
        # to click through to Monday from that board if it is to act as my calendar board").
        out['days'].append({'key': key, 'date': f'{when.day} {when.strftime("%b")}', 'posts': posts,
                            **({'open': f'#{names[key]}'} if key in names else {})})
    mix = week_mix(offdays)[0]
    if mix:
        # The week's filler is one press, not one per post (Ruling, Krish, 2026-10-30).
        out['asks'].insert(0, {'what': "This week's mix", 'detail': 'One press, Growth fills it',
                               'cta': 'Approve', 'href': '#ideas-offdays-mix', 'day': next(iter(mix))})
    return out


def board(monday, pages=None, pieces=None, teleprompter=None, picks=None, pending=None, kept=None, videos=None, review=None,
          draft=(), calls=None, posted=None, kept_at=None, ideas=None, queue=None, materials=None, briefs=None, combine=None,
          sweeps=None, lessons=None, folders=None, kept_draft=None, titles=None, offdays=None, manifests=None, archive=None,
          gates=None, moved=None):
    """(page, manifest, warnings). titles: {day: read_titles()}; offdays: read_offdays(); manifests: {day: the sha256
    of the piece's manifest}, for Approve for publish. folders: {day: the post's library folder, from its making record's pack}. ideas: {day: [idea]} from read_ideas(),
    shown as a first tab, Ideas, opened while no day is made. pages: {day: publish page text};
    pieces: {day: uuid}; teleprompter: {day: teleprompter_info}; picks:
    {day: {'id', 'title'}} from the week options; pending: {day: title};
    draft: the days whose words are in review; calls: {day: [what waits on
    Krish]}; posted: {day: when Substack went out}; kept_at: {review id:
    build time} of review blocks whose words have not changed."""
    built_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    use_layout(monday)
    briefs = briefs or {}
    if briefs and not FIXED:
        raise BoardError(f'--brief: the week of {monday.isoformat()} is in the layout it was published in, which has no Brief step; '
                         f'briefs are on boards from {LAYOUT_FROM.isoformat()}')
    sweeps = sweeps or {}
    if (sweeps or lessons) and not FIXED:
        raise BoardError(f'--sweep and --lessons: the week of {monday.isoformat()} is in the layout it was published in; '
                         f'Also changed and What I learned are in the Drafts step of boards from {LAYOUT_FROM.isoformat()}')
    titles, offdays, manifests = titles or {}, offdays or None, manifests or {}
    if archive is not None and VERSION < 3:
        raise BoardError(f'--archive: the week of {monday.isoformat()} is in layout {VERSION}; the Archive is on boards from '
                         f'{V3_FROM.isoformat() if V3_FROM else "layout v3"}')
    if (titles or offdays or manifests) and not FIXED:
        raise BoardError(f'--titles, off days and --publish-manifest: the week of {monday.isoformat()} is in the layout it was '
                         f'published in; his presses on them are on boards from {LAYOUT_FROM.isoformat()}')
    pages, pieces, teleprompter, picks, pending, kept = pages or {}, pieces or {}, teleprompter or {}, picks or {}, pending or {}, kept or {}
    kept_draft = kept_draft or {}
    calls, posted = calls or {}, posted or {}
    deep_piece = None if FIXED else deep_cut_piece(monday)
    warnings, days, panels, tabs, blocks = [], [], [], [], []
    parsed = {k: parse_day_page(v, f'the {k} publish page') for k, v in pages.items()}
    order = [k for k, *_ in DAYS]
    opened = next((k for k in order if k in parsed or k in kept), None) or next((k for k in order if k in pieces or k in picks or k in pending), None)
    if not opened:
        opened = 'ideas' if ideas or FIXED else 'mon'
    if TODAY_ON:
        opened = TODAY_TAB  # layout A: the board opens on Today, the Needs you queue first
    if FIXED:
        # The fixed layout's first two tabs are always there: Ideas (waiting until Sunday's ideas come) and Queue.
        panels.append(ideas_panel(monday, ideas, opened != 'ideas', queue, offdays) if ideas else
                      ideas_waiting_panel(monday, opened != 'ideas', offdays))
        n = len([k for k in order if (ideas or {}).get(k)])
        tabs.append(
            f'<button type="button" role="tab" id="tab-ideas" aria-controls="panel-ideas" '
            f'aria-selected="{"true" if opened == "ideas" else "false"}" tabindex="{"0" if opened == "ideas" else "-1"}" data-day="ideas">'
            f'<span class="t-day">Ideas</span><span class="t-dot"> · </span>'
            f'<span class="t-prog" data-tabprog="ideas">{f"pick {n}" if n else "not yet"}</span><span class="t-ch">Sunday</span></button>')
        panels.append(queue_panel(monday, queue, True, combine))
        tabs.append(
            '<button type="button" role="tab" id="tab-queue" aria-controls="panel-queue" aria-selected="false" tabindex="-1" data-day="queue">'
            f'<span class="t-day">Queue</span><span class="t-dot"> · </span>'
            f'<span class="t-prog" data-tabprog="queue">{len([q for q in queue or [] if isinstance(q, dict)])} saved</span>'
            '<span class="t-ch">For later</span></button>')
    elif ideas:
        panels.append(ideas_panel(monday, ideas, opened != 'ideas', queue))
        n = len([k for k in order if ideas.get(k)])
        tabs.append(
            f'<button type="button" role="tab" id="tab-ideas" aria-controls="panel-ideas" '
            f'aria-selected="{"true" if opened == "ideas" else "false"}" tabindex="{"0" if opened == "ideas" else "-1"}" data-day="ideas">'
            f'<span class="t-day">Ideas</span><span class="t-dot"> · </span>'
            f'<span class="t-prog" data-tabprog="ideas">pick {n}</span><span class="t-ch">Sunday</span></button>')
    for key, name, weekday, offset, slug, series_label in DAYS:
        when = monday + timedelta(days=offset)
        page = parsed.get(key)
        pick = dict(picks.get(key) or {})
        piece = pieces.get(key) or (page or {}).get('piece') or pick.get('id')
        if piece and not UUID.match(piece):
            raise BoardError(f'{weekday}: the piece id must be the content_ideas uuid, not {piece!r}')
        for other, label in ((pick.get('id'), 'the week\'s pick'), ((page or {}).get('piece'), 'its publish page')):
            if piece and other and other != piece:
                warnings.append(f'{weekday}: {label} says {other}, the board uses {piece}')
        title = pending.get(key) or (page or {}).get('title') or pick.get('title') or ''
        if key in kept_draft:
            if page or key in draft or (review or {}).get(key) or (materials or {}).get(key):
                raise BoardError(f'--keep-draft {key}: give the retained tab alone, or rebuild it from new inputs')
            if not piece:
                raise BoardError(f'--keep-draft {key}: the previous board has no piece id')
            state = 'draft'
            panels.append(re.sub(r'^(<div class="pm(?: fixed)?"[^>]*?)( hidden)?>',
                                 lambda m: m.group(1) + (' hidden' if key != opened else '') + '>',
                                 kept_draft[key], count=1))
        elif key in kept and not page:
            if not piece:
                raise BoardError(f'{weekday} is kept from the previous board but has no piece id: give --piece {key}=<uuid>')
            state = 'made'
            if FIXED and not kept[key].startswith('<div class="pm fixed"'):
                raise BoardError(f'--keep {key}: that tab is in the old layout; rebuild {weekday} with --day {key}=<its publish page> '
                                 'so it takes the fixed layout')
            panel = re.sub(r'^(<div class="pm(?: fixed)?"[^>]*?)( hidden)?>', lambda m: m.group(1) + (' hidden' if key != opened else '') + '>', kept[key], count=1)
            card = None if FIXED else videos_card(key, f'{key}-', (videos or {}).get(key), bool(piece) and piece == deep_piece)
            group = panel.find('<div class="dl-group" data-dl-group="videos">') if FIXED else -1
            if group >= 0 and (videos or {}).get(key):
                # The kept day's finished videos and thumbnails come from the record, as every other day's do.
                feature = 'data-feature="true"' in panel.split('>', 1)[0]
                panel = panel.replace(div_at(panel, group), dl_videos(f'{key}-', videos[key], feature), 1)
            if card:
                # The kept day's finished videos come from the record, as every other day's do.
                at = panel.find(f'<div class="rec" id="{key}-videos"')
                if at >= 0:
                    panel = panel.replace(div_at(panel, at), card, 1)
                elif '<div class="rec"' in panel:
                    panel = panel.replace('<div class="rec"', card + '<div class="rec"', 1)
            panels.append(panel)
        elif FIXED:
            state = fixed_day(key, name, weekday, when, series_label, page, piece, pick, title, pending, draft, calls, review,
                              materials, briefs, teleprompter, videos, ideas, key != opened, panels, warnings, built_at, kept_at,
                              sweeps, lessons, folders, titles, manifests, moved=moved)
        elif page:
            if not piece:
                raise BoardError(f'{weekday} is made but has no piece id: give --piece {key}=<uuid>, or --options or --live '
                                 'so the week\'s pick names it; every tick carries it')
            state = 'made'
            if page['css'] not in blocks:
                if blocks:
                    warnings.append(f'{weekday}: its publish page was built with other styles than the first; both are kept')
                blocks.append(page['css'])
            panels.append(made_panel(page, key, name, f'{key}-', teleprompter.get(key) or {}, key != opened, warnings,
                                     (videos or {}).get(key), bool(piece) and piece == deep_piece))
        else:
            state = 'draft' if key in draft else 'picked' if (piece or key in pending or pick) else 'not_picked'
            if state == 'draft' and not piece:
                raise BoardError(f'{weekday} is in draft but has no piece id: give --piece {key}=<uuid>')
            plain = next((i['so_what'] for i in (ideas or {}).get(key, [])
                          if (piece and i.get('id') == piece) or (title and i['story'].strip() == str(title).strip())), None)
            panels.append(not_made_panel(key, name, weekday, short_date(when), series_label,
                                         {'title': title, 'plain': plain} if state == 'picked' else None, key != opened,
                                         state == 'draft', calls.get(key) or (), bool(piece) and piece == deep_piece,
                                         (moved or {}).get(key) if state == 'not_picked' else None))
        if state == 'made' and posted.get(key):
            panels[-1] = posted_kick(panels[-1], posted[key], weekday, warnings)
        if calls.get(key) and state != 'draft':
            raise BoardError(f'--waiting {key}: only a day in draft shows what waits on Krish; give --draft {key}')
        if (review or {}).get(key) and not FIXED:
            if state not in ('made', 'draft'):
                # Never dropped without a word: a build that showed none of his review boxes once passed --verify.
                raise BoardError(f'--review {key}: {weekday} is {state.replace("_", " ")}, so its words would not show; '
                                 f'give --draft {key} while they are in review')
            panels[-1] = with_review(panels[-1], review_card(key, review[key], built_at, kept_at), after_heading=state == 'draft')
        if (materials or {}).get(key) and not FIXED:
            try:
                delivery = board_materials.validate(materials[key], piece)
                panels[-1] = board_materials.update_copy(panels[-1], key, delivery)
            except ValueError as error:
                raise BoardError(str(error)) from error
            if state not in ('made', 'draft'):
                raise BoardError('Publishing materials need a made or draft day')
            if 'data-prefix=' not in panels[-1].split('>', 1)[0]:
                panels[-1] = panels[-1].replace('>', f' data-prefix="{key}-">', 1)
            if state == 'draft':
                panels[-1] = re.sub(r'<p class="empty-line">.*?</p>',
                    '<p class="empty-line">This piece remains in review. Use the finished files and channel copy above; clear the stated holds before publishing.</p>',
                    panels[-1], count=1, flags=re.S)
                panels[-1] = panels[-1].replace('<h2>Waiting on you</h2>', '<h2>Before publishing</h2>')
                for step, wording in [('record-long', 'Record the long cut (Teleprompter)'), ('youtube', 'YouTube: the long video')]:
                    panels[-1] = panels[-1].replace(E(LABEL[step]), E(wording))
            card = board_materials.render(key, delivery)
            at = panels[-1].find(f'<div class="rec" id="{key}-materials"')
            if at >= 0:
                panels[-1] = panels[-1].replace(div_at(panels[-1], at), card, 1)
            else:
                at = panels[-1].find('<div class="rec')
                if at < 0:
                    raise BoardError('Cannot place publishing materials in this day')
                panels[-1] = panels[-1][:at] + card + panels[-1][at:]
        picked = state != 'not_picked'
        tabs.append(
            f'<button type="button" role="tab" id="tab-{name}" aria-controls="panel-{name}" '
            f'aria-selected="{"true" if key == opened else "false"}" tabindex="{"0" if key == opened else "-1"}" data-day="{name}">'
            f'<span class="t-day"><span class="t-wd">{when.strftime("%a")}</span> <span class="t-dm">{when.day} {when.strftime("%b")}</span></span><span class="t-dot"> · </span>'
            f'<span class="t-prog" data-tabprog="{key}">{f"{STANDING} steps" if picked else "moved" if key in (moved or {}) else "not picked"}</span>'
            f'<span class="t-ch">{series_label}</span></button>')
        days.append({
            'day': key, 'name': weekday, 'date': when.isoformat(), 'series': slug, 'series_label': series_label,
            'state': state, 'piece_id': piece or None, 'title': title or None,
            'teleprompter': teleprompter.get(key) or None,
            'waiting': list(calls.get(key) or []) or None,
            'tick_ids': [f'{key}-{k}' for k, *_ in STEPS] if picked else [],
        })
    if VERSION >= 3:
        # Layout v3: the Archive, last, with every piece since the Launch and his scores (W2.1).
        panels.append(archive_panel(archive, True))
        tabs.append(
            f'<button type="button" role="tab" id="tab-{ARCHIVE_TAB}" aria-controls="panel-{ARCHIVE_TAB}" aria-selected="false" tabindex="-1" '
            f'data-day="{ARCHIVE_TAB}"><span class="t-day">Archive</span><span class="t-dot"> · </span>'
            f'<span class="t-prog" data-tabprog="{ARCHIVE_TAB}">{len(archive or [])} pieces</span><span class="t-ch">Every piece</span></button>')
    if TODAY_ON:
        model = today_model(monday, days, videos or {}, posted, offdays, parsed, gates=gates)
        panels.insert(0, f'<div class="pm fixed" id="panel-{TODAY_TAB}" role="tabpanel" aria-labelledby="tab-{TODAY_TAB}" '
                         f'data-day="{TODAY_TAB}" tabindex="-1"><div class="day-head"><div class="kick">{E(week_span(monday))}</div>'
                         f'<h1>{E(model["label"])}</h1></div>{board_today.inner(model, heading=False)}</div>')
        asks = len(model['asks'])
        tabs.insert(0, f'<button type="button" role="tab" id="tab-{TODAY_TAB}" aria-controls="panel-{TODAY_TAB}" aria-selected="true" '
                       f'tabindex="0" data-day="{TODAY_TAB}"><span class="t-day">Today</span><span class="t-dot"> · </span>'
                       f'<span class="t-prog" data-tabprog="{TODAY_TAB}">{asks} ask{"s" if asks != 1 else ""}</span>'
                       f'<span class="t-ch">Needs you</span></button>')
    missing = [d['name'] for d in days if d['state'] == 'not_picked']
    aside = ''
    if missing:
        names = missing[0] if len(missing) == 1 else ', '.join(missing[:-1]) + ' and ' + missing[-1]
        aside = f'<span class="wk-aside">{names} {"counts" if len(missing) == 1 else "count"} once picked</span>'
    conf = {
        'week': monday.isoformat(),
        'days': [{'key': d['day'], 'name': n, 'picked': d['state'] != 'not_picked', 'state': d['state'], 'piece_id': d['piece_id']}
                 for d, (_, n, *_) in zip(days, DAYS)],
        'steps': [{'key': k, 'label': label, 'channel': c, 'standing': s} for k, label, c, s in STEPS],
        'ideas': sorted(k for k, v in (ideas or {}).items() if v),
    }
    if FIXED:
        # The briefs ride in the page, so a rebuild from the downloaded board (--previous) keeps them.
        conf['layout'] = VERSION
        conf['briefs'] = briefs
        conf['sweeps'] = sweeps  # carried on a rebuild while the words they changed stand (build(), previous_sweeps)
        # His presses' inputs ride in the page too, so a rebuild without them keeps what he is pressing on (previous_conf).
        conf['titles'] = titles
        conf['offdays'] = offdays
        conf['manifests'] = manifests
        if lessons and not any((review or {}).get(k) for k in order):
            warnings.append('--lessons: no day has drafts on the board, so What I learned from your edits shows nowhere')
    # The fixed layout has one stylesheet: publish_manager's, never a day page's own copy of it.
    css = publish_manager.CSS.strip() if FIXED else '\n'.join(blocks or [publish_manager.CSS.strip()])
    page = fill(template('page.html'), {
        'TITLE': html.escape(board_title(monday), quote=False),
        'BASE_CSS': css, 'WEEK_CSS': template('week.css').strip() + (board_today.scoped_css() if TODAY_ON else ''), 'KICKER': E(week_span(monday)),
        'TABLIST_LABEL': E(f'Publishing days, week of {monday.day} {monday.strftime("%B")}'),
        'TABS': ''.join(tabs), 'ASIDE': aside, 'PANELS': ''.join(panels), 'SCRIPT': script(conf),
        'WK_CLASS': ' fixed' if FIXED else '', 'MAIN_ATTRS': (f' data-layout="{VERSION}"' + (' data-today="1"' if TODAY_ON else '')) if FIXED else '',
    }, 'page.html')
    problems = check_page(page)
    if problems:
        raise BoardError('the board failed its own checks:\n  ' + '\n  '.join(problems))
    page = engine_stamp.stamp(page, 'week_board')
    # The board's own words have none (the self-test reads the templates); a piece's words are its own.
    dashes = sum(page.count(d) for d in DASHES)
    if dashes:
        warnings.append(f'the board holds {dashes} long dash{"es" if dashes > 1 else ""}, from a piece\'s own words or title')
    size = len(page.encode('utf-8'))
    if size > MAX_BYTES:
        raise BoardError(f'the board is {size / 1048576:.1f} MB, over the 16 MB an artifact page may be')
    if size > WARN_BYTES:
        warnings.append(f'the board is {size / 1048576:.1f} MB, close to the 16 MB an artifact page may be')
    manifest = {
        'kind': 'week_board', 'version': 1, 'title': board_title(monday),
        'week_start': monday.isoformat(), 'week_end': (monday + timedelta(days=4)).isoformat(),
        'built_at': built_at,
        'bytes': size, 'sha256': hashlib.sha256(page.encode('utf-8')).hexdigest(),
        'days': days,
        'made': [d['day'] for d in days if d['state'] == 'made'],
        'picked': [d['day'] for d in days if d['state'] != 'not_picked'],
        'db': {
            'ticks': {'doc_id': '<day>-<step>', 'fields': ['done', 'at', 'day', 'piece_id', 'step', 'channel', 'label']},
            'links': {'doc_id': '<day>', 'fields': ['article', 'youtube', 'at']},
            'edits': {'doc_id': '<day>-<item>', 'fields': ['text', 'day', 'item', 'base_sha256', 'at']},
            'picks': {'doc_id': '<day>', 'fields': ['pick', 'idea_id', 'series', 'story', 'day', 'at', 'note']},
            'queue': {'doc_id': '<pick>', 'fields': ['pick', 'queued', 'verdict', 'reason', 'angle', 'so_what', 'story', 'idea_id', 'series', 'week', 'at'],
                      'combine': {'doc_id': 'combine-<n>', 'fields': ['combine', 'members', 'pick', 'at'],
                                  'then': 'POST /api/content-ideas/synthesize with the members, decided_by Krish'}},
        },
        'combine': [{'id': g['id'], 'members': g['members'], 'series': g['series'], 'thesis': g['thesis']} for g in combine or []],
        'queue': [{'id': q.get('id'), 'so_what': q.get('so_what'), 'series': q.get('series'), 'triage': (q.get('triage') or {}).get('verdict')}
                  for q in (queue or [])],
        'ideas': {k: [{'pick': i['pick'], 'idea_id': i.get('id'), 'his': bool(i.get('his') or i.get('source_kind') == 'his'), 'so_what': i['so_what'], 'story': i['story'],
                       'why_now': i['why_now'], 'fact': i['fact'], 'source': i['source'], 'source_kind': i.get('source_kind'),
                       'why_here': i.get('why_here'), 'beats': i.get('beats') or [], 'style': i.get('style'), 'covers': i.get('covers') or []} for i in v]
                  for k, v in (ideas or {}).items()},
        'review': {k: [{'item': slug, 'label': label, 'words': len(t.split()),
                        'sha256': hashlib.sha256(t.encode('utf-8')).hexdigest(),
                        'built_at': (kept_at or {}).get(f'{k}-{slug}') or built_at} for slug, label, t in v]
                   for k, v in (review or {}).items()},
        'steps': [{'key': k, 'label': label, 'channel': c, 'standing': s,
                   'records_with': f'making.py <piece> posted {c} [url]' if c else None,
                   'note': None if c else 'Record is done from the takes on the record, never from a tick'}
                  for k, label, c, s in STEPS],
        'publish': {'title': board_title(monday), 'icon': 'calendar', 'capabilities': {'db': {}, 'downloads': True, 'comments': {}},
                    'description': f'The week of {week_span(monday)}: '
                                   + ('the ideas to pick from, then ' if ideas else '')
                                   + 'Monday, Wednesday and Friday, with a tick for every step.'},
        'warnings': warnings,
    }
    if FIXED:
        manifest['layout'] = VERSION
        if VERSION >= 3:
            manifest['archive'] = [{'piece_id': r['piece_id'], 'date': r['date'].isoformat(), 'scored': sorted(r['scores'])} for r in archive or []]
            manifest['db']['picks']['scores'] = {
                'doc_id': 'score-<piece uuid>', 'fields': ['kind', 'piece_id', 'narrative', 'production', 'basis', 'note', 'at'],
                'then': 'the server files each save as one piece_scores row, scored_by krish; history kept'}
        manifest['briefs'] = briefs
        manifest['sweeps'] = sweeps
        manifest['lessons'] = [{'id': ls['id'], 'kind': ls['kind'], 'status': ls['status']} for ls in lessons or []]
        # His presses (docs/PUBLISH_BOARDS.md, "His presses"): written by Krish alone; a session reads them, never writes them.
        manifest['db']['queue']['presses'] = {
            'doc_id': '<pick>', 'fields': ['pick', 'use', 'note', 'theme', 'reason', 'target_week', 'queued', 'idea_id', 'so_what', 'story', 'series', 'week', 'day', 'at'],
            'uses': [u for u, _ in PRESSES], 'null_use': 'he took the press back'}
        manifest['db']['queue']['offday'] = {
            'doc_id': 'off-<day>-<option id>', 'fields': ['pick', 'use', 'day', 'approved', 'copy_sha256', 'format', 'source', 'option_id', 'week', 'at'],
            # A recorded option's Approve also carries the piece and the exact words (the server schedules it and sends them).
            'recorded_fields': ['kind', 'piece_id', 'series', 'style', 'script', 'script_sha256', 'folder_title', 'title']}
        manifest['db']['picks']['decisions'] = {
            '<day>-scripts': {'kind': 'approve_scripts', 'fields': ['kind', 'day', 'piece_id', 'approved', 'texts', 'scripts', 'titles', 'folder_title', 'folder_id', 'script_ids', 'at', 'send'],
                              'then': 'the server sends them to Teleprompter once the scripts check passed on them and two fresh readers '
                                      'heard them (else status held), records a send on the making record, and writes send '
                                      '{status, folder_id, scripts, error, recorded, record_error, at, by}'},
            '<day>-titles': {'kind': 'titles', 'fields': ['kind', 'day', 'piece_id', 'picks', 'at']},
            '<day>-publish': {'kind': 'approve_publish', 'fields': ['kind', 'day', 'piece_id', 'approved', 'manifest_sha256', 'at']},
            '<day>-reject-<asset>': {'kind': 'reject_asset', 'fields': ['kind', 'day', 'piece_id', 'asset', 'label', 'reason', 'drive_id', 'at_ms', 'formats', 'at'],
                                     'then': 'the server files his reason in taste_rejection_inbox'},
            'views': {'approvals': 'approve_scripts', 'titles': 'titles'}}
        manifest['titles'] = titles
        manifest['offdays'] = offdays
        manifest['manifests'] = manifests
        manifest['db']['comments'] = {
            'doc_id': '<uuid>', 'fields': ['thread_id', 'anchor', 'text', 'at', 'box', 'paragraph', 'quote', 'act', 'ref'],
            'acts': {'undo': 'put the also-changed ref back (edit_sweep.py --undo)', 'apply': 'make the suggested ref too',
                     'lesson_yes': 'his yes to the proposal ref: relay it, decided_by Krish',
                     'lesson_no': 'his no to the proposal ref: relay it, decided_by Krish'}}
    return page, manifest, warnings


def check_page(page):
    """Problems that would break the board: a repeated id, a reference to
    no id, a tick for no step, a tick box with no tick."""
    problems = []
    ids = re.findall(r'\sid="([^"]+)"', page)
    seen, dups = set(), set()
    for i in ids:
        (dups if i in seen else seen).add(i)
    if dups:
        problems.append(f'{len(dups)} ids used twice: {sorted(dups)[:8]}')
    refs = re.findall(r'\s(?:data-ref|for|aria-controls|aria-labelledby)="([^"]+)"', page) + re.findall(r'\shref="#([^"]+)"', page)
    # A link to a day (#monday) or a day's step (#monday/publish) is a route week.js opens (fromHash), not an id.
    route = re.compile(r'(%s)(/(%s))?' % ('|'.join(n for _, n, *_ in DAYS), '|'.join(DAY_STEPS)))
    dangling = sorted({x for r in refs for x in r.split() if x not in seen and not route.fullmatch(x)})
    if dangling:
        problems.append(f'references to no id: {dangling[:8]}')
    keys = {k for k, *_ in STEPS}
    # The days whose piece Krish called a 15-minute feature: only their tabs may hold the feature's ticks.
    featured = {re.search(r'data-prefix="(\w+)-"', t).group(1) for t in re.findall(r'<div class="pm(?: fixed)?" id="panel-\w+"[^>]*>', page)
                if 'data-feature="true"' in t and 'data-prefix="' in t}
    for tid in set(re.findall(r'data-tick="([^"]+)"', page)):
        day, _, step = tid.partition('-')
        if day not in {k for k, *_ in DAYS} or step not in keys:
            problems.append(f'a tick for no step: {tid}')
        elif step in FEATURE_ONLY and day not in featured:
            problems.append(f'a 15-minute feature tick on a day that is not a feature: {tid}')
    if page.count('<label class="tick') != page.count('data-tick="'):
        problems.append('a tick label without its box')
    if 'Mark done' in page:
        problems.append('a Mark done button is left; its tick would live in one browser only')
    return problems


def verify(page):
    """Why this board may not be published, or []. scripts/hooks/artifact_gate.py runs it before every board
    publish (Krish, 2026-10-14: "how are you going to ensure all this stuff ... can never be had again"):
    the engine built it and nothing changed it since, every made day carries its Copy buttons, and every
    finished video on it has its Drive link and its thumbnail's ("I do not see any video thumbnail assets
    anywhere", "You should always link the Google Drive videos")."""
    out = []
    why = engine_stamp.stamp_problem(page, 'week_board')
    if why:
        out.append(why)
    starts = [m.start() for m in re.finditer(r'<div class="pm(?: fixed)?" id="panel-', page)] + [len(page)]
    if '<main id="week" data-layout="' in page:
        out += fixed_problems(page)
    ideas_at = max(page.find('<div class="pm" id="panel-ideas"'), page.find('<div class="pm fixed" id="panel-ideas"'))
    fixed = '<main id="week" data-layout="' in page
    if ideas_at >= 0 and 'data-state="ideas-waiting"' not in page[ideas_at:ideas_at + 400]:
        tab = page[ideas_at:next((s for s in starts if s > ideas_at), len(page))]
        for key, _, weekday, *_ in DAYS:
            day = re.search(rf'<section class="id-day" id="ideas-{key}".*?</section>', tab, re.S)
            cards = re.findall(r'<article class="id-card".*?</article>', day.group(0), re.S) if day else []
            # In the fixed layout his five presses (Krish, 2026-10-28): the pick box with its note, and the other four.
            marks = ((lambda c: all(f'data-press="{u}"' in c for u, _ in PRESSES) and 'data-pick-note="' in c) if fixed else
                     (lambda c: 'data-triage="story"' in c and 'data-queue-mark="' in c))
            checked = [c for c in cards if 'data-pick="' in c and re.search(r'<dt>Source</dt><dd><a href="https://', c)
                       and '<dt>Strongest checked fact</dt><dd>' in c and 'class="id-sowhat"' in c and marks(c)
                       and (not fixed or 'data-source-kind="' in c)]
            if len(checked) < MIN_IDEAS:
                out.append(f'ideas: {weekday} has {len(checked)} checked idea(s) with a pick box; it needs {MIN_IDEAS}, each with what a business person finds out, a pick box, '
                           + ('Wider piece, Future trend, Next week and Reject, and where it came from' if fixed else 'the triage buttons and a Queue mark'))
    for a, b in zip(starts, starts[1:]):
        panel = page[a:b]
        head = re.match(r'<div class="pm(?: fixed)?" id="panel-(\w+)"[^>]*>', panel)
        name, tag = head.group(1), head.group(0)
        if 'data-state="draft"' in tag and '<textarea class="rv-text"' not in panel:
            out.append(f'{name}: a day in review with no words to review')
        if 'data-state="made"' not in tag:
            continue
        p = (re.search(r'data-prefix="([^"]*)"', tag) or [None, ''])[1]
        if 'data-act="text"' not in panel:
            out.append(f'{name}: a made day with no Copy buttons')
        # Every picture carries its own bytes or a link. Krish, 2026-10-18, of Friday's six chart cards, empty
        # because they borrowed the article's picture by a script the board does not run: "there are
        # significant issues with the publish board, not downloading or linking the right assets".
        shown = re.sub(r'<script\b.*?</script>', '', panel, flags=re.S)  # a script's own template is not a picture
        empty = [t for t in re.findall(r'<img\b[^>]*>', shown)
                 if '${' not in t and not re.search(r'\ssrc="(?:data:image/|https://)', t)]
        if empty:
            out.append(f'{name}: {len(empty)} picture(s) with nothing to show, download or copy')
        if fixed and 'class="pm fixed"' in tag:
            out += run_sheet_problems(name, panel, tag)
        vid = re.search(r'<div class="rec" id="' + re.escape(p) + r'videos".*?<p class="rec-how">', panel, re.S)
        if vid:
            card = vid.group(0)
            if 'Not in Drive yet' in card:
                out.append(f'{name}: a finished video with no Drive link; record it (making.py PIECE drive-link CUT URL --thumb-url URL)')
            if 'its link joins this card once recorded' in card or card.count('Download thumbnail') < card.count('>Download</a>'):
                out.append(f'{name}: a finished video with no thumbnail link; record it (making.py PIECE drive-link CUT URL --thumb-url URL)')
    return out


def fixed_problems(page):
    """Why a board in the fixed layout is not in it: the five tabs in their order, each day exactly its heading, its
    four steps and their four panels and nothing else, one stylesheet, and no banner laid over a tab by hand.
    Krish, 2026-10-21: the engine must "feed it in the right way consistently", never change its layout."""
    out = []
    # The page says its own layout version: version 3 (from v3.from) adds the Archive, last.
    version = int((re.search(r'<main id="week" data-layout="(\d+)"', page) or [None, '2'])[1])
    today = bool(re.search(r'<main id="week" data-layout="\d+" data-today="1"', page))
    TABS = ((TODAY_TAB,) if today else ()) + TOP_TABS + ((ARCHIVE_TAB,) if version >= 3 else ())
    tabs = re.findall(r'<button type="button" role="tab" id="tab-([a-z]+)"', page)
    if tuple(tabs) != TABS:
        out.append(f'layout: the tabs are {tabs}, not {list(TABS)}')
    panels = re.findall(r'<div class="(pm[^"]*)" id="panel-([a-z]+)"', page)
    if tuple(n for _, n in panels) != TABS:
        out.append(f'layout: the tab panels are {[n for _, n in panels]}, not {list(TABS)}')
    if any(c != 'pm fixed' for c, _ in panels):
        out.append('layout: a tab not drawn in the fixed layout (a kept or hand-made panel)')
    if page.count('<style>') != 1:
        out.append(f'layout: {page.count("<style>")} stylesheets; the fixed layout has one')
    if re.search(r'<div class="stage[ "]', page):
        out.append('layout: a banner laid over a tab by hand')
    for _, name in panels:
        start = page.find(f'id="panel-{name}"')
        start = page.rfind('<div', 0, start)
        panel = div_at(page, start)
        inner = panel[panel.index('>') + 1:-len('</div>')]
        children = []
        at = 0
        while True:
            nxt = inner.find('<', at)
            if nxt < 0 or inner[at:nxt].strip():
                if nxt >= 0 or inner[at:].strip():
                    children.append(('text', inner[at:(nxt if nxt >= 0 else len(inner))].strip()[:40]))
                break
            if not inner.startswith('<div', nxt):
                children.append(('tag', inner[nxt:nxt + 40]))
                break
            block = div_at(inner, nxt)
            children.append(('div', re.match(r'<div class="([^"]+)"', block).group(1) if re.match(r'<div class="([^"]+)"', block) else block[:40]))
            at = nxt + len(block)
        kinds = [c for _, c in children]
        if name == TODAY_TAB:
            # Layout A: its heading, then the view. One button per ask, each a link to what it approves, and no
            # button label longer than its fixed width holds.
            if kinds != ['day-head', 'today-a']:
                out.append(f'layout: today holds {kinds}, not its heading and the Today view')
            for ask in re.findall(r'<li class="ask">.*?</li>', panel, re.S):
                if ask.count('class="btn') > 1 or ('<span class="n">' in ask and not re.search(r'<a class="btn go" href="(https://|#)', ask)):
                    out.append('layout: a Needs you row without its one button linking to what it approves')
            for label in re.findall(r'<a class="btn[^"]*" href="[^"]*">([^<]*)</a>', panel):
                if len(html.unescape(label)) > board_today.CTA_MAX:
                    out.append(f'layout: a Today button label longer than its button holds ({label})')
            continue
        if name == ARCHIVE_TAB:
            # The Archive: its heading, then its list; each row with a piece carries his Scores press.
            if kinds[:1] != ['day-head']:
                out.append('layout: archive does not open with its heading')
            for row in re.findall(r'<li class="ar-row".*?</li>', panel, re.S):
                piece = re.search(r'data-piece="([^"]*)"', row)
                if piece and UUID.match(piece.group(1)) and f'data-scores-piece="{piece.group(1)}"' not in row:
                    out.append(f'layout: an Archive row without its Scores press ({piece.group(1)})')
            continue
        if name in ('ideas', 'queue'):
            if not kinds or kinds[0] != 'day-head':
                out.append(f'layout: {name} does not open with its heading')
            if name == 'queue':
                # A "Could combine" card is queued ideas and his Combine button, never a card drawn by hand.
                for card in re.findall(r'<article class="q-combo".*?</article>', panel, re.S):
                    cid = re.search(r'data-combine="([^"]*)"', card)
                    ids = (re.search(r'data-members="([^"]*)"', card) or [None, ''])[1].split(',')
                    if (not cid or not re.fullmatch(r'combine-\d{1,3}', cid.group(1)) or not COMBINE_MIN <= len(ids) <= COMBINE_MAX
                            or not all(UUID.match(i) for i in ids) or f'data-act="combine" data-for="{cid.group(1)}"' not in card):
                        out.append('layout: a Could combine card without its queued members or its Combine button')
            continue
        want = ['day-head', 'steps'] + ['subpanel'] * len(DAY_STEPS)
        if kinds != want:
            out.append(f'layout: {name} holds {kinds}, not its heading, its steps and their {len(DAY_STEPS)} panels')
        subs = re.findall(r'<button type="button" role="tab" class="st" id="[^"]+" aria-controls="[^"]+" data-sub="([a-z]+)"', panel)
        if tuple(subs) != DAY_STEPS:
            out.append(f'layout: {name}\'s steps are {subs}, not {list(DAY_STEPS)}')
    return out


def write(page, manifest, out):
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    # LF on every machine, so the bytes are the ones the manifest's sha256 names.
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(page)
    side = out.with_suffix('.json')
    manifest = dict(manifest, html=out.name, publish=dict(manifest['publish'], file_path=str(out.resolve())))
    with open(side, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    return out, side


def build(args, get=None):
    """(page, manifest). get: the engine reader (live_reader()); --live makes one."""
    monday = monday_of(args.week)
    use_layout(monday)  # the inputs below (Teleprompter cuts, steps) are read in this week's layout
    warnings = []
    pages = {}
    for k, v in by_day(args.day, '--day').items():
        try:
            pages[k] = Path(v).read_text(encoding='utf-8')
        except OSError as error:
            raise BoardError(f'--day {k}: cannot read {v}: {error.strerror}')
    pieces = by_day(args.piece, '--piece')
    pending = by_day(args.pending, '--pending')
    unpick = set(by_day([f'{d}=x' for d in (args.unpick or [])], '--unpick'))
    moved = moved_of(getattr(args, 'moved', None))
    unpick |= set(moved)
    draft = set(by_day([f'{d}=x' for d in (getattr(args, 'draft', None) or [])], '--draft'))
    calls = {}
    for v in getattr(args, 'waiting', None) or []:
        k, sep, rest = v.partition('=')
        key = DAY_KEYS.get(k.strip().lower())
        if not (sep and key and rest.strip()):
            raise BoardError(f'--waiting {v}: give DAY=WHAT, e.g. fri=Approve the outline')
        calls.setdefault(key, []).append(rest.strip())
    previous = None
    if args.previous:
        try:
            previous = board_days(Path(args.previous).read_text(encoding='utf-8-sig'), f'--previous {args.previous}')
        except OSError as error:
            raise BoardError(f'--previous: cannot read {args.previous}: {error.strerror}')
    picks = {}
    if args.options and args.live:
        raise BoardError('give --options or --live, not both')
    get = get or (live_reader() if args.live else None)
    if args.options:
        picks = picks_from_options(read_json(args.options, '--options'), monday, warnings)
    elif get:
        picks = picks_from_options(get(f'/api/week/options?week_start={monday.isoformat()}'), monday, warnings)
    # Teleprompter scripts: a file for every day, a file for one day, and with --live each piece's making record.
    shared, per_day = [], {}
    for v in args.teleprompter or []:
        k, sep, rest = v.partition('=')
        if sep and DAY_KEYS.get(k.strip().lower()):
            per_day[DAY_KEYS[k.strip().lower()]] = read_json(rest.strip(), '--teleprompter')
        else:
            data = read_json(v, '--teleprompter')
            # A file for every day must name each piece by its id, or one piece's scripts would land on every tab.
            if not (isinstance(data, dict) and (isinstance(data.get('pieces'), dict) or any(UUID.match(str(k)) for k in data))):
                raise BoardError(f'--teleprompter {v}: a file without a day must hold each piece by its id ({{"pieces": {{"<uuid>": ...}}}}); '
                                 'give one piece\'s record or ids as --teleprompter mon=PATH')
            shared.append(data)
    kept = {}
    retained_drafts = {}
    for key in set(by_day([f'{d}=x' for d in (getattr(args, 'keep', None) or [])], '--keep')):
        if not args.previous:
            raise BoardError('--keep needs --previous, the board page to keep the day from')
        if key in pages:
            raise BoardError(f'--keep {key} and --day {key}: give one; --day builds the tab from its publish page')
        kept[key] = kept_panel(Path(args.previous).read_text(encoding='utf-8-sig'), key)
        if previous and not pieces.get(key):
            held = (previous['days'].get(key) or {}).get('piece_id')
            if held:
                pieces[key] = held
    for key in set(by_day([f'{d}=x' for d in (getattr(args, 'keep_draft', None) or [])], '--keep-draft')):
        if not args.previous or previous is None:
            raise BoardError('--keep-draft needs --previous, the live board page to retain')
        if key in pages or key in kept or key in draft:
            raise BoardError(f'--keep-draft {key}: give only one state for this day')
        held = (previous['days'].get(key) or {})
        if held.get('state') != 'draft' or not held.get('piece_id'):
            raise BoardError(f'--keep-draft {key}: the previous board has no drafted piece to retain')
        if pieces.get(key) and pieces[key] != held['piece_id']:
            raise BoardError(f'--keep-draft {key}: its piece id changed')
        pieces[key] = held['piece_id']
        retained_drafts[key] = kept_draft_panel(Path(args.previous).read_text(encoding='utf-8-sig'), key)
        _, retained_calls = previous_draft(Path(args.previous).read_text(encoding='utf-8-sig'), key)
        if retained_calls:
            calls[key] = retained_calls
    for v in getattr(args, 'carry', None) or []:
        k, sep, rest = v.partition('=')
        path, sep2, frm = rest.rpartition(':')
        key, src = DAY_KEYS.get(k.strip().lower()), DAY_KEYS.get(frm.strip().lower())
        if not (sep and sep2 and key and src and path):
            raise BoardError(f'--carry {v}: give DAY=PAGE:FROMDAY, e.g. mon=board-2026-10-26.html:fri')
        if key in pages or key in kept or key in retained_drafts or key in draft:
            raise BoardError(f'--carry {key}: give only one state for this day')
        try:
            src_text = Path(path).read_text(encoding='utf-8-sig')
        except OSError as error:
            raise BoardError(f'--carry {v}: cannot read {path}: {error.strerror}')
        held = (board_days(src_text, f'--carry {path}')['days'].get(src) or {}).get('piece_id')
        if not held:
            raise BoardError(f'--carry {v}: that board names no piece on {src}')
        if pieces.get(key) and pieces[key] != held:
            raise BoardError(f'--carry {key}: --piece says {pieces[key]}, the carried tab holds {held}')
        pieces[key] = held
        state, panel = carried_panel(src_text, src, key, monday + timedelta(days=next(o for d, _, _, o, *_ in DAYS if d == key)), f'--carry {v}')
        if state == 'made':
            kept[key] = panel
        else:
            retained_drafts[key] = panel
            _, carried_calls = previous_draft(src_text, src)
            if carried_calls:
                calls[key] = carried_calls
    for key in sorted(draft & (set(pages) | set(kept))):
        raise BoardError(f'--draft {key} with --day or --keep {key}: a day in review shows its review card, never an older publish page')
    scripts, unmade, videos, posted, fresh, folders = {}, [], {}, {}, set(), {}
    held_draft = {k for k, d in ((previous or {}).get('days') or {}).items() if d.get('state') == 'draft'}
    for key, _, weekday, *_ in DAYS:
        # The same order as board(): --piece, then the publish page's own, then the week's pick.
        piece = pieces.get(key) or (parse_day_page(pages[key], f'the {key} publish page')['piece'] if key in pages else None) \
            or (picks.get(key) or {}).get('id')
        found = {}
        if get and piece:
            try:
                answer = get(f'/api/content-ideas/{piece}/making')
            except BoardError as error:
                if key in pages or key in kept or key in draft:
                    # Fail closed: without the record nothing shows the page is not older than the words.
                    raise BoardError(f'{weekday}: its making record could not be read ({error}), so nothing shows whether '
                                     f'its tab is older than its words; try again, and leave the board standing until it reads')
                answer = None
                warnings.append(f'{weekday}: its making record could not be read ({error}); no Teleprompter scripts from it')
            if answer is not None:
                found = teleprompter_info(answer, piece, warnings, f'{weekday}\'s making record')
                making_rec = ((answer.get('making') or {}) if isinstance(answer, dict) else {})
                if isinstance(making_rec.get('video_assets'), list):
                    videos[key] = making_rec['video_assets']
                pack = making_rec.get('pack')
                if isinstance(pack, dict) and isinstance(pack.get('folder'), str) and pack['folder'].strip():
                    folders[key] = pack['folder'].strip()  # the post's library folder, named in Download first
                made_at = (making_rec.get('publish_manager') or {})
                url = made_at.get('url') if isinstance(made_at, dict) else None
                is_posted = isinstance(answer, dict) and answer.get('state') == 'published'
                if is_posted:
                    sub = ((making_rec.get('channels') or {}).get('substack') or {})
                    if isinstance(sub, dict) and sub.get('posted_at'):
                        posted[key] = sub['posted_at']
                if isinstance(url, str) and url.strip() and key not in pages and key not in kept and key not in draft and key not in retained_drafts:
                    unmade.append(f'{weekday}: the board being replaced holds its words in review; give --draft {key} with its '
                                  f'--review files (and --waiting for each call)' if key in held_draft else
                                  f'{weekday}: piece {piece} has its publish page ({url.strip()}); Artifact read it and give '
                                  f'--day {key}=<the saved file>, or its tab loses every Copy card')
                if key in draft and is_posted:
                    unmade.append(f'{weekday} is posted: its tab keeps the publish page that went out; --draft is for words '
                                  f'still in review')
                # A publish page older than the words it is for (Friday, 15 October: the first version's page, chips and
                # copy under v3's words). Once posted, the page is what went out, so it stays.
                changed = (making_rec.get('script_check') or {}).get('changed_at')
                words_at = [t for t in map(parse_time, changed.values() if isinstance(changed, dict) else [changed]) if t]
                page_at = parse_time(made_at.get('at') if isinstance(made_at, dict) else None)
                if (key in pages or key in kept) and page_at and words_at and page_at >= max(words_at):
                    fresh.add(key)
                if (key in pages or key in kept) and not is_posted and page_at and words_at and max(words_at) > page_at:
                    unmade.append(f'{weekday}: its publish page ({page_at:%d %b %H:%M} UTC) is older than its words '
                                  f'({max(words_at):%d %b %H:%M} UTC), so its chips, scripts and copy describe words that are '
                                  f'gone: give --draft {key} with --review for the words in review, or make its publish page again')
        for data in shared:
            found = teleprompter_info(data, piece, warnings, f'{weekday} in --teleprompter') or found
        if key in per_day:
            found = teleprompter_info(per_day[key], piece, warnings, f'--teleprompter {key}') or found
        if found:
            scripts[key] = found
    if unmade:
        raise BoardError('a made day has no publish page in this build:\n  ' + '\n  '.join(unmade))
    for key in unpick:
        picks.pop(key, None)
    review = {}
    for v in getattr(args, 'review', None) or []:
        k, sep, rest = v.partition('=')
        key = DAY_KEYS.get(k.strip().lower())
        label, bar, path = rest.partition('|')
        if not (sep and key and bar and path.strip()):
            raise BoardError(f'--review {v}: give DAY=LABEL|PATH, e.g. fri=Article|docs/plans/x.md')
        try:
            text = Path(path.strip()).read_text(encoding='utf-8').strip()
        except OSError as error:
            raise BoardError(f'--review {v}: cannot read {path.strip()}: {error.strerror}')
        slug = re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-') or 'text'
        review.setdefault(key, []).append((slug, label.strip(), text))
    for key in sorted(draft - set(review)):
        raise BoardError(f'--draft {key}: give the words in review with --review {key}=LABEL|PATH')
    drops = {}
    for v in getattr(args, 'drop_review', None) or []:
        k, sep, rest = v.partition('=')
        key = DAY_KEYS.get(k.strip().lower())
        if not (sep and key and rest.strip()):
            raise BoardError(f'--drop-review {v}: give DAY=ID, e.g. fri=outline')
        rid = rest.strip() if rest.strip().startswith(f'{key}-') else f'{key}-{rest.strip()}'
        drops.setdefault(key, set()).add(rid)
    if args.previous:
        before = Path(args.previous).read_text(encoding='utf-8-sig')
        for key in sorted(draft):
            had, had_calls = previous_draft(before, key)
            given = {f'{key}-{slug}' for slug, _, _ in review.get(key, [])}
            gone = [r for r in had if r not in given and r not in drops.get(key, set())]
            if gone:
                # A rebuild never drops a box Krish may be editing without a word (a scheduled one, say).
                raise BoardError(f'--draft {key}: the board being replaced holds {", ".join(gone)} for review, and this build '
                                 f'does not give {"it" if len(gone) == 1 else "them"}: give --review for each, or '
                                 f'--drop-review {key}=<id> once Krish is done with it')
            if had_calls and not calls.get(key):
                calls[key] = had_calls
                warnings.append(f'{next(w for k, _, w, *_ in DAYS if k == key)}: the calls waiting on Krish are carried from '
                                f'the board being replaced')
    for key in sorted(set(calls) - draft - set(retained_drafts)):
        raise BoardError(f'--waiting {key}: only a day in draft shows what waits on Krish; give --draft {key}')
    kept_at = previous_review_times(Path(args.previous).read_text(encoding='utf-8-sig'), review) if args.previous else {}
    ideas, offdays = None, None
    if getattr(args, 'ideas', None):
        raw = read_json(args.ideas, '--ideas')
        ideas = read_ideas(raw, monday)
        if fixed_layout(monday):
            offdays = read_offdays(raw.get('offdays') if isinstance(raw, dict) else None)
            # Krish, 2026-10-24: his Inspiration House read properly, and styles he can choose from that push. The
            # gather's sources.json sits beside ideas.json; a fixed week without it was never gathered.
            src = Path(args.ideas).resolve().parent / 'sources.json'
            if not src.exists():
                raise BoardError(f'--ideas: no sources.json beside {args.ideas}; run board_feed.py gather {monday.isoformat()} first')
            owed = coverage_problems(raw, read_json(str(src), 'sources.json')) + style_problems(raw)
            if owed:
                raise BoardError('--ideas is not ready to show (board_feed.py cover):\n  ' + '\n  '.join(owed))
    if getattr(args, 'offdays_plan', None):
        # Growth's Sunday Off-days section (growth-offdays/1): the days ideas.json did not give.
        if not fixed_layout(monday):
            raise BoardError(f'--offdays-plan: the week of {monday.isoformat()} is in the layout it was published in, which has no Off days')
        mixed, plan_warnings = read_growth_offdays(read_json(args.offdays_plan, '--offdays-plan'), monday)
        warnings.extend(plan_warnings)
        given = dict((offdays and {k: [previous_option(o) for o in v] for k, v in offdays.items()}) or {})
        offdays = read_offdays({**mixed, **given}, '--offdays-plan with ideas.json offdays')
    queue = None
    if getattr(args, 'queue', None):
        saved = read_json(args.queue, '--queue')
        queue = saved.get('queue') if isinstance(saved, dict) else saved
        if not isinstance(queue, list):
            raise BoardError('--queue: give the saved answer of GET /api/idea-queue ({"queue": [...]})')
    combine = None
    if getattr(args, 'combine', None):
        if not fixed_layout(monday):
            raise BoardError(f'--combine: the week of {monday.isoformat()} has no Queue tab; Could combine is on boards from {LAYOUT_FROM.isoformat()}')
        combine = read_combine(read_json(args.combine, '--combine'), queue)
    materials = board_materials.previous(Path(args.previous).read_text(encoding='utf-8-sig')) if args.previous else {}
    for key, path in by_day(getattr(args, 'materials', None), '--materials').items():
        materials[key] = read_json(path, '--materials')
    for key in unpick:
        materials.pop(key, None)
    briefs = {k: read_brief(read_json(v, f'--brief {k}'), f'--brief {k}') for k, v in by_day(getattr(args, 'brief', None), '--brief').items()}
    if args.previous and fixed_layout(monday):
        # A brief already on the board stays on it until a new one is given.
        for k, b in previous_briefs(Path(args.previous).read_text(encoding='utf-8-sig')).items():
            briefs.setdefault(k, b)
    for key in unpick:
        briefs.pop(key, None)
    sweeps = {k: dict(read_sweep(read_json(v, f'--sweep {k}'), f'--sweep {k}'), day=k)
              for k, v in by_day(getattr(args, 'sweep', None), '--sweep').items()}
    if args.previous and fixed_layout(monday):
        # Also changed stays on the board while the words it describes stand: every box of that day unchanged.
        for k, s in previous_sweeps(Path(args.previous).read_text(encoding='utf-8-sig')).items():
            rids = [f'{k}-{slug}' for slug, _, _ in review.get(k, [])]
            if k not in sweeps and rids and all(r in kept_at for r in rids):
                sweeps[k] = s
    lessons = read_lessons(read_json(args.lessons, '--lessons')) if getattr(args, 'lessons', None) else None
    titles = {k: read_titles(read_json(v, f'--titles {k}'), f'--titles {k}') for k, v in by_day(getattr(args, 'titles', None), '--titles').items()}
    manifests = {}
    for k, v in by_day(getattr(args, 'publish_manifest', None), '--publish-manifest').items():
        try:
            manifests[k] = hashlib.sha256(Path(v).read_bytes()).hexdigest()
        except OSError as error:
            raise BoardError(f'--publish-manifest {k}: cannot read {v}: {error.strerror}')
    if args.previous and fixed_layout(monday):
        # What he is pressing on stays on the board until new options are given: the titles, the off days, the manifests.
        before = Path(args.previous).read_text(encoding='utf-8-sig')
        for k, t in (previous_conf(before, 'titles') or {}).items():
            if k in DAY_KEYS.values() and k not in titles and k not in unpick:
                try:
                    titles[k] = read_titles({'piece_id': t.get('piece_id'), **(t.get('surfaces') or {})}, f'the previous board\'s {k} titles')
                except (BoardError, AttributeError):
                    continue
        if offdays is None:
            try:
                offdays = read_offdays({k: [previous_option(o) for o in v] for k, v in (previous_conf(before, 'offdays') or {}).items()},
                                       'the previous board\'s off days')
            except (BoardError, KeyError, TypeError, AttributeError):
                offdays = None
        for k, sha in (previous_conf(before, 'manifests') or {}).items():
            if k in DAY_KEYS.values() and k not in manifests and k not in unpick and re.fullmatch(r'[a-f0-9]{64}', str(sha)):
                manifests[k] = sha
    page, manifest, more = board(monday, pages, pieces, scripts, picks, pending, kept, videos, review, draft, calls, posted, kept_at,
                                 ideas, queue, materials, briefs, combine, sweeps, lessons, folders, retained_drafts,
                                 titles, offdays, manifests,
                                 read_archive(read_json(args.archive, '--archive')) if getattr(args, 'archive', None) else None,
                                 gates=gates_of(getattr(args, 'gate', None)), moved=moved)
    if previous is not None:
        keep_previous(previous, manifest['days'], unpick, monday, fresh)
    manifest['warnings'] = warnings + more
    if getattr(args, 'target', 'web') == 'web':
        from board_web import web_page
        page, manifest = web_page(page, manifest)
    return page, manifest


# ------------------------------------------------------------------ self-test

PNG = ('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
MON_ID = '11111111-2222-4333-8444-555555555555'
WED_ID = '22222222-3333-4444-8555-666666666666'
FRI_ID = '33333333-4444-4555-8666-777777777777'
TP_FOLDER, TP_LONG, TP_SHORT = '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9', '45F414D8-31E1-4B2D-BBE4-44EBA042B346', 'ED3DE98A-7158-4448-A622-A2A5115FFA83'
TP_FOLDER_FRI, TP_LONG_FRI, TP_SHORT_FRI = 'DD28154B-B6D1-47DB-803A-79410D83196D', '185F739E-733F-43B9-B5B2-66846CB5EC44', '1165370C-68A6-444E-88D5-A326A131E58C'


def stand_in(tmp, name, title, kicker, words=None):
    """A small publish page, made by publish_manager.py itself."""
    import base64
    d = Path(tmp) / name
    d.mkdir()
    (d / 'a.png').write_bytes(base64.b64decode(PNG))
    (d / 'body.md').write_text(f'{title}\n\n## THE PART\n\nA **bold** fact.\n', encoding='utf-8')
    (d / 'words.json').write_text(json.dumps({'title': title, 'youtube_title': title, 'short_caption': 'C',
                                              'linkedin_post': 'L {ARTICLE_URL}', **(words or {})}), encoding='utf-8')
    (d / 'long.md').write_text('The long script, said out loud.\n', encoding='utf-8')
    (d / 'short.md').write_text('The short script.\n', encoding='utf-8')
    (d / 'm.json').write_text(json.dumps({
        'title': title, 'subtitle': 'S', 'date': '2026-10-12', 'kicker': kicker, 'body': 'body.md', 'words': 'words.json',
        'images': [{'id': 'cover', 'file': 'a.png', 'alt': 'Cover', 'role': 'cover'},
                   {'id': 'pic', 'file': 'a.png', 'alt': 'A', 'after_heading': 'THE PART'}],
        'scripts': [{'label': 'The 3-minute video', 'file': 'long.md'}, {'label': 'The 90-second cut', 'file': 'short.md'}],
    }), encoding='utf-8')
    return publish_manager.build(d / 'm.json', d / 'out').read_text(encoding='utf-8')


def self_test():
    import tempfile
    import title_check
    with tempfile.TemporaryDirectory() as tmp, title_check.picked_for_tests(
            ['Warner sued Suno. Now it takes a cut.', 'OpenAI tried to pick your AI.'], tmp):
        return _self_test()


def _self_test():
    checks, fails = [], []

    def check(name, ok):
        checks.append(name)
        if not ok:
            fails.append(name)

    pinned_video = {'path': '3 Posts/example/3 Video/short.mp4', 'sha256': 'a' * 64,
                    'url': 'https://content.krishraja.com/api/library/file?path=3%20Posts%2Fexample%2F3%20Video%2Fshort.mp4&sha256=' + 'a' * 64 + '&download=1'}
    check('exact immutable video has download action', bool(immutable_video_download(pinned_video)))
    check('changed video digest has no immutable action', immutable_video_download({**pinned_video, 'sha256': 'b' * 64}) is None)
    check('foreign host has no immutable action', immutable_video_download({**pinned_video, 'url': pinned_video['url'].replace('content.krishraja.com', 'example.org')}) is None)

    monday = monday_of('2026-10-12')
    with tempfile.TemporaryDirectory() as tmp:
        mon = stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money')
        fri = stand_in(tmp, 'fri', 'OpenAI tried to pick your AI.', 'mind.the.gap')
        sent = {'pieces': {MON_ID: {'folder_id': TP_FOLDER, 'folder_name': 'Mon 12 Oct follow.the.money - Who gets paid for AI songs', 'cuts': {
            'long': {'script_id': TP_LONG, 'title': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs'},
            'short': {'script_id': 'not-an-id', 'title': 'Mon 12 Oct - 90-second - Who gets paid for AI songs'}}}}}
        record = {'making': {'script_check': {'passed': True, 'hashes': {'long': 'a' * 64, 'short': 'b' * 64}},
                             'teleprompter': {'folder_id': TP_FOLDER_FRI, 'folder_name': 'Fri 16 Oct mind.the.gap - Why so many AIs', 'cuts': {
                                 'long': {'script_id': TP_LONG_FRI, 'title': 'Fri 16 Oct - 3-minute - Why so many AIs', 'script_sha256': 'c' * 64},
                                 'short': {'script_id': TP_SHORT_FRI, 'title': 'Fri 16 Oct - 90-second - Why so many AIs', 'script_sha256': 'b' * 64}}}}}
        warned = []
        scripts = {'mon': teleprompter_info(sent, MON_ID, warned, 'sent'), 'fri': teleprompter_info(record, FRI_ID, warned, 'record')}
        page, manifest, warnings = board(monday, {'mon': mon, 'fri': fri}, {'mon': MON_ID, 'fri': FRI_ID}, scripts,
                                         pending={'wed': 'Watermarks <script>'}, picks={'wed': {'id': WED_ID, 'title': 'x'}})
        out, side = write(page, manifest, Path(tmp) / 'week-board.html')
        written = json.loads(side.read_text(encoding='utf-8'))
        out_path = str(out.resolve())
        on_disk = hashlib.sha256(out.read_bytes()).hexdigest()
        plain, plain_manifest, _ = board(monday, {'mon': mon}, {'mon': MON_ID})
        empty, empty_manifest, _ = board(monday)
        try:
            board(monday, {'mon': mon.replace('data-act="text"', 'data-act="share"', 1)}, {'mon': MON_ID})
            refused_act = False
        except BoardError:
            refused_act = True
        try:
            board(monday, {'fri': fri})
            refused_no_piece = False
        except BoardError:
            refused_no_piece = True
        try:
            monday_of('2026-10-13')
            refused_tuesday = False
        except BoardError:
            refused_tuesday = True
        # The command line: a day's page and piece, the week's picks from a saved answer, the hand send's links.
        (Path(tmp) / 'mon.html').write_text(mon, encoding='utf-8')
        (Path(tmp) / 'sent.json').write_text(json.dumps(sent), encoding='utf-8')
        (Path(tmp) / 'one.json').write_text(json.dumps(record), encoding='utf-8')
        (Path(tmp) / 'options.json').write_text(json.dumps({'week_start': '2026-10-12', 'series': [
            {'slug': 'follow_the_money', 'in_flight': [{'id': MON_ID, 'idea': 'Suno', 'state': 'review', 'scheduled_for': '2026-10-12'}]},
            {'slug': 'under_the_hood', 'in_flight': [{'id': WED_ID, 'idea': 'Watermarks', 'state': 'drafting', 'scheduled_for': '2026-10-14'}]}]}),
            encoding='utf-8')
        cli_page, cli_manifest = build(parser().parse_args(['--week', '2026-10-12', '--day', f'mon={tmp}/mon.html', '--options', f'{tmp}/options.json',
                                                            '--teleprompter', f'{tmp}/sent.json', '--out', f'{tmp}/cli.html']))
        try:
            build(parser().parse_args(['--week', '2026-10-12', '--teleprompter', f'{tmp}/one.json']))
            refused_unkeyed = False
        except BoardError:
            refused_unkeyed = True
        per_day_page, _ = build(parser().parse_args(['--week', '2026-10-12', '--day', f'fri={tmp}/mon.html', '--piece', f'fri={FRI_ID}',
                                                     '--teleprompter', f'fri={tmp}/one.json']))
        picks = picks_from_options({'week_start': '2026-10-12', 'series': [
            {'slug': 'under_the_hood', 'in_flight': [{'id': WED_ID, 'idea': 'Watermarks', 'state': 'drafting', 'scheduled_for': '2026-10-14'}]},
            {'slug': 'mind_the_gap', 'in_flight': [{'id': FRI_ID, 'idea': 'Menus', 'state': 'review', 'scheduled_for': '2026-10-23'}]}]},
            monday, [])
        # Monday posted on Substack: the watcher marks it published, and in_flight drops it; scheduled keeps it.
        old_warned = []
        published_options = {'week_start': '2026-10-12', 'series': [
            {'slug': 'follow_the_money', 'in_flight': [],
             'scheduled': [{'id': MON_ID, 'idea': 'Suno', 'state': 'published', 'scheduled_for': '2026-10-12'}]},
            {'slug': 'under_the_hood', 'in_flight': [{'id': WED_ID, 'idea': 'Watermarks', 'state': 'drafting', 'scheduled_for': '2026-10-14'}],
             'scheduled': [{'id': WED_ID, 'idea': 'Watermarks', 'state': 'drafting', 'scheduled_for': '2026-10-14'}]},
            {'slug': 'mind_the_gap', 'in_flight': [], 'scheduled': []}]}
        published_picks = picks_from_options(published_options, monday, old_warned)
        old_picks = picks_from_options({'week_start': '2026-10-12', 'series': [{'slug': 'follow_the_money', 'in_flight': []}]}, monday, old_warned)
        # A rebuild that would lose a day the board it replaces held.
        (Path(tmp) / 'prev.html').write_text(page, encoding='utf-8')
        prev_info = board_days(page)
        twelfth = ('<script>\nconst CONF = {"pieces": {"mon": "' + MON_ID + '", "fri": "' + FRI_ID + '", "wed": null}, "steps": []};\n'
                   '</script><div class="pm" id="panel-monday" role="tabpanel" data-prefix="mon-" data-day="mon">'
                   '<div class="pm" id="panel-wednesday" role="tabpanel" data-day="wed">')
        twelfth_info = board_days(twelfth)
        manifest_info = board_days(json.dumps(written))
        refusals = {}
        for label, extra in (('picked to not picked', ['--day', f'mon={tmp}/mon.html', '--piece', f'mon={MON_ID}']),
                             ('made without its page', ['--day', f'fri={tmp}/mon.html', '--piece', f'fri={FRI_ID}', '--piece', f'mon={MON_ID}',
                                                        '--piece', f'wed={WED_ID}'])):
            try:
                build(parser().parse_args(['--week', '2026-10-12', '--previous', f'{tmp}/prev.html', *extra]))
                refusals[label] = None
            except BoardError as error:
                refusals[label] = str(error)
        unpicked_page, unpicked = build(parser().parse_args(['--week', '2026-10-12', '--previous', f'{tmp}/prev.html', '--day', f'mon={tmp}/mon.html',
                                                             '--day', f'fri={tmp}/mon.html', '--piece', f'mon={MON_ID}', '--piece', f'fri={FRI_ID}',
                                                             '--unpick', 'wed']))
        moved_page, _ = build(parser().parse_args(['--week', '2026-10-12', '--previous', f'{tmp}/prev.html', '--day', f'mon={tmp}/mon.html',
                                                   '--day', f'fri={tmp}/mon.html', '--piece', f'mon={MON_ID}', '--piece', f'fri={FRI_ID}',
                                                   '--moved', 'wed=2026-11-04']))
        try:
            build(parser().parse_args(['--week', '2026-10-19', '--previous', f'{tmp}/prev.html']))
            refused_other_week = False
        except BoardError:
            refused_other_week = True

        # --live: a picked piece with a publish page must come with it.
        def engine(path):
            if path.startswith('/api/week/options'):
                return published_options
            if path == f'/api/content-ideas/{MON_ID}/making':
                return {'making': {'publish_manager': {'url': 'https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS'}}, 'steps': []}
            return {'making': {}, 'steps': []}
        try:
            build(parser().parse_args(['--week', '2026-10-12', '--live', '--day', f'fri={tmp}/mon.html', '--piece', f'fri={FRI_ID}']), get=engine)
            refused_unmade = None
        except BoardError as error:
            refused_unmade = str(error)
        live_page, live_manifest = build(parser().parse_args(['--week', '2026-10-12', '--live', '--day', f'mon={tmp}/mon.html']), get=engine)
        shown = io.StringIO()
        with contextlib.redirect_stdout(shown):
            shown_code = main(['--show', str(side), '--json'])

    ids = re.findall(r'\sid="([^"]+)"', page)
    check('unique ids: none used twice across three tabs', len(ids) == len(set(ids)) and len(ids) > 60)
    check('the board passes its own checks', check_page(page) == [] and check_page(plain) == [] and check_page(empty) == [])
    emptied = re.sub(r'(<img\b[^>]*?)\ssrc="data:image/[^"]*"', r'\1', page, count=1)
    check('a made day with a picture that has nothing to show is refused (Krish, 2026-10-18)',
          emptied != page and any('picture(s) with nothing to show' in w for w in verify(emptied)))
    want = {f'{d}-{k}' for d in ('mon', 'wed', 'fri') for k, *_ in STEPS}
    check('tick ids: every picked day has its ten, <day>-<step>, the published board\'s', set(re.findall(r'data-tick="([^"]+)"', page)) == want)
    standing = [k for k, *_, s in STEPS if s]
    check('seven steps make 100%: the two cuts and the standing five', standing == ['record-long', 'record-short', 'substack', 'youtube', 'shorts', 'tiktok', 'reels'])
    check('a made day ticks in three places: checklist, Record card and each channel heading',
          page.count('data-tick="mon-record-long"') == 2 and page.count('data-tick="mon-substack"') == 2
          and page.count('data-tick="mon-linkedin"') == 2 and page.count('data-tick="wed-substack"') == 1)
    check('the old Mark done buttons are gone', 'Mark done' not in page and 'data-act="done"' not in page)
    js = script({'week': '2026-10-12', 'days': [], 'steps': []})
    check('db wiring: ticks/<day>-<step> and links/<day> in the page\'s own store',
          'db.collection("ticks").doc(id).set(body)' in js and 'db.collection("ticks").onSnapshot(' in js
          and 'db.doc("links/" + day).set(body)' in js and 'db.doc("links/" + day).onSnapshot(' in js
          and 'window.claude.use("db")' in js and 'window.claude.use("downloads")' in js)
    check('pictures decode in the page: Download never needs fetch() on a data: URL, and says when it fails',
          'function dataBlob(src)' in js and 'dataBlob(src) ||' in js and 'Could not read this picture' in js)
    check('db wiring: a tick saves done, at, day, piece_id, step, channel and label',
          '{ done, at: new Date().toISOString(), day: m.day, piece_id: m.piece_id, step: m.step, channel: m.channel, label: m.label }' in js)
    conf = json.loads(re.search(r'const CONF = (\{.*?\});\n', page).group(1))
    check('the steps in the page are the published board\'s keys, labels and channels',
          [(s['key'], s['label'], s['channel'], s['standing']) for s in conf['steps']] == [tuple(s) for s in STEPS])
    check('each day carries its piece id into every tick',
          [(d['key'], d['picked'], d['piece_id']) for d in conf['days']] == [('mon', True, MON_ID), ('wed', True, WED_ID), ('fri', True, FRI_ID)])
    check('no long dash anywhere: the page and its templates',
          not any(d in page or d in empty for d in DASHES)
          and not any(d in (TEMPLATES / n).read_text(encoding='utf-8') for n in ('page.html', 'not-made.html', 'week.css', 'week.js') for d in DASHES))
    check('a picked day not made yet names its piece and keeps its checklist',
          'picked, not made yet' in page and 'Watermarks &lt;script&gt;' in page and '<script>' not in page.split('<main id="week">')[1].split('<script>\n')[0]
          and 'id="wed-ticks"' in page and 'data-state="picked"' in page)
    check('a day not picked says so, with no ticks, and the week counts once it is',
          'data-state="not_picked"' in plain and 'is not picked yet. Pick it on the week page' in plain
          and 'Wednesday and Friday count once picked' in plain and 'data-tick="wed-' not in plain)
    check('nothing picked at all is three designed tabs, no ticks',
          empty.count('data-state="not_picked"') == 3 and 'data-tick="' not in empty and empty_manifest['picked'] == [])
    check('Record: each cut\'s script in Teleprompter by its title, and its folder',
          'Read from Teleprompter: Mon 12 Oct - 3-minute - Who gets paid for AI songs' in page
          and 'folder &quot;Mon 12 Oct follow.the.money - Who gets paid for AI songs&quot;' in page
          and 'Read from Teleprompter: Fri 16 Oct - 90-second - Why so many AIs</span>' in page)
    check('Record: a script holding older words says so', 'Read from Teleprompter: Fri 16 Oct - 3-minute - Why so many AIs (it holds older words' in page)
    engine_answer = {'making': {'teleprompter': {'folder_id': TP_FOLDER, 'cuts': {'short': {
        'script_id': TP_SHORT, 'title': 'Mon 12 Oct - 90-second - Who gets paid for AI songs', 'script_sha256': 'd' * 64}}}}, 'steps': []}
    check('the making record\'s teleprompter field, as making.py teleprompter writes it, gives the scripts',
          teleprompter_info(engine_answer, FRI_ID) == {'folder_name': None, 'folder_id': TP_FOLDER, 'cuts': {
              'short': {'title': 'Mon 12 Oct - 90-second - Who gets paid for AI songs', 'script_id': TP_SHORT, 'state': None}}})
    check('a script with no uppercase id is left out and said', 'not-an-id' not in page and any('no title and uppercase script id' in w for w in warned))
    check('a cut not in Teleprompter says so, and with none the plain Record card says to copy the script',
          'Not in Teleprompter yet' in page and '<h2 id="mon-record-h">Record</h2>' in plain and 'are not in Teleprompter yet' in plain)
    check('the take comes back one way: dropped at the top of the Video Engine Inbox',
          'Then drop each take at the top of the Video Engine Inbox in Drive (makeyourmindup &gt; Video Engine &gt; Inbox)' in page
          and 'Then drop each take at the top of the Video Engine Inbox' in plain)
    retired = re.compile(r'descript(?!ion|ive|or)', re.I)  # the tool, never the word "description"
    check('Descript is gone from the board and its templates', not retired.search(page) and not retired.search(plain)
          and not any(retired.search((TEMPLATES / n).read_text(encoding='utf-8')) for n in ('page.html', 'not-made.html', 'week.css', 'week.js')))
    check('the two Record ticks keep their ids under their new labels',
          [s_[:2] for s_ in STEPS[:2]] == [('record-long', 'Record the 3-minute cut (Teleprompter)'), ('record-short', 'Record the 90-second cut (Teleprompter)')])
    check('the two scripts are at the top of a made tab, namespaced apart from the Scripts section',
          page.index('id="mon-rec-c') < page.index('id="mon-ticks"') < page.index('class="card links"')
          and page.count('<pre class="txt" id="mon-rec-') == 2 and 'id="mon-c1"' in page)
    check('the title, and the week\'s dates in the kicker',
          "<title>This Week's Publish Board (wC 12 Oct)</title>" in page and '<div class="kick">12 to 16 October 2026</div>' in page
          and 'Mon 12 Oct' in page and 'Wed 14 Oct' in page and 'Fri 16 Oct' in page)
    check('kicker across a month and a year',
          week_span(date(2026, 9, 28)) == '28 September to 2 October 2026' and week_span(date(2025, 12, 29)) == '29 December 2025 to 2 January 2026')
    check('the manifest: week, days, piece ids, which tabs are made, the publish call',
          written['week_start'] == '2026-10-12' and written['made'] == ['mon', 'fri'] and written['picked'] == ['mon', 'wed', 'fri']
          and [d['piece_id'] for d in written['days']] == [MON_ID, WED_ID, FRI_ID]
          and [d['state'] for d in written['days']] == ['made', 'picked', 'made']
          and written['days'][0]['tick_ids'][0] == 'mon-record-long' and len(written['days'][1]['tick_ids']) == 9
          and written['publish']['capabilities'] == {'db': {}, 'downloads': True, 'comments': {}} and written['publish']['icon'] == 'calendar'
          and written['publish']['file_path'] == out_path and written['html'] == 'week-board.html'
          and written['sha256'] == hashlib.sha256(page.encode('utf-8')).hexdigest() == on_disk)
    check('the manifest says how each tick reaches the engine, and that Record comes from takes',
          written['steps'][2]['records_with'] == 'making.py <piece> posted substack [url]' and written['steps'][0]['records_with'] is None)
    check('the week\'s picks: the piece in flight scheduled for the day\'s date', picks == {'wed': {'id': WED_ID, 'title': 'Watermarks', 'state': 'drafting'}})
    check('a day posted on Substack (published) still holds its piece: the options\' scheduled list',
          published_picks == {'mon': {'id': MON_ID, 'title': 'Suno', 'state': 'published'}, 'wed': {'id': WED_ID, 'title': 'Watermarks', 'state': 'drafting'}})
    check('an engine with no scheduled list is said, once', (old_picks, sum('no "scheduled" list' in w for w in old_warned)) == ({}, 1))
    check('a board\'s days, from its page: made, picked and not picked, with their pieces',
          prev_info == {'week': '2026-10-12', 'days': {'mon': {'state': 'made', 'piece_id': MON_ID}, 'wed': {'state': 'picked', 'piece_id': WED_ID},
                                                       'fri': {'state': 'made', 'piece_id': FRI_ID}}})
    check('a board\'s days, from the board of 12 October (CONF.pieces) and from a manifest',
          (twelfth_info['days']['mon'], twelfth_info['days']['wed'], manifest_info['days']['fri'])
          == ({'state': 'made', 'piece_id': MON_ID}, {'state': 'not_picked', 'piece_id': None}, {'state': 'made', 'piece_id': FRI_ID}))
    check('a rebuild that would turn a held day into not picked is refused, naming the piece and the fix',
          bool(refusals['picked to not picked']) and f'--piece wed={WED_ID}' in refusals['picked to not picked']
          and f'--piece fri={FRI_ID}' in refusals['picked to not picked'] and '--unpick' in refusals['picked to not picked'])
    check('a rebuild that would drop a made day\'s publish page is refused',
          bool(refusals['made without its page']) and '--day mon=<the saved file>' in refusals['made without its page'])
    check('--unpick: a day Krish moved or dropped may go', [d['state'] for d in unpicked['days']] == ['made', 'not_picked', 'made']
          and 'data-tick="wed-' not in unpicked_page)
    check('--moved: a day that moved says where it went and links to its new day (Krish, 2026-10-30)',
          moved_of(['mon=2026-11-09', 'fri=2026-11-02']) == {'mon': date(2026, 11, 9), 'fri': date(2026, 11, 2)}
          and moved_link(date(2026, 11, 4)) == ('Wed 4 Nov', '/board/2026-11-02#wednesday')
          and moved_link(date(2026, 11, 7)) == ('Sat 7 Nov', '/board/2026-11-02'))
    moved_wed = div_at(moved_page, moved_page.find('<div class="pm" id="panel-wednesday"'))
    check('--moved: a board in the layout before the fixed one says so too, and links to the new day',
          'moved to Wed 4 Nov' in moved_wed and 'This piece moved to Wed 4 Nov.' in moved_wed
          and 'href="/board/2026-11-02#wednesday"' in moved_wed and 'not picked' not in moved_wed)
    check('--previous of another week is refused', refused_other_week)
    check('--live: a picked piece with a publish page and no --day is refused, naming the page to read',
          bool(refused_unmade) and 'QpGeGjaqZwvyXwRnSadqyS' in refused_unmade and '--day mon=' in refused_unmade)
    check('--live: a published Monday given its page is made; the scheduled list names the week',
          [(d['state'], d['piece_id']) for d in live_manifest['days']] == [('made', MON_ID), ('picked', WED_ID), ('not_picked', None)])
    check('--show prints the days a board holds', shown_code == 0 and json.loads(shown.getvalue())['days']['wed'] == {'state': 'picked', 'piece_id': WED_ID})
    check('the page\'s CONF carries each day\'s state', [d.get('state') for d in conf['days']] == ['made', 'picked', 'made'])
    check('the command line: the pick names the made day\'s piece and a picked day, and the hand send\'s links reach Monday',
          [(d['state'], d['piece_id']) for d in cli_manifest['days']] == [('made', MON_ID), ('picked', WED_ID), ('not_picked', None)]
          and 'Read from Teleprompter: Mon 12 Oct - 3-minute - Who gets paid for AI songs' in cli_page and 'Watermarks' in cli_page)
    check('one piece\'s Teleprompter record is given for its day, never for the whole week',
          refused_unkeyed and 'Read from Teleprompter: Fri 16 Oct - 90-second - Why so many AIs' in per_day_page)
    check('a button the board cannot run is refused', refused_act)
    check('a made day with no piece id is refused', refused_no_piece)
    check('--week must be a Monday', refused_tuesday)
    check('every channel of the publish kit has its tick', all(s['where'] in SECTION_STEP for s in publish_kit.steps({})))
    check('a title cannot close the script', '</script>' not in script({'week': 'x', 'days': [{'name': '</script>'}], 'steps': []}).split('const CONF = ')[1].split(';\n')[0])
    check('the first made day opens first', re.search(r'id="tab-monday"[^>]*aria-selected="true"', page) is not None
          and 'id="panel-wednesday"' in page and re.search(r'id="panel-wednesday"[^>]*hidden>', page) is not None)
    check('warnings: the stand-ins raise none', warnings == [])
    # --keep: a made day carried over from the previous board's page, as it stands, minus a hand-laid banner.
    opened_at = page.index('<div class="pm" id="panel-monday"')
    head_end = page.index('>', opened_at) + 1
    bannered = page[:head_end] + '<div class="stage ready-stage"><strong>Ready</strong> <div>to post</div></div>' + page[head_end:]
    kept_mon = kept_panel(bannered, 'mon')
    original = div_at(page, opened_at)
    kept_page, kept_manifest, _ = board(date(2026, 10, 12), pieces={'mon': MON_ID}, kept={'mon': kept_mon})
    check('--keep: the day\'s whole panel, its banner dropped, made and open in the new board',
          kept_mon == original and 'ready-stage' not in kept_page and original.split('>', 1)[1] in kept_page
          and [d['state'] for d in kept_manifest['days']] == ['made', 'not_picked', 'not_picked']
          and re.search(r'<div class="pm" id="panel-monday"[^>]*hidden>', kept_page) is None)
    try:
        kept_panel(page, 'wed')
        check('--keep: a day the board does not hold as made is refused', False)
    except BoardError:
        check('--keep: a day the board does not hold as made is refused', True)
    # The finished videos: each cut's Drive file to download, open and copy; one not in Drive yet says so.
    vids = [{'cut': 'long', 'name': 'x - wide.mp4', 'seconds': 168, 'url': 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view'},
            {'cut': 'short', 'name': 'x - tall.mp4', 'seconds': 87}]
    card = videos_card('wed', 'wed-', vids)
    check('finished videos: Download and Open in Drive for a cut in Drive, its link to copy, and the other says it is not in Drive yet',
          'https://drive.usercontent.google.com/download?id=1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg&amp;export=download' in card
          and 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view' in card and 'data-act="text"' in card
          and 'Not in Drive yet' in card and '2 min 48 s' in card and videos_card('wed', 'wed-', []) == '')
    tv = [{'cut': 'long', 'url': 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view',
           'thumbnail': {'path': '3 Posts/x/3 Video/x - wide.jpg', 'url': 'https://drive.google.com/file/d/1dK3QdzIkQi-SO1JsR9_SR2LdYoxGZnSQ/view'}},
          {'cut': 'short', 'url': 'https://drive.google.com/file/d/12BfoG1GQ_wQQFMi1h9NLZyo72g4uEcgQ/view', 'thumbnail': {'path': '3 Posts/x/3 Video/x - tall.jpg'}}]
    tcard = videos_card('wed', 'wed-', tv)
    dropped_panel = ('<label class="tick row-tick"><input type="checkbox" data-tick="mon-whatsapp" aria-label="WhatsApp"><span>W</span></label>'
                     '<a href="#mon-s7">WhatsApp</a><section id="mon-s7"><div class="sec-head"><h2>7. WhatsApp</h2></div><p>x</p></section>'
                     '<section id="mon-s6"><div class="sec-head"><h2>6. LinkedIn</h2></div></section>')
    check('a kept day loses the channels Krish dropped, and keeps the rest',
          'whatsapp' not in drop_channels(dropped_panel, 'mon').lower() and '6. LinkedIn' in drop_channels(dropped_panel, 'mon'))
    card = review_card('fri', [('article', 'Article', 'One <b>two</b> three.'), ('deep-cut', 'Deep cut', 'Four five.')])
    check('each review block carries the time the board was built, so an older save never covers new words',
          review_card('fri', [('article', 'Article', 'x')], '2026-10-15T16:00:00Z').count('data-built-at="2026-10-15T16:00:00Z"') == 1)
    check('the review card holds each block as editable text, escaped, with Save and Comment',
          card.count('<textarea') == 2 and '&lt;b&gt;two&lt;/b&gt;' in card and card.count('data-act="save-review"') == 2
          and card.count('data-act="comment-review"') == 2 and 'data-review-id="fri-article"' in card)
    panel = '<div class="pm" id="panel-friday"><div class="rec">x</div></div>'
    once = with_review(panel, card)
    check('the review card goes first in the tab, and a rebuild replaces it rather than stacking a second',
          once.startswith('<div class="pm" id="panel-friday">' + REVIEW_START) and with_review(once, card).count(REVIEW_START) == 1
          and REVIEW_START not in with_review(once, ''))
    js = template('week.js')
    check('the page never shows a save older than the build over the new words',
          'v.at < built' in js and 'b.dataset.builtAt' in js)
    check('the page saves each review block to edits/<day>-<item> and opens the comment box on it',
          'rdb.doc("edits/" + id).set(' in js and 'comments.openComposer({ element:' in js and 'window.claude.use("comments")' in js)
    check('a board with Today opens on it: the tab a viewer last opened is remembered only on boards without Today',
          'if (!fromHash() && !tabs.some(t => t.dataset.day === "today")) { const r = remembered();' in js)
    check('a kept day drawn before section ticks (no sec-head) loses the dropped channels too',
          'notes' not in drop_channels('<section id="wed-s8"><h2>8. Substack Notes</h2><p>x</p></section>', 'wed').lower())
    check('finished videos: each cut offers its thumbnail, and one not linked yet says where it is',
          'download?id=1dK3QdzIkQi-SO1JsR9_SR2LdYoxGZnSQ' in tcard and 'Download thumbnail' in tcard and 'x - tall.jpg' in tcard)
    _draft_checks(check, page, fri)
    _ideas_checks(check)
    _fixed_checks(check, mon)
    _v3_checks(check, mon)
    _sources_checks(check)
    _style_cover_checks(check)
    delivery = {'piece_id': MON_ID, 'status': 'review', 'note': 'Fact review is still open.', 'sections': [
        {'id': 'spotify', 'title': 'Spotify', 'files': [{'label': 'Video', 'url': 'https://example.com/video.mp4'}],
         'copy': [{'label': 'Description', 'text': 'Quoted "words" & <safe text>'}]}]}
    held, held_manifest, _ = board(date(2026, 10, 19), pieces={'mon': MON_ID}, draft={'mon'},
        review={'mon': [('article', 'Article', 'Words in review')]}, materials={'mon': delivery})
    check('finished materials never mark a draft piece made or remove its review hold',
          held_manifest['days'][0]['state'] == 'draft' and board_days(held)['days']['mon']['state'] == 'draft' and 'Fact review is still open.' in held and
          'id="rvs-mon-article"' in held and 'data-prefix="mon-"' in held and verify(held) == [])
    check('material metadata round trips escaped wording and stable anchors',
          board_materials.previous(held) == {'mon': delivery} and 'id="mon-materials-spotify-copy-0"' in held)
    for bad, label in [(dict(delivery, piece_id=FRI_ID), 'another piece'),
                       (dict(delivery, sections=[{'id':'x','title':'X','files':[{'label':'bad','url':'javascript:alert(1)'}]}]), 'unsafe URL')]:
        try:
            board_materials.validate(bad, MON_ID)
            rejected = False
        except ValueError:
            rejected = True
        check('publishing materials refuse ' + label, rejected)
    if fails:
        print('week board self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'week board self-test passed: {len(checks)} checks')
    return 0


def _v3_checks(check, mon):
    """Layout v3 (W2.1): from the week of 9 November the board adds the Archive, a Scores press on each made day and the
    recording_sunday rhythm; earlier weeks keep version 2."""
    week = V3_FROM
    rows = read_archive({'rows': [
        {'piece_id': MON_ID, 'date': '2026-10-12', 'series': 'follow_the_money', 'title': 'Warner sued Suno',
         'links': [{'label': 'Substack', 'url': 'https://example.com/p/one'}], 'scores': {'hindsight': {'narrative': 8, 'production': 6}}},
        {'piece_id': None, 'date': '2026-10-06', 'series': None, 'title': 'The Launch', 'links': [], 'scores': {}}]})
    page, manifest, _ = board(week, {'mon': mon}, {'mon': MON_ID}, archive=rows)
    check('v3: a fed week with the Archive passes verify', verify(page) == [])
    check('v3: the tabs, Today first from today.from, the Archive last',
          re.findall(r'role="tab" id="tab-([a-z]+)"', page) == [TODAY_TAB] * (week >= TODAY_FROM) + list(TOP_TABS) + [ARCHIVE_TAB])
    if week >= TODAY_FROM:
        gated, _, _ = board(week, {'mon': mon}, {'mon': MON_ID}, archive=rows, gates={'mon': 'https://example.com/board#friday'})
        gp = gated[gated.find('id="panel-today"'):]
        check('layout A: a Gate 2 cut is one ask and the day card\'s button, both opening the cut',
              gp.count('href="https://example.com/board#friday">Watch cut</a>') == 2 and 'Gate 2, Mon ' in gp)
        panel = page[page.find('id="panel-today"'):]
        check('layout A: the board opens on Today, a made Monday asks for its publish approval and links to that step',
              'aria-selected="true" tabindex="0" data-day="today"' in page and 'href="#monday/publish">Approve</a>' in panel
              and 'data-today="1"' in page)
        broken = page.replace('href="#monday/publish">Approve</a></li>', 'href="#monday/publish">Approve this now please</a></li>', 1)
        check('layout A: verify refuses a Today button label longer than its button holds',
              any('Today button label' in p for p in fixed_problems(broken)))
        # The week's mix ask once broke every v3 build that had off-day options: its detail ran past DETAIL_MAX.
        mixed = today_model(week, {}, {}, {}, {'tue': [{'id': 'a', 'format': 'Carousel', 'copy': 'x'}]}, {})
        check('layout A: the week\'s mix ask fits its row', all(len(a['detail']) <= board_today.DETAIL_MAX for a in mixed['asks']))
    check('v3: the board and its manifest say layout 3', 'data-layout="3"' in page and manifest.get('layout') == 3)
    check('v3: the Archive lists the newest piece first, with its scores and its Scores press, and none on a row with no piece',
          page.find('Warner sued Suno') < page.find('The Launch') and 'Narrative 8/10, production 6/10, looking back' in page
          and page.count(f'data-scores-piece="{MON_ID}"') == 2 and 'Scores open once this piece is on the record' in page)
    check('v3: a made day carries his Scores press on its Publish step, at publish by default',
          re.search(r'id="mon-scores"[^>]*data-scores-piece="' + MON_ID + r'" data-scores-basis="at_publish"', page) is not None)
    at = page.rfind(f'data-scores-piece="{MON_ID}"')  # the Archive row's, after the day tabs
    stripped = page[:at] + 'data-x=""' + page[at + len(f'data-scores-piece="{MON_ID}"'):]
    check('v3: verify refuses an Archive row without its Scores press', any('without its Scores press' in x for x in verify(stripped)))
    empty, _, _ = board(week)
    check('v3: the brief and drafts are due on the recording Sunday, W-8 (Monday 9 Nov: Sun 1 Nov)',
          'Sun 1 Nov' in empty and verify(empty) == [])
    try:
        board(LAYOUT_FROM, archive=rows)
        check('v3: an Archive on a version 2 week is refused', False)
    except BoardError:
        check('v3: an Archive on a version 2 week is refused', True)
    old, _, _ = board(LAYOUT_FROM)
    check('v3: a week before v3 keeps version 2, five tabs and no Archive',
          'data-layout="2"' in old and 'id="tab-archive"' not in old and 'Sun 25 Oct' in old)
    try:
        read_archive({'rows': [{'piece_id': 'nope', 'date': '2026-10-12', 'title': 'X', 'scores': {'hindsight': {'narrative': 11, 'production': 1}}}]})
        check('v3: read_archive refuses a bad piece id and a score over 10', False)
    except BoardError as error:
        check('v3: read_archive refuses a bad piece id and a score over 10', 'piece_id' in str(error) and '1 to 10' in str(error))
    use_layout(LAYOUT_FROM)


def _fixed_checks(check, mon):
    """The fixed layout (config/board-layout.json): the same tabs and steps every week, and verify() refusing any other."""
    global FEATURES_FILE
    week = LAYOUT_FROM
    brief = {'idea': 'One idea', 'flow': ['A', 'B', 'C'], 'ending': 'E', 'takeaway': 'T', 'angle': 'A', 'tone': 'Warm', 'agreed': True}
    review = {'wed': [('article', 'Article draft', 'Words in review.'), ('long', 'Five-minute script', 'Said words.')]}
    page, manifest, _ = board(week, {'mon': mon}, {'mon': MON_ID, 'wed': WED_ID, 'fri': FRI_ID}, review=review, draft={'wed'},
                              calls={'wed': ['Pick the closing line']}, queue=[{'id': FRI_ID, 'so_what': 'Saved', 'series': 'mind_the_gap',
                                                                                'triage': {'verdict': 'angle', 'angle': 'who pays'}}],
                              briefs={'wed': read_brief(brief), 'fri': read_brief(dict(brief, agreed=False))})
    check('fixed layout: a fed week passes verify', verify(page) == [])
    check('fixed layout: the five tabs, always in one order',
          re.findall(r'role="tab" id="tab-([a-z]+)"', page) == list(TOP_TABS))
    for name in ('monday', 'wednesday', 'friday'):
        check(f'fixed layout: {name} has Brief, Drafts, Record and Publish, in that order',
              re.findall(rf'id="{name[:3]}-sub-([a-z]+)"', page) == list(DAY_STEPS))
    check('fixed layout: the step that opens first is where the day is (made: Publish, in review: Drafts, picked: Brief)',
          'id="mon-sub-publish" aria-labelledby="mon-st-publish" data-sub="publish" tabindex="-1">' in page
          and 'id="wed-sub-drafts" aria-labelledby="wed-st-drafts" data-sub="drafts" tabindex="-1">' in page
          and 'id="fri-sub-brief" aria-labelledby="fri-st-brief" data-sub="brief" tabindex="-1">' in page)
    check('fixed layout: the scripts are said once, under Record, not again under Publish',
          'id="mon-scripts"' not in page and 'class="rec-scripts"' in page)
    check('fixed layout: the long cut is the 5-minute video everywhere, never the 3-minute one, in the board\'s own words',
          'Record the 5-minute cut (Teleprompter)' in page and 'YouTube: the 5-minute video' in page
          and 'Record the 3-minute cut' not in page and 'YouTube: the 3-minute video' not in page)
    check('fixed layout: the brief is shown with its beats, and agreed or waiting for his yes',
          'class="card brief" id="wed-brief-card"' in page and '<ol class="br-flow"><li>A</li>' in page and 'Waiting for your yes' in page)
    check('fixed layout: what waits on him sits in the day\'s heading, above the steps',
          page.index('Pick the closing line') < page.index('id="wed-st-brief"'))
    check('fixed layout: the Queue tab lists his saved idea with his verdict and angle',
          'id="panel-queue"' in page and 'Saved' in page and '<span class="chip">Angle</span> who pays' in page)
    check('fixed layout: a brief rides in the page, so a rebuild from it keeps the brief', previous_briefs(page).get('wed', {}).get('idea') == 'One idea')
    check('fixed layout: the manifest says the layout and carries the briefs', manifest.get('layout') == VERSION == 2 and 'fri' in manifest['briefs'])
    empty, _, _ = board(week)
    check('fixed layout: an empty week still has every tab and step, each saying when it fills', verify(empty) == []
          and 'data-state="ideas-waiting"' in empty and empty.count('class="slot-empty"') >= 12)
    # Tampering: what a session might do to a built board, each refused by verify().
    head_end = page.index('</div>', page.index('<div class="day-head">', page.index('id="panel-monday"'))) + len('</div>')
    banner = page[:head_end] + '<div class="stage">Hand-made banner</div>' + page[head_end:]
    check('fixed layout: a banner laid into a day is refused', any('banner' in x or 'holds' in x for x in verify(banner)))
    swapped = page.replace('data-sub="brief"', 'data-sub="tmp"').replace('data-sub="record"', 'data-sub="brief"').replace('data-sub="tmp"', 'data-sub="record"')
    check('fixed layout: steps in another order are refused', any('steps are' in x for x in verify(swapped)))
    styled = page.replace('</style>', '</style><style>.x{}</style>', 1)
    check('fixed layout: a second stylesheet is refused', any('stylesheets' in x for x in verify(styled)))
    legacy = made_panel(parse_day_page(mon, 'mon'), 'mon', 'monday', 'mon-', {}, False, [])
    try:
        board(week, kept={'mon': legacy}, pieces={'mon': MON_ID})
        refused = False
    except BoardError as error:
        refused = 'old layout' in str(error)
    check('fixed layout: keeping a tab from the old layout is refused', refused)
    for bad, label in [(dict(brief, flow=['only one']), 'a flow of one beat'), (dict(brief, title='A title'), 'a title'),
                       ({k: v for k, v in brief.items() if k != 'takeaway'}, 'no takeaway'), (dict(brief, colour='red'), 'a field with no place')]:
        try:
            read_brief(bad)
            refused = False
        except BoardError:
            refused = True
        check(f'fixed layout: a brief with {label} is refused', refused)
    try:
        board(date(2026, 10, 19), briefs={'mon': read_brief(brief)})
        refused = False
    except BoardError:
        refused = True
    check('fixed layout: a brief for a week in the old layout is refused, not dropped', refused)
    with tempfile.TemporaryDirectory() as tmp:
        saved, FEATURES_FILE = FEATURES_FILE, Path(tmp) / 'features.json'
        try:
            FEATURES_FILE.write_text(json.dumps({'pieces': {MON_ID: {'called_on': '2026-10-25'}}}), encoding='utf-8')
            feat, _, _ = board(week, {'mon': mon}, {'mon': MON_ID})
        finally:
            FEATURES_FILE = saved
    check('fixed layout: a feature piece gets its 15-minute feature tick and a third cut; other pieces do not',
          'data-tick="mon-record-feature"' in feat and 'Three cuts' in feat and 'data-tick="mon-record-feature"' not in page)
    check('fixed layout: a rebuild from the page finds the day in review, its boxes and what waits on him',
          previous_draft(page, 'wed') == (['wed-article', 'wed-long'], ['Pick the closing line']))
    kept_mon = kept_panel(page, 'mon')
    again, _, _ = board(week, kept={'mon': kept_mon}, pieces={'mon': MON_ID})
    check('fixed layout: a made day can be kept from the page, as it stands, and still passes verify',
          kept_mon.startswith('<div class="pm fixed" id="panel-monday"') and verify(again) == [])
    later = week + timedelta(days=7)
    state, moved_mon = carried_panel(page, 'mon', 'fri', later + timedelta(days=4))
    carried, _, _ = board(later, kept={'fri': moved_mon}, pieces={'fri': MON_ID})
    check('a made day carried to another week and day: its ids and ticks move, its head names the new day, verify passes',
          state == 'made' and 'id="panel-friday"' in moved_mon and 'data-prefix="fri-"' in moved_mon
          and not re.search(r'="[^"]*(?<![a-z])mon-[^"]*"', moved_mon) and 'mind.the.gap · Fri ' in moved_mon and verify(carried) == [])
    dstate, moved_wed = carried_panel(page, 'wed', 'mon', later)
    check('a day in review carried to another day keeps its boxes under the new day',
          dstate == 'draft' and 'id="rv-mon-article"' in moved_wed and 'rv-wed-' not in moved_wed)
    stale = {'wed': dict(read_brief(brief), piece_id=FRI_ID)}
    moved, _, moved_warnings = board(week, pieces={'wed': WED_ID}, briefs=stale)
    check('fixed layout: a brief carried from the old board for another piece never shows under the new pick',
          'id="wed-brief-card"' not in moved and any('dropped' in w for w in moved_warnings))
    _editor_checks(check, week)
    _runsheet_checks(check, week, mon)
    _presses_checks(check, week, mon)
    use_layout(date(2026, 10, 12))
    check('the old layout comes back for an old week: its labels as they were published',
          LABEL['record-long'] == 'Record the 3-minute cut (Teleprompter)' and 'record-feature' not in LABEL)


def _growth_offday_checks(check, week, ideas):
    """W2.9: Growth's Sunday Off-days section (growth-offdays/1) on the Ideas tab, every day under "Mix wins: every
    day", 2 to 3 options a day, each with one Approve or Skip bound to Growth's draft copy."""
    o = lambda n, **kw: dict({'concept_id': f'meme-c{n}', 'lane': 'meme', 'formats': ['instagram:meme', 'tiktok:meme'],
                              'source_url': 'https://example.com/cue', 'draft': f'Synthetic meme draft {n}.', 'share_line': 'Send this to your CFO.',
                              'needs': [], 'ready': True}, **kw)
    plan = {'schema': 'growth-offdays/1', 'week_of': week.isoformat(), 'short': [],
            'days': {(week + timedelta(days=0)).isoformat(): [o(1), o(2)], (week + timedelta(days=1)).isoformat(): [o(3), o(4), o(5, ready=False)],
                     (week + timedelta(days=3)).isoformat(): [o(6)]}}
    mixed, warnings = read_growth_offdays(plan, week)
    offdays = read_offdays(mixed, 'growth')
    page, _, _ = board(week, ideas=ideas, offdays=offdays)
    check('growth offdays: a day with two or three options shows, Monday too ("Mix wins: every day"), and a short day is said',
          set(offdays) == {'mon', 'tue'} and 'id="offdays-mon"' in page and any('under the two' in w for w in warnings))
    check('growth offdays: the week\'s mix is one Approve, bound to its hash; no option has a press of its own (Ruling, Krish, 2026-10-30)',
          'data-offday="off-mon-meme-c1"' in page and page.count('data-act="offday" data-value') == 0 and page.count('data-act="mix" aria-pressed') == 1
          and f'data-mix-sha256="{week_mix(offdays)[1]}"' in page
          and offdays['mon'][0]['copy_sha256'] == hashlib.sha256(b'Synthetic meme draft 1.').hexdigest())
    check('growth offdays: the share line, the formats and what an option still needs are shown',
          'Send this to your CFO.' in page and 'instagram:meme, tiktok:meme' in page and 'Still needs: not ready yet' in page)
    check('growth offdays: the board passes verify', verify(page) == [])
    for bad, why in ((dict(plan, week_of='2026-01-05'), 'another week'), (dict(plan, schema='x'), 'another schema'),
                     (dict(plan, days={'2026-01-01': [o(1), o(2)]}), 'a day outside the week')):
        try:
            read_growth_offdays(bad, week)
            check(f'growth offdays: {why} is refused', False)
        except BoardError:
            pass
    try:
        read_offdays({'mon': [{'id': 'r', 'format': 'short', 'source': 's', 'copy': 'c', 'kind': 'recorded'}, {'id': 'q', 'format': 'f', 'source': 's', 'copy': 'c'}]})
        check('growth offdays: a recorded piece on a series day is refused', False)
    except BoardError as error:
        check('growth offdays: a recorded piece on a series day is refused', 'Tuesday, Thursday, Saturday or Sunday piece' in str(error))


def _presses_checks(check, week, mon):
    """Krish's presses in the fixed layout (Krish, 2026-10-28): the five on an idea, the off days, Approve scripts,
    Titles, Approve for publish and Reject asset. Each is drawn from data, disabled until the store answers, and saved
    only by his press (api/board/_contracts.ts); verify() refuses an idea card without them."""
    use_layout(week)
    _div = lambda page, marker: div_at(page, page.find(marker)) if marker in page else ''  # '' when it is not drawn at all
    one = lambda k, n: {'so_what': f'A leader finds out {k}{n}.', 'story': f'Story {k}{n}.', 'why_now': 'This week.', 'fact': 'A fact.',
                        'source': {'label': 'Src', 'url': f'https://example.com/{k}{n}'}, 'source_kind': 'engine',
                        'id': MON_ID if (k, n) == ('mon', 1) else None}
    ideas = read_ideas({'week_start': week.isoformat(), 'days': {k: [one(k, n) for n in range(1, 5)] for k, *_ in DAYS}}, week)
    opt = lambda n, **kw: dict({'id': f'o{n}', 'format': 'meme', 'source': 'A cue from your inspo folder', 'copy': f'Option {n} copy.'}, **kw)
    offdays = read_offdays({'tue': [opt(1), opt(2, source={'label': 'The release note', 'url': 'https://example.com/r'})], 'sat': [opt(1), opt(2), opt(3)]})
    page, manifest, _ = board(week, ideas=ideas, offdays=offdays)
    _growth_offday_checks(check, week, ideas)
    use_layout(week)
    nxt = (week + timedelta(days=7)).isoformat()
    check('presses: every idea has a pick note and Wider piece, Future trend, Next week and Reject, never the old triage',
          page.count('data-pick-note="') == 12 and all(page.count(f'data-press="{u}"') == 12 for u, _ in PRESSES)
          and 'data-triage=' not in page and 'data-queue-mark=' not in page and page.count(f'data-target-week="{nxt}"') == 12)
    check('presses: a fed Ideas tab passes verify', verify(page) == [])
    check('presses: verify refuses an idea card without its presses',
          any('Friday has 3 checked' in w for w in verify(page.replace('data-press="not_for_us" data-for="fri-4"', 'data-x="not_for_us" data-for="fri-4"', 1))))
    check('presses: the off days show each option with its format, source and copy, bound to the copy\'s hash',
          'id="off-tue-o1"' in page and 'id="off-sat-o3"' in page and page.count('data-act="mix" aria-pressed') == 1
          and f'data-copy-sha256="{hashlib.sha256(b"Option 1 copy.").hexdigest()}"' in page and '>The release note</a>' in page
          and 'No options for Thursday yet.' in page and 'No options for Sunday yet.' in page)
    check('presses: with no off-day options the section says so in one plain line, also before the ideas come',
          'No options for Tuesday, Thursday, Saturday or Sunday yet.' in board(week, ideas=ideas)[0]
          and 'No options for Tuesday, Thursday, Saturday or Sunday yet.' in board(week)[0])
    for bad, want in (({'tue': [opt(1)]}, '2 to 3 options'), ({'tue': [opt(1), opt(2, copy='')]}, 'no copy'),
                      ({'xyz': [opt(1), opt(2)]}, 'is not a day'), ({'tue': [opt(1), opt(1)]}, 'once a day'),
                      ({'tue': [opt(1), opt(2, source={'label': 'x', 'url': 'http://x'})]}, 'https')):
        try:
            read_offdays(bad)
            check(f'presses: off days refuse {want}', False)
        except BoardError as error:
            check(f'presses: off days refuse {want}', want in str(error))
    # An off-day piece he records (Ruling, Krish, 2026-10-29): the exact words on the card, bound to their hash.
    said = ("Why does your team still copy the same numbers into three tools every Monday? "
            + "I watched a small shop do this last week. They spent four hours moving data by hand. Then one person set up a simple agent. "
              "It read the sales sheet, wrote the summary and sent it to the boss. The trick was picking one boring job first. " * 3
            + "If I ran that shop, I'd do one thing. I'd hand the agent just the one task we repeat every week.")
    rec = lambda **kw: opt(9, **dict({'kind': 'recorded', 'format': 'Said to camera', 'style': 'to_camera', 'series': 'under_the_hood',
                                      'piece_id': MON_ID, 'title': 'One boring job first', 'script': said, 'covers': [MON_ID],
                                      'read_back': {'readers': ['Reader A', 'Reader B'], 'found': 'nothing lost'}}, **kw))
    rec_days = read_offdays({'thu': [opt(1), rec()]})
    rec_page, rec_manifest, _ = board(week, ideas=ideas, offdays=rec_days)
    card = rec_page[rec_page.find('id="off-thu-o9"'):]
    card = card[:card.find('</article>')]
    check('recorded off day: the card holds the exact words, their hash, the piece, its series and style, and its Teleprompter names',
          'data-kind="recorded"' in card and f'data-piece="{MON_ID}"' in card and 'data-series="under_the_hood"' in card
          and f'data-script-sha256="{rec_days["thu"][1]["script_sha256"]}"' in card and 'data-offscript="off-thu-o9"' in card
          and 'Why does your team still copy' in card and 'data-tp-title="' in card and 'data-folder-title="' in card
          and 'data-readers="Reader A|Reader B"' in card and 'Approve puts this piece on Thursday' in card and f'data-covers="{MON_ID}"' in card)
    check('recorded off day: its hash is the words as Teleprompter shows them', rec_days['thu'][1]['script_sha256']
          == __import__('making').script_hash(__import__('teleprompter_send').spoken_text(said)))
    check('recorded off day: a rebuild keeps it, words and all', read_offdays({k: [previous_option(o) for o in v] for k, v in previous_conf(rec_page, 'offdays').items()}) == rec_days)
    check('recorded off day: the manifest names what its press carries', 'script' in rec_manifest['db']['queue']['offday']['recorded_fields'])
    for bad, want in ((rec(style='dance'), 'style is one of'), (rec(piece_id='x'), 'piece_id'), (rec(series='other'), 'series is one of'),
                      (rec(script='Too short.'), 'words (it has'), (rec(read_back={'readers': ['Only one'], 'found': 'nothing lost'}), 'read_back'),
                      (rec(script=said.replace('I watched', 'NOT YET FACT-CHECKED I watched', 1)), 'script:'),
                      (rec(read_back={'readers': ['A', 'B'], 'found': 'nothing lost', 'script_sha256': 'f' * 64}), 'changed after'),
                      (rec(kind='video'), 'kind is "recorded"')):
        try:
            read_offdays({'thu': [opt(1), bad]})
            check(f'recorded off day: refuses {want}', False)
        except BoardError as error:
            check(f'recorded off day: refuses {want}', want in str(error))
    check('cover: an off-day option covers an idea he dropped in', coverage_problems({'days': {}, 'offdays': {'thu': [{'covers': ['his-1']}]}},
          {'must_cover': [{'id': 'his-1', 'what': 'Your idea "x"'}]}) == [])
    check('presses: the off days ride in the page, so a rebuild keeps them', previous_conf(page, 'offdays') == offdays
          and manifest['offdays'] == offdays and 'decisions' in manifest['db']['picks'] and 'presses' in manifest['db']['queue'])
    # Approve scripts under a day's drafts, with the names its scripts take in Teleprompter.
    review = {'wed': [('article', 'Article draft', 'Words.'), ('five-minute-script', 'Five-minute script', 'Said long.'),
                      ('90-second-script', '90-second script', 'Said short.')]}
    drafted, _, _ = board(week, pieces={'wed': WED_ID}, review=review, draft={'wed'}, pending={'wed': 'Why so many AIs'})
    card = _div(drafted, '<div class="rec ap" id="wed-approve"')
    check('presses: Approve scripts sits under the day\'s drafts and carries each script\'s draft and Teleprompter title',
          drafted.find('id="wed-approve"') > drafted.find('id="wed-review"') and f'data-piece="{WED_ID}"' in card
          and 'data-box-long="wed-five-minute-script"' in card and 'data-box-short="wed-90-second-script"' in card
          and 'data-title-long="Wed 28 Oct - 5-minute - Why so many AIs"' in card and 'data-cuts="long short"' in card
          and 'data-folder-title="Wed 28 Oct under.the.hood - Why so many AIs"' in card and verify(drafted) == [])
    held = {'folder_name': 'Wed 28 Oct under.the.hood - Held', 'folder_id': 'A' * 8 + '-AAAA-4AAA-8AAA-' + 'A' * 12,
            'cuts': {'long': {'title': 'Wed 28 Oct - 5-minute - Held', 'script_id': 'B' * 8 + '-BBBB-4BBB-8BBB-' + 'B' * 12, 'state': 'in'}}}
    kept_names, _, _ = board(week, pieces={'wed': WED_ID}, review=review, draft={'wed'}, pending={'wed': 'Why'}, teleprompter={'wed': held})
    check('presses: a script already in Teleprompter keeps its folder, title and id, so it is updated in place',
          'data-folder-title="Wed 28 Oct under.the.hood - Held"' in kept_names and f'data-folder-id="{held["folder_id"]}"' in kept_names
          and f'data-script-id-long="{held["cuts"]["long"]["script_id"]}"' in kept_names and 'data-title-long="Wed 28 Oct - 5-minute - Held"' in kept_names)
    article_only, _, _ = board(week, pieces={'wed': WED_ID}, review={'wed': [('article', 'Article draft', 'Words.')]}, draft={'wed'})
    twice, _, warned = board(week, pieces={'wed': WED_ID}, review={'wed': review['wed'] + [('long-2', 'Long script v2', 'x')]}, draft={'wed'})
    check('presses: no Approve scripts without a script, and none while two drafts claim one cut', 'id="wed-approve"' not in article_only
          and 'id="wed-approve"' not in twice and any('two drafts read as the long script' in w for w in warned))
    # Titles on the Record step: the options, or one plain line until they come.
    titles = {'wed': read_titles({'piece_id': WED_ID, 'long_title': ['Why so many AIs', 'Too many AIs?'], 'short_thumbnail': [{'text': 'TOO MANY'}]})}
    with_titles, man2, _ = board(week, pieces={'wed': WED_ID}, review=review, draft={'wed'}, pending={'wed': 'Why'}, titles=titles)
    tcard = _div(with_titles, '<div class="rec tt" id="wed-titles"')
    check('presses: Titles on the Record step offers each surface\'s options and one Save',
          with_titles.find('id="wed-titles"') > with_titles.find('id="wed-sub-record"') and tcard.count('data-title-surface="long_title"') == 2
          and '<legend>5-minute video title</legend>' in tcard and '<legend>90-second video thumbnail</legend>' in tcard
          and 'data-act="save-titles" data-day="wed"' in tcard and man2['titles']['wed']['surfaces']['short_thumbnail'] == ['TOO MANY']
          and previous_conf(with_titles, 'titles')['wed']['piece_id'] == WED_ID)
    check('presses: before the options come, Titles says so plainly; a day not picked has no Titles',
          'The title options are not here yet.' in _div(drafted, '<div class="rec tt" id="wed-titles"')
          and 'id="fri-titles"' not in drafted)
    try:
        board(week, pieces={'wed': FRI_ID}, review=review, draft={'wed'}, titles=titles)
        refused = False
    except BoardError as error:
        refused = 'options are for piece' in str(error)
    check('presses: title options for another piece are refused', refused)
    for bad, want in (({'headline': ['x']}, 'not a surface'), ({'long_title': []}, '1 to 5'), ({'long_title': ['a', 'a']}, '1 to 5'), ({}, 'no surface')):
        try:
            read_titles(bad)
            check(f'presses: titles refuse {want}', False)
        except BoardError as error:
            check(f'presses: titles refuse {want}', want in str(error))
    # Approve for publish and Reject asset on a made day's Publish step.
    vids = [{'cut': c, 'seconds': 90, 'url': f'https://drive.google.com/file/d/1{c}VideoAAAAAAAAAAAAAAAAAAAAAAAA/view',
             'thumbnail': {'url': f'https://drive.google.com/file/d/1{c}ThumbAAAAAAAAAAAAAAAAAAAAAAAA/view'}} for c in ('long', 'short')]
    made, _, _ = board(week, {'mon': mon}, {'mon': MON_ID}, videos={'mon': vids}, manifests={'mon': 'd' * 64})
    sub = _div(made, '<div class="subpanel" role="tabpanel" id="mon-sub-publish"')
    check('presses: Approve for publish comes after Download first and before the places to post, with the piece and its manifest',
          sub.find('id="mon-download"') < sub.find('id="mon-signoff"') < sub.find('class="run-h"') and f'data-piece="{MON_ID}"' in sub
          and f'data-manifest-sha256="{"d" * 64}"' in sub and verify(made) == [])
    check('presses: every file ready in Download first has Reject, a reason box, and its Drive id and formats',
          'data-asset="video-short" data-asset-label="90-second video (tall, 9:16)" data-formats="short_video" data-drive-id="1shortVideoAAAAAAAAAAAAAAAAAAAAAAAA"' in sub
          and 'data-asset="thumb-long"' in sub and 'data-formats="thumbnail"' in sub
          and sub.count('data-act="reject-asset"') == sub.count('data-state="ready"') and sub.count('data-reject-at') == 2)
    bare = board(week, {'mon': mon}, {'mon': MON_ID})[0]
    no_vids = _div(bare, '<div class="subpanel" role="tabpanel" id="mon-sub-publish"')
    check('presses: a file not made yet has nothing to reject', 'data-dl="video-long" data-state="waiting">' in no_vids
          and 'data-asset="video-long"' not in no_vids and 'data-asset="img-cover"' in no_vids)
    check('presses: the subject for Teleprompter is one short line', subject_line('A long engine line that is never a title. ' * 4)
          == 'A long engine line that is never a title. A long engine line' and subject_line('') == '')
    js = template('week.js')
    check('presses: the page saves each press in its store, and only his presses',
          'qdb.doc("queue/" + id).set(body)' in js and 'ddb.doc("picks/" + id).set(body)' in js and 'kind: "approve_scripts"' in js
          and 'kind: "reject_asset"' in js and 'kind: "approve_publish"' in js and 'kind: "titles"' in js and 'use: "offday"' in js
          and 'pdb.doc("picks/" + day).set(body)' in js)


def _runsheet_checks(check, week, mon):
    """The Publish step's run-sheet (Krish, 2026-10-21: "where I publish, how I publish, what I need to download, when,
    and in what order"): Download first, then a card per place to post in the layout's order, each with its own tick."""
    global FEATURES_FILE
    drive = lambda c: f'https://drive.google.com/file/d/{c * 25}/view'
    videos = {'mon': [{'cut': 'long', 'url': drive('a'), 'seconds': 305, 'path': '3 Posts/2026-10-26 Mon follow.the.money - Suno/3 Video/l.mp4',
                       'thumbnail': {'url': drive('b')}},
                      {'cut': 'short', 'url': drive('c'), 'seconds': 86, 'thumbnail': {'url': drive('d')}}]}
    mats = {'mon': {'piece_id': MON_ID, 'status': 'review', 'note': 'Held for one fact.',
                    'sections': [{'id': 'captions', 'title': 'Captions', 'files': [{'label': 'Download the captions', 'url': 'https://example.com/c.srt'}],
                                  'copy': [{'label': 'Chapters', 'text': '0:00 Start'}]}],
                    'copy_updates': {'mon-c3': 'A refreshed YouTube title'}}}
    page, _, _ = board(week, {'mon': mon}, {'mon': MON_ID}, videos=videos, materials=mats)
    use_layout(week)
    sub = div_at(page, page.find('<div class="subpanel" role="tabpanel" id="mon-sub-publish"'))
    check('run-sheet: a made day with its videos passes verify', verify(page) == [])
    order = re.findall(r'<li class="dl-item" id="mon-dl-([^"]+)"', sub)
    check('run-sheet: Download first holds every file in the order he uses them (videos, thumbnails, the Substack cover, '
          'the article, its pictures, then the prepared files)',
          order[:7] == ['video-long', 'video-short', 'thumb-long', 'thumb-short', 'img-cover', 'article', 'img-pic']
          and 'data-dl="material"' in sub[sub.index('id="mon-dl-img-pic"'):])
    # A finished cut not on the record yet fills its own row from the materials; the record wins where it holds the cut.
    filling = {'mon': {'piece_id': MON_ID, 'status': 'ready', 'note': 'The finished cuts.',
                       'sections': [{'id': 'video', 'title': 'Finished videos', 'files': [
                           {'label': 'Download the 5-minute video', 'url': '/api/board/2026-10-26/assets/l?sha=' + 'a' * 64, 'fills': 'video-long'},
                           {'label': 'Download its thumbnail', 'url': '/api/board/2026-10-26/assets/t?sha=' + 'b' * 64, 'fills': 'thumb-long'},
                           {'label': 'Download the 90-second video', 'url': 'https://example.com/s.mp4', 'fills': 'video-short'}]}]}}
    filled, _, _ = board(week, {'mon': mon}, {'mon': MON_ID}, videos={'mon': videos['mon'][1:]}, materials=filling)
    use_layout(week)
    fsub = re.sub(r'\sdata-materials="[^"]*"', '', div_at(filled, filled.find('<div class="subpanel" role="tabpanel" id="mon-sub-publish"')))
    row = lambda r: (re.search(r'<li class="dl-item" id="mon-dl-%s".*?</li>' % r, fsub, re.S) or [''])[0]
    check('run-sheet: a cut the record lacks downloads from its own row, from the materials that fill it, and is not listed twice',
          verify(filled) == [] and '/api/board/2026-10-26/assets/l?sha=' in row('video-long') and 'data-state="ready"' in row('video-long')
          and '/assets/t?sha=' in row('thumb-long') and fsub.count('/api/board/2026-10-26/assets/l?sha=') == 1
          and 'example.com/s.mp4' not in row('video-short') and drive('c') in row('video-short')
          and fsub.count('example.com/s.mp4') == 1 and 'Not made yet' not in fsub
          and board_materials.previous(filled) == filling)
    try:
        board_materials.validate({**filling['mon'], 'sections': [{'id': 'v', 'title': 'V', 'files': [
            {'label': 'a', 'url': 'https://example.com/a', 'fills': 'video-long'},
            {'label': 'b', 'url': 'https://example.com/b', 'fills': 'video-long'}]}]}, MON_ID)
        check('materials refuse two files filling one row', False)
    except ValueError:
        check('materials refuse two files filling one row', True)
    runs = re.findall(r'<section class="run(?: opt)?" id="mon-([a-z0-9-]+)" data-run="([a-z-]+)"', sub)
    check('run-sheet: one card per place to post, in config/board-layout.json\'s order, under the ids the page gave them',
          [k for _, k in runs] == [s['key'] for s in LAYOUT['publish_steps']['steps'] if s.get('channel') and not s.get('feature_only')]
          and [i for i, _ in runs][:3] == ['substack', 's2', 's3'])
    check('run-sheet: the progress at the top, then Download first, then the cards, then the optional ones under their heading',
          sub.index('data-meter="mon"') < sub.index('id="mon-download"') < sub.index('data-run="substack"')
          < sub.index('When you want them') < sub.index('data-run="linkedin"'))
    check('run-sheet: each card has its own one tick, and no tick sits outside a card',
          all(re.findall(r'data-tick="([^"]+)"', c.group(2)) == [f'mon-{c.group(1)}'] for c in
              re.finditer(r'<section class="run(?: opt)?" id="[^"]+" data-run="([^"]+)"[^>]*>(.*?)</section>', sub, re.S))
          and 'data-tick="' not in re.sub(r'<section class="run.*?</section>', '', sub, flags=re.S))
    sub_card = re.search(r'<section class="run" id="mon-substack".*?</section>', sub, re.S).group(0)
    check('run-sheet: a card\'s parts in one order (files, copy, do, link box, tick), its files linking to Download first',
          sub_card.index('href="#mon-dl-video-long"') < sub_card.index('data-ref="mon-c1"') < sub_card.index('<ol class="do">')
          < sub_card.index('id="mon-link-article"') < sub_card.index('data-tick="mon-substack"')
          and 'Press Copy article above' in sub_card and 'data-act="article" data-ref="mon-art"' in sub_card)
    check('run-sheet: the old section ticks, the contents bar and the Finished videos card are gone from a fixed week',
          'sec-tick' not in sub and 'nav class="toc"' not in sub and 'id="mon-videos"' not in sub and 'Mark done' not in page)
    check('run-sheet: a copy box keeps its id, so copy_updates still refreshes it and a comment on it still finds it',
          'id="mon-c3" data-raw="A refreshed YouTube title"' in sub)
    check('run-sheet: the prepared files ride in Download first and a rebuild reads them back',
          board_materials.previous(page).get('mon', {}).get('note') == 'Held for one fact.' and 'id="mon-materials-captions-copy-0"' in sub)
    check('run-sheet: Download all for the files the page holds, and the post\'s library folder said plainly',
          'data-act="download-all" data-ref="mon-download">Download all 3 files on this page' in sub
          and '3 Posts, 2026-10-26 Mon follow.the.money - Suno.' in sub)
    check('run-sheet: the list at the top says each step, the recordings pointing to Record',
          '<a href="#mon-record" data-tickstate="mon-record-long">' in sub and '<a href="#mon-s2" data-tickstate="mon-youtube">' in sub)
    # Refusals: what a hand edit might do to a run-sheet.
    no_dl = page.replace(div_at(page, page.find('<div class="rec dl" id="mon-download"')), '', 1)
    check('run-sheet: a Publish step with no Download first is refused', any('no Download first' in x for x in verify(no_dl)))
    a = re.search(r'<section class="run" id="mon-s3".*?</section>', page, re.S).group(0)
    b = re.search(r'<section class="run" id="mon-s4".*?</section>', page, re.S).group(0)
    swapped = page.replace(a, '\0').replace(b, a).replace('\0', b)
    check('run-sheet: cards out of order are refused', any('places to post are' in x for x in verify(swapped)))
    loose = page.replace('<h2 class="run-h">Then post', row_tick('mon', 'tiktok') + '<h2 class="run-h">Then post', 1)
    check('run-sheet: a tick with no card is refused', any('with no card' in x for x in verify(loose)))
    untick = page.replace(re.search(r'<label class="tick run-tick"><input type="checkbox" data-tick="mon-reels".*?</label>', page, re.S).group(0), '', 1)
    check('run-sheet: a card without its tick is refused', any('the reels card holds' in x for x in verify(untick)))
    held = {'mon': [dict(videos['mon'][0], url=None, name='l.mp4'), dict(videos['mon'][1], thumbnail={'path': 'x/t.jpg'})]}
    gaps, _, _ = board(week, {'mon': mon}, {'mon': MON_ID}, videos=held)
    problems = verify(gaps)
    check('run-sheet: a video with no Drive link and a video with no thumbnail link are refused, as before',
          any('no Drive link' in x for x in problems) and any('no thumbnail link' in x for x in problems))
    kept, _, _ = board(week, kept={'mon': kept_panel(gaps, 'mon')}, pieces={'mon': MON_ID}, videos=videos)
    check('run-sheet: a kept day draws its videos again from the record', verify(kept) == [] and 'data-dl="video-long" data-state="ready"' in kept)
    with tempfile.TemporaryDirectory() as tmp:
        saved, FEATURES_FILE = FEATURES_FILE, Path(tmp) / 'features.json'
        try:
            FEATURES_FILE.write_text(json.dumps({'pieces': {MON_ID: {'called_on': '2026-10-25'}}}), encoding='utf-8')
            feat, _, _ = board(week, {'mon': mon}, {'mon': MON_ID}, videos=videos)
        finally:
            FEATURES_FILE = saved
    fsub = div_at(feat, feat.find('<div class="subpanel" role="tabpanel" id="mon-sub-publish"'))
    check('run-sheet: a feature piece has its feature card last, under When you want them, and its video in Download first',
          verify(feat) == [] and fsub.index('When you want them') < fsub.index('data-run="record-feature"')
          and 'id="mon-dl-video-feature"' in fsub and 'href="#mon-dl-video-feature"' in fsub)
    # Each card finds its copy by its section's heading, never by its place (review, 2026-10-21: a page made before the
    # feature's two steps were added put the Shorts caption on the TikTok card once the piece became a feature).
    with tempfile.TemporaryDirectory() as tmp:
        plain = stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money',
                         {'piece_id': MON_ID, 'youtube_description': 'YT words', 'shorts_caption': 'Shorts words',
                          'tiktok_caption': 'TikTok words', 'reels_caption': 'Reels words', 'spotify_title': 'Spotify words'})
    def copies(built):
        sub = div_at(built, built.find('<div class="subpanel" role="tabpanel" id="mon-sub-publish"'))
        return {m.group(1): re.findall(r'data-raw="([^"]*)"', m.group(2)) for m in
                re.finditer(r'<section class="run(?: opt)?" id="[^"]+" data-run="([^"]+)"[^>]*>(.*?)</section>', sub, re.S)}
    before, _, _ = board(week, {'mon': plain}, {'mon': MON_ID})
    use_layout(week)
    import making  # publish_kit.is_feature reads config/features.json through it
    with tempfile.TemporaryDirectory() as tmp:
        saved, saved_making, FEATURES_FILE = FEATURES_FILE, making.FEATURES, Path(tmp) / 'features.json'
        making.FEATURES = FEATURES_FILE
        try:
            FEATURES_FILE.write_text(json.dumps({'pieces': {MON_ID: {'called_on': '2026-10-25'}}}), encoding='utf-8')
            after, _, _ = board(week, {'mon': plain}, {'mon': MON_ID})
            use_layout(week)
        finally:
            FEATURES_FILE, making.FEATURES = saved, saved_making
    was, now = copies(before), copies(after)
    check('run-sheet: a page made before the piece was a feature keeps every caption on its own card on a feature board',
          verify(after) == [] and 'record-feature' in now and all(now[k] == v for k, v in was.items())
          and 'TikTok words' in ' '.join(now['tiktok'])
          and 'Shorts words' not in ' '.join(now['tiktok']))
    _feature_card_checks(check, week, videos, sub)
    for bad, said in [(plain.replace('<h2>4. TikTok</h2>', '<h2>4. Threads</h2>'), 'that no publish step names'),
                      (plain.replace('<h2>4. TikTok</h2>', '<h2>4. Instagram Reels</h2>'), 'two sections for')]:
        try:
            board(week, {'mon': bad}, {'mon': MON_ID})
            refused = ''
        except BoardError as error:
            refused = str(error)
        use_layout(week)
        check(f'run-sheet: a publish page section {"no step names" if "names" in said else "doubling another"} is refused',
              said in refused)
    old = re.sub(r'<script type="application/json" id="pm-data">.*?</script>', '', mon, flags=re.S)
    _, _, warned = board(week, {'mon': old}, {'mon': MON_ID})
    check('run-sheet: a publish page with no words as data still draws, and says it names the standing files',
          any('standing files' in w for w in warned))
    with tempfile.TemporaryDirectory() as tmp:
        legacy = stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money')
    use_layout(date(2026, 10, 12))
    vids = [{'cut': c, 'seconds': 90, 'url': f'https://drive.google.com/file/d/1{c}VideoAAAAAAAAAAAAAAAAAAAAAAAA/view',
             'thumbnail': {'url': f'https://drive.google.com/file/d/1{c}ThumbAAAAAAAAAAAAAAAAAAAAAAAA/view'}} for c in ('long', 'short')]
    made = made_panel(parse_day_page(legacy, 'mon'), 'mon', 'monday', 'mon-', {}, False, [], vids)
    check('run-sheet: an older week\'s made day is byte for byte what it was before the run-sheet',
          hashlib.sha256(made.encode('utf-8')).hexdigest() == '55798f3f552d6772471d9a5f51e2c67516cd09ed5e935e6af1fa351c5e8400ec')
    use_layout(week)


def _feature_card_checks(check, week, videos, plain_sub):
    """The 15-minute feature's two posting cards (Krish, 2026-10-21: "Yes, add the cards"): on a feature piece only,
    YouTube long-form right after the 5-minute YouTube card and its Spotify episode right after the Spotify card, each
    with its files, its words to copy, its do-steps and its own tick. Every other piece's run-sheet is as it was."""
    global FEATURES_FILE
    import making  # publish_kit.is_feature reads config/features.json through it
    # The hash moved once, on 2026-10-28, for Approve for publish and Reject asset alone (Krish, 2026-10-28: "Approve each
    # day Monday"): the run-sheet with those taken out still hashes 11ff1480...ac36, the value before them.
    check('feature cards: a piece that is not a feature has a run-sheet byte for byte what it was, with neither card',
          hashlib.sha256(plain_sub.encode('utf-8')).hexdigest() == 'adb04622b964682ccec5e02dd06093de3de2ad7ac7d834100ead8ed199b2570a'
          and 'feature-youtube' not in plain_sub and 'feature-spotify' not in plain_sub)
    words = {'piece_id': MON_ID, 'feature_youtube_title': 'The feature title', 'feature_youtube_description': 'The feature description',
             'feature_spotify_chapters': '0:00 Start\n7:30 The deal',
             'files': {'feature_video': '3 Video/F - feature.mp4', 'feature_thumbnail': '3 Video/F - feature - thumb.jpg'}}
    vids = {'mon': videos['mon'] + [{'cut': 'feature', 'url': f'https://drive.google.com/file/d/{"e" * 25}/view', 'seconds': 905,
                                     'thumbnail': {'url': f'https://drive.google.com/file/d/{"f" * 25}/view'}}]}
    with tempfile.TemporaryDirectory() as tmp:
        saved, saved_making, FEATURES_FILE = FEATURES_FILE, making.FEATURES, Path(tmp) / 'features.json'
        making.FEATURES = FEATURES_FILE
        try:
            FEATURES_FILE.write_text(json.dumps({'pieces': {MON_ID: {'called_on': '2026-10-25'}}}), encoding='utf-8')
            page_words = stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money', words)
            feat, _, _ = board(week, {'mon': page_words}, {'mon': MON_ID}, videos=vids)
            use_layout(week)
            feat_problems, feat_page = verify(feat), check_page(feat)
        finally:
            FEATURES_FILE, making.FEATURES = saved, saved_making
    with tempfile.TemporaryDirectory() as tmp:
        page_plain = stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money', words)
    plain, _, _ = board(week, {'mon': page_plain}, {'mon': MON_ID}, videos=videos)
    use_layout(week)
    fsub = div_at(feat, feat.find('<div class="subpanel" role="tabpanel" id="mon-sub-publish"'))
    runs = [m.group(1) for m in re.finditer(r'<section class="run(?: opt)?" id="[^"]+" data-run="([^"]+)"', fsub)]
    check('feature cards: a feature piece posts in one order, YouTube long-form after the 5-minute YouTube, its episode after Spotify',
          runs == ['substack', 'youtube', 'feature-youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'spotify', 'feature-spotify', 'record-feature'])
    card = {k: re.search(rf'<section class="run(?: opt)?" id="[^"]+" data-run="{k}"[^>]*>.*?</section>', fsub, re.S).group(0)
            for k in ('feature-youtube', 'feature-spotify')}
    yt, sp = card['feature-youtube'], card['feature-spotify']
    check('feature cards: each is headed by its place and holds its own one tick, not counted toward 100%',
          '>YouTube long-form (the 15-minute feature)</h3>' in yt and '>Spotify (the 15-minute feature)</h3>' in sp
          and re.findall(r'data-tick="([^"]+)"', yt) == ['mon-feature-youtube'] and re.findall(r'data-tick="([^"]+)"', sp) == ['mon-feature-spotify']
          and yt.startswith('<section class="run opt"') and sp.startswith('<section class="run opt"')
          and 'Done: tick it once it is live' in yt and 'data-tickstate="mon-feature-' not in fsub)
    check('feature cards: their files are the feature video and its wide thumbnail, linked to Download first',
          all('href="#mon-dl-video-feature"' in c and 'href="#mon-dl-thumb-feature"' in c for c in (yt, sp))
          and 'id="mon-dl-video-feature"' in fsub and 'id="mon-dl-thumb-feature"' in fsub)
    check('feature cards: their words to copy, each with one-tap Copy (title, description, chapters)',
          all(re.search(rf'<pre class="txt" id="[^"]+" data-raw="{re.escape(t)}"', c) and 'data-act="text"' in c
              for c, t in ((yt, 'The feature title'), (yt, 'The feature description'), (sp, 'The feature title'),
                           (sp, 'The feature description'), (sp, '0:00 Start\n7:30 The deal'))))
    check('feature cards: their do-steps, uploading the feature to YouTube Studio and to Spotify for Creators',
          '<ol class="do">' in yt and 'YouTube Studio' in yt and 'Spotify for Creators' in sp and '3 Video/F - feature - thumb.jpg' in sp)
    check('feature cards: a feature board with both cards passes verify and the page check',
          feat_problems == [] and feat_page == [])
    psub = div_at(plain, plain.find('<div class="subpanel" role="tabpanel" id="mon-sub-publish"'))
    check('feature cards: the same words on a piece that is not a feature show neither card and pass verify',
          verify(plain) == [] and check_page(plain) == [] and 'data-run="feature-' not in psub and 'data-tick="mon-feature-' not in plain)
    loose = plain.replace('<h2 class="run-h">When you want them</h2>', yt + '<h2 class="run-h">When you want them</h2>', 1)
    check('feature cards: a feature card on a piece that is not a feature is refused by verify and the page check',
          any('places to post are' in x for x in verify(loose)) and any('not a feature: mon-feature-youtube' in x for x in check_page(loose)))
    dropped = feat.replace(sp, '', 1)
    check('feature cards: a feature piece without its Spotify card is refused', any('places to post are' in x for x in verify(dropped)))


def _editor_checks(check, week):
    """The Drafts step (learning edits-propagate-and-teach): the editor's read view, Also changed, What I learned."""
    article = '# Who pays\n\nAbout **40%** of firms pay.\nA second line.\n\n- one\n- two\n\n> A quote\n\n---'
    review = {'wed': [('article', 'Article draft', article), ('long', 'Five-minute script', 'Said words.')]}
    sweep = read_sweep({'day': 'wed', 'piece_id': WED_ID, 'also_changed': [
        {'id': 's1', 'where': 'Wednesday, Five-minute script', 'kind': 'number_fact', 'from': '40 percent', 'to': '38 percent',
         'context': 'About 38 percent of firms pay.', 'undo': {'path': 'x'}}],
        'suggestions': [{'id': 't1', 'where': 'Friday, Article', 'kind': 'tone', 'from': 'really cheap', 'to': 'cheap'}],
        'held': [{'where': 'Wednesday, 90-second script', 'why': 'you have recorded it'}],
        'gates': [{'where': 'Wednesday, Five-minute script', 'check': 'story_check', 'ok': True, 'problems': []}],
        'ledger': [], 'edits': []})
    lessons = read_lessons({'ok': True, 'proposals': [
        {'id': '44444444-5555-4666-8777-888888888888', 'assertion': 'On the publish board Krish made 3 number or fact edits.',
         'independent_session_count': 3, 'status': 'proposed', 'scope': {'level': 'global', 'key': 'board_edit:number_fact'}},
        {'id': '55555555-5555-4666-8777-888888888888', 'assertion': 'A preset is never kept.', 'independent_session_count': 4,
         'status': 'proposed', 'scope': {'level': 'global', 'key': 'tone:punchier'}}]})
    taste = read_lessons({'proposals': [
        {'id': f'6666666{i}-5555-4666-8777-888888888888', 'assertion': f'Titles say what happens, case {i}.',
         'independent_session_count': 4, 'status': 'proposed' if i else 'corrected',
         'scope': {'level': 'global', 'key': 'taste:packaging', 'source': 'taste_ledger'}} for i in range(5)]})
    check('lessons: the taste ledger\'s proposals show, at most three', [t['kind'] for t in taste] == ['taste'] * 3)
    taste_card = lessons_card('wed-', taste)
    check('lessons: a taste lesson says it came from what he saved and said, a reword is a standing rule in his words',
          'From what you saved and said, across 4 days' in taste_card and 'Reworded: a standing rule, in your words' in taste_card)
    ventured = read_lessons({'proposals': [
        {'id': '77777777-5555-4666-8777-888888888888', 'assertion': 'Open on the person.', 'independent_session_count': 3,
         'status': 'proposed', 'scope': {'level': 'global', 'key': 'taste:packaging', 'source': 'taste_ledger', 'venture': 'heartside'},
         'venture': 'heartside', 'venture_label': 'Heartside'},
        {'id': '88888888-5555-4666-8777-888888888888', 'assertion': 'Name the event.', 'independent_session_count': 3,
         'status': 'proposed', 'scope': {'level': 'global', 'key': 'taste:packaging', 'source': 'taste_ledger'}},
        {'id': '99999999-5555-4666-8777-888888888888', 'assertion': 'Say the number.', 'independent_session_count': 3,
         'status': 'proposed', 'scope': {'level': 'global', 'key': 'taste:packaging', 'source': 'taste_ledger', 'venture': ' mindmake '}}]})
    ventured_card = lessons_card('wed-', ventured)
    check('lessons: each says the venture it is for by its plain name, none is left out for its venture, and none named is Make Your Mind Up\'s',
          [ls['venture'] for ls in ventured] == ['Heartside', MYMU, 'Mindmake'] and 'For Heartside.' in ventured_card
          and 'For Mindmake.' in ventured_card
          and f'For {MYMU}.' in ventured_card and f'For {MYMU}.' in lessons_card('wed-', lessons))
    page, manifest, warnings = board(week, pieces={'wed': WED_ID}, review=review, draft={'wed'}, sweeps={'wed': sweep}, lessons=lessons)
    check('editor: a fed week with the editor, Also changed and What I learned passes verify', verify(page) == [])
    card = page[page.index('<div class="rec rv ed" id="wed-review">'):page.index(REVIEW_END)]
    check('editor: each draft is a read view, its heading drawn without its # signs',
          '<h4 class="rv-h">Who pays</h4>' in card and '# Who pays' not in card.split('<textarea')[0])
    check('editor: bold, line breaks, lists, quotes and a rule are drawn',
          '<strong>40%</strong>' in card and 'firms pay.<br>A second line.' in card and '<ul><li>one</li><li>two</li></ul>' in card
          and '<blockquote><p>A quote</p></blockquote>' in card and '<hr>' in card)
    check('editor: one tappable block per paragraph, numbered as week.js numbers them',
          [int(n) for n in re.findall(r'id="rvp-wed-article-(\d+)"', card)] == list(range(len(paragraphs(article)))) == list(range(5)))
    check('editor: the raw words stay in the hidden box with the hash of what was built',
          f'data-base-sha256="{hashlib.sha256(article.encode()).hexdigest()}"' in card and 'aria-label="Article draft" hidden>' in card)
    check('editor: one Save bar for the day, saying nothing is unsaved yet',
          card.count('data-act="save-all" data-day="wed"') == 1 and 'No unsaved changes' in card)
    check('editor: a rebuild still finds the words he can edit, and their build time', previous_review_times(page, review) != {}
          and previous_draft(page, 'wed')[0] == ['wed-article', 'wed-long'])
    drafts = page[page.index('id="wed-sub-drafts"'):page.index('id="wed-sub-record"')]
    check('Also changed sits under the drafts, each carried change with its Undo', drafts.index('id="wed-review"') < drafts.index('id="wed-also"')
          and 'data-act="undo-also" data-for="s1"' in drafts and '<del>40 percent</del>' in drafts and '<ins>38 percent</ins>' in drafts)
    check('a tone suggestion is offered, never made; the recorded script is listed; the checks are said',
          'data-act="apply-also" data-for="t1"' in drafts and 'Left alone: already recorded' in drafts and 'passes the story check' in drafts)
    check('What I learned shows only the proposals from his board edits, each waiting for his yes',
          'What I learned from your edits' in drafts and drafts.index('id="wed-also"') < drafts.index('id="wed-lessons"')
          and 'data-act="lesson-yes" data-for="44444444-5555-4666-8777-888888888888"' in drafts and 'A preset is never kept' not in page)
    check('the sweep rides in the page, so a rebuild with the same words keeps it',
          previous_sweeps(page).get('wed', {}).get('also_changed', [{}])[0].get('id') == 's1' and manifest['sweeps']['wed']['day'] == 'wed')
    check('the manifest says what a comment may carry and what each of his taps means',
          'quote' in manifest['db']['comments']['fields'] and set(manifest['db']['comments']['acts']) == {'undo', 'apply', 'lesson_yes', 'lesson_no'})
    approved = [dict(lessons[0], status='approved')]
    shown, _, _ = board(week, pieces={'wed': WED_ID}, review=review, draft={'wed'}, lessons=approved)
    shown = shown[:shown.index('<script>')]  # the page's script names every button it handles
    check('an approved lesson says so and asks nothing', 'Approved: a standing rule' in shown and 'data-act="lesson-yes"' not in shown)
    for bad, label in [({'also_changed': [{'id': 'S 1', 'where': 'x', 'kind': 'tone', 'from': 'a', 'to': 'b'}]}, 'an id with a space'),
                       ({'also_changed': [{'id': 's1', 'where': 'x', 'kind': 'vibes', 'from': 'a', 'to': 'b'}]}, 'an unknown kind'),
                       ({'also_changed': [{'id': 's1', 'where': 'x', 'kind': 'tone', 'from': 'a', 'to': 'a'}]}, 'no change'),
                       ({'banner': 'Hello'}, 'a field with no place')]:
        try:
            read_sweep(bad)
            refused = False
        except BoardError:
            refused = True
        check(f'a sweep with {label} is refused', refused)
    try:
        board(week, pieces={'wed': WED_ID}, sweeps={'wed': sweep})
        refused = False
    except BoardError as error:
        refused = 'no drafts in review' in str(error)
    check('a sweep for a day with no drafts on the board is refused, never dropped', refused)
    try:
        board(week, pieces={'wed': FRI_ID}, review=review, draft={'wed'}, sweeps={'wed': sweep})
        refused = False
    except BoardError as error:
        refused = 'is for piece' in str(error)
    check('a sweep for another piece is refused', refused)
    _, _, lonely = board(week, lessons=lessons)
    check('lessons with no day in draft are said, not silently lost', any('--lessons' in w for w in lonely))
    use_layout(date(2026, 10, 19))
    legacy = review_card('fri', [('article', 'Article', '# Head\n\nHello *world*.'), ('long', 'Five-minute script', 'Said.')],
                         '2026-10-19T00:00:00Z', {'fri-long': '2026-10-18T00:00:00Z'})
    check('an older week\'s review card is byte for byte what it was before the editor',
          hashlib.sha256(legacy.encode('utf-8')).hexdigest() == '134b7fc49be5d170c1136ef9888aa645ddc039bed50270ac7bc7e9af31f67f23')
    try:
        board(date(2026, 10, 19), pieces={'fri': FRI_ID}, review={'fri': review['wed']}, draft={'fri'}, sweeps={'fri': sweep})
        refused = False
    except BoardError:
        refused = True
    check('a sweep for a week in the old layout is refused', refused)
    use_layout(week)


def _style_cover_checks(check):
    """Krish, 2026-10-24: styles he can choose from that push and diverge, and his Inspiration House read properly."""
    formats = style_formats()
    check('styles: the bank has script and production formats with evidence',
          len(formats['script']) >= 6 and len(formats['production']) >= 5
          and all(f.get('evidence') and f.get('pitch') for k in ('script', 'production') for f in formats[k].values()))
    bank = {m['id'] for m in json.loads(STYLES_PATH.read_text(encoding='utf-8'))['bank']}
    check('styles: every format is made of modules that are in the bank',
          all(set(f.get('modules') or []) <= bank for k in ('script', 'production') for f in formats[k].values()))
    sc, pr = list(formats['script']), list(formats['production'])
    exp = next(i for i, f in formats['script'].items() if f.get('status') == 'experimental')
    st = lambda n: {'script': sc[n % 2], 'production': pr[n % 3], 'experiment': {'format': exp, 'why': 'the bolder version'}}
    good = {'days': {k: [{'style': st(n)} for n in range(4)] for k, *_ in DAYS}}
    check('styles: a varied week with an experiment a day passes', style_problems(good, formats) == [])
    same = {'days': {k: [{'style': {'script': sc[0], 'production': pr[0], 'experiment': {'format': exp, 'why': 'x'}}} for _ in range(4)] for k, *_ in DAYS}}
    probs = style_problems(same, formats)
    check('styles: one script format all day is refused', any('script format(s) across' in p for p in probs))
    check('styles: one production format all week is refused', any('production format(s)' in p for p in probs) and any('% of the recommendations' in p for p in probs))
    bare = {'days': {'mon': [{}]}}
    check('styles: an idea with no style is refused', any('no style' in p for p in style_problems(bare, formats)))
    made_up = {'days': {'mon': [{'style': dict(st(0), script='tiktok-dance')}]}}
    check('styles: a format not in the bank is refused', any("'tiktok-dance' is not a script format" in p for p in style_problems(made_up, formats)))
    tame = {'days': {k: [{'style': dict(st(n), experiment={'format': sc[0] if formats['script'][sc[0]].get('status') == 'proven' else 'head-to-head', 'why': 'x'})} for n in range(4)] for k, *_ in DAYS}}
    check('styles: a day whose experiments are all proven formats is refused', any('untried format' in p for p in style_problems(tame, formats)))
    nope = json.loads(json.dumps(formats))
    nope['production'][pr[0]]['krish_verdict'] = 'not for us'
    check('styles: a format he marked not for us is never offered', any('not for us' in p for p in style_problems(good, nope)))
    sources = {'must_cover': [{'id': 'card-1', 'what': 'Inspiration card "x" you routed to Make a piece'}, {'id': 'said-1', 'what': 'Your words'}]}
    check('cover: a routed card left off the board is refused, by name',
          any('Inspiration card "x"' in p for p in coverage_problems({'days': {'mon': [{'covers': ['said-1']}]}}, sources)))
    check('cover: covered by an idea or accounted for with a reason passes',
          coverage_problems({'days': {'mon': [{'covers': ['said-1']}]}, 'accounted': {'card-1': 'merged into Monday idea 2, same Duet launch'}}, sources) == [])
    check('cover: accounted given as a list is said, never a crash',
          any('accounted is an object' in p for p in coverage_problems({'days': {}, 'accounted': ['card-1']}, sources)))
    check('cover: a one-word excuse is not an account', coverage_problems({'days': {}, 'accounted': {'card-1': 'no', 'said-1': 'skip'}}, sources) != [])
    line = style_line(st(0))
    check('styles: the card shows the suggested style and the bolder try',
          '<dt>Suggested style</dt>' in line and '<dt>Or try something new</dt>' in line and formats['script'][sc[0]]['name'] in line)


def _sources_checks(check):
    """Sunday's ideas from every source and the Queue's Could combine (Krish, 2026-10-21; learning
    queue-consolidation-and-fresh-sunday-ideas): each idea says where it came from and why it is here, and queued
    ideas that would make one piece are shown together with a Combine button, combined only on his word."""
    week = LAYOUT_FROM
    kinds = ('his', 'inspo', 'engine', 'engine')
    one = lambda k, n, **kw: dict({'so_what': f'A leader finds out {k}{n}.', 'story': f'Story {k}{n}.', 'why_now': 'This week.',
                                   'fact': 'A fact.', 'source': {'label': 'Src', 'url': 'https://example.com/s'},
                                   'source_kind': kinds[n - 1], 'beats': ['What happened', 'Why it matters', 'What to do']}, **kw)
    data = lambda **kw: {'week_start': week.isoformat(), 'days': {k: [one(k, n, **kw) for n in (1, 2, 3, 4)] for k, *_ in DAYS}}
    ideas = read_ideas(data(why_here='close to your Story mark on "Who pays"'), week)
    queue = [{'id': MON_ID, 'so_what': 'Who pays for a free AI picture.', 'series': 'follow_the_money', 'triage': {'verdict': 'story'}},
             {'id': WED_ID, 'so_what': 'What your AI can read in your Gmail.', 'series': 'follow_the_money', 'triage': None},
             {'id': FRI_ID, 'so_what': 'A third saved idea.', 'series': None, 'triage': None}]
    combine = read_combine([{'members': [MON_ID, WED_ID], 'series': 'follow_the_money', 'thesis': 'Free AI is paid for with your data.',
                             'joins': ['The free picture', 'The plugged-in inbox', 'The same bill']}], queue)
    page, manifest, _ = board(week, ideas=ideas, queue=queue, combine=combine)
    check('sources: a fed Sunday with combine groups passes verify', verify(page) == [])
    check('sources: every idea carries its source chip, his own marked as his',
          page.count('data-source-kind="') == 12 and page.count('data-source-kind="his"') == 3
          and 'From your inspo folder' in page and 'Engine research' in page and 'class="id-flag his"' not in page)
    check('sources: every idea shows why it is here and its beats',
          page.count('class="id-why"') == 12 and page.count('<ol class="id-beats"') == 12 and '<li>Why it matters</li>' in page)
    check('sources: the manifest carries where each idea came from and its beats',
          manifest['ideas']['mon'][0]['source_kind'] == 'his' and manifest['ideas']['mon'][0]['his'] is True
          and len(manifest['ideas']['wed'][1]['beats']) == 3)

    def refused(fn):
        try:
            fn()
            return False
        except BoardError:
            return True
    plain = data()
    for d in plain['days'].values():
        for i in d:
            i.pop('source_kind')
    check('sources: an idea with no source_kind is refused in a fixed week', refused(lambda: read_ideas(plain, week)))
    check('sources: an idea with no source_kind is still fine in a week in the old layout',
          not refused(lambda: read_ideas(dict(plain, week_start='2026-10-19'), date(2026, 10, 19))))
    check('sources: an unknown source_kind is refused', refused(lambda: read_ideas(data(source_kind='friend'), week)))
    check('sources: two beats are refused (3 to 5)', refused(lambda: read_ideas(data(beats=['One', 'Two']), week)))
    chipless = page.replace('data-source-kind="', 'data-was-kind="', 1)
    check('sources: verify refuses a fixed board whose idea lost its source chip', any('where it came from' in x for x in verify(chipless)))
    check('combine: the Could combine card shows the members, what joins them and a Combine button',
          'data-combine="combine-1"' in page and f'data-members="{MON_ID},{WED_ID}"' in page
          and 'data-act="combine" data-for="combine-1"' in page and 'The plugged-in inbox' in page
          and 'Who pays for a free AI picture.' in page[page.index('id="queue-combine"'):page.index('id="queue-follow_the_money"')])
    check('combine: the manifest says where a Combine tap is saved and what runs then',
          manifest['combine'][0]['members'] == [MON_ID, WED_ID] and manifest['db']['queue']['combine']['doc_id'] == 'combine-<n>')
    check('combine: no groups, the slot says it fills when there are some',
          'class="slot-empty"' in board(week, ideas=ideas, queue=queue)[0].split('id="queue-combine"')[1][:400])
    tampered = page.replace(f'data-members="{MON_ID},{WED_ID}"', f'data-members="{MON_ID}"')
    check('combine: verify refuses a Could combine card without its queued members', any('Could combine' in x for x in verify(tampered)))
    group = {'members': [MON_ID, WED_ID], 'series': None, 'thesis': 'One argument.', 'joins': ['A', 'B', 'C']}
    for bad, label in [(dict(group, members=[MON_ID]), 'one member'), (dict(group, members=[MON_ID, '44444444-5555-4666-8777-888888888888']), 'a member not in the queue'),
                       (dict(group, thesis=''), 'no thesis'), (dict(group, joins=['A', 'B']), 'two joins'), (dict(group, series='retired'), 'a series that is not one')]:
        check(f'combine: a group with {label} is refused', refused(lambda: read_combine([bad], queue)))
    check('combine: a group with no --queue is refused', refused(lambda: read_combine([group], None)))
    contracts = (Path(__file__).resolve().parents[2] / 'apps/control-plane/api/board/_contracts.ts').read_text(encoding='utf-8')
    check('combine: the board API accepts the Combine tap (queue/combine-<n> with its members)',
          'body.combine === true && body.pick === id' in contracts and 'combine-' in contracts)
    js = template('week.js')
    check('combine: the tap saves queue/combine-<n> with combine true and its members, and posts a comment',
          'qdb.doc("queue/" + cid).set(body)' in js and 'combine: true, members' in js and 'COMBINE ${cid}' in js)
    check('combine: a saved tap shows only on the card for those same ideas, and its comment carries no board words as his',
          'same(saved[cid].members, members(c))' in js and '`COMBINE ${cid} ${body.members.join(" ")}\\n${body.at}`' in js
          and 'q-sowhat")?.textContent' not in js)


def _ideas_checks(check):
    """The Sunday Ideas tab (Krish, 2026-10-18): first, at least three checked ideas a day, a pick box each."""
    wk = date(2026, 10, 19)
    one = lambda n, **kw: dict({'so_what': f'A business person finds out {n}.', 'story': f'Story {n}.', 'why_now': 'On 12 October 2026.', 'fact': 'A fact.',
                                 'source': {'label': 'Src', 'url': f'https://example.com/{n}'}}, **kw)
    data = {'week_start': '2026-10-19', 'days': {k: [one(f'{k}{n}', his=n == 1, id=MON_ID if (k, n) == ('mon', 1) else None)
                                                     for n in (1, 2, 3, 4)] for k, *_ in DAYS}}
    ideas = read_ideas(data, wk)
    page, manifest, _ = board(wk, ideas=ideas)
    first = re.search(r'role="tablist"[^>]*>\s*<button[^>]*id="tab-(\w+)"', page)
    check('ideas: the Ideas tab comes first and opens while no day is made',
          bool(first) and first.group(1) == 'ideas' and 'id="tab-ideas" aria-controls="panel-ideas" aria-selected="true"' in page
          and re.search(r'<div class="pm" id="panel-monday"[^>]*hidden', page) is not None)
    check('ideas: the title names the week', "<title>This Week's Publish Board (wC 19 Oct)</title>" in page
          and manifest['publish']['title'] == "This Week's Publish Board (wC 19 Oct)")
    check('ideas: one pick box per idea, one group per day, the idea id carried',
          page.count('data-pick="') == 12 and page.count('name="pick-mon"') == 4 and f'data-idea-id="{MON_ID}"' in page)
    check('ideas: every card shows why now, the checked fact and its linked source',
          page.count('<dt>Strongest checked fact</dt>') == 12 and page.count('<dt>Source</dt><dd><a href="https://') == 12)
    check('ideas: his own idea is marked', page.count('class="id-flag his"') == 3)
    check('ideas: a board with its ideas passes --verify', verify(page) == [])
    thin = page.replace('<article class="id-card" id="idea-fri-4"', '<article class="x" id="idea-fri-4"', 1)
    check('ideas: --verify refuses a day with fewer than four checked ideas',
          any('Friday has 3 checked' in w for w in verify(thin)))
    check('ideas: the manifest lists the ideas and where picks are saved',
          len(manifest['ideas']['wed']) == 4 and manifest['db']['picks']['doc_id'] == '<day>' and manifest['ideas']['mon'][0]['idea_id'] == MON_ID)
    js = template('week.js')
    check('ideas: a pick is saved to picks/<day> and posted as a comment',
          'pdb.doc("picks/" + day).set(body)' in js and 'PICK ${day}' in js)
    check('ideas: every card says what a business person finds out, first', page.count('class="id-sowhat"') == 12
          and page.index('class="id-sowhat"') < page.index('class="id-story"'))
    check('ideas: every card has the four triage buttons, Drop and a Queue mark',
          page.count('data-triage="story"') == 12 and page.count('data-triage="curious"') == 12 and page.count('data-triage="drop"') == 12
          and page.count('data-queue-mark="') == 12)
    check('ideas: --verify refuses a card with no triage buttons',
          any('Friday has 3 checked' in w for w in verify(page.replace('data-triage="story" data-for="fri-4"', 'data-x="story" data-for="fri-4"', 1))))
    check('ideas: the manifest says where triage is saved', manifest['db']['queue']['doc_id'] == '<pick>'
          and manifest['ideas']['mon'][0]['so_what'] == 'A business person finds out mon1.')
    queued = [{'id': MON_ID, 'so_what': 'Queued so-what.', 'series': 'follow_the_money', 'triage': {'verdict': 'story'}},
              {'id': None, 'so_what': 'Any-series so-what.', 'series': None}]
    qpage, qman, _ = board(wk, ideas=ideas, queue=queued)
    check('ideas: "From your queue" comes first on the day the queued ideas fit',
          qpage.count('From your queue') == 3 and qpage.count('Queued so-what.') == 1 and qpage.count('Any-series so-what.') == 3
          and qpage.index('data-queue-day="mon"') < qpage.index('data-pick-card="mon-1"') and verify(qpage) == []
          and len(qman['queue']) == 2)
    check('ideas: no queue, no "From your queue"', 'From your queue' not in page)
    long_row = 'A long engine line that is never a title. ' * 12
    picked, _, _ = board(wk, ideas=ideas, picks={'mon': {'id': MON_ID, 'title': long_row}})
    mon_panel = picked[picked.index('id="panel-monday"'):picked.index('id="panel-wednesday"')]
    check('ideas: a picked day shows the weekday as its heading and the idea in plain words, never the engine line',
          '<h1>Monday</h1>' in mon_panel and 'A business person finds out mon1.' in mon_panel and 'never a title' not in mon_panel)
    check('ideas: triage is saved to queue/<pick> and posted as a comment',
          'qdb.doc("queue/" + pid).set(body)' in js and 'QUEUE ${pid}' in js and 'curious' in js)
    for name, bad, want in (
            ('an idea with no so_what', dict(data, days=dict(data['days'], mon=data['days']['mon'][:3] + [dict(one('n'), so_what='')])), 'so_what'),
            ('too few ideas', dict(data, days=dict(data['days'], wed=data['days']['wed'][:3])), 'Wednesday: 3 idea(s)'),
            ('an idea with a title', dict(data, days=dict(data['days'], fri=data['days']['fri'][:3] + [one('t', title='T')])), 'a title'),
            ('an idea with no source', dict(data, days=dict(data['days'], mon=data['days']['mon'][:3] + [dict(one('s'), source={})])), 'source.url'),
            ('another week', dict(data, week_start='2026-10-12'), 'not 2026-10-19')):
        try:
            read_ideas(bad, wk)
            check(f'ideas: refuses {name}', False)
        except BoardError as error:
            check(f'ideas: refuses {name}', want in str(error))
    made = board(date(2026, 10, 12), ideas=read_ideas(dict(data, week_start=None), date(2026, 10, 12)))[0]
    check('ideas: with no board day picked the Ideas tab opens; days still build',
          'id="panel-friday"' in made and 'aria-controls="panel-ideas" aria-selected="true"' in made)
    check('ideas: a board without ideas has no Ideas tab', 'panel-ideas' not in board(wk)[0])


def _draft_checks(check, page, fri):
    """A day in draft (--draft): its words in review, never an older publish
    page under them. On 15 October Friday v3's review card sat on top of the
    first version's page, whose chips said "Fact check passed on this exact
    text" and "Both scripts approved and in Teleprompter" for words that had
    neither. page: a board with Monday and Friday made, Wednesday picked."""
    import tempfile

    def refused(argv, get=None):
        try:
            build(parser().parse_args(argv), get=get)
            return ''
        except BoardError as error:
            return str(error) or 'refused'

    def live(path):
        if path.startswith('/api/week/options'):
            return {'week_start': '2026-10-12', 'series': [
                {'slug': 'follow_the_money', 'in_flight': [],
                 'scheduled': [{'id': MON_ID, 'idea': 'Suno', 'state': 'published', 'scheduled_for': '2026-10-12'}]},
                {'slug': 'under_the_hood', 'in_flight': [{'id': WED_ID, 'idea': 'Watermarks', 'state': 'drafting', 'scheduled_for': '2026-10-14'}]},
                {'slug': 'mind_the_gap', 'in_flight': [{'id': FRI_ID, 'idea': 'Menus', 'state': 'review', 'scheduled_for': '2026-10-16'}]}]}
        if path == f'/api/content-ideas/{MON_ID}/making':
            # Posted, with a publish page older than its last script change (Monday's real record): it stays.
            return {'state': 'published', 'making': {
                'publish_manager': {'url': 'https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS', 'at': '2026-10-11T19:19:09.181Z'},
                'script_check': {'changed_at': {'long': '2026-10-12T15:50:40.153498Z'}},
                'channels': {'substack': {'posted_at': '2026-10-12T20:59:44.114Z'}}}}
        if path == f'/api/content-ideas/{FRI_ID}/making':
            # In review, its words changed after its publish page was made (Friday's real record).
            return {'state': 'review', 'making': {
                'publish_manager': {'url': 'https://claude.ai/artifact/VS5swZnLXVkF8EHnERMp9H', 'at': '2026-10-14T11:21:49.233Z'},
                'script_check': {'changed_at': {'long': '2026-10-15T15:18:20.923404Z', 'short': '2026-10-15T15:18:20.923404Z'}}}}
        return {'making': {}, 'steps': []}

    def friday(text):
        return div_at(text, text.index('<div class="pm" id="panel-friday"'))

    def times(text):
        return {rid: at for rid, at, _ in REVIEW_BOX.findall(text)}

    with tempfile.TemporaryDirectory() as tmp:
        prev, words, deep = Path(tmp) / 'prev.html', Path(tmp) / 'words.md', Path(tmp) / 'deep.md'
        fri_page = Path(tmp) / 'fri.html'
        fri_page.write_text(fri, encoding='utf-8')
        prev.write_text(page, encoding='utf-8')
        words.write_text('New words, in review.\n', encoding='utf-8')
        deep.write_text('The deep cut, in review.\n', encoding='utf-8')
        review = ['--review', f'fri=Article|{words}', '--review', f'fri=Deep cut|{deep}']
        base = ['--week', '2026-10-12', '--previous', str(prev), '--keep', 'mon', '--piece', f'wed={WED_ID}']
        drafted, manifest = build(parser().parse_args(base + ['--live', '--draft', 'fri', *review, '--waiting', 'fri=Approve the outline',
                                                              '--waiting', 'fri=Pick the title']), get=live)
        tab = friday(drafted)
        mon_tab = div_at(drafted, drafted.index('<div class="pm" id="panel-monday"'))
        stale = refused(base + ['--live', '--keep', 'fri', *review], get=live)
        with_keep = refused(base + ['--keep', 'fri', '--draft', 'fri', *review])
        with_day = refused(['--week', '2026-10-12', '--day', f'fri={prev}', '--draft', 'fri', *review])
        no_words = refused(base + ['--piece', f'fri={FRI_ID}', '--draft', 'fri'])
        dropped = refused(['--week', '2026-10-12', '--piece', f'fri={FRI_ID}', *review])
        calls_alone = refused(['--week', '2026-10-12', '--piece', f'fri={FRI_ID}', '--waiting', 'fri=x'])
        prev2 = Path(tmp) / 'prev2.html'
        prev2.write_text(drafted, encoding='utf-8')
        base2 = ['--week', '2026-10-12', '--previous', str(prev2), '--keep', 'mon', '--piece', f'wed={WED_ID}', '--piece', f'fri={FRI_ID}']
        lost = refused(base2)
        kept_draft = refused(base2 + ['--keep', 'fri'])
        carried, carried_manifest = build(parser().parse_args(base2 + ['--live', '--keep-draft', 'fri']), get=live)
        wrong_piece = refused(['--week', '2026-10-12', '--previous', str(prev2), '--keep-draft', 'fri',
                               '--piece', f'fri={WED_ID}'])
        again, again_manifest = build(parser().parse_args(base2 + ['--draft', 'fri', *review]))
        box_dropped = refused(base2 + ['--draft', 'fri', '--review', f'fri=Article|{words}'])
        box_let_go, _ = build(parser().parse_args(base2 + ['--draft', 'fri', '--review', f'fri=Article|{words}', '--drop-review', 'fri=deep-cut']))
        to_made = refused(base2 + ['--day', f'fri={fri_page}'])

        def newer(path):
            # Friday's publish page made after its words last changed: it may replace the review tab.
            if path == f'/api/content-ideas/{FRI_ID}/making':
                return {'state': 'review', 'making': {'publish_manager': {'url': 'https://claude.ai/artifact/x', 'at': '2026-10-16T09:00:00Z'},
                                                      'script_check': {'changed_at': {'long': '2026-10-15T15:18:20.923404Z'}}}}
            return live(path)
        made_after, _ = build(parser().parse_args(base2 + ['--live', '--day', f'fri={fri_page}']), get=newer)
        posted_draft = refused(['--week', '2026-10-12', '--live', '--draft', 'mon', '--review', f'mon=Article|{words}'], get=live)

        def down(path):
            if path == f'/api/content-ideas/{MON_ID}/making':
                raise BoardError('the engine is down')
            return live(path)
        unread = refused(base + ['--live', '--draft', 'fri', *review], get=down)
        from_manifest = previous_review_times(json.dumps(manifest), {'fri': [('article', 'Article', 'New words, in review.'),
                                                                              ('deep-cut', 'Deep cut', 'The deep cut, in review.')]})
        words.write_text('Words he changed.\n', encoding='utf-8')
        changed, _ = build(parser().parse_args(base2 + ['--draft', 'fri', *review]))
    check('a day in draft shows its review boxes, what waits on Krish and its checklist, and nothing of its older publish page',
          tab.count('<textarea class="rv-text"') == 2 and 'data-state="draft"' in tab and 'in review, not ready to post' in tab
          and 'OpenAI tried to pick your AI' not in tab and 'class="card links"' not in tab and 'data-act="text"' not in tab
          and '<ol class="do"><li>Approve the outline</li><li>Pick the title</li></ol>' in tab
          and set(re.findall(r'data-tick="(fri-[^"]+)"', tab)) == {f'fri-{k}' for k, *_ in STEPS})
    check('a day in draft is draft in the manifest and the page, with its calls, and passes verify',
          [d['state'] for d in manifest['days']] == ['made', 'picked', 'draft'] and manifest['days'][2]['waiting'] == ['Approve the outline', 'Pick the title']
          and board_days(drafted)['days']['fri']['state'] == 'draft' and verify(drafted) == [])
    check('--keep-draft carries an unrelated live draft byte-for-byte, including review boxes and calls',
          friday(carried) == tab and carried_manifest['days'][2]['state'] == 'draft'
          and carried_manifest['days'][2]['waiting'] == ['Approve the outline', 'Pick the title']
          and verify(carried) == [] and 'piece id changed' in wrong_piece)
    check('--live: a piece in review whose publish page is older than its words is refused, naming --draft; a posted one keeps its page',
          'older than its words' in stale and '--draft fri' in stale and 'Monday' not in stale)
    check('a posted day says so in its status line, from the record: "nothing has been posted" never outlives the post',
          'posted on Substack 12 Oct; the ticks below show each channel' in mon_tab and 'nothing has been posted' not in mon_tab)
    check('--draft with --keep or --day for the same day is refused', 'never an older publish page' in with_keep and 'never an older publish page' in with_day)
    check('--draft with no words in review is refused', '--review fri' in no_words)
    check('--review on a day that is neither made nor in draft is refused, never dropped without a word',
          'would not show' in dropped and '--draft fri' in dropped)
    check('--waiting on a day not in draft is refused', 'only a day in draft' in calls_alone)
    check('a rebuild of a board holding a day in draft, without --draft, is refused; --keep of it is refused',
          'holds its words in review' in lost and 'no made friday tab' in kept_draft.lower())
    check('a rebuild keeps a review block\'s build time while its words are the same, so a newer save still shows; changed words get a new time',
          times(again) == times(drafted) and times(changed)['fri-deep-cut'] == times(drafted)['fri-deep-cut']
          and times(changed)['fri-article'] != times(drafted)['fri-article'])
    check('verify refuses a day in draft with no words to review',
          any('a day in review with no words to review' in p for p in verify(drafted.replace(tab, with_review(tab, ''), 1))))
    check('a day in draft says "in review, not ready to post" above its words, and each box has its own id for comments',
          tab.index('in review, not ready to post') < tab.index('<textarea') and 'id="rvs-fri-article"' in tab
          and tab.index('<textarea') < tab.index('Waiting on you'))
    check('the week\'s deep cut day says "deep cut" in its checklist, never "3-minute"',
          'Record the deep cut, 8 to 12 minutes' in checklist('fri', 'fri-', True) and 'YouTube: the deep cut' in checklist('fri', 'fri-', True)
          and '3-minute' not in checklist('fri', 'fri-', True) and '3-minute' in checklist('mon', 'mon-')
          and deep_cut_piece(date(2026, 10, 12)) == '904658db-4df2-4537-a0ed-ebe93e081db7')
    check('a rebuild of a day in draft that leaves out a review box is refused; --drop-review lets it go on purpose',
          'does not give it' in box_dropped and 'fri-deep-cut' in box_dropped and box_let_go.count('<textarea class="rv-text"') == 1)
    check('a rebuild of a day in draft that gives no calls carries them from the board being replaced',
          again_manifest['days'][2]['waiting'] == ['Approve the outline', 'Pick the title'])
    check('a publish page replaces a day in draft only when --live shows it was made after the words',
          'nothing shows this publish page was made from them' in to_made
          and [d['state'] for d in board_days(made_after)['days'].values()] == ['made', 'picked', 'made'])
    check('--draft on a posted day is refused: its tab keeps the page that went out', 'is posted' in posted_draft)
    check('--live fails closed when a kept day\'s making record cannot be read', 'could not be read' in unread and 'Monday' in unread)
    check('a manifest as --previous keeps each unchanged block\'s build time too', from_manifest == times(drafted))
    check('an engine time with no zone is read as UTC, so comparing it never crashes the build',
          parse_time('2026-10-15T15:18:20') == parse_time('2026-10-15T15:18:20Z') and parse_time('2026-10-15T15:18:20') > parse_time('2026-10-14T11:21:49.233Z'))


def parser():
    ap = argparse.ArgumentParser(description='The week\'s one publish board: three tabs and a tick for every step.')
    ap.add_argument('--week', help='the Monday the week starts on, YYYY-MM-DD')
    ap.add_argument('--day', action='append', metavar='DAY=PATH', help='a made day\'s publish page (publish_manager.py), DAY mon, wed or fri')
    ap.add_argument('--piece', action='append', metavar='DAY=UUID', help='the piece a day holds')
    ap.add_argument('--teleprompter', action='append', metavar='[DAY=]PATH', help='each cut\'s script in Teleprompter: a making record, or a small '
                    'JSON of ids ({folder_id, folder_name, cuts: {long: {script_id, title}}}), for a day, or under "pieces" by piece id')
    ap.add_argument('--options', metavar='PATH', help='a saved GET /api/week/options answer for the week')
    ap.add_argument('--live', action='store_true', help='read the week\'s picks and each piece\'s making record from the engine (GET only)')
    ap.add_argument('--pending', action='append', metavar='DAY=TITLE', help='a picked piece not made yet, named by hand')
    ap.add_argument('--previous', metavar='BOARD', help='the board this one replaces: its week-board.json, or its page as Artifact read saved it; '
                    'a day it held is never lost')
    ap.add_argument('--keep', action='append', metavar='DAY', help='with --previous (its page): carry a made day over exactly as the board holds it, '
                    'when its publish page cannot be read any more')
    ap.add_argument('--carry', action='append', metavar='DAY=PAGE:FROMDAY', help='carry a made or in-review day from another '
                    'week\'s board page to DAY of this week, ids, date and series moved with it (a piece that moved weeks)')
    ap.add_argument('--keep-draft', action='append', metavar='DAY', help='with --previous (its page): retain an unrelated draft day exactly as shown, '
                    'including its editable review boxes, while another day advances')
    ap.add_argument('--brief', action='append', metavar='DAY=JSON', help='the day\'s record-ready brief (boards from the fixed layout on): '
                    '{idea, flow: [3 to 6 beats], ending, takeaway, angle, tone, reader?, agreed?, agreed_at?}; kept on rebuild')
    ap.add_argument('--materials', action='append', metavar='DAY=JSON', help='finished downloads and channel copy, with an explicit readiness note; never changes the day state; preserved on rebuild')
    ap.add_argument('--unpick', action='append', metavar='DAY', help='with --previous: a day Krish moved or dropped, which really has no piece now')
    ap.add_argument('--review', action='append', metavar='DAY=LABEL|PATH', help='words for Krish to edit or comment on in that day\'s tab '
                    '(the article, each script); his saves land in the board\'s store as edits/<day>-<item>')
    ap.add_argument('--draft', action='append', metavar='DAY', help='with --review: a day whose words are in review; its tab is the '
                    'review card, what waits on Krish and its checklist, never an older publish page')
    ap.add_argument('--moved', action='append', metavar='DAY=YYYY-MM-DD', help='with --previous: the date Krish moved this day\'s piece to; the day leaves this board and links to its new day')
    ap.add_argument('--gate', action='append', metavar='DAY=URL', help='layout A: a cut the day waits on Krish\'s Gate 2 '
                    'verdict for; Today asks for it and the day\'s card opens it (an https link)')
    ap.add_argument('--waiting', action='append', metavar='DAY=WHAT', help='with --draft: one call waiting on Krish, in order, '
                    'listed in that day\'s tab')
    ap.add_argument('--drop-review', action='append', metavar='DAY=ID', help='with --draft: a review box the board being '
                    'replaced holds that this build leaves out on purpose (Krish is done with it)')
    ap.add_argument('--ideas', metavar='PATH', help='the week\'s checked ideas (docs/plans/<week>/ideas.json): a first tab, Ideas, '
                    'with at least three per day and a pick box for each')
    ap.add_argument('--queue', metavar='PATH', help='the saved answer of GET /api/idea-queue: the Ideas tab shows "From your queue" '
                    'first on each day the queued ideas fit; read it fresh at the start of the build, never from memory')
    ap.add_argument('--combine', metavar='PATH', help='the queued ideas worth combining (docs/plans/<week>/combine.json, from '
                    'GET /api/idea-queue?combine=1): [{"members": [queued ids], "series", "thesis", "joins": [3 to 5 beats]}]; '
                    'the Queue tab shows each with a Combine button (needs --queue)')
    ap.add_argument('--sweep', action='append', metavar='DAY=JSON', help='what edit_sweep.py carried from his saved edits '
                    '(boards from the fixed layout on): shown under the day\'s drafts as Also changed, each with Undo; kept on '
                    'a rebuild while the day\'s words are unchanged')
    ap.add_argument('--lessons', metavar='JSON', help='the saved answer of GET /api/video-studio/learning-proposals: the '
                    'proposals learned from his board edits (scope board_edit:*), shown under each day\'s drafts as What I '
                    'learned from your edits; each stays a proposal until he approves it')
    ap.add_argument('--titles', action='append', metavar='DAY=JSON', help='the title options for his Titles press on the day\'s Record step '
                    '(boards from the fixed layout on): {"piece_id"?, "long_title": [...], "short_title": [...], "long_thumbnail": [...], '
                    '"short_thumbnail": [...]}, 1 to 5 options a surface, best first; kept on rebuild')
    ap.add_argument('--publish-manifest', action='append', metavar='DAY=PATH', help='the piece\'s manifest: its sha256 rides on the '
                    'day\'s Approve for publish press; kept on rebuild')
    ap.add_argument('--offdays-plan', metavar='JSON', help='Growth\'s Sunday Off-days section (growth.py mix offdays, growth-offdays/1): '
                    '2 to 3 options a day, each with Approve and Skip; ideas.json offdays wins for a day it gives')
    ap.add_argument('--archive', metavar='JSON', help='the Archive (boards from layout v3 on): GET /api/board/<Monday>/archive as '
                    'board_feed.py archive writes it, every piece since the Launch with his scores')
    ap.add_argument('--verify', metavar='PAGE', help='say why this built board may not be published (the publish hook runs it); exit 1 if it may not')
    ap.add_argument('--show', metavar='BOARD', help='print the days a board holds: its week-board.json, or its page as Artifact read saved it')
    ap.add_argument('--json', action='store_true', help='with --show: as JSON')
    ap.add_argument('--out', default='week-board.html', help='the page; the manifest is written beside it as .json')
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--target', choices=['artifact', 'web'], default='web', help='web (content.krishraja.com) is the default and the only one that is published; artifact builds a legacy copy for comparison only (Claude artifacts are retired, Krish 2026-10-19)')
    return ap


def main(argv=None):
    ap = parser()
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if a.verify:
        why = verify(Path(a.verify).read_text(encoding='utf-8'))
        print('\n'.join(why) if why else 'the board may be published')
        return 1 if why else 0
    if a.show:
        try:
            info = board_days(Path(a.show).read_text(encoding='utf-8-sig'), a.show)
        except OSError as error:
            print(f'week board: cannot read {a.show}: {error.strerror}', file=sys.stderr)
            return 2
        except BoardError as error:
            print(f'week board: {error}', file=sys.stderr)
            return 2
        print(json.dumps(info, indent=2) if a.json else show_board(info))
        return 0
    if not a.week:
        ap.error('give --week, the Monday')
    try:
        page, manifest = build(a)
        out, side = write(page, manifest, a.out)
    except BoardError as error:
        print(f'week board: {error}', file=sys.stderr)
        return 2
    ids = re.findall(r'\sid="([^"]+)"', page)
    print(f'{out} ({manifest["bytes"]:,} bytes, {len(ids)} ids, none twice)')
    print(f'{side}')
    for d in manifest['days']:
        print(f'  {d["name"]:<9} {d["date"]}  {d["state"]:<10} {d["piece_id"] or ""}')
    for w in manifest['warnings']:
        print(f'  warning: {w}')
    return 0


if __name__ == '__main__':
    sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[1]))
    import quiet_errors  # G7: one line on failure, the traceback to .cache/logs
    sys.exit(quiet_errors.run(main, 'week_board'))
