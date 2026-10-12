#!/usr/bin/env python3
"""kit: everything quick-edit needs to render one cut of a piece, drawn from
the piece's own post.json, so no piece needs a graphics script of its own.

Until 2026-10-12 every edition drew its graphics with a bespoke make_gfx.py
(editions/2026-10-higgsfield/video-kit/ is the last one), and make.py cannot
render without them: it needs cues, an end card for each shape and, for the
wide shape, the frame behind the speaker. This draws them the same way for
every piece, in the house style from config/studio.json:

    python kit.py POST_JSON --cut long|short --recording FILE --out DIR [--files DIR ...] [--force] [--json]
    python kit.py --self-test

It writes into DIR, and nowhere else:

  endcard-9x16.png/.mp4, endcard-16x9.png/.mp4
                       the house end card, 4 seconds, 30 fps, a silent 48 kHz stereo track
  frame-16x9.png       the wide shape's background in the subchannel's look
  strap-9x16.png       Krish's name and the subchannel, for the tall shape
  panels/<id>-9x16.png, panels/<id>-16x9.png
                       every picture in the post (kind "image"), fitted to the
                       1080 x 1000 tall panel and the 1314 x 1080 wide panel
  <cut>-script.txt     the cut's script, the words only
  <cut>.json           a starter config for make.py: the recording, crop auto,
                       subject, date, TikTok, intro and music on auto, the end
                       cards, the frame, the strap, the script (its names go to
                       the transcriber as a hint) and one cue per picture the
                       script brings in, with start and end words from the
                       script line that introduces it
  kit.json             what it made, from what, and anything to check

Run it once per cut into the same DIR: the graphics are shared and are only
drawn again when what they are drawn from changes. A <cut>.json edited by
hand since kit.py wrote it is never overwritten: the new one goes beside it
as <cut>.kit-new.json, unless --force.

Which picture goes where. A picture is shown over the paragraph of the
script that names most of what it shows (its purpose in post.json, and its
label, alt text and caption from the manager.json beside it when there is
one), a paragraph to a picture. The video's first sentence is Krish's face
(the hook, and the logo in its first seconds), and the paragraph with the
call to action is his face before the end card, so neither gets a picture.
A picture no paragraph names is drawn but not cued, and kit.json says so.

The cue words are the script's, chosen to survive the transcriber: no
numbers, the opening words of the paragraph where they can be, each found
exactly where it is meant to be by make.py's own matching. Krish rarely says
a script word for word, so run make.py --plan on the recording and change a
cue's words to the ones he said where the plan says one was not found.

Needs Python 3.10+, Pillow, ffmpeg, the repository's fonts (`npm ci`) and
Playwright for Python with a Chromium (`MYMU_BROWSER` may name one; in the
cloud container it is set to the Chromium that is there).
"""
import argparse
import base64
import hashlib
import html
import io
import json
import math
import os
import re
import shutil
import string
import subprocess
import sys
import tempfile
from itertools import combinations, pairwise
from pathlib import Path

