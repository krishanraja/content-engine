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
youtube, shorts, tiktok, reels, linkedin, whatsapp or notes. These are the
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
import publish_kit  # noqa: E402
import publish_manager  # noqa: E402

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
    ('whatsapp', 'WhatsApp', 'whatsapp', False),
    ('notes', 'Substack Notes', 'notes', False),
)
LABEL = {k: label for k, label, *_ in STEPS}
STANDING = sum(1 for *_, s in STEPS if s)
# A channel section of the day page, by its heading (publish_kit.steps "where"), and the step it ticks.
SECTION_STEP = {
    'Substack': 'substack', 'YouTube (the 3-minute video)': 'youtube', 'YouTube Shorts': 'shorts',
    'TikTok': 'tiktok', 'Instagram Reels': 'reels', 'LinkedIn': 'linkedin', 'WhatsApp': 'whatsapp',
    'Substack Notes': 'notes',
}
# The two cuts (house rule TWO_CUTS): the cut, its tick, its name, how it is filmed.
CUTS = (
    ('long', 'record-long', '3-minute cut', 'Wide shot, 16:9'),
    ('short', 'record-short', '90-second cut', 'Sit in the centre, cut tall 9:16'),
)
# What the day page's buttons do; the board's script handles these and only these.
KNOWN_ACTS = {'text', 'article', 'image', 'download', 'done'}

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


def row_tick(day, key):
    return (f'<label class="tick row-tick">{tick_box(f"{day}-{key}", LABEL[key])}'
            f'<span class="t-label">{E(LABEL[key])}</span>{TICK_TAIL}</label>')


def section_tick(day, key):
    return (f'<label class="tick sec-tick">{tick_box(f"{day}-{key}", LABEL[key])}'
            f'<span class="t-hint">Tick when done</span>{TICK_TAIL}</label>')


def checklist(day, p):
    standing = ''.join(row_tick(day, k) for k, _, _, s in STEPS if s)
    optional = ''.join(row_tick(day, k) for k, _, _, s in STEPS if not s)
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
VIDEO_CUTS = (('long', '3-minute video (wide, 16:9)', 'YouTube and the Substack video post'),
              ('short', '90-second video (tall, 9:16)', 'Shorts, Reels, TikTok and LinkedIn'))


def videos_card(day, p, videos):
    """The finished videos at the top of a made day: each cut's Drive file,
    to open, to download straight to the computer, and its link to copy.
    Krish, 2026-10-14: "You should always link the Google Drive videos
    because I need to actually download them onto my computer and then
    upload them into Substack or YouTube". videos: the making record's
    video_assets; a video's "url" is its Drive link once it is in Drive."""
    by_cut = {}
    for v in videos or []:
        if isinstance(v, dict) and v.get('cut') in ('long', 'short'):
            by_cut[v['cut']] = v
    if not by_cut:
        return ''
    rows = []
    for cut, label, where in VIDEO_CUTS:
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
        rows.append(f'<div class="rec-row vid-row"><span class="rec-cut"><span class="rec-name">{E(label)}</span>'
                    f'<span class="rec-shape">For {E(where)}{". " + E(length) if length else ""}</span></span>'
                    f'<div class="rec-links">{links}</div></div>')
    return (f'<div class="rec" id="{p}videos" role="region" aria-labelledby="{p}videos-h"><div class="rec-head">'
            f'<h2 id="{p}videos-h">Finished videos</h2><span class="kick">In Drive, 3 Video</span></div>'
            + ''.join(rows) + '<p class="rec-how">Download each to your computer, then upload it where its line says.</p></div>')


def record_card(day, p, scripts):
    """The Record card: each cut's script in Teleprompter (its title, and
    whether it holds the current words), the folder, and the one way a take
    comes back. scripts is teleprompter_info's answer, or {}."""
    rows, any_script = [], False
    cuts = scripts.get('cuts') or {}
    for cut, key, name, shape in CUTS:
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
               + ', and read each cut from its own script. The 3-minute cut is a wide shot; for the 90-second cut sit in the centre, '
               'as it is cut tall. ' + back)
    else:
        how = ('These scripts are not in Teleprompter yet. Copy one just below into your teleprompter and record. The 3-minute cut is '
               'a wide shot; for the 90-second cut sit in the centre, as it is cut tall. ' + back)
    return (f'<div class="rec" id="{p}record" role="region" aria-labelledby="{p}record-h"><div class="rec-head">'
            f'<h2 id="{p}record-h">Record</h2><span class="kick">Two cuts</span></div>'
            + ''.join(rows) + f'<p class="rec-how">{E(how)}</p></div>')


