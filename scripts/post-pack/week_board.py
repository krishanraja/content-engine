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
Weeks before keep the layout below, the one they were published in.

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
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import engine_stamp  # noqa: E402  the engine's stamp on a page it built
import publish_kit  # noqa: E402
import publish_manager  # noqa: E402
import board_materials  # noqa: E402

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
    return data


LAYOUT = load_layout()
LAYOUT_FROM = date.fromisoformat(LAYOUT['layout_from'])
FIXED = False  # whether the board being built is in the fixed layout; set by use_layout()
FEATURE_ONLY = set()
LEGACY_LAYOUT = {'STEPS': STEPS, 'SECTION_STEP': SECTION_STEP, 'CUTS': CUTS,
                 'DROPPED_CHANNELS': {'whatsapp': 'WhatsApp', 'notes': 'Substack Notes'}}


def fixed_layout(monday):
    return monday >= LAYOUT_FROM


def use_layout(monday):
    """Point the module's step and cut tables at the layout of this week: the fixed one from layout_from, else the
    one the week was published in. Every function below reads them, so one switch keeps a week in one layout."""
    global STEPS, LABEL, STANDING, SECTION_STEP, CUTS, FIXED, FEATURE_ONLY, DROPPED_CHANNELS
    FIXED = fixed_layout(monday)
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
    return {'css': css.group(1).strip(), 'post': attr(m.group(1), 'data-post') or '', 'body': body,
            'title': html.unescape(re.sub(r'<[^>]+>', '', h1.group(1))).strip() if h1 else '',
            'piece': piece if piece and UUID.match(piece) else None}


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


def read_lessons(data, where='--lessons'):
    """What the weekly compiler proposed from his board edits: GET /api/video-studio/learning-proposals's answer (only
    proposals whose scope.key starts board_edit:), or a list of {id, assertion, evidence_count, kind?, status?}.
    Each stays a proposal until he approves it (AGENTS.md: every durable taste rule needs his explicit approval)."""
    rows = data.get('proposals', data.get('lessons')) if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise BoardError(f'{where}: give the saved answer of GET /api/video-studio/learning-proposals, or a list of lessons')
    out = []
    for i, r in enumerate(rows):
        if not isinstance(r, dict):
            raise BoardError(f'{where}: lesson {i} is not an object')
        key = str((r.get('scope') or {}).get('key') or '') if isinstance(r.get('scope'), dict) else ''
        if 'scope' in r and not key.startswith('board_edit:'):
            continue  # another surface's proposal: it is ruled on where it came from
        kind = r.get('kind') or (key.split(':', 1)[1] if key.startswith('board_edit:') else None)
        lid, says = str(r.get('id') or ''), str(r.get('assertion') or '').strip()
        count = r.get('evidence_count', r.get('independent_session_count'))
        status = r.get('status') or 'proposed'
        if not LESSON_ID.match(lid) or not says or len(says) > 1600 or not isinstance(count, int) or count < 1:
            raise BoardError(f'{where}: lesson {i} needs an id, its assertion (at most 1600 characters) and how often it was seen')
        if kind not in EDIT_KINDS or status not in ('proposed', 'approved', 'rejected'):
            raise BoardError(f'{where}: lesson {lid} has kind {kind!r} or status {status!r} the board does not know')
        out.append({'id': lid, 'assertion': says, 'evidence_count': count, 'kind': kind, 'status': status})
    if len(out) > 12:
        raise BoardError(f'{where}: {len(out)} lessons; give the 12 newest at most')
    return out


def lessons_card(p, lessons):
    items = []
    for i, ls in enumerate(lessons, 1):
        chip = {'proposed': 'Proposed: yours to approve', 'approved': 'Approved: a standing rule', 'rejected': 'Not a rule'}[ls['status']]
        buttons = (f'<div class="btns"><button type="button" class="btn-s" data-act="lesson-yes" data-for="{E(ls["id"])}">Make it a rule</button>'
                   f'<button type="button" class="btn-s ghost" data-act="lesson-no" data-for="{E(ls["id"])}">Not a rule</button>'
                   f'<span class="ls-state" data-lesson-state="{E(ls["id"])}" aria-live="polite"></span></div>') if ls['status'] == 'proposed' else ''
        items.append(f'<article class="ls-item" id="{p}lesson-{i}" data-lesson="{E(ls["id"])}"><p class="ls-says">{E(ls["assertion"])}</p>'
                     f'<p class="ls-meta"><span class="chip{" ok" if ls["status"] == "approved" else ""}">{E(chip)}</span> '
                     f'{E(EDIT_KINDS[ls["kind"]])} edits, seen {ls["evidence_count"]} times in 28 days</p>{buttons}</article>')
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