sys.dont_write_bytecode = True  # kit.py writes under --out only

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
TEMPLATES = HERE / 'kit'
_CLOUD_CHROME = Path('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
if _CLOUD_CHROME.exists():
    os.environ.setdefault('MYMU_BROWSER', str(_CLOUD_CHROME))
for _extra in (REPO / 'scripts' / 'pages', REPO / 'scripts' / 'post-pack'):
    if str(_extra) not in sys.path:
        sys.path.append(str(_extra))
import brand  # noqa: E402  the house style, fonts, logos and browser
import story_check  # noqa: E402  how a script file becomes the words he says

KIT_VERSION = 1
CUT_SHAPE = {'long': '16x9', 'short': '9x16'}  # house rule TWO_CUTS
FRAME = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
PANEL = {'9x16': (1080, 1000), '16x9': (1314, 1080)}
# Where the picture sits inside a panel. The tall panel keeps its picture
# below the top 140 to 180 pixels that Shorts, TikTok and Reels cover with
# their own buttons (config/studio.json, the platforms' safe zones).
PANEL_LAYOUT = {
    '9x16': dict(pad=48, top=96, pill=30, gap=26, bottom=40),
    '16x9': dict(pad=64, top=56, pill=32, gap=30, bottom=56),
}
SHADOW_PX = 16
MAX_SCALE = 1.25  # never blow a picture up past this: its words go soft
ENDCARD_SECONDS = 4
TAGLINE = 'A free publication on how AI really works. You make your mind up.'
CTA = 'Subscribe free'
STRAP_SECONDS = 3.5

# How big a picture's words come out, from house rule SUBSTACK_FIT: a
# 1360-wide article picture draws every word a reader needs at 54 pixels or
# more, so a phone shows it at 14. A panel shows the picture at some scale,
# and the video is then shown at some width: the tall cut on a phone about
# 390 points wide, the wide cut in a 1280-wide player. The same 14 there is
# 39 pixels in the tall frame and 21 in the wide one.
ARTICLE_WORDS_PX, ARTICLE_WIDTH = 54, 1360
PHONE_FLOOR_PX = 14
SHOWN_AT = {'9x16': 390, '16x9': 1280}
FLOOR_PX = {shape: math.ceil(PHONE_FLOOR_PX * FRAME[shape][0] / SHOWN_AT[shape]) for shape in FRAME}

# The paragraph a picture covers runs at most this many words (about 36
# seconds at 150 a minute); a longer one keeps the stretch that names it most.
CAP_WORDS = 90
MIN_SCORE = 4.0  # below this, no paragraph names the picture well enough
MIN_SHARED = 2   # and its best line shares at least this many words with it

STOP = set("""a about above after again against all almost also am an and any are aren't as at be because been before being
below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each even ever every
few for from further get gets getting go goes going gone got had hadn't has hasn't have haven't having he he'd he'll he's her here
here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more
most much must mustn't my myself no nor not now of off on once one only or other ought our ours ourselves out over own same say
says said see shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then
there there's these they they'd they'll they're they've this those through to too under until up upon us very was wasn't we we'd
we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with won't would
wouldn't yet you you'd you'll you're you've your yours yourself yourselves goes after heading also still really thing things way
make makes made new""".split())
NUMBER_WORDS = set("""zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen
seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion
first second third fourth fifth half quarter percent per cent""".split())


class KitError(Exception):
    """A reason to stop, in words a person can act on."""


# ---------------------------------------------------------------- make.py's own word matching

def norm(t):
    """make.py's norm: how a word is compared with the transcript."""
    return re.sub(r"[^a-z0-9%$]", '', t.lower())


def find(ws, phrase, after=0.0):
    """make.py's find: the first run of words saying `phrase`, at or after `after`."""
    p = [norm(x) for x in phrase.split() if norm(x)]
    toks = [norm(w['w']) for w in ws]
    for i in range(len(toks) - len(p) + 1):
        if ws[i]['s'] >= after and toks[i:i + len(p)] == p:
            return i, i + len(p) - 1
    return None


# ---------------------------------------------------------------- the post

def load_post(path):
    try:
        post = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as e:
        raise KitError(f'cannot read {path}: {e}') from None
    for key in ('subchannel', 'subject', 'date', 'files'):
        if not post.get(key):
            raise KitError(f'{path} has no "{key}"; post.json needs subchannel, subject, date and files')
    return post


def resolve_file(entry, roots, default_name=None):
    """Where an entry's file is: beside post.json, in a folder given with
    --files, or in a packed library folder, where it carries its packed name."""
    names = [n for n in (entry.get('file'), entry.get('name'), default_name) if n]
    for root in roots:
        for n in names:
            p = Path(root) / n
            if p.is_file():
                return p
    for root in roots:
        for n in names:
            hits = sorted(p for p in Path(root).rglob(Path(n).name) if p.is_file())
            if len(hits) == 1:
                return hits[0]
    return None


def script_for(post, cut, roots):
    """The cut's script as paragraphs of the words he says, and where it came from."""
    entries = [e for e in post['files'] if e.get('kind') == 'video-script']
    mine = [e for e in entries if e.get('cut') == cut]
    if not mine:
        mine = [e for e in entries if not e.get('cut') and story_check.cut_of(e.get('name') or e.get('file')) == cut]
    if not mine and cut == 'long':
        mine = [e for e in entries if not e.get('cut') and not story_check.cut_of(e.get('name') or e.get('file'))]
    if not mine:
        raise KitError(f'post.json has no video-script for the {cut} cut (an entry with "kind": "video-script", "cut": "{cut}")')
    entry = mine[0]
    if entry.get('text'):
        text, where = entry['text'], 'post.json'
    else:
        ext = Path(entry.get('file') or 'x.md').suffix or '.md'
        path = resolve_file(entry, roots, default_name='video-script' + ext)
        if not path:
            raise KitError(f'the {cut} script {entry.get("file")!r} is not beside post.json or in --files')
        text, where = path.read_text(encoding='utf-8-sig'), str(path)
    paragraphs = story_check.spoken_paragraphs(text)
    if not paragraphs:
        raise KitError(f'the {cut} script has no spoken words')
    return paragraphs, where


def manager_notes(post_path, roots):
    """Label, alt text and caption per picture file, from manager.json when there is one."""
    for root in [Path(post_path).parent, *roots]:
        p = Path(root) / 'manager.json'
        if p.is_file():
            try:
                data = json.loads(p.read_text(encoding='utf-8-sig'))
            except ValueError:
                return {}
            return {Path(img.get('file', '')).name: img for img in data.get('images', []) if img.get('file')}
    return {}


def slug(text, keep=48):
    s = re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')
    return s[:keep].rstrip('-') or 'piece'


def pictures(post, post_path, roots):
    """The post's pictures (kind "image"), each with an id, its file and the words that say what it shows."""
    notes = manager_notes(post_path, roots)
    out, seen = [], set()
    for e in post['files']:
        if e.get('kind') != 'image' or not e.get('file'):
            continue
        pid = slug(Path(e['file']).stem, 32)
        n = 2
        while pid in seen:
            pid, n = f'{slug(Path(e["file"]).stem, 30)}-{n}', n + 1
        seen.add(pid)
        note = notes.get(Path(e['file']).name) or notes.get(Path(e.get('name') or '').name) or {}
        purpose = re.sub(r'\s*Goes after the heading[^.]*\.?', '', e.get('purpose') or '')
        name = re.sub(r'^\d+[-_ ]*', '', Path(e.get('name') or e['file']).stem).replace('-', ' ')
        words = ' '.join(x for x in (purpose, note.get('label'), note.get('alt'), note.get('caption'), name,
                                     ' '.join(e.get('logos') or [])) if x)
        out.append({'id': pid, 'entry': e, 'file': resolve_file(e, roots), 'words': words,
                    'label': note.get('label') or name})
    return out


# ---------------------------------------------------------------- which line brings in which picture

def stem(t):
    if t.isdigit():
        return t
    if t.endswith('ies') and len(t) > 4:
        t = t[:-3] + 'y'
    elif t.endswith('s') and not t.endswith('ss') and len(t) > 3:
        t = t[:-1]
    if t.endswith('ing') and len(t) > 5:
        t = t[:-3]
    elif t.endswith('ed') and len(t) > 4:
        t = t[:-2]
    return t


def content_tokens(text):
    text = str(text).lower().replace('\u2019', "'").replace('\u2018', "'")
    text = re.sub(r'(?<=\d),(?=\d{3})', '', text)
    out = []
    for t in re.findall(r"[a-z0-9]+(?:'[a-z]+)?", text):
        t = re.sub(r"'s$", '', t).replace("'", '')
        if t in STOP or (len(t) < 2 and not t.isdigit()):
            continue
        out.append(stem(t))
    return out


SENTENCE = re.compile(r'(?<=[.!?])["\u201d\u2019)]?\s+(?=["\u201c\u2018(]?[A-Z0-9$])')


def sentences(paragraph):
    return [s.strip() for s in SENTENCE.split(paragraph) if s.strip()]


def script_units(paragraphs):
    """Every sentence with its paragraph, its place and whether a picture may start or cover it."""
    units = []
    outro = len(paragraphs) - 1 if paragraphs and (story_check.OUTRO.search(paragraphs[-1]) or story_check.ARTICLE.search(paragraphs[-1])) else None
    for p, para in enumerate(paragraphs):
        for s in sentences(para):
            units.append({'para': p, 'text': s, 'n': len(s.split()), 'tokens': content_tokens(s)})
    for i, u in enumerate(units):
        # The opening line is his face (the hook) and the call to action is his face before the end card.
        u['open'] = i > 0 and u['para'] != outro
    return units


def match_pictures(pics, units):
    """Which paragraph brings in each picture: (cues, not_shown). A cue is the
    picture, its first and last sentence index and the line that names it.

    The pictures keep the order post.json lists them in, which is the
    article's, and a script follows its article: so of every way to give
    the pictures paragraphs in that order, a paragraph to a picture, the one
    that names them most in total wins. Two pictures that say much the same
    (the money map and the two camps both name Warner's share of Suno's
    revenue) then each land on their own beat, where the single best score
    for one would have taken the other's paragraph."""
    n = len(units)
    df = {}
    for u in units:
        for t in set(u['tokens']):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}
    paras = sorted({u['para'] for u in units if u['open']})
    options, best_line = [], {}
    for pic in pics:
        have = set(content_tokens(pic['words']))
        per = []
        for u in units:
            shared = set(u['tokens']) & have
            per.append((sum(idf[t] for t in shared), len(shared)) if u['open'] else (0.0, 0))
        top = max(range(n), key=lambda i: per[i][0]) if n else None
        best_line[pic['id']] = (top, per[top][0] if top is not None else 0.0)
        mine = {}
        for para in paras:
            idx = [i for i, u in enumerate(units) if u['para'] == para and u['open']]
            lead = max(idx, key=lambda i: per[i][0])
            if per[lead][1] < MIN_SHARED:
                continue
            total = per[lead][0] + 0.3 * sum(per[i][0] for i in idx if i != lead)
            if total >= MIN_SCORE:
                mine[para] = (total, idx, lead, per)
        options.append(mine)
    memo = {}

    def best(i, j):
        """The best (total, shown, choices) for pictures i on, from paragraph paras[j] on."""
        if i == len(pics) or j >= len(paras):
            return (0.0, 0, ())
        if (i, j) not in memo:
            choice = best(i + 1, j)
            for k in range(j, len(paras)):
                opt = options[i].get(paras[k])
                if not opt:
                    continue
                rest = best(i + 1, k + 1)
                cand = (opt[0] + rest[0], rest[1] + 1, ((i, paras[k]),) + rest[2])
                if (round(cand[0], 6), cand[1]) > (round(choice[0], 6), choice[1]):
                    choice = cand
            memo[(i, j)] = choice
        return memo[(i, j)]

    total, _, chosen = best(0, 0)
    cues, taken = [], set()
    for i, para in chosen:
        score, idx, lead, per = options[i][para]
        first, last = idx[0], idx[-1]
        if sum(units[k]['n'] for k in idx) > CAP_WORDS:
            first, last = best_stretch(idx, lead, per, units)
        cues.append({'id': pics[i]['id'], 'first': first, 'last': last, 'lead': lead, 'score': round(score, 2)})
        taken.add(pics[i]['id'])
    not_shown = []
    for pic in pics:
        if pic['id'] not in taken:
            top, score = best_line[pic['id']]
            not_shown.append({'id': pic['id'], 'why': 'no paragraph outside the opening line and the call to action names it'
                              if score < MIN_SCORE else 'the paragraphs that name it, in the article\'s order, went to pictures they name more',
                              'nearest_line': units[top]['text'] if top is not None and score > 0 else None,
                              'score': round(score, 2)})
    return cues, not_shown


