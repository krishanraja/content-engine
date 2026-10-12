#!/usr/bin/env python3
"""descript_send: every checked script into Krish's Descript drive, and the
record of where it went.

Krish, 2026-10-12: "Descript is now my tool of choice for video script
readouts on my phone - scripts should automatically be sent there, with the
ability for Descript to put the video in the correct place when recorded."
He records in Descript: "I can use the descript web app, otherwise my laptop
to record". His standing yes to the send, asked "May every checked script go
to that account automatically? One view-access project per cut, in a
Mindmake scripts folder, about 5 media minutes a piece; nothing published,
edited or deleted, no AI credits": "3. yes", then "go, upload". Of the
teleprompter: "2 fine, no issue with copy paste". All of it, and the drive,
is in config/descript.json; nothing is sent or recorded unless its status
is "confirmed".

One project per piece and cut, in "Mindmake scripts/<pack folder>", with
two compositions:

  Script       the pages video he reads on his phone: a title card, then
               pages of about 30 words broken at sentence ends (never across
               a paragraph), each on screen for its words at 150 a minute,
               1080 x 1920. The words are the script's, exactly: the pages
               are joined back and compared before anything is drawn, and
               each page's drawn lines are compared with the page.
  Record here  a 1-second slate, 1920 x 1080 for both cuts: he records on a
               laptop camera, and the 90-second cut is cropped tall later,
               so its slate says to sit in the centre. He records into this
               one, pasting the script into Descript's teleprompter.

    python descript_send.py render SCRIPT --cut long|short --title TITLE --out OUT.mp4
    python descript_send.py slate --cut long|short --day "Mon 12 Oct" --title TITLE --out OUT.mp4
    python descript_send.py plan PIECE post.json long.md short.md [--work DIR] [--new-project] [--json]
    python descript_send.py record PIECE CUT --drive ID --project ID --script-composition ID
                   --record-composition ID --media NAME --known-media NAME [NAME ...] --sha SHA256
                   [--links SCRIPT_URL RECORD_URL] [--sent-at TIME]
    python descript_send.py record PIECE CUT --drive ID [--project ID] --error "what Descript said"
    python descript_send.py pending [--week YYYY-MM-DD] [--retry] [--json]
    python descript_send.py --self-test

`plan` sends nothing. It reads the piece's making record from the engine,
refuses unless the scripts' check passed and each file holds the words it
passed (making.script_hash), renders what each cut needs into --work
(.cache/descript/<piece>), and prints the Descript calls to make, in order,
with the exact import_media arguments: get_drive_info, import_media, a curl
PUT for each file, wait_for_job, get_project, then the `record` line. A cut
whose words Descript already holds needs no call. A cut never sent gets a
new project with both compositions. A cut whose words changed gets the new
pages video and a new Script composition in its own project, so the Record
here composition, and every take in it, stays where it is; the record's
Script link then opens the new words. Media names are unique in a project
(the time and the hash's first seven characters, then a number if taken).
Nothing is ever deleted, published or edited. --new-project makes a new
project for a cut whose project is gone from his drive.

A send that fails is recorded with what Descript said and when (`record
--error`), with --project when import_media had already made the project:
the next plan finishes that project (both compositions, their names
carrying the send time) and never makes a second one, since Krish's yes was
one project per cut. `pending` holds back a cut whose last send failed for
want of media minutes (402), or failed less than six hours ago, until its
words change or a session runs it with --retry (Krish's go). A cut that
WORKBENCH.md shows was sent by hand (a `making.py ... descript CUT
--project ...` line) and that the record does not hold yet gets that line,
never a plan line: recorded first, so no second project is made.

The calls are made by the Claude Code session that holds the Descript
connector (make-piece, the Scripts step), never by this file: it holds no
Descript key. `record` writes what was made onto the piece's making record
(making.descript_patch; making.py descript is the same), and refuses a drive
other than the config's. `pending` lists the pieces in flight this week and
next whose current words are not in Descript yet, with the plan line for
each. The Descript state never holds a step back: Copy on the publish page
always works, and recording is never blocked.
"""
import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
for _path in (HERE, HERE.parent):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))
import making  # noqa: E402  script_hash, the record, descript_patch
import library  # noqa: E402  post_folder: the pack folder's name

CONFIG = REPO / 'config' / 'descript.json'
WORK = REPO / '.cache' / 'descript'
PLANS = REPO / 'docs' / 'plans'
CUTS = making.CUTS
PY = 'python' if os.name == 'nt' else 'python3'
SELF = 'scripts/post-pack/descript_send.py'

# The house colours of the hand-made send Krish read on 12 October.
INK, CREAM, MINT, MUTED = (12, 21, 18), (244, 239, 228), (126, 240, 192), (150, 170, 160)
INTER = REPO / 'node_modules' / '@fontsource' / 'inter' / 'files'
BODY_FONTS = (INTER / 'inter-latin-600-normal.woff2', INTER / 'inter-latin-600-normal.woff')
HEAD_FONT = HERE.parent / 'quick-edit' / 'fonts' / 'ArchivoBlack-Regular.ttf'
DAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
# A sentence ends at . ! or ?, or one of them inside a closing quote or bracket.
SENTENCE_END = re.compile(r'(?<=[.!?])\s+|(?<=[.!?]["\u201d\u2019)])\s+')
SLACK = 0.05  # how far a rendered video's length may be from its planned length
COOL_OFF = timedelta(hours=6)  # a failed send is not tried again sooner, unless its words changed or --retry
NO_MINUTES = re.compile(r'\b402\b|media minutes', re.I)
WORKBENCH = REPO / 'WORKBENCH.md'
# A send made by hand, as WORKBENCH.md keeps its record line (12 October's four).
HAND_LINE = re.compile(r'(python3? \S*making\.py\b.*?\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+descript\s+'
                       r'(long|short)\b.*?--project\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*)$')


class DescriptError(making.MakingError):
    """A reason to stop, in words a person can act on."""


# ---------------------------------------------------------------- the config

def load_config(path=CONFIG):
    """config/descript.json, refused unless Krish confirmed it: status
    "confirmed", a drive id, view access, and the page settings."""
    try:
        cfg = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise DescriptError(f'{Path(path).name} cannot be read ({error}), so nothing goes to Descript')
    if not isinstance(cfg, dict) or cfg.get('status') != 'confirmed':
        raise DescriptError(f'{Path(path).name} is not confirmed by Krish (its status is not "confirmed"), so nothing goes to Descript')
    if not making.UUID.match(str(cfg.get('drive_id') or '')) or cfg['drive_id'] != cfg['drive_id'].lower():
        raise DescriptError(f'{Path(path).name} has no drive_id (the uuid get_drive_info gives, in lower case)')
    if cfg.get('team_access') != 'view':
        raise DescriptError(f'Krish allowed view-access projects only; {Path(path).name} says team_access "{cfg.get("team_access")}"')
    for key in ('drive_name', 'folder_root', 'words_per_minute', 'page', 'record_here', 'cuts'):
        if not cfg.get(key):
            raise DescriptError(f'{Path(path).name} has no {key}')
    for cut in CUTS:
        if not isinstance(cfg['cuts'].get(cut), dict) or not cfg['cuts'][cut].get('name'):
            raise DescriptError(f'{Path(path).name} has no cuts.{cut}')
    return cfg


def check_drive(cfg, drive):
    """The drive id get_drive_info gave must be the config's: Krish's drive,
    the only one his yes covers."""
    given = str(drive or '').strip().lower()
    if not given:
        raise DescriptError(f'--drive is the id get_drive_info gave; it is checked against {cfg["drive_name"]} before anything is recorded')
    if given != cfg['drive_id']:
        raise DescriptError(f'the Descript drive this session reaches ({drive}) is not Krish\'s ({cfg["drive_name"]}, {cfg["drive_id"]}): '
                            'nothing is sent or recorded; connect the Descript connector to his drive')
    return given


# ---------------------------------------------------------------- the pages

def script_words(text):
    """The script's words, as they are hashed (making.normal_script)."""
    return making.normal_script(text).split()


def pages_of(text, per_page=30):
    """Pages of about per_page words, broken only at sentence ends and never
    across a paragraph. A sentence longer than one and a half pages is broken
    between words. Every word of the script, in order, exactly once."""
    pages, limit = [], per_page + per_page // 2
    for para in re.split(r'\n[ \t]*\n', making.normal_script(text)):
        para = ' '.join(para.split())
        if not para:
            continue
        current = []
        for sentence in (s for s in SENTENCE_END.split(para) if s.strip()):
            words = sentence.split()
            chunks = [words[i:i + per_page] for i in range(0, len(words), per_page)] if len(words) > limit else [words]
            for chunk in chunks:
                if current and len(current) + len(chunk) > per_page:
                    pages.append(' '.join(current))
                    current = []
                current.extend(chunk)
        if current:
            pages.append(' '.join(current))
    return pages