def ideas_panel(monday, ideas, hidden, queue=None):
    """The Ideas tab, first: each day's ideas with a pick box. Krish,
    2026-10-18: "refresh This Week's Publish Board by adding a 4th tab at the
    front: Ideas. Cementing Ideas and basic narrative is Sunday's job." A pick
    is saved at once in the page's own store (picks/<day>) and posted as a
    comment ("PICK <day>"), which either of his accounts can read; a session
    writes it onto the pieces through /api/week/options."""
    head = f'<div class="kick">{E(week_span(monday))}</div><h1>Ideas</h1>'
    parts = [f'<div class="pm{" fixed" if FIXED else ""}" id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" data-day="ideas" data-state="ideas" '
             f'tabindex="-1"{" hidden" if hidden else ""}>'
             + (f'<div class="day-head">{head}</div>' if FIXED else head) +
             '<p class="id-how">Pick one idea for each day. Your pick is saved as soon as you tick it, and Claude starts '
             'that day\'s piece from it. Every fact here was checked against the source linked beside it. '
             'There are no titles yet: you choose those after you record.</p>']
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
                + (f'<dt>Where it came from</dt><dd>{E(idea["from"])}</dd>' if idea.get('from') else '') +
                '</dl>' + triage_row(pid) + '</article>')
        parts.append('</section>')
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


def not_made_panel(day, name, weekday, when, series_label, pick, hidden, draft=False, calls=(), deep=False):
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
    """When a step is due, from config/board-layout.json's rhythm: "Sun 25 Oct, night"."""
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


def drop_scripts_section(publish, p):
    """The publish page's Scripts section: in the fixed layout its cards are under Record, so they are said once."""
    publish = re.sub(rf'<section id="{re.escape(p)}scripts">.*?</section>', '', publish, flags=re.S)
    return re.sub(rf'<a href="#{re.escape(p)}scripts">[^<]*</a>', '', publish)


def ideas_waiting_panel(monday, hidden):
    sunday = monday - timedelta(days=1)
    return (f'<div class="pm fixed" id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" data-day="ideas" '
            f'data-state="ideas-waiting" tabindex="-1"{" hidden" if hidden else ""}>'
            f'<div class="day-head"><div class="kick">{E(week_span(monday))}</div><h1>Ideas</h1></div>'
            + slot_empty(f'This week\'s ideas arrive by {short_date(sunday)}: fresh ones from the ideas you drop in Control Center, '
                         'the Cold Ideas and Inspo folder and the engine\'s own research, with what you queued earlier first.')
            + '</div>')


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


def fixed_day(key, name, weekday, when, series_label, page, piece, pick, title, pending, draft, calls, review, materials,
              briefs, teleprompter, videos, ideas, hidden, panels, warnings, built_at, kept_at, sweeps=None, lessons=None):
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
    brief_due, drafts_due = due(when, LAYOUT['rhythm']['brief']), due(when, LAYOUT['rhythm']['drafts'])
    files = board_materials.render(key, delivery) if delivery else ''
    attrs = ' data-feature="true"' if feature else ''
    sweep = (sweeps or {}).get(key)
    if sweep and not (rv and (page or key in draft)):
        raise BoardError(f'--sweep {key}: {weekday} has no drafts in review, so where the change was carried would not show; '
                         f'give it with --draft {key} and --review')
    if sweep and sweep.get('piece_id') and piece and sweep['piece_id'] != piece:
        raise BoardError(f'--sweep {key}: the sweep is for piece {sweep["piece_id"]}, and {weekday} holds {piece}')
    # Below the drafts, in this order: where his change was carried, then what was learned from his edits.
    after = (sweep_card(p, sweep) if sweep else '') + (lessons_card(p, lessons) if lessons and rv else '')
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
            'record': parts['record'] + parts['scripts'],
            'publish': files + parts['videos'] + parts['checklist'] + parts['link_state'] + drop_scripts_section(parts['publish'], p) + SAVE_NOTE,
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
        plain = next((i['so_what'] for i in (ideas or {}).get(key, [])
                      if (piece and i.get('id') == piece) or (title and i['story'].strip() == str(title).strip())), None)
        said = plain or (pick or {}).get('plain') or title
        record = (record_card(key, p, tp, feature) if tp.get('cuts') else
                  slot_empty('The scripts go to Teleprompter once the drafts are signed off. How to record and send each take back is here then.'))
        if state == 'not_picked':
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