def best_stretch(idx, lead, per, units):
    """The run of sentences of at most CAP_WORDS, holding the lead line, that names the picture most."""
    best = (lead, lead)
    best_key = None
    for a in range(len(idx)):
        for b in range(a, len(idx)):
            run = idx[a:b + 1]
            if lead not in run or sum(units[i]['n'] for i in run) > CAP_WORDS:
                continue
            key = (sum(per[i][0] for i in run), -run[0])
            if best_key is None or key > best_key:
                best, best_key = (run[0], run[-1]), key
    return best


# ---------------------------------------------------------------- cue words that survive the transcriber

WORDS_PER_SECOND = 2.5  # 150 a minute, the pace the scripts are written to (house rule TWO_CUTS)
LEAD, TAIL = 0.15, 0.35  # make.py's own: a graphic comes in 0.15 s before its words and leaves 0.35 s after
REACH = 8  # how many words a cue's words may sit inside its stretch, the time made up by lead or tail


def word_risk(word, first_in_sentence):
    """How likely the transcriber writes this word differently from the script."""
    bare = word.strip('"\'\u201c\u201d\u2018\u2019()[],.;:!?')
    low = bare.lower().replace('\u2019', "'")
    if re.search(r'[0-9$%\u00a3\u20ac]', bare):
        return 3.0  # "9 September", "$5.4 billion", "70%": written many ways
    if low in NUMBER_WORDS:
        return 2.0  # "two" or "2"
    if re.search(r'[-\u2010-\u2015]', bare):
        return 2.0  # "fan-made" or "fan made"
    risk = 0.0
    if bare[:1].isupper() and not first_in_sentence and low not in ('i', "i'm", "i've", "i'd", "i'll"):
        risk += 0.3  # a name: the transcriber has the script's names as a hint, so mostly right
    if "'" in low:
        risk += 0.3  # "it's" or "it is"
    return risk


def tidy(word):
    w = word.replace('\u2019', "'").replace('\u2018', "'")
    return re.sub(r"^[^\w$%']+|[^\w%']+$", '', w).lower()


def script_words(units):
    """Every spoken word as make.py's transcript would hold it, with its sentence."""
    out = []
    for si, u in enumerate(units):
        for k, w in enumerate(u['text'].split()):
            if norm(w):
                out.append({'w': w, 'unit': si, 'first': k == 0})
    return out


def _timed(words):
    return [{'w': w['w'], 's': float(i)} for i, w in enumerate(words)]


def start_anchor(words, first_unit, last_unit=None, from_word=0):
    """Words near the start of sentence `first_unit` (or from word `from_word`
    on) that make.py finds there first: (phrase, position, words skipped).
    The opening words win unless they hold a number or the like; then it
    steps in, at most REACH words and never past `last_unit`, and the cue's
    lead makes up the time."""
    last_unit = first_unit if last_unit is None else last_unit
    span = [i for i, w in enumerate(words) if first_unit <= w['unit'] <= last_unit and i >= from_word]
    if not span:
        return None, None, 0
    ws = _timed(words)
    best = None
    for length in (4, 5, 6, 3):
        for off in range(min(REACH, len(span)) + 1):
            pos = span[0] + off
            if pos + length - 1 > span[-1]:
                break
            phrase = ' '.join(tidy(words[pos + k]['w']) for k in range(length))
            if find(ws, phrase) != (pos, pos + length - 1):
                continue
            risk = sum(word_risk(words[pos + k]['w'], words[pos + k]['first']) for k in range(length))
            risk += 0.6 * any(words[pos + k]['first'] for k in range(1, length))  # across a full stop
            key = (round(risk + 0.25 * off + (0.3 if length == 3 else 0.0), 3), off)
            if best is None or key < best[0]:
                best = (key, phrase, pos, off)
    return (best[1], best[2], best[3]) if best else (None, None, 0)


def end_anchor(words, last_unit, after_pos):
    """Words at the end of sentence `last_unit` that make.py finds there first
    after the start: (phrase, words left after it). It steps back, at most
    REACH words and never to the start, past a number at the very end
    ("I'm 70% sure"), and the cue's tail makes up the time."""
    span = [i for i, w in enumerate(words) if w['unit'] <= last_unit and i > after_pos]
    if not span:
        return None, 0
    end = span[-1]
    ws = _timed(words)
    best = None
    for length in (3, 4, 5):
        for back in range(REACH + 1):
            last = end - back
            pos = last - length + 1
            if pos <= after_pos:
                break
            phrase = ' '.join(tidy(words[pos + k]['w']) for k in range(length))
            if find(ws, phrase, after=float(after_pos)) != (pos, last):
                continue
            risk = sum(word_risk(words[pos + k]['w'], words[pos + k]['first']) for k in range(length))
            risk += 0.6 * any(words[pos + k]['first'] for k in range(1, length))  # across a full stop
            key = (round(risk + 0.25 * back + (0.2 if length > 3 else 0.0), 3), back)
            if best is None or key < best[0]:
                best = (key, phrase, back)
    return (best[1], best[2]) if best else (None, 0)


def build_cues(pics, units):
    """make.py cues for the matched pictures, and the pictures left out."""
    matched, not_shown = match_pictures(pics, units)
    words = script_words(units)
    cues = []
    for m in matched:
        start, pos, skipped = start_anchor(words, m['first'], m['last'])
        end, left = end_anchor(words, m['last'], pos) if start else (None, 0)
        if not start or not end:
            not_shown.append({'id': m['id'], 'why': 'no words in its paragraph are said only there, so make.py could not place it',
                              'nearest_line': units[m['lead']]['text'], 'score': m['score']})
            continue
        cue = {'id': m['id'], 'panel': f'panels/{m["id"]}-{{aspect}}.png', 'start': start, 'end': end}
        if skipped:
            cue['lead'] = round(LEAD + skipped / WORDS_PER_SECOND, 2)
        if left:
            cue['tail'] = round(TAIL + left / WORDS_PER_SECOND, 2)
        cue['line'] = units[m['lead']]['text']
        cue['seconds_in_script'] = round(sum(units[i]['n'] for i in range(m['first'], m['last'] + 1)) / WORDS_PER_SECOND, 1)
        cues.append(cue)
    return cues, not_shown