def made_panel(page, day, name, p, links, hidden, warnings, videos=None):
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
        key = SECTION_STEP.get(where)
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
    extra = videos_card(day, p, videos) + record_card(day, p, links) + scripts + checklist(day, p)
    if links_line not in page['body']:
        extra += '<p class="files"><span class="link-state" data-linkstate></span></p>'
    body = body.replace(anchor, extra + anchor, 1)
    body += ('<p class="save-note">Each tick saves here at once. Claude copies them onto the piece&#x27;s record in the engine, '
             'which updates the board and Control Center.</p>')
    return (f'<div class="pm" id="panel-{name}" role="tabpanel" aria-labelledby="tab-{name}" data-prefix="{p}" '
            f'data-day="{day}" data-state="made" data-post="{E(page["post"])}" tabindex="-1"{" hidden" if hidden else ""}>'
            + body + '</div>')


def not_made_panel(day, name, weekday, when, series_label, pick, hidden):
    p = f'{day}-'
    if pick:
        title = pick.get('title') or f'{weekday}\'s piece'
        values = {
            'STATE': 'picked', 'KICK': E(f'{series_label} · {when} · picked, not made yet'), 'HEADING': E(title),
            'LINE': E(f'Picked for {weekday} and not made yet. Its publish board appears in this tab once it is made: '
                      'press Make it in Claude Code on the week page when you are ready.'),
            'CHECKLIST': checklist(day, p),
        }
    else:
        values = {
            'STATE': 'not_picked', 'KICK': E(f'{series_label} · {when} · not picked'), 'HEADING': E(weekday),
            'LINE': E(f'{weekday}\'s {series_label} piece is not picked yet. Pick it on the week page and it will be made here.'),
            'CHECKLIST': '',
        }
    values.update({'DAYNAME': name, 'DAY': day, 'PREFIX': p, 'HIDDEN': ' hidden' if hidden else ''})
    return fill(template('not-made.html'), values, 'not-made.html')


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
        if re.search(rf'<div class="pm" id="panel-[a-z]+"[^>]*\sdata-prefix="{key}-"', text):
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
    start = text.find(f'<div class="pm" id="panel-{name}"')
    if start < 0 or f'data-prefix="{key}-"' not in text[start:start + 400]:
        raise BoardError(f'--keep {key}: the previous board has no made {name} tab to keep')
    panel = div_at(text, start)
    while True:
        m = re.search(r'<div class="stage[ "]', panel)
        if not m:
            break
        panel = panel.replace(div_at(panel, m.start()), '', 1)
    return panel


def keep_previous(previous, days, unpick, monday):
    """Refusals for a rebuild that would lose a day the board it replaces
    held: a made or picked day now not picked, or a made day now without
    its publish page. unpick: the days Krish moved or dropped."""
    if previous.get('week') and previous['week'] != monday.isoformat():
        raise BoardError(f'--previous is the board of the week of {previous["week"]}, not {monday.isoformat()}; '
                         'a new week gets a new board')
    problems = []
    for d in days:
        was = previous['days'].get(d['day']) or {}
        if was.get('state') not in ('made', 'picked') or d['day'] in unpick:
            continue
        held = was.get('piece_id')
        if d['state'] == 'not_picked':
            problems.append(f'{d["name"]}: the board being replaced holds piece {held or "(unnamed)"} ({was["state"]}), and this build has no '
                            f'piece for it. A piece posted on Substack is published, and an engine from before the week options\' '
                            f'"scheduled" list leaves it out: give --piece {d["day"]}={held}'
                            + (f' and --day {d["day"]}=<its publish page>' if was['state'] == 'made' else '')
                            + f'. Only if Krish moved or dropped it, give --unpick {d["day"]}')
        elif was['state'] == 'made' and d['state'] != 'made' and (not held or d['piece_id'] == held):
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