def prove_pages(text, pages):
    """The pages hold the script's words, exactly: joined back, they are the
    same words in the same order. Raises when they are not."""
    want, got = script_words(text), ' '.join(pages).split()
    if got != want:
        at = next((i for i, (a, b) in enumerate(zip(got, want)) if a != b), min(len(got), len(want)))
        raise DescriptError(f'the pages do not hold the script\'s words exactly (word {at + 1} differs); nothing was drawn')
    return len(want)


def page_seconds(page, wpm):
    return round(len(page.split()) * 60 / wpm, 3)


def planned_seconds(pages, cfg):
    """The title card, then each page for its words at the config's pace."""
    return round(cfg['page']['title_seconds'] + sum(page_seconds(p, cfg['words_per_minute']) for p in pages), 3)


def clock(seconds):
    whole = int(round(seconds))
    return f'{whole // 60}:{whole % 60:02d}'


# ---------------------------------------------------------------- drawing

def _pil():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise DescriptError('drawing the pages needs Pillow (pip install -r requirements-ci.txt)')
    return Image, ImageDraw, ImageFont


def _font(image_font, size, head=False):
    """Archivo Black for headings (in the repository); Inter SemiBold for the
    pages (npm ci puts it in node_modules), else Archivo Black."""
    for path in ((HEAD_FONT,) if head else (*BODY_FONTS, HEAD_FONT)):
        if Path(path).is_file():
            try:
                return image_font.truetype(str(path), size)
            except OSError:
                continue
    raise DescriptError('no font to draw the pages with: run npm ci (Inter), and check scripts/quick-edit/fonts')


def wrap(draw, text, font, width):
    """Lines that fit width, broken between words; a word wider than the
    line keeps a line of its own. The lines hold the text's words exactly."""
    lines, current = [], ''
    for word in text.split():
        trial = f'{current} {word}'.strip()
        if not current or draw.textlength(trial, font=font) <= width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if ' '.join(lines).split() != text.split():
        raise DescriptError('a page\'s lines do not hold its words exactly')
    return lines


def _title_frame(path, cut, title, cfg):
    image_cls, draw_cls, font_cls = _pil()
    page = cfg['page']
    w, h, margin = page['width'], page['height'], page['margin_px']
    image = image_cls.new('RGB', (w, h), INK)
    draw = draw_cls.Draw(image)
    big, mid, small = _font(font_cls, 104, head=True), _font(font_cls, 64), _font(font_cls, 48)
    name, shape = cfg['cuts'][cut]['title_card']
    y = int(h * 0.33)
    for line in wrap(draw, name, big, w - 2 * margin):
        draw.text((margin, y), line, font=big, fill=MINT)
        y += 124
    y += 30
    for line in wrap(draw, shape, mid, w - 2 * margin):
        draw.text((margin, y), line, font=mid, fill=CREAM)
        y += 84
    y += 46
    for line in wrap(draw, title, small, w - 2 * margin):
        draw.text((margin, y), line, font=small, fill=MUTED)
        y += 64
    image.save(path)


def _page_frame(path, text, number, total, cfg):
    image_cls, draw_cls, font_cls = _pil()
    page = cfg['page']
    w, h, margin = page['width'], page['height'], page['margin_px']
    image = image_cls.new('RGB', (w, h), INK)
    draw = draw_cls.Draw(image)
    room = h - 2 * 370  # clear of the phone's top bar and Descript's player controls
    size = page['type_px']
    while True:
        font = _font(font_cls, size)
        lines = wrap(draw, text, font, w - 2 * margin)
        height = int(size * 1.32)
        if len(lines) * height <= room:
            break
        if size - 4 < page['min_type_px']:
            raise DescriptError(f'page {number} has too many words to read at {page["min_type_px"]} px; nothing was drawn')
        size -= 4
    y = (h - len(lines) * height) // 2 - 40
    for line in lines:
        draw.text((margin, y), line, font=font, fill=CREAM)
        y += height
    draw.text((margin, h - 300), f'{number}/{total}', font=_font(font_cls, 36), fill=MUTED)
    image.save(path)


def _slate_frame(path, cut, day, title, cfg):
    image_cls, draw_cls, font_cls = _pil()
    w, h = cfg['record_here']['width'], cfg['record_here']['height']
    k = w / 1920
    image = image_cls.new('RGB', (w, h), INK)
    draw = draw_cls.Draw(image)
    x = int(140 * k)
    draw.text((x, int(330 * k)), 'Record here', font=_font(font_cls, int(120 * k), head=True), fill=MINT)
    draw.text((x, int(500 * k)), f'{cfg["cuts"][cut]["slate"]}  \u00b7  {day}', font=_font(font_cls, int(60 * k)), fill=CREAM)
    draw.text((x, int(590 * k)), title, font=_font(font_cls, int(48 * k)), fill=MUTED)
    draw.text((x, int(760 * k)), 'Paste the script into the teleprompter, then record from here.', font=_font(font_cls, int(40 * k)), fill=MUTED)
    image.save(path)


def _ffmpeg():
    tool = shutil.which('ffmpeg')
    if not tool:
        raise DescriptError('making the video needs ffmpeg on this machine')
    return tool