LOGO_SECONDS = 3.0  # make.py lays the makeyourmindup logo over the tall cut's first 3 seconds


def strap_after(units, cues=()):
    """The words the strap comes in on: as the opening logo leaves, while the
    hook is still on his face, and gone before the first picture comes in.
    None (the strap opens with his first word) when the opening is too short."""
    words = script_words(units)
    if not words:
        return None
    at = round(LOGO_SECONDS * WORDS_PER_SECOND)
    first_panel = min((find(_timed(words), c['start'])[0] for c in cues if find(_timed(words), c['start'])), default=len(words))
    room = round(STRAP_SECONDS * WORDS_PER_SECOND)
    if at + room > first_panel:
        return None
    phrase, pos, _ = start_anchor(words, words[at]['unit'], words[first_panel - 1]['unit'], from_word=at)
    return phrase if phrase is not None and pos + room <= first_panel else None


# ---------------------------------------------------------------- pictures into panels

def border_colour(img):
    """The picture's background: the commonest colour round its edge."""
    w, h = img.size
    px = img.load()
    counts = {}
    step = max(1, min(w, h) // 200)
    for x in range(0, w, step):
        for y in (0, 1, h - 2, h - 1):
            c = px[x, y]
            counts[c] = counts.get(c, 0) + 1
    for y in range(0, h, step):
        for x in (0, 1, w - 2, w - 1):
            c = px[x, y]
            counts[c] = counts.get(c, 0) + 1
    return max(counts, key=counts.get)


def content_mask(img, bg, tolerance=6):
    """Where the picture is not its background. The pictures are flat
    renders, so a card filled a shade off the page (the money map's cards
    are 10 levels off its ink) still counts as content."""
    from PIL import Image, ImageChops
    diff = ImageChops.difference(img, Image.new('RGB', img.size, bg))
    r, g, b = diff.split()
    return ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > tolerance else 0)


def trim(img, bg, margin_frac=0.035):
    mask = content_mask(img, bg)
    box = mask.getbbox()
    if not box:
        return img
    m = round(margin_frac * img.width)
    x0, y0, x1, y1 = max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m)
    return img.crop((x0, y0, x1, y1))


def gap_lines(img, bg, rule_frac=0.03, min_run=None):
    """Rows where the picture is its own background, bar one thin rule (the
    money map's line from step to step), as (centre, start, end): the only
    places it may be cut into columns. A row that crosses a box, even one
    with no fill, has content at both its sides, so it is never a gap."""
    mask = content_mask(img, bg)
    w, h = img.size
    rule = max(2, round(rule_frac * w))
    min_run = min_run or max(12, round(0.006 * h))
    gaps, start, empty = [], None, []
    for y in range(h + 1):
        box = mask.crop((0, y, w, y + 1)).getbbox() if y < h else (0, 0, w, 1)
        if box is None or box[2] - box[0] <= rule:
            start = y if start is None else start
            empty.append(box is None)
        else:
            if start is not None and y - start >= min_run and start > 0 and y < h:
                gaps.append((cut_point(start, empty), start, y))
            start, empty = None, []
    return gaps


def cut_point(start, empty):
    """Where to cut a gap: in the middle of its longest stretch of rows with
    nothing on them at all, so a rule that runs on past a box stays whole
    with it; the middle of the gap when every row has the rule."""
    best, run_start = None, None
    for i, e in enumerate(empty + [False]):
        if e and run_start is None:
            run_start = i
        elif not e and run_start is not None:
            if best is None or i - run_start > best[1] - best[0]:
                best = (run_start, i)
            run_start = None
    if best and best[1] - best[0] >= 2:
        return start + (best[0] + best[1]) // 2
    return start + len(empty) // 2


def split_rows(height, gaps, k):
    """k column bands cut at gaps, as even as the gaps allow: [(top, bottom), ...] or None."""
    if k == 1:
        return [(0, height)]
    cuts = [g[0] for g in gaps]
    if len(cuts) < k - 1:
        return None
    best, best_h = None, None
    for chosen in combinations(cuts, k - 1):
        bands = list(pairwise([0, *chosen, height]))
        tallest = max(b - a for a, b in bands)
        if best_h is None or tallest < best_h:
            best, best_h = bands, tallest
    return best


def fit_picture(img, box_w, box_h, max_cols=3):
    """The picture trimmed to its content and, when it is much taller than the
    box, laid out in columns at its own gaps, then sized to the pixel to fit
    the box. Returns (picture, facts)."""
    from PIL import Image
    src = img.convert('RGB')
    bg = border_colour(src)
    body = trim(src, bg)
    gaps = gap_lines(body, bg)
    gutter = round(body.width * 0.05)
    head = round(0.035 * src.width)  # each later column gets the margin the first has above it
    best = None
    for k in range(1, max_cols + 1):
        bands = split_rows(body.height, gaps, k)
        if not bands:
            continue
        w = k * body.width + (k - 1) * gutter
        h = max(b - a + (head if i else 0) for i, (a, b) in enumerate(bands))
        s = min(box_w / w, box_h / h, MAX_SCALE)
        # Columns only when they show the picture clearly bigger.
        if best is None or s > best['scale'] * 1.06:
            best = {'columns': k, 'bands': bands, 'w': w, 'h': h, 'scale': s}
    sheet = Image.new('RGB', (best['w'], best['h']), bg)
    for i, (a, b) in enumerate(best['bands']):
        sheet.paste(body.crop((0, a, body.width, b)), (i * (body.width + gutter), head if i else 0))
    s = best['scale']
    out = sheet.resize((max(1, round(sheet.width * s)), max(1, round(sheet.height * s))), Image.LANCZOS)
    # How big its words come out in the frame, if it was drawn to SUBSTACK_FIT.
    words_px = ARTICLE_WORDS_PX * src.width / ARTICLE_WIDTH * out.width / sheet.width
    return out, {'columns': best['columns'], 'cuts': [a for a, _ in best['bands'][1:]], 'scale': round(out.width / sheet.width, 3),
                 'size': list(out.size), 'background': '#{:02X}{:02X}{:02X}'.format(*bg[:3]), 'words_px': round(words_px, 1)}