def board(monday, pages=None, pieces=None, teleprompter=None, picks=None, pending=None, kept=None, videos=None, review=None,
          draft=(), calls=None, posted=None, kept_at=None, ideas=None, queue=None, materials=None, briefs=None, combine=None,
          sweeps=None, lessons=None):
    """(page, manifest, warnings). ideas: {day: [idea]} from read_ideas(),
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
    pages, pieces, teleprompter, picks, pending, kept = pages or {}, pieces or {}, teleprompter or {}, picks or {}, pending or {}, kept or {}
    calls, posted = calls or {}, posted or {}
    deep_piece = None if FIXED else deep_cut_piece(monday)
    warnings, days, panels, tabs, blocks = [], [], [], [], []
    parsed = {k: parse_day_page(v, f'the {k} publish page') for k, v in pages.items()}
    order = [k for k, *_ in DAYS]
    opened = next((k for k in order if k in parsed or k in kept), None) or next((k for k in order if k in pieces or k in picks or k in pending), None)
    if not opened:
        opened = 'ideas' if ideas or FIXED else 'mon'
    if FIXED:
        # The fixed layout's first two tabs are always there: Ideas (waiting until Sunday's ideas come) and Queue.
        panels.append(ideas_panel(monday, ideas, opened != 'ideas', queue) if ideas else ideas_waiting_panel(monday, opened != 'ideas'))
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
        if key in kept and not page:
            if not piece:
                raise BoardError(f'{weekday} is kept from the previous board but has no piece id: give --piece {key}=<uuid>')
            state = 'made'
            if FIXED and not kept[key].startswith('<div class="pm fixed"'):
                raise BoardError(f'--keep {key}: that tab is in the old layout; rebuild {weekday} with --day {key}=<its publish page> '
                                 'so it takes the fixed layout')
            panel = re.sub(r'^(<div class="pm(?: fixed)?"[^>]*?)( hidden)?>', lambda m: m.group(1) + (' hidden' if key != opened else '') + '>', kept[key], count=1)
            card = videos_card(key, f'{key}-', (videos or {}).get(key), bool(piece) and piece == deep_piece)
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
                              sweeps, lessons)
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
                                         state == 'draft', calls.get(key) or (), bool(piece) and piece == deep_piece))
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
            f'<span class="t-day">{short_date(when)}</span><span class="t-dot"> · </span>'
            f'<span class="t-prog" data-tabprog="{key}">{f"{STANDING} steps" if picked else "not picked"}</span>'
            f'<span class="t-ch">{series_label}</span></button>')
        days.append({
            'day': key, 'name': weekday, 'date': when.isoformat(), 'series': slug, 'series_label': series_label,
            'state': state, 'piece_id': piece or None, 'title': title or None,
            'teleprompter': teleprompter.get(key) or None,
            'waiting': list(calls.get(key) or []) or None,
            'tick_ids': [f'{key}-{k}' for k, *_ in STEPS] if picked else [],
        })
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
        conf['layout'] = LAYOUT['version']
        conf['briefs'] = briefs
        conf['sweeps'] = sweeps  # carried on a rebuild while the words they changed stand (build(), previous_sweeps)
        if lessons and not any((review or {}).get(k) for k in order):
            warnings.append('--lessons: no day has drafts on the board, so What I learned from your edits shows nowhere')
    # The fixed layout has one stylesheet: publish_manager's, never a day page's own copy of it.
    css = publish_manager.CSS.strip() if FIXED else '\n'.join(blocks or [publish_manager.CSS.strip()])
    page = fill(template('page.html'), {
        'TITLE': html.escape(board_title(monday), quote=False),
        'BASE_CSS': css, 'WEEK_CSS': template('week.css').strip(), 'KICKER': E(week_span(monday)),
        'TABLIST_LABEL': E(f'Publishing days, week of {monday.day} {monday.strftime("%B")}'),
        'TABS': ''.join(tabs), 'ASIDE': aside, 'PANELS': ''.join(panels), 'SCRIPT': script(conf),
        'WK_CLASS': ' fixed' if FIXED else '', 'MAIN_ATTRS': f' data-layout="{LAYOUT["version"]}"' if FIXED else '',
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
            'picks': {'doc_id': '<day>', 'fields': ['pick', 'idea_id', 'series', 'story', 'day', 'at']},
            'queue': {'doc_id': '<pick>', 'fields': ['pick', 'queued', 'verdict', 'reason', 'angle', 'so_what', 'story', 'idea_id', 'series', 'week', 'at'],
                      'combine': {'doc_id': 'combine-<n>', 'fields': ['combine', 'members', 'pick', 'at'],
                                  'then': 'POST /api/content-ideas/synthesize with the members, decided_by Krish'}},
        },
        'combine': [{'id': g['id'], 'members': g['members'], 'series': g['series'], 'thesis': g['thesis']} for g in combine or []],
        'queue': [{'id': q.get('id'), 'so_what': q.get('so_what'), 'series': q.get('series'), 'triage': (q.get('triage') or {}).get('verdict')}
                  for q in (queue or [])],
        'ideas': {k: [{'pick': i['pick'], 'idea_id': i.get('id'), 'his': bool(i.get('his') or i.get('source_kind') == 'his'), 'so_what': i['so_what'], 'story': i['story'],
                       'why_now': i['why_now'], 'fact': i['fact'], 'source': i['source'], 'source_kind': i.get('source_kind'),
                       'why_here': i.get('why_here'), 'beats': i.get('beats') or []} for i in v]
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
        manifest['layout'] = LAYOUT['version']
        manifest['briefs'] = briefs
        manifest['sweeps'] = sweeps
        manifest['lessons'] = [{'id': ls['id'], 'kind': ls['kind'], 'status': ls['status']} for ls in lessons or []]
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
    dangling = sorted({x for r in refs for x in r.split() if x not in seen})
    if dangling:
        problems.append(f'references to no id: {dangling[:8]}')
    keys = {k for k, *_ in STEPS}
    for tid in set(re.findall(r'data-tick="([^"]+)"', page)):
        day, _, step = tid.partition('-')
        if day not in {k for k, *_ in DAYS} or step not in keys:
            problems.append(f'a tick for no step: {tid}')
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
            checked = [c for c in cards if 'data-pick="' in c and re.search(r'<dt>Source</dt><dd><a href="https://', c)
                       and '<dt>Strongest checked fact</dt><dd>' in c and 'class="id-sowhat"' in c and 'data-triage="story"' in c
                       and 'data-queue-mark="' in c and (not fixed or 'data-source-kind="' in c)]
            if len(checked) < MIN_IDEAS:
                out.append(f'ideas: {weekday} has {len(checked)} checked idea(s) with a pick box; it needs {MIN_IDEAS}, each with what a business person finds out, a pick box, the triage buttons and a Queue mark'
                           + (', and where it came from' if fixed else ''))
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
    tabs = re.findall(r'<button type="button" role="tab" id="tab-([a-z]+)"', page)
    if tuple(tabs) != TOP_TABS:
        out.append(f'layout: the tabs are {tabs}, not {list(TOP_TABS)}')
    panels = re.findall(r'<div class="(pm[^"]*)" id="panel-([a-z]+)"', page)
    if tuple(n for _, n in panels) != TOP_TABS:
        out.append(f'layout: the tab panels are {[n for _, n in panels]}, not {list(TOP_TABS)}')
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
    for key in sorted(draft & (set(pages) | set(kept))):
        raise BoardError(f'--draft {key} with --day or --keep {key}: a day in review shows its review card, never an older publish page')
    scripts, unmade, videos, posted, fresh = {}, [], {}, {}, set()
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
                made_at = (making_rec.get('publish_manager') or {})
                url = made_at.get('url') if isinstance(made_at, dict) else None
                is_posted = isinstance(answer, dict) and answer.get('state') == 'published'
                if is_posted:
                    sub = ((making_rec.get('channels') or {}).get('substack') or {})
                    if isinstance(sub, dict) and sub.get('posted_at'):
                        posted[key] = sub['posted_at']
                if isinstance(url, str) and url.strip() and key not in pages and key not in kept and key not in draft:
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
    for key in sorted(set(calls) - draft):
        raise BoardError(f'--waiting {key}: only a day in draft shows what waits on Krish; give --draft {key}')
    kept_at = previous_review_times(Path(args.previous).read_text(encoding='utf-8-sig'), review) if args.previous else {}
    ideas = read_ideas(read_json(args.ideas, '--ideas'), monday) if getattr(args, 'ideas', None) else None
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
    page, manifest, more = board(monday, pages, pieces, scripts, picks, pending, kept, videos, review, draft, calls, posted, kept_at,
                                 ideas, queue, materials, briefs, combine, sweeps, lessons)
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


def stand_in(tmp, name, title, kicker):
    """A small publish page, made by publish_manager.py itself."""
    import base64
    d = Path(tmp) / name
    d.mkdir()
    (d / 'a.png').write_bytes(base64.b64decode(PNG))
    (d / 'body.md').write_text(f'{title}\n\n## THE PART\n\nA **bold** fact.\n', encoding='utf-8')
    (d / 'words.json').write_text(json.dumps({'title': title, 'youtube_title': title, 'short_caption': 'C',
                                              'linkedin_post': 'L {ARTICLE_URL}'}), encoding='utf-8')
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
    check('a kept day drawn before section ticks (no sec-head) loses the dropped channels too',
          'notes' not in drop_channels('<section id="wed-s8"><h2>8. Substack Notes</h2><p>x</p></section>', 'wed').lower())
    check('finished videos: each cut offers its thumbnail, and one not linked yet says where it is',
          'download?id=1dK3QdzIkQi-SO1JsR9_SR2LdYoxGZnSQ' in tcard and 'Download thumbnail' in tcard and 'x - tall.jpg' in tcard)
    _draft_checks(check, page, fri)
    _ideas_checks(check)
    _fixed_checks(check, mon)
    _sources_checks(check)
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
    check('fixed layout: the manifest says the layout and carries the briefs', manifest.get('layout') == LAYOUT['version'] and 'fri' in manifest['briefs'])
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
    stale = {'wed': dict(read_brief(brief), piece_id=FRI_ID)}
    moved, _, moved_warnings = board(week, pieces={'wed': WED_ID}, briefs=stale)
    check('fixed layout: a brief carried from the old board for another piece never shows under the new pick',
          'id="wed-brief-card"' not in moved and any('dropped' in w for w in moved_warnings))
    _editor_checks(check, week)
    use_layout(date(2026, 10, 12))
    check('the old layout comes back for an old week: its labels as they were published',
          LABEL['record-long'] == 'Record the 3-minute cut (Teleprompter)' and 'record-feature' not in LABEL)


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
    ap.add_argument('--brief', action='append', metavar='DAY=JSON', help='the day\'s record-ready brief (boards from the fixed layout on): '
                    '{idea, flow: [3 to 6 beats], ending, takeaway, angle, tone, reader?, agreed?, agreed_at?}; kept on rebuild')
    ap.add_argument('--materials', action='append', metavar='DAY=JSON', help='finished downloads and channel copy, with an explicit readiness note; never changes the day state; preserved on rebuild')
    ap.add_argument('--unpick', action='append', metavar='DAY', help='with --previous: a day Krish moved or dropped, which really has no piece now')
    ap.add_argument('--review', action='append', metavar='DAY=LABEL|PATH', help='words for Krish to edit or comment on in that day\'s tab '
                    '(the article, each script); his saves land in the board\'s store as edits/<day>-<item>')
    ap.add_argument('--draft', action='append', metavar='DAY', help='with --review: a day whose words are in review; its tab is the '
                    'review card, what waits on Krish and its checklist, never an older publish page')
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