def board(monday, pages=None, pieces=None, teleprompter=None, picks=None, pending=None, kept=None, videos=None):
    """(page, manifest, warnings). pages: {day: publish page text};
    pieces: {day: uuid}; teleprompter: {day: teleprompter_info}; picks:
    {day: {'id', 'title'}} from the week options; pending: {day: title}."""
    pages, pieces, teleprompter, picks, pending, kept = pages or {}, pieces or {}, teleprompter or {}, picks or {}, pending or {}, kept or {}
    warnings, days, panels, tabs, blocks = [], [], [], [], []
    parsed = {k: parse_day_page(v, f'the {k} publish page') for k, v in pages.items()}
    order = [k for k, *_ in DAYS]
    opened = next((k for k in order if k in parsed or k in kept), None) or next((k for k in order if k in pieces or k in picks or k in pending), 'mon')
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
            panel = re.sub(r'^(<div class="pm"[^>]*?)( hidden)?>', lambda m: m.group(1) + (' hidden' if key != opened else '') + '>', kept[key], count=1)
            card = videos_card(key, f'{key}-', (videos or {}).get(key))
            if card:
                # The kept day's finished videos come from the record, as every other day's do.
                at = panel.find(f'<div class="rec" id="{key}-videos"')
                if at >= 0:
                    panel = panel.replace(div_at(panel, at), card, 1)
                elif '<div class="rec"' in panel:
                    panel = panel.replace('<div class="rec"', card + '<div class="rec"', 1)
            panels.append(panel)
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
                                     (videos or {}).get(key)))
        else:
            state = 'picked' if (piece or key in pending or pick) else 'not_picked'
            panels.append(not_made_panel(key, name, weekday, short_date(when), series_label,
                                         {'title': title} if state == 'picked' else None, key != opened))
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
    }
    css = '\n'.join(blocks or [publish_manager.CSS.strip()])
    page = fill(template('page.html'), {
        'BASE_CSS': css, 'WEEK_CSS': template('week.css').strip(), 'KICKER': E(week_span(monday)),
        'TABLIST_LABEL': E(f'Publishing days, week of {monday.day} {monday.strftime("%B")}'),
        'TABS': ''.join(tabs), 'ASIDE': aside, 'PANELS': ''.join(panels), 'SCRIPT': script(conf),
    }, 'page.html')
    problems = check_page(page)
    if problems:
        raise BoardError('the board failed its own checks:\n  ' + '\n  '.join(problems))
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
        'kind': 'week_board', 'version': 1, 'title': TITLE,
        'week_start': monday.isoformat(), 'week_end': (monday + timedelta(days=4)).isoformat(),
        'built_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'bytes': size, 'sha256': hashlib.sha256(page.encode('utf-8')).hexdigest(),
        'days': days,
        'made': [d['day'] for d in days if d['state'] == 'made'],
        'picked': [d['day'] for d in days if d['state'] != 'not_picked'],
        'db': {
            'ticks': {'doc_id': '<day>-<step>', 'fields': ['done', 'at', 'day', 'piece_id', 'step', 'channel', 'label']},
            'links': {'doc_id': '<day>', 'fields': ['article', 'youtube', 'at']},
        },
        'steps': [{'key': k, 'label': label, 'channel': c, 'standing': s,
                   'records_with': f'making.py <piece> posted {c} [url]' if c else None,
                   'note': None if c else 'Record is done from the takes on the record, never from a tick'}
                  for k, label, c, s in STEPS],
        'publish': {'title': TITLE, 'icon': 'calendar', 'capabilities': {'db': {}, 'downloads': True},
                    'description': f'The week of {week_span(monday)}: Monday, Wednesday and Friday, with a tick for every step.'},
        'warnings': warnings,
    }
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
    scripts, unmade, videos = {}, [], {}
    for key, _, weekday, *_ in DAYS:
        # The same order as board(): --piece, then the publish page's own, then the week's pick.
        piece = pieces.get(key) or (parse_day_page(pages[key], f'the {key} publish page')['piece'] if key in pages else None) \
            or (picks.get(key) or {}).get('id')
        found = {}
        if get and piece:
            try:
                answer = get(f'/api/content-ideas/{piece}/making')
            except BoardError as error:
                answer = None
                warnings.append(f'{weekday}: its making record could not be read ({error}); no Teleprompter scripts from it')
            if answer is not None:
                found = teleprompter_info(answer, piece, warnings, f'{weekday}\'s making record')
                making_rec = ((answer.get('making') or {}) if isinstance(answer, dict) else {})
                if isinstance(making_rec.get('video_assets'), list):
                    videos[key] = making_rec['video_assets']
                made_at = (making_rec.get('publish_manager') or {})
                url = made_at.get('url') if isinstance(made_at, dict) else None
                if isinstance(url, str) and url.strip() and key not in pages and key not in kept:
                    unmade.append(f'{weekday}: piece {piece} has its publish page ({url.strip()}); Artifact read it and give '
                                  f'--day {key}=<the saved file>, or its tab loses every Copy card')
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
    page, manifest, more = board(monday, pages, pieces, scripts, picks, pending, kept, videos)
    if previous is not None:
        keep_previous(previous, manifest['days'], unpick, monday)
    manifest['warnings'] = warnings + more
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
    want = {f'{d}-{k}' for d in ('mon', 'wed', 'fri') for k, *_ in STEPS}
    check('tick ids: every picked day has its ten, <day>-<step>, the published board\'s', set(re.findall(r'data-tick="([^"]+)"', page)) == want)
    standing = [k for k, *_, s in STEPS if s]
    check('seven steps make 100%: the two cuts and the standing five', standing == ['record-long', 'record-short', 'substack', 'youtube', 'shorts', 'tiktok', 'reels'])
    check('a made day ticks in three places: checklist, Record card and each channel heading',
          page.count('data-tick="mon-record-long"') == 2 and page.count('data-tick="mon-substack"') == 2
          and page.count('data-tick="mon-notes"') == 2 and page.count('data-tick="wed-substack"') == 1)
    check('the old Mark done buttons are gone', 'Mark done' not in page and 'data-act="done"' not in page)
    js = script({'week': '2026-10-12', 'days': [], 'steps': []})
    check('db wiring: ticks/<day>-<step> and links/<day> in the page\'s own store',
          'db.collection("ticks").doc(id).set(body)' in js and 'db.collection("ticks").onSnapshot(' in js
          and 'db.doc("links/" + day).set(body)' in js and 'db.doc("links/" + day).onSnapshot(' in js
          and 'window.claude.use("db")' in js and 'window.claude.use("downloads")' in js)
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
          "<title>This Week's Publish Board</title>" in page and '<div class="kick">12 to 16 October 2026</div>' in page
          and 'Mon 12 Oct' in page and 'Wed 14 Oct' in page and 'Fri 16 Oct' in page)
    check('kicker across a month and a year',
          week_span(date(2026, 9, 28)) == '28 September to 2 October 2026' and week_span(date(2025, 12, 29)) == '29 December 2025 to 2 January 2026')
    check('the manifest: week, days, piece ids, which tabs are made, the publish call',
          written['week_start'] == '2026-10-12' and written['made'] == ['mon', 'fri'] and written['picked'] == ['mon', 'wed', 'fri']
          and [d['piece_id'] for d in written['days']] == [MON_ID, WED_ID, FRI_ID]
          and [d['state'] for d in written['days']] == ['made', 'picked', 'made']
          and written['days'][0]['tick_ids'][0] == 'mon-record-long' and len(written['days'][1]['tick_ids']) == 10
          and written['publish']['capabilities'] == {'db': {}, 'downloads': True} and written['publish']['icon'] == 'calendar'
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
    if fails:
        print('week board self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'week board self-test passed: {len(checks)} checks')
    return 0


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
    ap.add_argument('--unpick', action='append', metavar='DAY', help='with --previous: a day Krish moved or dropped, which really has no piece now')
    ap.add_argument('--show', metavar='BOARD', help='print the days a board holds: its week-board.json, or its page as Artifact read saved it')
    ap.add_argument('--json', action='store_true', help='with --show: as JSON')
    ap.add_argument('--out', default='week-board.html', help='the page; the manifest is written beside it as .json')
    ap.add_argument('--self-test', action='store_true')
    return ap


def main(argv=None):
    ap = parser()
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
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
    sys.exit(main())