def panel_geometry(shape, pic_w=0, pic_h=0):
    """The panel's size, the box a picture may fill, and, for a picture of
    pic_w x pic_h, where the pill and the picture go: together, as one block,
    in the middle of the panel's height and never above its top line."""
    W, H = PANEL[shape]
    L = PANEL_LAYOUT[shape]
    pill_h = round(L['pill'] * 1.64)
    x0, y0 = L['pad'], L['top'] + pill_h + L['gap']
    area = (x0, y0, W - 2 * L['pad'] - SHADOW_PX, H - y0 - L['bottom'] - SHADOW_PX)
    block = pill_h + L['gap'] + pic_h
    top = L['top'] + max(0, (H - L['bottom'] - SHADOW_PX - L['top'] - block) // 2)
    return {'W': W, 'H': H, 'area': area, 'pill_top': top, 'picture_top': top + pill_h + L['gap'],
            'picture_left': x0 + (area[2] - pic_w) // 2}


def panel_box(shape):
    g = panel_geometry(shape)
    return g['area'][2], g['area'][3]


# ---------------------------------------------------------------- the house style

def mix(hex_a, hex_b, amount):
    a = [int(hex_a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(hex_b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x * (1 - amount) + y * amount):02X}' for x, y in zip(a, b, strict=True))


def style_for(subchannel):
    H = brand.house()
    ch = brand.channel(H, subchannel)
    tok = H['tokens']
    return {'house': H, 'channel': ch, 'ink': tok['ink'], 'cream': tok['cream'], 'mint': tok['mint'],
            'accent': ch['accent'], 'shadow': mix(ch['accent'], tok['ink'], 0.28),
            'site': H['copy'].get('site', 'makeyourmindup.ai')}


def template(name):
    return string.Template((TEMPLATES / name).read_text(encoding='utf-8'))


def png_uri(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=False)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def page_endcard(st, shape, masthead, fonts):
    W, H = FRAME[shape]
    days = ''.join(f'<div class="d"><span class="dn">{html.escape(c["day"])}</span>'
                   f'<span class="cn" style="color:{c["accent"]}">{html.escape(c["name"])}</span></div>'
                   for c in st['house']['channels'])
    return template('endcard.html').substitute(fonts=fonts, W=W, H=H, ink=st['ink'], cream=st['cream'], mint=st['mint'],
                                               shape='tall' if shape == '9x16' else 'wide', masthead=masthead,
                                               tagline=html.escape(TAGLINE), days=days, cta=html.escape(CTA),
                                               site=html.escape(st['site']))


def page_frame16(st, subject, wordmark, fonts):
    sticker = st['channel'].get('sticker')
    return template('frame16.html').substitute(
        fonts=fonts, ink=st['ink'], cream=st['cream'], accent=st['accent'], shadow=st['shadow'],
        channel=html.escape(st['channel']['name']), subject=html.escape(subject),
        sticker=f'<span class="sticker">{html.escape(sticker)}</span>' if sticker else '',
        wordmark=wordmark, days=html.escape(st['channel']['days']), site=html.escape(st['site']))


def page_strap(st, fonts):
    return template('strap.html').substitute(fonts=fonts, ink=st['ink'], cream=st['cream'], accent=st['accent'],
                                             author=html.escape(brand.AUTHOR), channel=html.escape(st['channel']['name']))


def page_panel(st, shape, picture, facts, fonts):
    w, h = facts['size']
    g = panel_geometry(shape, w, h)
    L = PANEL_LAYOUT[shape]
    return template('panel.html').substitute(
        fonts=fonts, W=g['W'], H=g['H'], ink=st['ink'], cream=st['cream'], accent=st['accent'], shadow=st['shadow'],
        pad=L['pad'], top=g['pill_top'], pill=L['pill'], x=g['picture_left'], y=g['picture_top'], w=w, h=h,
        picture_bg=facts['background'], picture=png_uri(picture), channel=html.escape(st['channel']['name']))


# ---------------------------------------------------------------- drawing

CHECK_JS = """() => {
  for (const el of document.querySelectorAll('[data-fit]')) {
    const lines = +el.dataset.fit;
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const lh = () => parseFloat(getComputedStyle(el).lineHeight);
    while (fs > 24 && (el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().height > lines * lh() + 2)) {
      fs -= 2; el.style.fontSize = fs + 'px';
    }
  }
  const W = innerWidth, H = innerHeight, bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1))
      bad.push(el.tagName + '.' + el.className + ' runs past the edge ' + JSON.stringify([Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]));
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'hidden' && el.clientWidth)
      bad.push(el.tagName + '.' + el.className + ' is wider than its box');
  }
  for (const el of document.querySelectorAll('.card, .inkcard')) {
    const r = el.getBoundingClientRect();
    if (r.bottom + 16 > H - 8 || r.right + 16 > W - 8) bad.push('the card\\'s shadow runs to the edge');
  }
  for (const img of document.querySelectorAll('img')) if (!img.complete || !img.naturalWidth) bad.push('a picture did not load');
  return bad;
}"""


class Drawer:
    """One browser for every picture in a run, started only when something needs drawing."""

    def __init__(self):
        self._pw = self._browser = self._page = None

    def page(self):
        if not self._page:
            self._pw = brand.playwright().start()
            self._browser = brand.browser(self._pw)
            self._page = self._browser.new_page(device_scale_factor=1)
        return self._page

    def shoot(self, doc, size, path, clear=False):
        pg = self.page()
        pg.set_viewport_size({'width': size[0], 'height': size[1]})
        pg.set_content(doc, wait_until='load')
        pg.evaluate('document.fonts.ready.then(() => true)')
        bad = pg.evaluate(CHECK_JS)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(path), omit_background=clear, clip={'x': 0, 'y': 0, 'width': size[0], 'height': size[1]})
        return bad

    def close(self):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()
        self._pw = self._browser = self._page = None


def endcard_video(png, mp4, seconds=ENDCARD_SECONDS):
    """A still as a clip make.py can join: 30 fps, a fade in from ink, a silent 48 kHz stereo track."""
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', str(png),
                    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', str(seconds),
                    '-vf', 'fade=t=in:st=0:d=0.4:color=0x0C1512,format=yuv420p', '-r', '30',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', str(mp4)],
                   check=True)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def sha256_text(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


# ---------------------------------------------------------------- the starter config

def relative(path, base):
    """`path` as make.py reads it from a config in `base`: relative when it can be."""
    try:
        return Path(os.path.relpath(Path(path).resolve(), Path(base).resolve())).as_posix()
    except ValueError:  # another drive on Windows
        return str(Path(path).resolve())


def starter_config(post, cut, recording, out, cues, strap_words, post_path):
    shape = CUT_SHAPE[cut]
    cfg = {
        'name': f'{slug(post["subject"], 40)}-{cut}',
        'source': relative(recording, out),
        'crop': 'auto',
        'subject': post['subject'],
        'date': post['date'],
        'piece_id': post.get('piece_id'),
        'tiktok': True,
        'intro': 'auto',
        'music': 'auto',
        'script': f'{cut}-script.txt',
        'remove': [],
        'replacements': [],
        'endcard': {'9x16': 'endcard-9x16.mp4', '16x9': 'endcard-16x9.mp4'},
        'frame16': 'frame-16x9.png',
        'strap': {'png': 'strap-9x16.png', 'after': strap_words, 'seconds': STRAP_SECONDS},
        'cues': cues,
        'kit': {
            'made_by': 'scripts/quick-edit/kit.py', 'post': str(post_path), 'cut': cut, 'shape': shape,
            'plan': f'python scripts/quick-edit/make.py "{Path(out) / (cut + ".json")}" --out <render folder> --only {shape} --plan',
            'note': ('The cue words are the script\'s. Run --plan on the recording; where a cue is not found, '
                     'put the words Krish said there. "remove" and "replacements" are for the stumbles and misheard '
                     'names the plan shows.'),
        },
    }
    if not strap_words:
        cfg['strap'].pop('after')
    if not cfg['piece_id']:
        cfg.pop('piece_id')
    return cfg


def write_config(path, cfg, recorded_sha, force=False):
    """Writes the starter config unless it was edited by hand since kit.py
    wrote it; then the new one goes beside it. Returns (path written, sha256, kept_edits)."""
    text = json.dumps(cfg, indent=1, ensure_ascii=False) + '\n'
    path = Path(path)
    if path.exists() and not force:
        now = sha256_file(path)
        if recorded_sha is None or now != recorded_sha:
            if path.read_text(encoding='utf-8') == text:
                return path, now, False
            beside = path.with_name(path.stem + '.kit-new.json')
            beside.write_text(text, encoding='utf-8')
            return beside, sha256_text(text), True
    path.write_text(text, encoding='utf-8')
    return path, sha256_text(text), False


# ---------------------------------------------------------------- the run

def make_kit(post_path, cut, recording, out, roots=(), force=False, drawer=None, logos=None, log=print):
    post_path = Path(post_path).resolve()
    post = load_post(post_path)
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    roots = [Path(r).resolve() for r in roots] + [post_path.parent]
    shape = CUT_SHAPE[cut]
    st = style_for(post['subchannel'])
    receipt_path = out / 'kit.json'
    try:
        receipt = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {}
    except ValueError:
        receipt = {}
    if receipt.get('piece_id') and post.get('piece_id') and receipt['piece_id'] != post['piece_id']:
        raise KitError(f'{out} holds the kit for another piece ({receipt.get("subject")}); use a folder of its own')
    made = receipt.get('made', {})
    warnings, problems, files = [], [], {}
    paragraphs, script_from = script_for(post, cut, roots)
    pics = pictures(post, post_path, roots)
    fonts = brand.font_css()
    logos = logos or {'masthead': brand.brand_uri('masthead', full=True), 'wordmark': brand.brand_uri('wordmark', full=True)}
    own = drawer is None
    drawer = drawer or Drawer()

    def draw(rel, doc, size, clear=False):
        sig = sha256_text(f'{KIT_VERSION}\n{doc}')
        path = out / rel
        if path.exists() and made.get(rel) == sig:
            log(f'kept  {rel}')
            return path, False
        bad = drawer.shoot(doc, size, path, clear)
        made[rel] = sig
        if bad:
            problems.append(f'{rel}: {"; ".join(bad)}')
            made.pop(rel)
        log(('CHECK ' if bad else 'made  ') + rel + (f'  {bad}' if bad else ''))
        return path, True

    try:
        for sh in ('9x16', '16x9'):
            png, _ = draw(f'endcard-{sh}.png', page_endcard(st, sh, logos['masthead'], fonts), FRAME[sh])
            mp4 = out / f'endcard-{sh}.mp4'
            sig = f'{sha256_file(png)}:{ENDCARD_SECONDS}:{KIT_VERSION}'
            if mp4.exists() and made.get(mp4.name) == sig:
                log(f'kept  {mp4.name}')
            else:
                endcard_video(png, mp4)
                made[mp4.name] = sig
                log(f'made  {mp4.name}')
        draw('frame-16x9.png', page_frame16(st, post['subject'], logos['wordmark'], fonts), FRAME['16x9'])
        draw('strap-9x16.png', page_strap(st, fonts), FRAME['9x16'], clear=True)
        panels = receipt.get('panels', {})
        drawn = set()  # the pictures panelled in this run: a panel left from an earlier run is never cued
        from PIL import Image
        for pic in pics:
            if not pic['file']:
                warnings.append(f'{pic["id"]}: its picture {pic["entry"]["file"]!r} is not beside post.json or in --files, so it has no panel')
                continue
            with Image.open(pic['file']) as opened:
                img = opened.convert('RGB')
            info = {'source': str(pic['file']), 'source_sha256': sha256_file(pic['file']), 'label': pic['label'], 'shapes': {}}
            for sh in ('9x16', '16x9'):
                picture, facts = fit_picture(img, *panel_box(sh))
                facts['floor_px'] = FLOOR_PX[sh]
                facts['legible'] = facts['words_px'] >= FLOOR_PX[sh]
                draw(f'panels/{pic["id"]}-{sh}.png', page_panel(st, sh, picture, facts, fonts), PANEL[sh])
                info['shapes'][sh] = facts
            panels[pic['id']] = info
            drawn.add(pic['id'])
    finally:
        if own:
            drawer.close()

    units = script_units(paragraphs)
    cues, not_shown = build_cues([p for p in pics if p['id'] in drawn], units)
    for c in cues:
        facts = panels[c['id']]['shapes'][shape]
        if not facts['legible']:
            warnings.append(f'{c["id"]}: in the {shape} panel its words come out about {facts["words_px"]:g} px, under the '
                            f'{FLOOR_PX[shape]} px a viewer can read ({PHONE_FLOOR_PX} px at {SHOWN_AT[shape]} wide, house rule '
                            f'SUBSTACK_FIT); look at panels/{c["id"]}-{shape}.png, and draw a panel for video or drop the cue')
    for n in not_shown:
        warnings.append(f'{n["id"]}: not cued ({n["why"]}); its panels are drawn if a cue is wanted')
    script_path = out / f'{cut}-script.txt'
    script_path.write_text('\n\n'.join(paragraphs) + '\n', encoding='utf-8')
    rec = Path(recording)
    if not rec.is_file():
        warnings.append(f'the recording {rec} is not there yet; the config points at it')
    cfg = starter_config(post, cut, rec, out, cues, strap_after(units, cues), post_path)
    cut_receipt = receipt.get('cuts', {}).get(cut, {})
    cfg_path, cfg_sha, kept = write_config(out / f'{cut}.json', cfg, cut_receipt.get('config_sha256'), force)
    if kept:
        warnings.append(f'{cut}.json was edited by hand since kit.py wrote it, so it is kept; the new one is {cfg_path.name} '
                        '(--force replaces it)')
    for rel in sorted(made):
        p = out / rel
        if p.exists():
            files[rel] = {'sha256': sha256_file(p), 'bytes': p.stat().st_size}
    receipt = {
        'schema_version': 1, 'made_by': 'scripts/quick-edit/kit.py', 'post': str(post_path), 'piece_id': post.get('piece_id'),
        'subchannel': st['channel']['name'], 'subject': post['subject'], 'date': post['date'],
        'files': files, 'panels': panels,
        'cuts': {**receipt.get('cuts', {}), cut: {
            'shape': shape, 'config': (out / f'{cut}.json').name, 'config_sha256': cfg_sha if not kept else cut_receipt.get('config_sha256'),
            'written': cfg_path.name, 'script': script_path.name, 'script_from': script_from, 'recording': str(rec),
            'cues': cues, 'not_cued': not_shown, 'warnings': warnings}},
        'problems': problems, 'made': made,
    }
    receipt_path.write_text(json.dumps(receipt, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return {'out': str(out), 'config': str(cfg_path), 'cut': cut, 'shape': shape, 'cues': cues, 'not_cued': not_shown,
            'warnings': warnings, 'problems': problems}


# ---------------------------------------------------------------- self-test

SELF_SCRIPT = [
    'Everyone says the cheapest model always wins. So who really pays when a fan makes a song with AI, and who is left waiting?',
    ('You pay the app to download your song. The labels get a portion of the revenue, and the artist waits. '
     'Think of a wedding band booked through an agency.'),
    'On 18 September two labels sued the app over sixty thousand recordings. The other label settled and became a partner.',
    'So here is the thing about licences. A licence can become evidence against you.',
    'My call: by the end of next year the suers will have a licensing deal with the app. I am seventy percent sure.',
    'The full article has the money map and the court papers, free at makeyourmindup.ai. I\'m Krish. Make your mind up.',
]


def self_test():
    from PIL import Image, ImageDraw
    checks = []

    def check(label, got, want):
        checks.append((label, got, want))

    # The script into sentences, and which may carry a picture.
    units = script_units(SELF_SCRIPT)
    check('sentences split at full stops and question marks', [len(sentences(p)) for p in SELF_SCRIPT], [2, 3, 2, 2, 2, 3])
    check('the opening line and the call to action (three sentences) carry no picture',
          [i for i, u in enumerate(units) if not u['open']], [0, len(units) - 3, len(units) - 2, len(units) - 1])

    pics = [
        {'id': 'money', 'words': 'The money path from one fan\'s song: the fan pays the app to download, the labels get a portion of the revenue, the artist waits'},
        # Like Monday's two camps, it also names the revenue share the money map shows; in the article's order it still lands on its own beat.
        {'id': 'camps', 'words': 'The partners and the suers: which label settled and became a partner, which labels sued over the recordings. '
                                 'Since the deal the labels get a portion of the revenue'},
        {'id': 'call', 'words': 'Our call: a licensing deal by the end of next year, seventy percent sure'},
        {'id': 'hook', 'words': 'Everyone says the cheapest model always wins'},
    ]
    cues, not_shown = build_cues(pics, units)
    got = {c['id']: (c['start'], c['end']) for c in cues}
    check('each picture goes to the paragraph that names it', sorted(got), ['call', 'camps', 'money'])
    check('the money picture comes in on its paragraph\'s first words', got.get('money', (None,))[0], 'you pay the app')
    check('and leaves on its last', got.get('money', (None, None))[1], 'through an agency')
    lines = {c['id']: c['line'] for c in cues}
    check('two pictures that name the same thing each land on their own paragraph, in the article\'s order',
          (lines.get('money', '')[:15], lines.get('camps', '')[:20]), ('The labels get ', 'The other label sett'))
    camps = next((c for c in cues if c['id'] == 'camps'), {})
    check('a cue never starts on a number: "On 18 September two" is stepped over, and lead makes up the time',
          (bool(re.search(r'\d', camps.get('start', '0'))), camps.get('lead')), (False, round(0.15 + 4 / 2.5, 2)))
    call = next((c for c in cues if c['id'] == 'call'), {})
    check('nor ends on one: "I am seventy percent sure" is stepped back over, and tail makes up the time',
          (call.get('end'), call.get('tail')), ('with the app', round(0.35 + 5 / 2.5, 2)))
    check('a picture only the opening line names is not cued, and says why', [(n['id'], 'opening line' in n['why']) for n in not_shown], [('hook', True)])
    check('the strap comes in as the opening logo leaves (word 8, 3 s in), and is gone before the first picture',
          strap_after(units, cues), 'who really pays when')
    check('with no room before the first picture, it opens with his first word', strap_after(units, [{'start': 'makes a song with'}]), None)

    # Every cue is found by make.py's own matching, where it is meant to be.
    ws, t = [], 0.0
    for w in ' '.join(SELF_SCRIPT).split():
        ws.append({'w': w, 's': round(t, 2), 'e': round(t + 0.3, 2)})
        t += 0.4
    try:
        sys.path.insert(0, str(HERE))
        import make
        found, missing = make.cue_windows(ws, cues, t)
        same = all(make.norm(x) == norm(x) for x in ('Suno\'s', '70%', '$5.4', 'makeyourmindup.ai', '"a portion"'))
        check('make.py places every cue and misses none', (len(found), missing), (3, []))
        check('the money cue covers its paragraph in time', [round(c['s'], 2) for c in found if c['id'] == 'money'],
               [round(ws[[norm(w['w']) for w in ws].index('you')]['s'] - 0.15, 2)])
        check('kit.py matches words exactly as make.py does', same, True)
    except Exception as e:  # noqa: BLE001 make.py must import for this check
        check(f'make.py imports for the cue check ({type(e).__name__}: {e})', False, True)

    # A start phrase said earlier in the script is lengthened or moved until make.py finds it in its own place.
    twice = ['Hello there. So here is the thing, and it matters.', 'So here is the thing about money. It moves.']
    u2 = script_units(twice)
    w2 = script_words(u2)
    phrase, pos, _ = start_anchor(w2, 2)
    ws2 = _timed(w2)
    check('a start phrase said twice is still found in its own place', find(ws2, phrase)[0] if phrase else None, pos)

    # A tall picture with gaps goes into columns at a gap; a wide one does not.
    tall = Image.new('RGB', (1200, 3000), (12, 21, 18))
    d = ImageDraw.Draw(tall)
    d.rectangle((100, 100, 1100, 900), fill=(244, 239, 228))
    # A box with no fill (only its sides cross most rows), and a card filled a
    # shade off the page, as the money map's are: neither may be cut through.
    d.rectangle((100, 1000, 1100, 1900), outline=(126, 240, 192), width=3)
    d.rectangle((150, 1050, 600, 1150), fill=(244, 239, 228))
    d.rectangle((100, 2000, 1100, 2900), fill=(22, 33, 29))
    d.rectangle((150, 2050, 600, 2150), fill=(244, 239, 228))
    d.rectangle((60, 100, 72, 1900), fill=(126, 240, 192))  # a thin rule across the first gap, like the money map's
    between = ((900, 1000), (1900, 2000))
    top = content_mask(tall, (12, 21, 18)).getbbox()[1] - round(0.035 * tall.width)  # where trim starts
    found = [g[0] + top for g in gap_lines(trim(tall, (12, 21, 18)), (12, 21, 18))]
    check('the only gaps are between the blocks: never inside a box with no fill, nor a card a shade off the page',
          (len(found), all(any(a < y < b for a, b in between) for y in found)), (2, True))
    box = panel_box('16x9')
    pic, facts = fit_picture(tall, *box)
    check('a tall picture goes into two columns for the wide panel', facts['columns'], 2)
    body_cut = facts['cuts'][0] if facts['cuts'] else None
    check('it is cut in a gap, never through a block', body_cut is not None and any(a <= body_cut <= b for a, b in ((850, 1000), (1850, 2000))), True)
    check('it fits the panel', pic.width <= box[0] and pic.height <= box[1], True)
    wide = Image.new('RGB', (1600, 1000), (7, 13, 11))
    ImageDraw.Draw(wide).rectangle((40, 40, 1560, 960), fill=(200, 200, 200))
    pic, facts = fit_picture(wide, *panel_box('9x16'))
    check('a wide picture stays whole', (facts['columns'], pic.width), (1, panel_box('9x16')[0]))
    check('the readable floor is 39 px tall and 21 px wide', (FLOOR_PX['9x16'], FLOOR_PX['16x9']), (39, 21))

    # Every template fills, with nothing left over.
    st = {'house': {'channels': [{'day': 'Monday', 'name': 'follow.the.money', 'accent': '#FFD84D'}]},
          'channel': {'name': 'follow.the.money', 'days': 'Mondays', 'sticker': 'Bring a calculator'},
          'ink': '#0C1512', 'cream': '#F4EFE4', 'mint': '#7EF0C0', 'accent': '#FFD84D', 'shadow': '#BBA13C', 'site': 'makeyourmindup.ai'}
    dot = png_uri(Image.new('RGB', (8, 8), (12, 21, 18)))
    small = Image.new('RGB', (100, 60), (12, 21, 18))
    docs = [page_endcard(st, '9x16', dot, ''), page_endcard(st, '16x9', dot, ''), page_frame16(st, 'Who gets paid & why', dot, ''),
            page_strap(st, ''), page_panel(st, '9x16', small, {'size': [100, 60], 'background': '#0C1512'}, '')]
    left = [m for doc in docs for m in re.findall(r'\$\{?[A-Za-z_]\w*', doc)]
    check('every template is filled, and text is escaped', (left, 'Who gets paid &amp; why' in docs[2]), ([], True))
    check('the shadow is the subchannel colour, darker', mix('#B7A6FF', '#0C1512', 0.28), '#877DBD')

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # The end card clip: 4 seconds, 30 fps, a silent 48 kHz stereo track.
        if shutil.which('ffmpeg') and shutil.which('ffprobe'):
            png = tmp / 'end.png'
            Image.new('RGB', (1080, 1920), (12, 21, 18)).save(png)
            endcard_video(png, tmp / 'end.mp4')
            probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,r_frame_rate,sample_rate,channels:format=duration',
                                               '-of', 'json', str(tmp / 'end.mp4')], capture_output=True, text=True, check=True).stdout)
            streams = {s['codec_type']: s for s in probe['streams']}
            check('the end card clip is 4 s, 30 fps, silent 48 kHz stereo',
                  (round(float(probe['format']['duration'])), streams['video']['r_frame_rate'], streams['audio']['sample_rate'], streams['audio']['channels']),
                  (4, '30/1', '48000', 2))
        else:
            check('ffmpeg and ffprobe are on the PATH for the end card check', False, True)

        # The starter config: what make.py needs, paths from the config's folder, a name ffmpeg can take.
        out = tmp / 'kit'
        out.mkdir()
        (tmp / 'rec').mkdir()
        post = {'subject': 'Who gets paid: AI songs?', 'date': '2026-10-12', 'piece_id': 'p1', 'subchannel': 'follow.the.money'}
        cfg = starter_config(post, 'short', tmp / 'rec' / 'take 2.mov', out, cues, 'so who really pays', tmp / 'post.json')
        need = {'name', 'source', 'crop', 'cues', 'endcard', 'frame16', 'intro', 'music', 'tiktok', 'subject', 'date', 'script'}
        check('the starter config has everything make.py reads', sorted(need - set(cfg)), [])
        check('the recording is found from the config\'s folder', cfg['source'], '../rec/take 2.mov')
        check('the name is safe in an ffmpeg filter', (bool(re.fullmatch(r'[a-z0-9-]+', cfg['name'])), cfg['name']), (True, 'who-gets-paid-ai-songs-short'))
        check('intro and music are on auto, TikTok on', (cfg['intro'], cfg['music'], cfg['tiktok']), ('auto', 'auto', True))
        path, sha, kept = write_config(out / 'short.json', cfg, None)
        check('the first config is written', (path.name, kept), ('short.json', False))
        edited = json.loads(path.read_text())
        edited['remove'] = [{'say': 'um', 'after': 'the app'}]
        path.write_text(json.dumps(edited))
        path2, _, kept = write_config(out / 'short.json', cfg, sha)
        stumble = '"say": "um"'
        check('a hand-edited config is kept and the new one goes beside it', (path2.name, kept, stumble in path.read_text()),
              ('short.kit-new.json', True, True))
        path3, _, kept = write_config(out / 'short.json', cfg, sha, force=True)
        check('--force replaces it', (path3.name, kept, stumble in path.read_text()), ('short.json', False, False))

        # The pictures as panels, in a real browser, when this machine has one.
        # Skipped only when this machine has no Playwright or no browser
        # (CI has neither); once a browser is up, a drawing fault fails.
        browser_note = ''
        drawer = Drawer()
        try:
            import playwright  # noqa: F401
            drawer.page()
        except (ImportError, SystemExit, Exception) as e:  # noqa: BLE001
            browser_note = f' (browser checks skipped: no browser here, {type(e).__name__})'
        if not browser_note:
            try:
                fonts = brand.font_css()
                frame = drawer.shoot(page_frame16(st, 'Who gets paid for AI songs', dot, fonts), FRAME['16x9'], tmp / 'frame.png')
                pic, facts = fit_picture(tall, *panel_box('9x16'))
                panel = drawer.shoot(page_panel(st, '9x16', pic, facts, fonts), PANEL['9x16'], tmp / 'panel.png')
                with Image.open(tmp / 'frame.png') as a, Image.open(tmp / 'panel.png') as b:
                    sizes = (a.size, b.size)
                check('in a browser, the frame and a panel draw at their sizes with nothing past an edge',
                      (frame, panel, sizes), ([], [], ((1920, 1080), (1080, 1000))))
            finally:
                drawer.close()

    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'kit self-test passed: {len(checks)} checks{browser_note}')
    return 1 if bad else 0