def probe(path):
    """(width, height, seconds) of a video, by ffprobe; None without ffprobe."""
    tool = shutil.which('ffprobe')
    if not tool:
        return None
    out = subprocess.run([tool, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True)
    try:
        data = json.loads(out.stdout)
        stream = data['streams'][0]
        return int(stream['width']), int(stream['height']), float(data['format']['duration'])
    except (ValueError, KeyError, IndexError, TypeError):
        raise DescriptError(f'ffprobe could not read {Path(path).name}')


def _encode(frames, out, fps, seconds):
    """Still frames, each for its seconds, into an H.264 video with a silent
    sound track (Descript imports it as one clip)."""
    with tempfile.TemporaryDirectory() as tmp:
        listing = Path(tmp) / 'frames.txt'
        quoted = lambda p: "'" + Path(p).as_posix().replace("'", "'\\''") + "'"
        listing.write_text(''.join(f'file {quoted(p)}\nduration {d}\n' for p, d in frames) + f'file {quoted(frames[-1][0])}\n',
                           encoding='utf-8')
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        done = subprocess.run([_ffmpeg(), '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
                               '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', f'{seconds:.3f}',
                               # The colours are converted before the frames are repeated, once a page, not 30 times a second.
                               '-vf', f'format=yuv420p,fps={fps}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                               '-tune', 'stillimage', '-g', str(int(fps) * 10), '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart',
                               str(out)],
                              capture_output=True, text=True)
        if done.returncode != 0:
            raise DescriptError(f'ffmpeg could not make {Path(out).name}: {done.stderr.strip()[:300]}')


def _check_video(out, width, height, seconds):
    seen = probe(out)
    if seen is None:
        return None
    if seen[:2] != (width, height):
        raise DescriptError(f'{Path(out).name} came out {seen[0]} x {seen[1]}, not {width} x {height}')
    if abs(seen[2] - seconds) > max(0.5, seconds * SLACK):
        raise DescriptError(f'{Path(out).name} runs {seen[2]:.1f} seconds, not the {seconds:.1f} its words take')
    return seen[2]


def render(script, cut, title, out, cfg=None):
    """The Script composition's video for one cut: the title card, then the
    pages, each for its words at the config's pace. The words are proven
    exact before anything is drawn."""
    cfg = cfg or load_config()
    making._cut(cut)
    text = Path(script).read_text(encoding='utf-8-sig')
    pages = pages_of(text, cfg['page']['words'])
    words = prove_pages(text, pages)
    if not pages:
        raise DescriptError(f'{Path(script).name} has no words to put on a page')
    seconds = planned_seconds(pages, cfg)
    with tempfile.TemporaryDirectory() as tmp:
        frames = [(Path(tmp) / 'p000.png', cfg['page']['title_seconds'])]
        _title_frame(frames[0][0], cut, title, cfg)
        for number, page in enumerate(pages, 1):
            path = Path(tmp) / f'p{number:03d}.png'
            _page_frame(path, page, number, len(pages), cfg)
            frames.append((path, page_seconds(page, cfg['words_per_minute'])))
        _encode(frames, out, cfg['page']['fps'], seconds)
    _check_video(out, cfg['page']['width'], cfg['page']['height'], seconds)
    return {'out': str(out), 'cut': cut, 'pages': len(pages), 'words': words, 'seconds': seconds,
            'bytes': Path(out).stat().st_size, 'script_sha256': making.script_hash(text)}


def slate(cut, day, title, out, cfg=None):
    """The Record here composition's video: one second, 1920 x 1080 for both
    cuts (he records on a laptop camera; the 90-second cut is cropped tall
    later, so its slate says to sit in the centre)."""
    cfg = cfg or load_config()
    making._cut(cut)
    seconds = float(cfg['record_here']['seconds'])
    with tempfile.TemporaryDirectory() as tmp:
        frame = Path(tmp) / 'slate.png'
        _slate_frame(frame, cut, day, title, cfg)
        _encode([(frame, seconds)], out, cfg['record_here']['fps'], seconds)
    _check_video(out, cfg['record_here']['width'], cfg['record_here']['height'], seconds)
    return {'out': str(out), 'cut': cut, 'seconds': seconds, 'bytes': Path(out).stat().st_size}


# ---------------------------------------------------------------- names

def day_label(when):
    """'Mon 12 Oct' for '2026-10-12'."""
    try:
        d = date.fromisoformat(str(when)[:10])
    except ValueError:
        raise DescriptError(f'the post\'s date is YYYY-MM-DD, not "{when}"')
    return f'{DAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]}'


def local_time(cfg, at=None):
    """An instant on Krish's clock (config timezone), else in UTC when this
    machine has no time zone data."""
    at = at or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return at.astimezone(ZoneInfo(cfg.get('timezone') or 'UTC'))
    except (ImportError, KeyError, OSError, ValueError):
        return at.astimezone(timezone.utc)


def sent_label(local):
    """'Mon 12 Oct 10.05am', or '... 14.05 UTC' when the clock is UTC."""
    day = f'{DAYS[local.weekday()]} {local.day} {MONTHS[local.month - 1]}'
    if local.utcoffset() == timedelta(0) and local.tzname() in ('UTC', None):
        return f'{day} {local:%H.%M} UTC'
    hour = local.hour % 12 or 12
    return f'{day} {hour}.{local:%M}{"am" if local.hour < 12 else "pm"}'


def unique(name, taken):
    """name, or name with " 2", " 3" before its extension when the project
    already holds it: Descript refuses a media name a project holds."""
    if name not in taken:
        return name
    stem, dot, ext = name.rpartition('.')
    n = 2
    while f'{stem} {n}{dot}{ext}' in taken:
        n += 1
    return f'{stem} {n}{dot}{ext}'


def script_media_name(sha, local):
    return f'Script {local:%Y-%m-%d %H%M} {sha[:7]}.mp4'


def record_media_name(cut, cfg):
    return f'Record here {cfg["cuts"][cut]["name"]} slate.mp4'


def subject_of(post):
    return str(post.get('subject') or post.get('headline') or '').strip()


def project_name(post, cut, cfg):
    """'Mon 12 Oct - 3-minute - Who gets paid for AI songs'."""
    return f'{day_label(post.get("date"))} - {cfg["cuts"][cut]["name"]} - {subject_of(post)}'


def pack_folder(post):
    try:
        return library.post_folder(post.get('date'), post.get('subject'), post.get('subchannel'),
                                   bool(post.get('launch')), post.get('day'))
    except (library.LibraryError, ValueError, TypeError) as error:
        raise DescriptError(f'the post\'s pack folder cannot be named: {error}')


def folder_name(post, cfg):
    """'Mindmake scripts/2026-10-12 Mon follow.the.money - Who gets paid for AI songs'."""
    return f'{cfg["folder_root"]}/{pack_folder(post)}'


# ---------------------------------------------------------------- the plan

def _composition(name, size, media):
    return {'name': name, 'width': size['width'], 'height': size['height'], 'fps': size['fps'], 'clips': [{'media': media}]}


def plan(piece_id, post_path, script_paths, call=None, cfg=None, work=None, at=None, render_fn=None, slate_fn=None, new_project=False):
    """What to send for each cut, and the calls that send it. Renders what
    is needed; sends nothing."""
    cfg = cfg or load_config()
    render_fn, slate_fn = render_fn or render, slate_fn or slate
    if not making.UUID.match(piece_id or ''):
        raise DescriptError('the piece id is the content_ideas uuid (post.json "piece_id")')
    try:
        post = json.loads(Path(post_path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as error:
        raise DescriptError(f'{post_path} cannot be read: {error}')
    if not isinstance(post, dict):
        raise DescriptError(f'{post_path} is not a post.json')
    if post.get('piece_id') and post['piece_id'] != piece_id:
        raise DescriptError(f'{post_path} is the post of piece {post["piece_id"]}, not {piece_id}')
    script_paths = list(script_paths or [])
    if len(script_paths) != len(CUTS):
        raise DescriptError('give both scripts, the long cut first: plan PIECE post.json long.md short.md')
    record = making.record_of(piece_id, call)
    check = record.get('script_check') if isinstance(record.get('script_check'), dict) else {}
    if check.get('passed') is not True:
        raise DescriptError('the scripts\' check has not passed on the piece\'s record: run making.py PIECE scripts long.md short.md '
                            'first; nothing is sent')
    hashes = making.current_hashes(record)
    for cut, path in zip(CUTS, script_paths):
        if cut not in hashes:
            raise DescriptError(f'the record holds no hash for the {cut} script: run making.py PIECE scripts long.md short.md again')
        try:
            got = making.script_file_hash(path)
        except (OSError, UnicodeDecodeError) as error:
            raise DescriptError(f'the {cut} script {path} cannot be read: {error}')
        if got != hashes[cut]:
            raise DescriptError(f'{Path(path).name} does not hold the {cut} words the check passed (its words hash {got[:12]}, the '
                                f'record holds {hashes[cut][:12]}): give the files making.py scripts checked, or check these first')
    day, title, folder = day_label(post.get('date')), subject_of(post), folder_name(post, cfg)
    if not title:
        raise DescriptError(f'{post_path} has no subject to name the projects by')
    work = Path(work) if work else WORK / piece_id[:8]
    work.mkdir(parents=True, exist_ok=True)
    local = local_time(cfg, at)
    out = {'piece_id': piece_id, 'day': day, 'title': title, 'folder': folder, 'drive_id': cfg['drive_id'],
           'drive_name': cfg['drive_name'], 'cuts': []}
    for cut, path in zip(CUTS, script_paths):
        sha = hashes[cut]
        state, entry = making.descript_state(record, cut)
        item = {'cut': cut, 'name': cfg['cuts'][cut]['name'], 'state': state, 'sha256': sha, 'script': str(path)}
        if state == 'in' and not new_project:
            item.update(action='none', sent_at=entry.get('sent_at'), script_link=entry.get('script_link'), record_link=entry.get('record_link'))
            out['cuts'].append(item)
            continue
        existing = entry if entry and entry.get('project_id') and not new_project else None
        # A send that failed after import_media made the project: finished there, never a second project.
        bare = bool(existing) and not existing.get('record_composition')
        taken = set((existing or {}).get('known_media') or [])
        media = unique(script_media_name(sha, local), taken)
        script_file = work / f'{cut}-script-{sha[:7]}.mp4'
        made = render_fn(path, cut, title, script_file, cfg)
        if made.get('script_sha256') and made['script_sha256'] != sha:
            raise DescriptError(f'the {cut} pages were drawn from other words than the check passed; nothing is sent')
        files = [{'name': media, 'file': str(script_file), 'bytes': Path(script_file).stat().st_size,
                  'pages': made.get('pages'), 'words': made.get('words'), 'seconds': made.get('seconds')}]
        add_media = {media: {'content_type': 'video/mp4', 'file_size': files[0]['bytes']}}
        if bare:
            # Both compositions, named with the send time, so they are told apart from anything the failed send left.
            composition, record_name = f'Script, sent {sent_label(local)}', f'Record here, sent {sent_label(local)}'
            slate_media = unique(f'Record here {cfg["cuts"][cut]["name"]} slate {local:%H%M}.mp4', taken | {media})
            slate_file = work / f'{cut}-record-here.mp4'
            slate_fn(cut, day, title, slate_file, cfg)
            files.append({'name': slate_media, 'file': str(slate_file), 'bytes': Path(slate_file).stat().st_size})
            add_media[slate_media] = {'content_type': 'video/mp4', 'file_size': files[1]['bytes']}
            args = {'project_id': existing['project_id'], 'add_media': add_media,
                    'add_compositions': [_composition(composition, cfg['page'], media), _composition(record_name, cfg['record_here'], slate_media)]}
            item.update(action='finish', project_id=existing['project_id'], record_name=record_name, failed=existing.get('error'))
        elif existing:
            composition = f'Script, sent {sent_label(local)}'
            args = {'project_id': existing['project_id'], 'add_media': add_media,
                    'add_compositions': [_composition(composition, cfg['page'], media)]}
            item.update(action='resend', project_id=existing['project_id'], record_composition=existing.get('record_composition'),
                        record_link=existing.get('record_link'))
        else:
            composition = 'Script'
            slate_media = unique(record_media_name(cut, cfg), taken | {media})
            slate_file = work / f'{cut}-record-here.mp4'
            slate_fn(cut, day, title, slate_file, cfg)
            files.append({'name': slate_media, 'file': str(slate_file), 'bytes': Path(slate_file).stat().st_size})
            add_media[slate_media] = {'content_type': 'video/mp4', 'file_size': files[1]['bytes']}
            args = {'project_name': project_name(post, cut, cfg), 'folder_name': folder, 'team_access': cfg['team_access'],
                    'add_media': add_media,
                    'add_compositions': [_composition('Script', cfg['page'], media), _composition('Record here', cfg['record_here'], slate_media)]}
            item.update(action='new')
        item.update(media=media, composition=composition, files=files, import_media=args)
        out['cuts'].append(item)
    return out


def _q(value):
    return shlex.quote(str(value))


def record_line(piece_id, item, drive='<the drive id get_drive_info gave>'):
    project = item.get('project_id') or '<the project_id import_media gave>'
    record_composition = item.get('record_composition') or f'<the id of the composition named "{item.get("record_name") or "Record here"}">'
    parts = [PY, SELF, 'record', piece_id, item['cut'], '--drive', drive, '--project', project,
             '--script-composition', f'<the id of the composition named "{item["composition"]}">',
             '--record-composition', record_composition, '--media', item['media'], '--sha', item['sha256']]
    return ' '.join(_q(p) for p in parts) + ' --known-media <every media name get_project lists, each in quotes>'


def error_line(piece_id, cut, project=None):
    """The line that records a send that failed. With the project import_media
    made (or the cut already had), so the next plan finishes that project."""
    parts = [PY, SELF, 'record', piece_id, cut, '--drive', '<the drive id get_drive_info gave>']
    parts += ['--project', project or '<the project_id import_media gave>']
    return ' '.join(_q(p) for p in parts + ['--error', '<what Descript said>'])


def error_line_alone(piece_id, cut):
    return ' '.join(_q(p) for p in [PY, SELF, 'record', piece_id, cut, '--drive', '<the drive id get_drive_info gave>',
                                     '--error', '<what Descript said>'])


def show_plan(p):
    """The plan as the session reads it: each call, in order."""
    lines = [f'Descript send: {p["day"]} "{p["title"]}" (piece {p["piece_id"]})',
             f'Drive: {p["drive_name"]} ({p["drive_id"]}); folder "{p["folder"]}"']
    sending = [c for c in p['cuts'] if c['action'] != 'none']
    for c in p['cuts']:
        if c['action'] == 'none':
            lines.append(f'{c["name"]} cut: Descript already holds these words (sent {c.get("sent_at")}); nothing to send. '
                         f'Read {c.get("script_link")}; record here {c.get("record_link")}')
    if not sending:
        lines.append('Nothing to send.')
        return '\n'.join(lines)
    lines.append('Rendered here, each page checked word for word against its script:')
    for c in sending:
        for f in c['files']:
            extra = f', {f["words"]} words on {f["pages"]} pages, {clock(f["seconds"])}' if f.get('pages') else ''
            lines.append(f'  {c["name"]} cut: {f["file"]} ({f["bytes"]} bytes{extra}), uploaded as "{f["name"]}"')
    lines += ['', '1. get_drive_info {}',
              f'   The drive id must be {p["drive_id"]} ({p["drive_name"]}). If it is not, stop: nothing is sent.']
    step = 2
    for c in sending:
        how = {'new': 'a new project with the Script and Record here compositions',
               'resend': f'the new words into its project {c.get("project_id")}, as a new Script composition; Record here stays as it is',
               'finish': (f'the send that failed ({c.get("failed")}) left its project {c.get("project_id")} with no timelines on the record: '
                          'both go into it now, named with the send time, never a second project. If get_project shows timelines the '
                          'failed send left, tell Krish their names, so he records only through the Record here link')}[c['action']]
        lines += ['', f'{c["name"]} cut ({c["cut"]}): {how}',
                  f'{step}. import_media {json.dumps(c["import_media"], ensure_ascii=False)}']
        lines.append(f'{step + 1}. PUT each file to its upload_url in the answer (upload_urls["<name>"].upload_url):')
        for f in c['files']:
            lines.append(f"   curl -sS --fail -X PUT -H 'Content-Type: application/octet-stream' --data-binary @{_q(f['file'])} "
                         f"'<upload_url for \"{f['name']}\">'")
        lines += [f'{step + 2}. wait_for_job {{"job_id": "<the job_id import_media gave>"}}, again until job_state is "stopped" '
                  'and result.status is "success"',
                  f'{step + 3}. get_project {{"project_id": "{c.get("project_id") or "<the project_id import_media gave>"}"}}',
                  f'   Read the id of the composition named "{c["composition"]}"'
                  + ('' if c['action'] == 'resend' else f' and of "{c.get("record_name") or "Record here"}"') + ', and every media name it lists.',
                  f'{step + 4}. {record_line(p["piece_id"], c)}']
        step += 5
    lines += ['', 'If a call fails with a 5xx or 429, make it once more. If it fails again, or Descript says the media minutes are '
              'used up (402), record why and stop; Copy on the publish page still works and recording is never held up. Once '
              'import_media has answered with a project_id, record the failure on that project, so the next send finishes it and '
              'never makes a second one:']
    for c in sending:
        lines.append(f'   {error_line(p["piece_id"], c["cut"], c.get("project_id"))}')
        if c['action'] == 'new':
            lines.append(f'   (import_media gave no project_id: {error_line_alone(p["piece_id"], c["cut"])})')
    lines += ['', f'Then: {PY} scripts/post-pack/making.py {p["piece_id"]} show']
    return '\n'.join(lines)


def _plain(p):
    """The plan as JSON: paths as text."""
    return json.loads(json.dumps(p, default=str))


# ---------------------------------------------------------------- record

def record(piece_id, cut, args, call=None, by=None, cfg=None):
    """Writes one cut's place in Descript onto the piece's making record,
    after checking the drive against the config."""
    cfg = cfg or load_config()
    patch = making.descript_record_patch(piece_id, cut, args, call, by, config=cfg)
    return making.post(piece_id, patch, call, by=by)


# ---------------------------------------------------------------- pending

def week_monday(text=None, today=None):
    try:
        d = date.fromisoformat(text) if text else (today or date.today())
    except ValueError:
        raise DescriptError(f'--week is a date, YYYY-MM-DD, not "{text}"')
    return d - timedelta(days=d.weekday())


def _get(call, path):
    status, text = (call or making._engine_call)('GET', path, None)
    if status != 200:
        raise DescriptError(f'the engine answered {status} to GET {path.split("?")[0]}: {str(text)[:200]}')
    try:
        return json.loads(text)
    except ValueError:
        raise DescriptError(f'the engine answered GET {path.split("?")[0]} with something that is not JSON')


def find_post(piece_id, plans=PLANS):
    for path in sorted(Path(plans).glob('*/post.json')):
        try:
            data = json.loads(path.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict) and str(data.get('piece_id') or '') == piece_id:
            return path
    return None


def scripts_of(post_path):
    """{cut: path} of the piece's two scripts on this machine (plan_files)."""
    import plan_files
    found = {}
    for item in plan_files.video_files(post_path):
        if item['kind'] == 'video-script' and item.get('cut') in CUTS and item.get('path') and item['cut'] not in found:
            found[item['cut']] = item['path']
    return found


def _shown(path):
    try:
        return Path(path).resolve().relative_to(REPO).as_posix()
    except ValueError:
        return Path(path).as_posix()


def _when(text):
    try:
        at = datetime.fromisoformat(str(text).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return at if at.tzinfo else at.replace(tzinfo=timezone.utc)


def held_back(record, cut, entry, now=None):
    """Why a cut whose last send failed is not sent again yet, or None: its
    media minutes were used up (402), or it failed less than COOL_OFF ago.
    Words changed since the failure are always sent."""
    if not isinstance(entry, dict) or not entry.get('error'):
        return None
    failed = _when(entry.get('failed_at') or entry.get('sent_at'))
    check = record.get('script_check') if isinstance(record.get('script_check'), dict) else {}
    changed = _when((check.get('changed_at') or {}).get(cut)) if isinstance(check.get('changed_at'), dict) else None
    if failed and changed and changed > failed:
        return None
    error = str(entry['error'])
    if NO_MINUTES.search(error):
        return (f'Descript said his media minutes are used up ({error}): sent again when the words change, or with --retry once '
                'Krish says (the board item about it)')
    now = now or datetime.now(timezone.utc)
    if failed and now - failed < COOL_OFF:
        return (f'the last send failed at {failed.isoformat().replace("+00:00", "Z")} ({error}): tried again '
                f'{int(COOL_OFF.total_seconds() // 3600)} hours after it, or with --retry')
    return None


def hand_made(piece_id, cut, workbench=WORKBENCH):
    """The making.py descript line WORKBENCH.md keeps for a send made by
    hand for this piece and cut, or None."""
    try:
        text = Path(workbench).read_text(encoding='utf-8')
    except OSError:
        return None
    for line in text.splitlines():
        hit = HAND_LINE.search(line.strip())
        if hit and hit.group(2).lower() == piece_id and hit.group(3) == cut:
            return hit.group(1)
    return None


def pending(call=None, monday=None, plans=PLANS, retry=False, now=None, workbench=WORKBENCH):
    """The pieces in flight this week and next whose current checked words
    are not all in Descript: [{'id', 'idea', 'scheduled_for', 'cuts':
    {cut: state}, 'held': {cut: why}, 'hand_made': {cut: line}, 'plan': the
    plan line or None, 'why'}]. A cut held back (held_back) is not in cuts
    unless retry; a cut sent by hand is in hand_made, and no plan line is
    given until those lines have run."""
    monday = monday or week_monday()
    seen = {}
    for week in (monday, monday + timedelta(days=7)):
        for series in _get(call, f'/api/week/options?week_start={week.isoformat()}').get('series') or []:
            for item in series.get('in_flight') or []:
                pid = str((item or {}).get('id') or '')
                if making.UUID.match(pid) and pid not in seen:
                    seen[pid] = {'id': pid, 'idea': item.get('idea') or '', 'scheduled_for': item.get('scheduled_for')}
    out = []
    for piece in seen.values():
        record = _get(call, f'/api/content-ideas/{piece["id"]}/making').get('making') or {}
        states = {cut: making.descript_state(record, cut) for cut in CUTS}
        waiting, held, hand = {}, {}, {}
        for cut, (state, entry) in states.items():
            if state not in ('missing', 'older', 'failed'):
                continue
            why_held = None if retry else held_back(record, cut, entry, now)
            line = hand_made(piece['id'], cut, workbench) if state == 'missing' else None
            if why_held:
                held[cut] = why_held
            elif line:
                hand[cut] = line
            else:
                waiting[cut] = state
        if not waiting and not held and not hand:
            continue
        post_path = find_post(piece['id'], plans)
        scripts = scripts_of(post_path) if post_path else {}
        if hand:
            line = None
            why = 'a send made by hand is not on the record yet: run its line below first, then pending again (no second project)'
        elif not waiting:
            line, why = None, 'held back'
        elif post_path and all(cut in scripts for cut in CUTS):
            line = ' '.join(_q(x) for x in [PY, SELF, 'plan', piece['id'], _shown(post_path), _shown(scripts['long']), _shown(scripts['short'])])
            why = None
        else:
            line = None
            why = ('no post.json in docs/plans names it' if not post_path
                   else 'its scripts are not on this machine (' + ', '.join(c for c in CUTS if c not in scripts) + ')')
        out.append({**piece, 'cuts': waiting, 'held': held, 'hand_made': hand, 'plan': line, 'why': why})
    out.sort(key=lambda p: (p.get('scheduled_for') or '9999-12-31', p['id']))
    return out


def show_pending(found):
    if not found:
        return 'Every checked script in flight this week and next is in Descript.'
    words = {'missing': 'not sent', 'older': 'Descript has older words', 'failed': 'the last send failed'}
    lines = []
    for p in found:
        cuts = '; '.join([f'{making.CUT_NAME[c]}: {words[s]}' for c, s in p['cuts'].items()]
                         + [f'{making.CUT_NAME[c]}: sent by hand, not on the record yet' for c in p.get('hand_made') or {}]
                         + [f'{making.CUT_NAME[c]}: held back' for c in p.get('held') or {}])
        lines.append(f'{p.get("scheduled_for") or "unscheduled"} {p["id"]} ({cuts})')
        for c, line in (p.get('hand_made') or {}).items():
            lines.append(f'  record the {making.CUT_NAME[c]} send made by hand first (WORKBENCH.md): {line}')
        for c, why in (p.get('held') or {}).items():
            lines.append(f'  {making.CUT_NAME[c]} held back: {why}')
        if p['plan']:
            lines.append(f'  {p["plan"]}')
        elif p['cuts']:
            lines.append(f'  cannot plan here: {p["why"]}')
    return '\n'.join(lines)


# ---------------------------------------------------------------- self-test

def self_test():
    fails, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    def refused(label, fn, words):
        nonlocal count
        count += 1
        try:
            fn()
            fails.append(f'{label}: not refused')
        except making.MakingError as error:
            if words not in str(error):
                fails.append(f'{label}: refused with "{error}", which does not say "{words}"')

    cfg = load_config()
    drive = 'd8b77ba9-0c95-4b7b-8964-2f5b888c0b78'
    check('config: confirmed, on Krish\'s drive, view access, Mindmake scripts',
          (cfg['status'], cfg['drive_id'], cfg['drive_name'], cfg['team_access'], cfg['folder_root'], cfg['words_per_minute']),
          ('confirmed', drive, "Krish Raja's Drive", 'view', 'Mindmake scripts', 150))
    check('config: the pages and the slate',
          ((cfg['page']['width'], cfg['page']['height'], cfg['page']['words']), (cfg['record_here']['width'], cfg['record_here']['height'], cfg['record_here']['seconds'])),
          ((1080, 1920, 30), (1920, 1080, 1)))
    said = cfg['said']
    check('config: his words, verbatim',
          (said['tool']['words'], said['records_in']['words'], said['send']['words'], said['send']['then'], said['takes']['words'],
           said['teleprompter']['words']),
          ('Descript is now my tool of choice for video script readouts on my phone - scripts should automatically be sent there, '
           'with the ability for Descript to put the video in the correct place when recorded.',
           'I can use the descript web app, otherwise my laptop to record', '3. yes', 'go, upload', '1. yes',
           '2 fine, no issue with copy paste'))
    check('config: never Underlord, never publish', ('prompt_project_agent' not in cfg['send_calls'], 'publish_project' not in cfg['send_calls']),
          (True, True))
    check('drive: his drive, in any case, is accepted', check_drive(cfg, drive.upper()), drive)
    refused('drive: another drive is refused', lambda: check_drive(cfg, '00000000-0000-4000-8000-000000000000'), 'is not Krish\'s')
    refused('drive: no drive is refused', lambda: check_drive(cfg, ''), 'get_drive_info gave')
    with tempfile.TemporaryDirectory() as tmp:
        for label, change, words in (('a proposed config', {'status': 'proposed'}, 'not confirmed by Krish'),
                                     ('edit access', {'team_access': 'edit'}, 'view-access projects only'),
                                     ('no drive', {'drive_id': ''}, 'has no drive_id')):
            path = Path(tmp) / 'descript.json'
            path.write_text(json.dumps({**cfg, **change}), encoding='utf-8')
            refused(f'config: {label} is refused', lambda: load_config(path), words)

    # The pages: every word, in order, broken at sentence ends, never across a paragraph.
    sample = ('Warner sued Suno. Now it takes a cut! Who else gets paid? "That is the question." Universal and Sony are suing it '
              'all over again, and the court will hear it next year.\r\n\r\nYou pay Suno.   Warner, BMG and Believe get "a portion".  \n'
              'Half the cake, or the crumbs?\n\n' + ' '.join(f'word{i}' for i in range(70)) + '.\n')
    pages = pages_of(sample, 30)
    check('pages: the words come back exactly', prove_pages(sample, pages), len(script_words(sample)))
    check('pages: never more than one and a half pages of words', max(len(p.split()) for p in pages) <= 45, True)
    check('pages: a paragraph starts a page', any(p.startswith('You pay Suno.') for p in pages), True)
    check('pages: a page ends at a sentence end, unless a sentence is too long for one', pages[0].endswith('"That is the question."'), True)
    check('pages: a 70-word sentence is broken between words', [len(p.split()) for p in pages[-3:]], [30, 30, 10])
    refused('pages: a page missing a word is refused', lambda: prove_pages(sample, pages[:-1]), 'word')
    check('seconds: the title card, then each page for its words at 150 a minute',
          planned_seconds(['one two three'] * 2, cfg), round(3 + 2 * 3 * 60 / 150, 3))
    for name in ('2026-10-12-draft-script.md', '2026-10-12-draft-script-90s.md', '2026-10-09-draft-script.md', '2026-10-09-draft-script-90s.md'):
        path = PLANS / name
        if path.is_file():
            text = path.read_text(encoding='utf-8')
            real = pages_of(text, 30)
            check(f'pages: {name} comes back word for word', prove_pages(text, real), len(text.split()))
            check(f'pages: {name} runs its words at 150 a minute plus the card', planned_seconds(real, cfg),
                  round(3 + sum(round(len(p.split()) * 0.4, 3) for p in real), 3))

    # Names: unique media, the day, the project and its folder.
    post = {'piece_id': 'f328382d-71b3-41a7-a221-d8615826f12e', 'date': '2026-10-12', 'subchannel': 'follow.the.money',
            'subject': 'Who gets paid for AI songs', 'files': []}
    check('names: the day', day_label('2026-10-16'), 'Fri 16 Oct')
    check('names: the project', project_name(post, 'short', cfg), 'Mon 12 Oct - 90-second - Who gets paid for AI songs')
    check('names: the folder is the pack folder under Mindmake scripts', folder_name(post, cfg),
          'Mindmake scripts/2026-10-12 Mon follow.the.money - Who gets paid for AI songs')
    morning = datetime(2026, 10, 12, 14, 5, tzinfo=timezone.utc)
    local = local_time(cfg, morning)
    check('names: the send time on his clock', sent_label(local) in ('Mon 12 Oct 10.05am', 'Mon 12 Oct 14.05 UTC'), True)
    check('names: a media name a project holds gets a number', unique('Script a.mp4', {'Script a.mp4', 'Script a 2.mp4'}), 'Script a 3.mp4')
    check('names: a free name is kept', unique('Record here 3-minute slate.mp4', set()), 'Record here 3-minute slate.mp4')

    # The plan, against a stand-in engine and stand-in drawing.
    pid = post['piece_id']
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / 'post.json').write_text(json.dumps(post), encoding='utf-8')
        (t / 'long.md').write_text('The long script.\n', encoding='utf-8')
        (t / 'short.md').write_text('The short script.\n', encoding='utf-8')
        long_sha, short_sha = making.script_hash('The long script.\n'), making.script_hash('The short script.\n')
        holds = {'script_check': {'passed': True, 'checked_at': '2026-10-12T12:29:00Z', 'problems': [], 'hashes': {'long': long_sha, 'short': short_sha}}}
        gets = []

        def engine(method, path, body):
            gets.append((method, path))
            return 200, json.dumps({'ok': True, 'making': holds, 'steps': []})
        drawn = []

        def fake_render(script, cut, title, out, cfg_):
            Path(out).write_bytes(b'x' * (1000 + len(cut)))
            drawn.append(('pages', cut, title))
            return {'pages': 1, 'words': 3, 'seconds': 4.2, 'script_sha256': making.script_hash(Path(script).read_text(encoding='utf-8'))}

        def fake_slate(cut, day, title, out, cfg_):
            Path(out).write_bytes(b'y' * 500)
            drawn.append(('slate', cut, day))
            return {}
        go = lambda **kw: plan(pid, t / 'post.json', [t / 'long.md', t / 'short.md'], engine, cfg, t / 'work', morning, fake_render, fake_slate, **kw)
        first = go()
        long_plan = first['cuts'][0]
        args = long_plan['import_media']
        check('plan: the record is read, nothing is written', [m for m, _ in gets], ['GET'])
        check('plan: a cut never sent is a new project, in his folder, view access',
              (long_plan['action'], args['project_name'], args['folder_name'], args['team_access']),
              ('new', 'Mon 12 Oct - 3-minute - Who gets paid for AI songs',
               'Mindmake scripts/2026-10-12 Mon follow.the.money - Who gets paid for AI songs', 'view'))
        media = f'Script {local:%Y-%m-%d %H%M} {long_sha[:7]}.mp4'
        check('plan: two uploads with their sizes, named uniquely', args['add_media'],
              {media: {'content_type': 'video/mp4', 'file_size': 1004}, 'Record here 3-minute slate.mp4': {'content_type': 'video/mp4', 'file_size': 500}})
        check('plan: Script upright, Record here wide, for both cuts',
              [(c['name'], c['width'], c['height'], c['fps'], c['clips']) for c in args['add_compositions']]
              + [(c['name'], c['width'], c['height']) for c in first['cuts'][1]['import_media']['add_compositions']],
              [('Script', 1080, 1920, 30, [{'media': media}]), ('Record here', 1920, 1080, 30, [{'media': 'Record here 3-minute slate.mp4'}]),
               ('Script', 1080, 1920), ('Record here', 1920, 1080)])
        check('plan: only what import_media takes', sorted(args), ['add_compositions', 'add_media', 'folder_name', 'project_name', 'team_access'])
        check('plan: the pages and the slate drawn for each cut, with the title and the day',
              drawn, [('pages', 'long', 'Who gets paid for AI songs'), ('slate', 'long', 'Mon 12 Oct'),
                      ('pages', 'short', 'Who gets paid for AI songs'), ('slate', 'short', 'Mon 12 Oct')])
        shown = show_plan(first)
        check('plan: the calls in order, then the record line and the failure line',
              [shown.index(x) >= 0 for x in ('1. get_drive_info', '2. import_media', '3. PUT', 'curl -sS --fail -X PUT',
                                              '4. wait_for_job', '5. get_project', '6. ' + PY + ' ' + SELF + ' record', '--error')],
              [True] * 8)
        check('plan: the record line carries the full hash', f'--sha {long_sha}' in shown, True)

        # Descript holds the long words already; the short words changed since their send.
        holds['descript'] = {'drive_id': drive, 'cuts': {
            'long': {'project_id': '16aa1f87-c054-4115-a11c-4342def815e5', 'script_composition': '46c2a75a-615d-4ab5-bdc4-c84b57a88454',
                     'record_composition': 'f6eb149a-82e8-4604-836e-b78ea7c73797', 'script_link': 'https://web.descript.com/16aa1f87-c054-4115-a11c-4342def815e5/46c2a',
                     'record_link': 'https://web.descript.com/16aa1f87-c054-4115-a11c-4342def815e5/f6eb1', 'script_sha256': long_sha,
                     'media': 'Script 2026-10-12 x.mp4', 'known_media': ['Script 2026-10-12 x.mp4'], 'sent_at': '2026-10-12T10:31:16Z', 'by': 'Claude Code'},
            'short': {'project_id': '6e1c3178-ba5c-4603-a5e2-ec23f3612071', 'script_composition': 'f27bfc76-e71b-498d-a942-767063070c48',
                      'record_composition': '36a320ab-ed9a-4d7e-bddb-61668278faea', 'script_link': 'https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/f27bf',
                      'record_link': 'https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/36a32', 'script_sha256': 'e' * 64,
                      'media': media.replace(long_sha[:7], short_sha[:7]), 'known_media': [media.replace(long_sha[:7], short_sha[:7]), 'Record here 90-second slate.mp4'],
                      'sent_at': '2026-10-12T10:31:16Z', 'by': 'Claude Code'}}}
        drawn.clear()
        again = go()
        check('plan: the same words as the last send need no call', (again['cuts'][0]['action'], 'import_media' in again['cuts'][0]), ('none', False))
        short_plan = again['cuts'][1]
        resend = short_plan['import_media']
        check('plan: changed words go into the cut\'s own project, a new Script composition, nothing else',
              (short_plan['action'], sorted(resend), resend['project_id'], [c['name'] for c in resend['add_compositions']]),
              ('resend', ['add_compositions', 'add_media', 'project_id'], '6e1c3178-ba5c-4603-a5e2-ec23f3612071', [f'Script, sent {sent_label(local)}']))
        check('plan: the new media name is not one the project holds', list(resend['add_media']), [media.replace(long_sha[:7], short_sha[:7]).replace('.mp4', ' 2.mp4')])
        check('plan: only the changed cut\'s pages are drawn; no new slate', drawn, [('pages', 'short', 'Who gets paid for AI songs')])
        check('plan: the record line keeps the project and its Record here composition',
              ('--project 6e1c3178-ba5c-4603-a5e2-ec23f3612071' in record_line(pid, short_plan),
               '--record-composition 36a320ab-ed9a-4d7e-bddb-61668278faea' in record_line(pid, short_plan)), (True, True))
        holds['descript']['cuts']['short'] = {**holds['descript']['cuts']['short'], 'script_sha256': short_sha, 'error': 'HTTP 503'}
        check('plan: a failed send is sent again, into its project', go()['cuts'][1]['action'], 'resend')
        check('plan: --new-project makes a new one for a project gone from his drive', go(new_project=True)['cuts'][1]['action'], 'new')
        holds['descript']['cuts']['short'].pop('error')
        check('plan: both in Descript, nothing to send', 'Nothing to send.' in show_plan(go()), True)
        # A send that failed after import_media made the project: finished in it, never a second project.
        saved_short = holds['descript']['cuts']['short']
        holds['descript']['cuts']['short'] = {'project_id': '6e1c3178-ba5c-4603-a5e2-ec23f3612071', 'error': 'HTTP 500 on the upload',
                                              'failed_at': '2026-10-12T13:00:00Z', 'sent_at': '2026-10-12T13:00:00Z', 'by': 'Claude Code'}
        drawn.clear()
        finish = go()['cuts'][1]
        made_args = finish['import_media']
        check('plan: a bare project left by a failed send is finished, never a second one',
              (finish['action'], sorted(made_args), made_args['project_id'], [c['name'] for c in made_args['add_compositions']]),
              ('finish', ['add_compositions', 'add_media', 'project_id'], '6e1c3178-ba5c-4603-a5e2-ec23f3612071',
               [f'Script, sent {sent_label(local)}', f'Record here, sent {sent_label(local)}']))
        check('plan: its slate is drawn again and named with the send time', (drawn[-1][0], sorted(made_args['add_media'])[0].startswith('Record here 90-second slate ')),
              ('slate', True))
        finish_shown = show_plan({**first, 'cuts': [finish]})
        check('plan: its record line names the Record here composition by its new name',
              f'<the id of the composition named "Record here, sent {sent_label(local)}">' in record_line(pid, finish), True)
        check('plan: the failure line records the project, so the next send finishes it',
              ('--project 6e1c3178-ba5c-4603-a5e2-ec23f3612071 --error' in finish_shown, 'never a second project' in finish_shown), (True, True))
        check('plan: a new project\'s failure line asks for the project import_media gave',
              "--project '<the project_id import_media gave>' --error" in show_plan(first), True)
        holds['descript']['cuts']['short'] = saved_short

        # The refusals: nothing is drawn and nothing is planned.
        drawn.clear()
        holds['script_check']['hashes']['long'] = 'f' * 64
        refused('plan: a file that is not the words the check passed is refused', go, 'does not hold the long words the check passed')
        holds['script_check']['hashes']['long'] = long_sha
        holds['script_check']['passed'] = False
        refused('plan: a check that did not pass is refused', go, 'has not passed')
        holds['script_check']['passed'] = True
        del holds['script_check']['hashes']
        refused('plan: a check with no hashes is refused', go, 'no hash for the long script')
        holds['script_check']['hashes'] = {'long': long_sha, 'short': short_sha}
        (t / 'other.json').write_text(json.dumps({**post, 'piece_id': '904658db-4df2-4537-a0ed-ebe93e081db7'}), encoding='utf-8')
        refused('plan: another piece\'s post.json is refused',
                lambda: plan(pid, t / 'other.json', [t / 'long.md', t / 'short.md'], engine, cfg, t / 'work', morning, fake_render, fake_slate),
                'is the post of piece')
        refused('plan: one script is refused', lambda: plan(pid, t / 'post.json', [t / 'long.md'], engine, cfg), 'give both scripts')
        check('plan: nothing was drawn for a refused plan', drawn, [])

        # record: the drive checked, then the patch written.
        posts = []

        def writer(method, path, body):
            if method == 'GET':
                return 200, json.dumps({'ok': True, 'making': holds, 'steps': []})
            posts.append(body)
            return 200, json.dumps({'ok': True, 'steps': []})
        ns = lambda **kw: argparse.Namespace(**{**dict(drive=drive, project=None, script_composition=None, record_composition=None, links=None,
                                                       media=None, known_media=None, sha=None, sent_at=None, error=None), **kw})
        full = ns(project='6e1c3178-ba5c-4603-a5e2-ec23f3612071', script_composition='0b1c2d3e-0000-4000-8000-000000000001',
                  record_composition='36a320ab-ed9a-4d7e-bddb-61668278faea', media='Script new.mp4',
                  known_media=['Script new.mp4', 'Record here 90-second slate.mp4'], sha=short_sha)
        record(pid, 'short', full, writer, 'Claude Code', cfg)
        entry = posts[-1]['descript']['cuts']['short']
        check('record: the cut written with both links built from the ids', (posts[-1]['descript']['drive_id'], entry['script_link'], entry['record_link'],
              entry['script_sha256'], entry['by']),
              (drive, 'https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/0b1c2', 'https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/36a32',
               short_sha, 'Claude Code'))
        before = len(posts)
        refused('record: another drive is refused before anything is written',
                lambda: record(pid, 'short', ns(**{**vars(full), 'drive': '00000000-0000-4000-8000-000000000000'}), writer, 'Claude Code', cfg), 'is not Krish\'s')
        unconfirmed = Path(tmp) / 'proposed.json'
        unconfirmed.write_text(json.dumps({**cfg, 'status': 'proposed'}), encoding='utf-8')
        refused('record: an unconfirmed config is refused', lambda: record(pid, 'short', full, writer, 'Claude Code', load_config(unconfirmed)), 'not confirmed')
        check('record: nothing written when refused', len(posts), before)
        record(pid, 'short', ns(error='HTTP 402: media minutes used up'), writer, 'Claude Code', cfg)
        failed = posts[-1]['descript']['cuts']['short']
        check('record: a failed send keeps the project the cut had, with the error on it, and when it failed',
              (failed['project_id'], failed['error'], failed['sent_at'], bool(failed.get('failed_at'))),
              ('6e1c3178-ba5c-4603-a5e2-ec23f3612071', 'HTTP 402: media minutes used up', '2026-10-12T10:31:16Z', True))
        holds['descript']['cuts'].pop('long')
        record(pid, 'long', ns(project='16AA1F87-C054-4115-A11C-4342DEF815E5', error='HTTP 500 on the upload'), writer, 'Claude Code', cfg)
        bare = posts[-1]['descript']['cuts']['long']
        check('record: a first send that failed after import_media keeps the project it made',
              (bare['project_id'], bare['error'], 'record_composition' in bare), ('16aa1f87-c054-4115-a11c-4342def815e5', 'HTTP 500 on the upload', False))

    # pending: in flight this week and next, current words not in Descript.
    def week_engine(method, path, body):
        if path.startswith('/api/week/options'):
            if 'week_start=2026-10-12' in path:
                return 200, json.dumps({'series': [{'in_flight': [{'id': pid, 'idea': 'songs', 'scheduled_for': '2026-10-12'},
                                                                   {'id': '904658db-4df2-4537-a0ed-ebe93e081db7', 'idea': 'AIs', 'scheduled_for': '2026-10-16'}]}]})
            return 200, json.dumps({'series': []})
        hashes = {'long': 'a' * 64, 'short': 'b' * 64}
        sent = {'drive_id': drive, 'cuts': {c: {'project_id': '16aa1f87-c054-4115-a11c-4342def815e5', 'script_sha256': hashes[c]} for c in CUTS}}
        making_ = {'script_check': {'passed': True, 'checked_at': 'x', 'problems': [], 'hashes': hashes}}
        if pid in path:
            making_['descript'] = {**sent, 'cuts': {'long': sent['cuts']['long']}}
        else:
            making_['descript'] = sent
        return 200, json.dumps({'ok': True, 'making': making_, 'steps': []})
    with tempfile.TemporaryDirectory() as tmp:
        bench = Path(tmp) / 'WORKBENCH.md'
        bench.write_text('# Workbench\n', encoding='utf-8')
        found = pending(week_engine, date(2026, 10, 12), workbench=bench)
        check('pending: the piece with a cut not sent, and only it', [(p['id'], p['cuts']) for p in found], [(pid, {'short': 'missing'})])
        if (PLANS / '2026-10-12-monday' / 'post.json').is_file():
            check('pending: the plan line names its post.json and both scripts',
                  found[0]['plan'], f'{PY} {SELF} plan {pid} docs/plans/2026-10-12-monday/post.json docs/plans/2026-10-12-draft-script.md '
                                    'docs/plans/2026-10-12-draft-script-90s.md')
        # A send made by hand that the record does not hold yet: its line, never a plan line (no second project).
        hand = (f"     python3 scripts/post-pack/making.py --by 'Claude Code' {pid} descript short --drive {drive} --project "
                "6e1c3178-ba5c-4603-a5e2-ec23f3612071 --script-composition f27bfc76-e71b-498d-a942-767063070c48 --known-media 'a.mp4'")
        bench.write_text('# Workbench\n\n' + hand + '\n', encoding='utf-8')
        by_hand = pending(week_engine, date(2026, 10, 12), workbench=bench)
        check('pending: a cut sent by hand is recorded first, with no plan line',
              (by_hand[0]['cuts'], list(by_hand[0]['hand_made']), by_hand[0]['plan'], by_hand[0]['hand_made']['short'] == hand.strip()),
              ({}, ['short'], None, True))
        check('pending: the line is said', 'record the 90-second send made by hand first' in show_pending(by_hand), True)
        check('pending: the real WORKBENCH line of 12 October is read',
              bool(hand_made('904658db-4df2-4537-a0ed-ebe93e081db7', 'long')) or 'descript long' not in WORKBENCH.read_text(encoding='utf-8'), True)

    # A failed send waits: for media minutes (402) until the words change or --retry; otherwise six hours.
    at = datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)
    rec = {'script_check': {'passed': True, 'changed_at': {'long': '2026-10-12T09:00:00Z'}}}
    entry = lambda error, when: {'error': error, 'failed_at': when, 'sent_at': '2026-10-12T08:00:00Z'}
    check('held back: no media minutes (402)', bool(held_back(rec, 'long', entry('HTTP 402: media minutes used up', '2026-10-12T10:00:00Z'), at)), True)
    check('held back: a failure an hour ago', 'tried again 6 hours after it' in (held_back(rec, 'long', entry('HTTP 503', '2026-10-12T14:00:00Z'), at) or ''), True)
    check('held back: a failure seven hours ago is sent again', held_back(rec, 'long', entry('HTTP 503', '2026-10-12T08:00:00Z'), at), None)
    check('held back: words changed since the failure are always sent',
          held_back({'script_check': {'changed_at': {'long': '2026-10-12T14:30:00Z'}}}, 'long', entry('HTTP 402', '2026-10-12T14:00:00Z'), at), None)

    def failing_engine(method, path, body):
        if path.startswith('/api/week/options'):
            return 200, json.dumps({'series': [{'in_flight': [{'id': pid, 'idea': 'songs', 'scheduled_for': '2026-10-12'}]}]}
                                   if 'week_start=2026-10-12' in path else {'series': []})
        hashes = {'long': 'a' * 64, 'short': 'b' * 64}
        return 200, json.dumps({'ok': True, 'steps': [], 'making': {'script_check': {'passed': True, 'hashes': hashes, 'changed_at': {}}, 'descript': {
            'drive_id': drive, 'cuts': {'long': {'project_id': '16aa1f87-c054-4115-a11c-4342def815e5', 'script_sha256': 'a' * 64},
                                        'short': {'error': 'HTTP 402: media minutes used up', 'failed_at': '2026-10-12T14:00:00Z', 'sent_at': 'x'}}}}})
    with tempfile.TemporaryDirectory() as tmp:
        bench = Path(tmp) / 'WORKBENCH.md'
        bench.write_text('', encoding='utf-8')
        waiting_now = pending(failing_engine, date(2026, 10, 12), now=at, workbench=bench)
        retried = pending(failing_engine, date(2026, 10, 12), now=at, workbench=bench, retry=True)
    check('pending: a cut held back is said, with no plan line', (waiting_now[0]['cuts'], list(waiting_now[0]['held']), waiting_now[0]['plan']),
          ({}, ['short'], None))
    check('pending: --retry sends it (Krish said go)', retried[0]['cuts'], {'short': 'failed'})

    # The real drawing, when this machine can: sizes, lengths and exact words.
    try:
        _pil()
        _ffmpeg()
        can_draw = bool(shutil.which('ffprobe'))
    except DescriptError:
        can_draw = False
    if can_draw:
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            script = t / 'short.md'
            script.write_text('Warner sued Suno. Now it takes a cut.\n\nWho else gets paid?\n', encoding='utf-8')
            made = render(script, 'short', 'Who gets paid for AI songs', t / 'pages.mp4', cfg)
            width, height, seconds = probe(t / 'pages.mp4')
            words = len(script.read_text(encoding='utf-8').split())
            check('render: upright, 1080 x 1920', (width, height), (1080, 1920))
            check('render: its length is its words at 150 a minute plus the card, within 5%',
                  abs(seconds - (3 + words * 60 / 150)) <= (3 + words * 60 / 150) * SLACK, True)
            check('render: every word on its pages, and the hash of its words', (made['words'], made['script_sha256']),
                  (words, making.script_hash(script.read_text(encoding='utf-8'))))
            slate('short', 'Mon 12 Oct', 'Who gets paid for AI songs', t / 'slate.mp4', cfg)
            width, height, seconds = probe(t / 'slate.mp4')
            check('slate: wide for both cuts, one second', (width, height, abs(seconds - 1) <= 0.2), (1920, 1080, True))
    else:
        print('descript self-test: Pillow, ffmpeg or ffprobe is missing here, so the real drawing was not checked')

    if fails:
        print('descript self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'descript self-test passed: {count} checks')
    return 0


# ---------------------------------------------------------------- main

def main(argv=None, call=None):
    ap = argparse.ArgumentParser(description='Each checked script into Krish\'s Descript drive, and the record of it.')
    ap.add_argument('what', nargs='?', choices=['render', 'slate', 'plan', 'record', 'pending'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--cut', choices=CUTS, help='with render and slate: the cut')
    ap.add_argument('--title', help='with render and slate: the piece\'s subject')
    ap.add_argument('--day', help='with slate: the day it goes out, "Mon 12 Oct"')
    ap.add_argument('--out', help='with render and slate: the video to write')
    ap.add_argument('--work', help='with plan: where the videos are rendered (default .cache/descript/<piece>)')
    ap.add_argument('--new-project', action='store_true', help='with plan: a new project even for a cut that has one (it is gone from his drive)')
    ap.add_argument('--week', help='with pending: a day in the week to start from (default this week)')
    ap.add_argument('--retry', action='store_true', help='with pending: list a cut held back after a failed send too (Krish said go)')
    ap.add_argument('--json', action='store_true', help='with plan and pending: the answer as JSON')
    ap.add_argument('--by', help='with record: who is writing (default as making.py)')
    ap.add_argument('--drive', metavar='ID')
    ap.add_argument('--project', metavar='ID')
    ap.add_argument('--script-composition', metavar='ID')
    ap.add_argument('--record-composition', metavar='ID')
    ap.add_argument('--links', nargs=2, metavar=('SCRIPT_URL', 'RECORD_URL'))
    ap.add_argument('--media', metavar='NAME')
    ap.add_argument('--known-media', nargs='+', metavar='NAME')
    ap.add_argument('--sha', metavar='SHA256')
    ap.add_argument('--sent-at', metavar='TIME')
    ap.add_argument('--error', metavar='TEXT')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.what:
        ap.error('say what to do: render, slate, plan, record or pending')
    try:
        if a.what == 'render':
            if len(a.args) != 1 or not (a.cut and a.title and a.out):
                ap.error('render SCRIPT --cut long|short --title TITLE --out OUT.mp4')
            made = render(a.args[0], a.cut, a.title, a.out)
            print(f'{made["out"]}: {made["words"]} words on {made["pages"]} pages, {clock(made["seconds"])}, every word checked')
        elif a.what == 'slate':
            if a.args or not (a.cut and a.day and a.title and a.out):
                ap.error('slate --cut long|short --day "Mon 12 Oct" --title TITLE --out OUT.mp4')
            made = slate(a.cut, a.day, a.title, a.out)
            print(f'{made["out"]}: Record here, {made["seconds"]:g} second')
        elif a.what == 'plan':
            if len(a.args) != 4:
                ap.error('plan PIECE post.json long.md short.md')
            p = plan(a.args[0], a.args[1], a.args[2:], call, work=a.work, new_project=a.new_project)
            print(json.dumps(_plain(p), indent=1) if a.json else show_plan(p))
        elif a.what == 'record':
            if len(a.args) != 2:
                ap.error('record PIECE CUT --drive ID ...')
            by = making.who(a.by)
            data = record(a.args[0], a.args[1], a, call, by)
            for line in making.descript_lines(data.get('making') or {}):
                print(line)
        else:
            found = pending(call, week_monday(a.week), retry=a.retry)
            print(json.dumps(found, indent=1) if a.json else show_pending(found))
    except (making.MakingError, OSError) as error:
        print(f'descript: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