# ---------------------------------------------------------------- command line

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--self-test']:
        return self_test()
    ap = argparse.ArgumentParser(description='The shared per-piece kit for quick-edit: end cards, the wide frame, panels and a starter config.')
    ap.add_argument('post', help="the piece's post.json")
    ap.add_argument('--cut', required=True, choices=sorted(CUT_SHAPE), help='long (the 16:9 cut) or short (the 9:16 cut)')
    ap.add_argument('--recording', required=True, help="the cut's recording; the config points at it")
    ap.add_argument('--out', required=True, help='the folder to write the kit into; both cuts can share one')
    ap.add_argument('--files', action='append', default=[], help="where the post's pictures and scripts are, if not beside post.json "
                                                                 '(a working folder or the packed library folder); may repeat')
    ap.add_argument('--force', action='store_true', help='replace a <cut>.json edited by hand')
    ap.add_argument('--json', action='store_true', help='print the result as JSON')
    args = ap.parse_args(argv)
    say = (lambda *_: None) if args.json else print
    try:
        result = make_kit(args.post, args.cut, args.recording, args.out, args.files, args.force, log=say)
    except KitError as e:
        print(f'kit: {e}', file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, indent=1, ensure_ascii=False))
    else:
        for c in result['cues']:
            print(f'cue   {c["id"]}: "{c["start"]}" to "{c["end"]}"  ({c["line"][:70]})')
        for w in result['warnings']:
            print(f'note  {w}')
        for p in result['problems']:
            print(f'CHECK {p}')
        print(f'wrote {result["config"]}')
        print(f'next  python scripts/quick-edit/make.py {result["config"]} --out <render folder> --only {result["shape"]} --plan')
    return 1 if result['problems'] else 0


if __name__ == '__main__':
    sys.exit(main())
