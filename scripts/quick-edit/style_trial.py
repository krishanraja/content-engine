#!/usr/bin/env python3
"""Style trial: render a short 9:16 test clip in a style from the bank.

A trial renderer, not part of make.py or episode.py. It takes one take, its
word timings (faster-whisper words with s/e seconds on the take's own clock),
a start and an end time, a recipe (which style modules to use, ids from
config/style-references.json) and optional cutaways, and writes a 1080x1920
H.264 clip at the take's frame rate with his own sound, plus a contact sheet
and a report. See STYLE_TRIAL.md next to this file.

Modules it knows:
  full-face-vertical      the speaker fills the tall frame, close
  treated-background      person mask, room softened, darkened, graded to ink
  kinetic-serif-captions  2-4 words at a time, light/bold sans + italic serif payoff
  word-bounce-in          each word arrives on its frame with an overshoot
  dark-object-card        full-screen dark grainy card, two words, real logos
  constant-motion         a slow push inside every shot, punch-in cuts, drifting cards

Every time on the command line (start, end, cutaways) is on the take's clock.
Run it with the Python that has mediapipe and cv2 (.cache/py312/bin/python).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FONT_DIR = HERE / 'fonts-trial'
SANS_FILE = FONT_DIR / 'outfit' / 'Outfit[wght].ttf'
SERIF_FILE = FONT_DIR / 'playfairdisplay' / 'PlayfairDisplay-Italic[wght].ttf'
DEFAULT_LOGO_DIR = REPO / 'docs' / 'plans' / '2026-10-14-wednesday' / 'logos'

W, H = 1080, 1920
FPS = 24
INK = np.array([12, 21, 18], np.float32)          # brand ink #0C1512
CREAM = np.array([250, 246, 238], np.float32)
PEACH = np.array([247, 160, 118], np.float32)     # warm end of the payoff gradient
SAFE_TOP = 0.12                                    # platform UI above this
SAFE_BOTTOM = 0.82                                 # platform UI below this

MODULES = (
    'full-face-vertical',
    'treated-background',
    'kinetic-serif-captions',
    'word-bounce-in',
    'dark-object-card',
    'constant-motion',
)

# Type: sizes in px at 1080 wide; weights on the variable axes.
SANS_SIZE = 80
SERIF_SIZE = 128
CARD_WORD_SIZE = 92
LIGHT_WGHT = 300
BOLD_WGHT = 700
SERIF_WGHT = 600

STOP = set('a an and are as at be but by for from had has have he her his i if in into is it its '
           'me my no not of on or our so than that the their them then there these they this to '
           'was we were what when which who will with you your'.split())


# ----------------------------------------------------------------------------- small helpers

def log(msg):
    print(msg, flush=True)


def clean_word(w):
    """Caption text for a whisper word: no surrounding space, no punctuation, typographic apostrophe."""
    t = w.strip()
    t = re.sub(r'[.,;:!?"“”]', '', t)
    return t.replace("'", '’')


def key_word(w):
    return re.sub(r"[^a-z0-9']", '', w.strip().lower().replace('’', "'"))


def ease_out_cubic(u):
    u = min(max(u, 0.0), 1.0)
    return 1 - (1 - u) ** 3


def ease_in_out(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def bounce_scale(t, dur=0.18, peak=1.08, start=0.0):
    """Scale ~0 -> ~108% -> 100% over dur seconds (t is seconds since arrival)."""
    if t <= 0:
        return start
    up = dur * 0.6
    if t < up:
        return start + (peak - start) * ease_out_cubic(t / up)
    if t < dur:
        return peak + (1.0 - peak) * ease_in_out((t - up) / (dur - up))
    return 1.0


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


# ----------------------------------------------------------------------------- fonts

_font_cache: dict = {}


def font(kind, size):
    key = (kind, size)
    if key not in _font_cache:
        path, wght = {
            'light': (SANS_FILE, LIGHT_WGHT),
            'bold': (SANS_FILE, BOLD_WGHT),
            'serif': (SERIF_FILE, SERIF_WGHT),
        }[kind]
        if not path.exists():
            raise SystemExit(f'font missing: {path} (fetch it into fonts-trial/, see STYLE_TRIAL.md)')
        f = ImageFont.truetype(str(path), size)
        f.set_variation_by_axes([wght])
        _font_cache[key] = f
    return _font_cache[key]


def check_glyphs(texts):
    """Refuse text the trial faces cannot draw (Pillow would draw a box, not fall back)."""
    from fontTools.ttLib import TTFont
    missing = []
    for path in (SANS_FILE, SERIF_FILE):
        cmap = TTFont(str(path)).getBestCmap()
        for kind_text in texts:
            for ch in kind_text:
                if ch != ' ' and ord(ch) not in cmap:
                    missing.append((path.name, ch))
    if missing:
        raise SystemExit(f'glyphs missing from the trial faces: {sorted(set(missing))}')
    return True


# ----------------------------------------------------------------------------- sprites

@dataclass
class Sprite:
    rgb: np.ndarray       # premultiplied, float32 0-255, h x w x 3
    a: np.ndarray         # alpha float32 0-1, h x w
    ax: float             # anchor x inside the sprite (centre of the ink)
    ay: float             # anchor y inside the sprite
    left: float = 0.0     # pen x of the text start inside the sprite
    base: float = 0.0     # baseline y inside the sprite
    adv: float = 0.0      # advance width of the text
    ink: tuple = (0, 0, 0, 0)   # text ink box relative to the anchor (x0, y0, x1, y1)


def text_sprite(text, kind, size, glow=True, grad=None):
    """grad=(x, width): where this word starts inside its line and the line's width, so a
    payoff phrase carries one gradient across all its words."""
    f = font(kind, size)
    asc, desc = f.getmetrics()
    adv = f.getlength(text)
    pad = int(size * 0.55)
    w, h = int(math.ceil(adv)) + 2 * pad, asc + desc + 2 * pad
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).text((pad, pad + asc), text, font=f, fill=255, anchor='ls')
    m = np.asarray(mask, np.float32) / 255.0
    if kind == 'serif':
        off, span = grad if grad else (0.0, adv)
        xs = np.clip((np.arange(w, dtype=np.float32) - pad + off) / max(span, 1.0), 0, 1)
        g = (xs ** 0.8)[None, :, None]
        col = PEACH[None, None, :] * (1 - g) + CREAM[None, None, :] * g
        col = np.broadcast_to(col, (h, w, 3))
        glow_col, glow_a, glow_s = np.array([255, 170, 120], np.float32), 0.55, size * 0.16
    else:
        col = np.broadcast_to(CREAM[None, None, :], (h, w, 3))
        glow_col, glow_a, glow_s = np.array([255, 250, 242], np.float32), 0.30, size * 0.15
    rgb = col * m[..., None]
    a = m.copy()
    if glow:
        gl = cv2.GaussianBlur(m, (0, 0), glow_s) * glow_a
        rgb = rgb + glow_col[None, None, :] * (gl * (1 - a))[..., None]
        a = a + gl * (1 - a)
    # soft shadow for legibility on a light shirt; black adds alpha only
    sh = cv2.GaussianBlur(m, (0, 0), size * 0.10)
    sh = np.roll(sh, int(size * 0.05), axis=0) * 0.45
    a = a + sh * (1 - a)
    ys, xs_ = np.nonzero(m > 0.1)
    ax = (xs_.min() + xs_.max()) / 2 if len(xs_) else w / 2
    ay = (ys.min() + ys.max()) / 2 if len(ys) else h / 2
    sp = Sprite(rgb.astype(np.float32), a.astype(np.float32), ax, ay, pad, pad + asc, adv)
    sp.ink = (xs_.min() - ax, ys.min() - ay, xs_.max() - ax, ys.max() - ay) if len(xs_) else (0, 0, 0, 0)
    return sp


def image_sprite(rgba, glow_col=(255, 214, 170), glow=(0.55, 0.30)):
    """Premultiplied sprite from an RGBA uint8 image, plus a separate glow sprite."""
    a = rgba[..., 3].astype(np.float32) / 255.0
    rgb = rgba[..., :3].astype(np.float32) * a[..., None]
    h, w = a.shape
    padc = int(max(h, w) * 0.45)
    A = np.zeros((h + 2 * padc, w + 2 * padc), np.float32)
    A[padc:padc + h, padc:padc + w] = a
    g = cv2.GaussianBlur(A, (0, 0), max(h, w) * 0.05) * glow[0] + cv2.GaussianBlur(A, (0, 0), max(h, w) * 0.16) * glow[1]
    g = np.clip(g, 0, 1)
    gc = np.array(glow_col, np.float32)
    glow_sp = Sprite((gc[None, None, :] * g[..., None]).astype(np.float32), g, (w + 2 * padc) / 2, (h + 2 * padc) / 2)
    return Sprite(rgb, a, w / 2, h / 2), glow_sp


def blit(frame, sp: Sprite, x, y, scale=1.0, alpha=1.0, mode='over'):
    """Draw sprite with its anchor at (x, y) on frame (float32 0-255, in place)."""
    if alpha <= 0.004 or scale <= 0.03:
        return
    if abs(scale - 1.0) > 1e-3:
        hh, ww = sp.a.shape
        nw, nh = max(1, int(round(ww * scale))), max(1, int(round(hh * scale)))
        interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
        rgb = cv2.resize(sp.rgb, (nw, nh), interpolation=interp)
        a = cv2.resize(sp.a, (nw, nh), interpolation=interp)
        ax, ay = sp.ax * nw / ww, sp.ay * nh / hh
    else:
        rgb, a, ax, ay = sp.rgb, sp.a, sp.ax, sp.ay
    x0, y0 = int(round(x - ax)), int(round(y - ay))
    h, w = a.shape
    fx0, fy0 = max(0, x0), max(0, y0)
    fx1, fy1 = min(frame.shape[1], x0 + w), min(frame.shape[0], y0 + h)
    if fx1 <= fx0 or fy1 <= fy0:
        return
    sx0, sy0 = fx0 - x0, fy0 - y0
    sub_rgb = rgb[sy0:sy0 + fy1 - fy0, sx0:sx0 + fx1 - fx0]
    sub_a = a[sy0:sy0 + fy1 - fy0, sx0:sx0 + fx1 - fx0] * alpha
    region = frame[fy0:fy1, fx0:fx1]
    if mode == 'screen':
        add = sub_rgb * alpha
        region[:] = region + add * (1 - region / 255.0)
    else:
        region[:] = region * (1 - sub_a[..., None]) + sub_rgb * alpha


# ----------------------------------------------------------------------------- logos

def find_chrome():
    cands = sorted(Path('/opt/pw-browsers').glob('chromium_headless_shell-*/chrome-linux/headless_shell'))
    cands += sorted(Path('/opt/pw-browsers').glob('chromium-*/chrome-linux/chrome'))
    for c in cands:
        if c.exists():
            return str(c)
    for name in ('chromium', 'chromium-browser', 'google-chrome', 'headless_shell'):
        p = shutil.which(name)
        if p:
            return p
    raise SystemExit('no headless Chromium found to rasterise the SVG logos')


def svg_aspect(svg_text):
    m = re.search(r'viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)', svg_text)
    if m:
        return float(m.group(3)) / float(m.group(4))
    mw = re.search(r'<svg[^>]*\bwidth="([\d.]+)', svg_text)
    mh = re.search(r'<svg[^>]*\bheight="([\d.]+)', svg_text)
    return float(mw.group(1)) / float(mh.group(1)) if mw and mh else 1.0


def raster_logo(svg_path: Path, cache_dir: Path, long_side=1400):
    """Rasterise an SVG (real logo, unaltered) with headless Chromium, trimmed to its ink."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / (svg_path.stem + f'-{long_side}.png')
    if not out.exists():
        aspect = svg_aspect(svg_path.read_text(errors='replace'))
        w, h = (long_side, int(round(long_side / aspect))) if aspect >= 1 else (int(round(long_side * aspect)), long_side)
        with tempfile.TemporaryDirectory() as td:
            html = Path(td) / 'logo.html'
            html.write_text('<!doctype html><html><body style="margin:0;background:transparent">'
                            f'<img src="{svg_path.resolve().as_uri()}" style="display:block;width:{w}px;height:{h}px">'
                            '</body></html>')
            run([find_chrome(), '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                 '--default-background-color=00000000', f'--window-size={w},{h}',
                 f'--screenshot={out}', html.as_uri()], capture_output=True, timeout=120)
    im = np.array(Image.open(out).convert('RGBA'))
    ys, xs = np.nonzero(im[..., 3] > 8)
    if not len(xs):
        raise SystemExit(f'logo rendered empty: {svg_path}')
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


# ----------------------------------------------------------------------------- words and timing

def load_words(path, start, end):
    d = json.loads(Path(path).read_text())
    words = d['words'] if isinstance(d, dict) else d
    out = []
    for i, w in enumerate(words):
        if w['e'] > start and w['s'] < end:
            out.append({'i': i, 'w': w['w'], 's': float(w['s']), 'e': float(w['e'])})
    return out, words


def audio_envelope(take, t0, t1, sr=16000, hop=0.01):
    raw = run(['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-t', f'{t1 - t0:.3f}', '-i', str(take),
               '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    n = int(sr * hop)
    k = len(a) // n
    rms = np.sqrt((a[:k * n].reshape(k, n) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms + 1e-6)
    db = np.convolve(db, np.ones(2) / 2, mode='same')   # 20 ms smoothing
    return db


def hiss_envelope(take, t0, t1, sr=16000, hop=0.01):
    """Loudness of the 2.5-7.5 kHz band (dB), 10 ms hops: the hiss of an f, th, s or h,
    which starts a word before the voice does and is too quiet to count as voice."""
    raw = run(['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-t', f'{t1 - t0:.3f}', '-i', str(take),
               '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    n, win = int(sr * hop), int(sr * 0.02)
    k = max(0, (len(a) - win) // n + 1)
    if k == 0:
        return np.zeros(0, np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(a, win)[::n][:k] * np.hanning(win)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    f = np.fft.rfftfreq(win, 1 / sr)
    band = spec[:, (f >= 2500) & (f <= 7500)].sum(1)
    return (10 * np.log10(band + 1e-12)).astype(np.float32)


def refine_onsets(words, db, env_t0, hop=0.01, hiss=None):
    """Snap whisper word starts to the voice. Whisper often starts a word inside the
    silence before it, or a little after the voice begins; a word that begins after a
    real pause is moved to where the sound rises. Words inside running speech keep
    whisper's time."""
    floor = float(np.percentile(db, 8))
    thr = max(floor + 16.0, -48.0)
    speech = db > thr
    n = len(db)

    def idx(t):
        return int(min(max(round((t - env_t0) / hop), 0), n - 1))

    def t_of(j):
        return env_t0 + j * hop

    # 1. a word whisper starts in the silence moves to where the voice comes in
    for w in words:
        s, e = w['s'], w['e']
        j = idx(s)
        w['on'], w['on_how'] = s, 'kept'
        if not speech[max(j - 1, 0):j + 2].any():
            jj = j
            while jj < idx(max(e - 0.03, s)) and not speech[jj]:
                jj += 1
            if speech[jj]:
                w['on'], w['on_how'] = t_of(jj), 'moved later (whisper start was in silence)'
    # 2. every place the voice comes in after at least 60 ms of quiet belongs to one word:
    #    the word whisper has running there if whisper started that word inside the quiet
    #    (its start was early), otherwise the next word (whisper stretched the word before
    #    over the pause). Trial A gave each onset to the nearest later start instead, which
    #    pulled "and" back onto the start of "price" (5.78 s), 0.3 s before he says it.
    onsets = []
    for j in range(1, n):
        if speech[j] and not speech[j - 1] and j >= 6 and not speech[j - 6:j].any():
            q = j - 1
            while q >= 0 and not speech[q]:
                q -= 1
            onsets.append((t_of(j), (j - 1 - q) * hop))
    hiss_on = None
    if hiss is not None and len(hiss):
        hfloor = float(np.percentile(hiss, 10))
        hiss_on = hiss > hfloor + 18.0
    for t_on, quiet in onsets:
        k = next((k for k, w in enumerate(words) if w['s'] <= t_on < w['e']), None)
        if k is not None and words[k]['s'] < t_on - quiet - 0.05:
            k = k + 1 if k + 1 < len(words) else None           # stretched over the pause: the next word
        elif k is None:
            k = next((k for k, w in enumerate(words) if w['s'] > t_on), None)
        if k is None or abs(words[k]['s'] - t_on) > 0.45:
            continue
        w = words[k]
        if hiss_on is not None and t_on > w['s']:
            # a word that starts with a hiss (f, th, s, h) starts at the hiss, not at the
            # voice after it: "43" and "thing" had been moved 0.1 s late in testing
            # only a hiss that runs up to the voice (not the tail of the word before)
            lo_j, jj = idx(max(w['s'] - 0.06, t_on - quiet)), idx(t_on) + 1
            while jj > lo_j and not hiss_on[jj]:
                jj -= 1
            if jj >= idx(t_on) - 3:
                j0 = jj
                while j0 - 1 >= lo_j and (hiss_on[j0 - 1] or (j0 - 2 >= lo_j and hiss_on[j0 - 2])):
                    j0 -= 1
                if jj - j0 >= 2 and j0 < idx(t_on):
                    t_on = t_of(j0)
        w['on'] = t_on
        w['on_how'] = 'moved earlier (voice starts before whisper)' if t_on < w['s'] else \
            'moved later (whisper start was in the quiet before the voice)' if t_on > w['s'] else 'kept'
    # 3. in order, never two words closer than 60 ms; the silence before each word
    prev_on = -1e9
    for w in words:
        if w['on'] < prev_on + 0.06:
            w['on'], w['on_how'] = prev_on + 0.06, w['on_how'] + ' (kept 60 ms after the word before)'
        w['on'] = round(w['on'], 3)
        q = idx(w['on']) - 1
        while q >= 0 and not speech[q]:
            q -= 1
        w['quiet'] = round((idx(w['on']) - 1 - q) * hop, 2)     # silence just before the word
        prev_on = w['on']
    # 4. where his voice stops after each word (whisper often stretches a word over the
    #    pause after it, which hid the pause in "But the ... best" in trial A)
    for k, w in enumerate(words):
        nxt = words[k + 1]['on'] if k + 1 < len(words) else w['e'] + 0.3
        j0, j1 = idx(w['on']), idx(max(nxt, w['on'] + hop))
        last = None
        for j in range(j0, j1):          # the voice from the word on, until 50 ms of quiet (a breath after is not the word)
            if speech[j]:
                last = j
            elif last is not None and j - last > 5:
                break
        w['off'] = round(min(t_of(last) + hop, nxt) if last is not None else min(w['e'], nxt), 3)
    return thr


# ----------------------------------------------------------------------------- captions

@dataclass
class Token:
    text: str
    kind: str            # light | bold | serif
    on: float            # arrival on the clip clock (seconds from clip start)
    end: float
    src: dict = field(default_factory=dict)
    nth: int = 1         # which time he says this word in the clip


@dataclass
class Group:
    lines: list          # list of list[Token]
    t0: float = 0.0
    t1: float = 0.0
    layout: list = field(default_factory=list)   # (token, sprite, x_anchor, y_anchor)
    height: float = 0.0


GLUE_END = set('a an the of to for on in and about with your its my our their than at by from but so or '
               'like is are was i as into'.split())   # a caption never ends on one of these
NUM_WORDS = set('one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty '
                'sixty seventy eighty ninety hundred thousand million billion half twice'.split())
WEAK = set('thing things about actually really completely against just very'.split())


def is_number(word):
    k = key_word(word)
    return bool(re.search(r'\d', k)) or k in NUM_WORDS


def split_phrases(toks, gaps, final_lead=False):
    """Best 2-4 word groups for one run of words (no sentence end, pause or cut inside):
    a group should not end on a little word ("the", "of", "about") or start with "of",
    three words is the natural size, and a break where he pauses or a comma falls is
    cheap. Returns a list of lists."""
    n = len(toks)
    size_cost = {1: 6.0, 2: 1.0, 3: 0.0, 4: 0.8}
    best = [0.0] + [math.inf] * n
    back = [0] * (n + 1)
    for j in range(1, n + 1):
        for size in (1, 2, 3, 4):
            i = j - size
            if i < 0:
                break
            c = best[i] + size_cost[size]
            last, first = toks[j - 1], toks[i]
            if j < n:
                if key_word(last.src['w']) in GLUE_END:
                    c += 4.0
                if key_word(toks[j].src['w']) == 'of':
                    c += 6.0           # "out / of 10 each": never split a phrase before "of"
                elif re.search(r'[,;:]\s*$', last.src['w']) or gaps[j - 1] >= 0.2:
                    c -= 1.5
            if c < best[j]:
                best[j], back[j] = c, i
    out, j = [], n
    while j > 0:
        out.append(toks[back[j]:j])
        j = back[j]
    return out[::-1]


def plan_groups(words, clip_start, cut_windows, bold, payoffs, lead, auto_bold=True):
    """Group the spoken words into 2-4 word captions at the phrase breaks; payoff phrases
    get their own serif line, with the words just before them as a lead-in above.
    bold: words set bold wherever said, or word#n for the nth time he says it in the clip."""
    toks = []
    count = {}
    for w in words:
        kw = key_word(w['w'])
        count[kw] = count.get(kw, 0) + 1
        on = w['on'] - clip_start
        inside = [(a, b) for a, b in cut_windows if a - 1e-3 <= on < b]
        if inside:
            a, b = inside[0]
            if b - on > 0.25:
                continue
            on = b + lead     # said as the card leaves: it arrives on the first frame back
        txt = clean_word(w['w'])
        if not txt:
            continue
        t = Token(txt, 'light', max(on - lead, 0.0), w.get('off', w['e']) - clip_start, w)
        t.nth = count[kw]
        toks.append(t)
    # payoff phrases (in order of appearance)
    keys = [key_word(t.src['w']) for t in toks]
    pay_id = [None] * len(toks)
    for pid, phrase in enumerate(payoffs):
        pk = [key_word(x) for x in phrase.split()]
        for i in range(len(toks) - len(pk) + 1):
            if keys[i:i + len(pk)] == pk and all(p is None for p in pay_id[i:i + len(pk)]):
                for j in range(i, i + len(pk)):
                    pay_id[j] = pid
                    toks[j].kind = 'serif'
                break
    every, nth = set(), set()
    for b in bold:
        b = b.strip()
        if '#' in b:
            wd, _, k = b.partition('#')
            nth.add((key_word(wd), int(k)))
        elif b:
            every.add(key_word(b))
    for t, k, p in zip(toks, keys, pay_id):
        if p is None and (k in every or (k, t.nth) in nth):
            t.kind = 'bold'

    def hard_break(a, b):
        """No caption runs across a sentence end, a real pause or a cut."""
        return (bool(re.search(r'[.?!]\s*$', a.src['w'])) or b.on - a.end > 0.45
                or any(a.on < x <= b.on for x, _ in cut_windows) or any(a.on < x <= b.on for _, x in cut_windows))

    groups, i = [], 0
    while i < len(toks):
        if pay_id[i] is not None:
            j = i
            while j < len(toks) and pay_id[j] == pay_id[i]:
                j += 1
            groups.append(Group([toks[i:j]]))
            i = j
            continue
        j = i + 1
        while j < len(toks) and pay_id[j] is None and not hard_break(toks[j - 1], toks[j]):
            j += 1
        run_ = toks[i:j]
        gaps = [run_[k + 1].on - run_[k].end for k in range(len(run_) - 1)] + [0.0]
        parts = split_phrases(run_, gaps)
        # the run leads straight into a payoff: its last part (up to three words) sits
        # above the payoff line as its lead-in
        if j < len(toks) and pay_id[j] is not None and len(parts[-1]) <= 3 \
                and not hard_break(toks[j - 1], toks[j]):
            pj = j
            while pj < len(toks) and pay_id[pj] == pay_id[j]:
                pj += 1
            groups.extend(Group([pt]) for pt in parts[:-1])
            groups.append(Group([parts[-1], toks[j:pj]]))
            i = pj
            continue
        groups.extend(Group([pt]) for pt in parts)
        i = j
    # a group with no emphasis gets the word that carries its meaning in bold: a number
    # first, else its longest content word (five letters or more); a group of little
    # words ("But the", "Muse and Siri") stays light, as in the reference ("is what I")
    if auto_bold:
        for g in groups:
            flat = [t for ln in g.lines for t in ln]
            if any(t.kind != 'light' for t in flat):
                continue
            nums = [t for t in flat if is_number(t.src['w'])]
            cands = nums or [t for t in flat if key_word(t.src['w']) not in STOP | WEAK and len(t.text) >= 5]
            if cands:
                max(cands, key=lambda t: len(t.text)).kind = 'bold'
    return groups


def time_groups(groups, clip_dur, cut_windows, hold=0.55):
    for k, g in enumerate(groups):
        flat = [t for ln in g.lines for t in ln]
        g.t0 = flat[0].on
        end = flat[-1].end + hold
        if k + 1 < len(groups):
            nxt0 = [t for ln in groups[k + 1].lines for t in ln][0].on
            end = min(end, nxt0)
        for a, _ in cut_windows:
            if g.t0 < a:
                end = min(end, a)
        g.t1 = min(end, clip_dur)


def layout_group(g: Group, max_w=0.86 * W):
    """Centre each line; sprites are built once at full size. Returns the block height."""
    g.layout = []
    y = 0.0
    lines_out = []
    for li, line in enumerate(g.lines):
        serif = all(t.kind == 'serif' for t in line)
        size = SERIF_SIZE if serif else SANS_SIZE
        while True:
            space = font('light', size).getlength(' ') * (0.9 if serif else 1.0)
            advs = [font(t.kind, size).getlength(t.text) for t in line]
            total = sum(advs) + space * (len(advs) - 1)
            if total <= max_w or size <= 40:
                break
            size = int(size * 0.92)
        offs = [sum(advs[:k]) + space * k for k in range(len(advs))]
        sps = [text_sprite(t.text, t.kind, size, grad=(o, total)) for t, o in zip(line, offs)]
        asc = font(line[0].kind, size).getmetrics()[0]
        cap = asc * (0.78 if serif else 0.74)
        gap_above = 0 if li == 0 else (size * 0.30 if serif else size * 0.22)
        y += gap_above + cap
        base = y
        y += size * (0.26 if serif else 0.22)
        x = (W - total) / 2
        row = []
        for t, s in zip(line, sps):
            # anchor = sprite ink centre; place by pen position + baseline
            ax = x + (s.ax - s.left)
            ay = base + (s.ay - s.base)
            row.append((t, s, ax, ay))
            x += s.adv + space
        lines_out.append(row)
    g.height = y
    for row in lines_out:
        g.layout.extend(row)
    return g.height


def draw_captions(frame, groups, t, bottom, bounce=True):
    """Draw the caption group showing at clip time t, its block centred on y=centre. Returns ink bbox."""
    bbox = None
    for g in groups:
        if not (g.t0 <= t < g.t1):
            continue
        top = bottom - g.height        # every block sits on one bottom line; a lead-in stacks above
        out_u = (g.t1 - t)
        g_alpha = min(1.0, out_u / 0.08) if g.t1 - g.t0 > 0.2 else 1.0
        g_scale = 0.97 + 0.03 * min(1.0, out_u / 0.08)
        drift = -6.0 * min(1.0, (t - g.t0) / max(g.t1 - g.t0, 0.1))     # the group keeps moving
        for tok, sp, ax, ay in g.layout:
            if bounce:
                dt = t - tok.on
                if dt < 0:
                    continue
                sc = bounce_scale(dt, dur=0.18, peak=1.08, start=0.05)
                al = min(1.0, dt / 0.09)
                dy = 14.0 * (1 - ease_out_cubic(dt / 0.18))
            else:
                sc, al, dy = 1.0, 1.0, 0.0
            sc *= g_scale
            px, py = ax, top + ay + dy + drift
            blit(frame, sp, px, py, scale=sc, alpha=al * g_alpha)
            if al * g_alpha < 0.05:
                continue
            ink = (px + sp.ink[0] * sc, py + sp.ink[1] * sc, px + sp.ink[2] * sc, py + sp.ink[3] * sc)
            bbox = ink if bbox is None else (min(bbox[0], ink[0]), min(bbox[1], ink[1]),
                                             max(bbox[2], ink[2]), max(bbox[3], ink[3]))
        break
    return bbox


# ----------------------------------------------------------------------------- analysis pass

def decode_cmd(take, start, nframes, w, h):
    vf = f'fps={FPS},scale={w}:{h}:flags={"area" if w < 1080 else "bicubic"}:in_color_matrix=bt709:in_range=tv,format=rgb24'
    return ['ffmpeg', '-v', 'error', '-ss', f'{start:.3f}', '-i', str(take), '-an', '-vf', vf,
            '-frames:v', str(nframes), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']


def read_frames(cmd, w, h):
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=w * h * 3 * 2)
    n = w * h * 3
    try:
        while True:
            buf = p.stdout.read(n)
            if len(buf) < n:
                break
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    finally:
        p.stdout.close()
        p.wait()


MW, MH = 288, 512    # analysis size (mask and face)


def analyse(take, start, nframes, mask_model):
    import mediapipe as mp
    seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=mask_model)
    fd = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.4)
    masks = np.zeros((nframes, MH, MW), np.float32)
    grays = np.zeros((nframes, MH, MW), np.float32)
    faces = np.full((nframes, 6), np.nan, np.float32)   # cx, eye_y, mouth_y, chin_y, face_w, face_top (px, full res)
    n = 0
    for k, fr in enumerate(read_frames(decode_cmd(take, start, nframes, MW, MH), MW, MH)):
        masks[k] = seg.process(fr).segmentation_mask
        grays[k] = cv2.cvtColor(fr, cv2.COLOR_RGB2GRAY).astype(np.float32)
        res = fd.process(fr)
        if res.detections:
            d = max(res.detections, key=lambda d: d.location_data.relative_bounding_box.width)
            bb = d.location_data.relative_bounding_box
            kp = d.location_data.relative_keypoints
            eye_y = (kp[0].y + kp[1].y) / 2
            mouth_y = kp[3].y
            chin_y = max(bb.ymin + bb.height, mouth_y + 1.1 * (mouth_y - eye_y))
            faces[k] = [(kp[0].x + kp[1].x) / 2 * W, eye_y * H, mouth_y * H, chin_y * H, bb.width * W, bb.ymin * H]
        n = k + 1
    seg.close()
    fd.close()
    masks, grays, faces = masks[:n], grays[:n], faces[:n]
    # fill face gaps, then smooth
    for c in range(faces.shape[1]):
        col = faces[:, c]
        ok = ~np.isnan(col)
        if ok.any():
            faces[:, c] = np.interp(np.arange(n), np.nonzero(ok)[0], col[ok])
    if n >= 7:   # a running median takes out single-frame detector jumps
        pad = np.pad(faces, ((3, 3), (0, 0)), mode='edge')
        faces = np.median(np.stack([pad[k:k + n] for k in range(7)]), axis=0).astype(np.float32)
    return masks, grays, faces


def smooth_masks(masks, grays, radius=2, sigma_t=1.2, sigma_i=10.0):
    """Joint temporal filter: average each pixel's mask over +-radius frames, but only
    where the picture did not change (so a moving hand keeps its own mask and a still
    edge stops flickering)."""
    n = len(masks)
    out = np.empty_like(masks)
    gb = np.stack([cv2.GaussianBlur(g, (5, 5), 0) for g in grays])
    for t in range(n):
        num = np.zeros_like(masks[t])
        den = np.zeros_like(masks[t])
        for k in range(-radius, radius + 1):
            j = t + k
            if j < 0 or j >= n:
                continue
            wt = math.exp(-(k * k) / (2 * sigma_t * sigma_t))
            if k:
                d = gb[t] - gb[j]
                wt = wt * np.exp(-(d * d) / (2 * sigma_i * sigma_i))
            num += wt * masks[j]
            den += wt
        out[t] = num / den
    return out


def flicker_metric(masks, grays):
    """Mean frame-to-frame mask change where the picture is still (0-255 scale)."""
    vals = []
    for t in range(1, len(masks)):
        still = np.abs(cv2.GaussianBlur(grays[t], (5, 5), 0) - cv2.GaussianBlur(grays[t - 1], (5, 5), 0)) < 4
        edge = (masks[t] > 0.05) & (masks[t] < 0.95) | (masks[t - 1] > 0.05) & (masks[t - 1] < 0.95)
        sel = still & edge
        if sel.sum() > 50:
            vals.append(float(np.abs(masks[t] - masks[t - 1])[sel].mean() * 255))
    return round(float(np.mean(vals)), 2) if vals else 0.0, round(float(np.max(vals)), 2) if vals else 0.0


# ----------------------------------------------------------------------------- treated background

def guided_filter(I, p, r, eps):
    k = (2 * r + 1, 2 * r + 1)

    def mean(x):
        return cv2.boxFilter(x, -1, k, borderType=cv2.BORDER_REFLECT)

    mI, mp_ = mean(I), mean(p)
    cov = mean(I * p) - mI * mp_
    var = mean(I * I) - mI * mI
    a = cov / (var + eps)
    b = mp_ - a * mI
    return mean(a) * I + mean(b)


def normconv(img, wgt, sigma):
    num = cv2.GaussianBlur(img * wgt[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(wgt, (0, 0), sigma)
    return num / np.maximum(den, 1e-4)[..., None], den


class Treat:
    """Cut the person from the room and turn the room into a set."""

    def __init__(self, l_weight=0.4, conf_lo=8.0, conf_hi=22.0, keep=0.6):
        self.l_weight, self.conf_lo, self.conf_hi = l_weight, conf_lo, conf_hi
        self.keep = keep                  # how much of last frame's alpha a still pixel keeps
        self.prev = None                  # (frame index, alpha, small grey)
        yy, xx = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
        cx, cy = (W // 4) / 2, (H // 4) * 0.36
        r = np.sqrt(((xx - cx) / (W / 4 * 0.75)) ** 2 + ((yy - cy) / (H / 4 * 0.55)) ** 2)
        self.spot = np.clip(1 - r, 0, 1) ** 1.6                    # soft set light behind the head
        r2 = np.sqrt(((xx - (W // 4) / 2) / (W / 4 * 0.62)) ** 2 + ((yy - (H // 4) * 0.45) / (H / 4 * 0.62)) ** 2)
        self.vig_bg = (1 - 0.55 * smoothstep(0.35, 1.25, r2)).astype(np.float32)

    def grade(self, B):
        lum = B @ np.array([0.299, 0.587, 0.114], np.float32)
        des = lum[..., None] * 0.7 + B * 0.3            # most of the room's colour out
        tint = 1 + (INK / INK.mean() - 1) * 0.55          # the ink's green-black hue
        dark = des * 0.27 * tint
        out = dark * 0.8 + INK * 0.2
        out = out + np.array([34, 28, 20], np.float32) * self.spot[..., None] * 0.6   # a warm set light behind him
        return out * self.vig_bg[..., None]

    def apply(self, frame_u8, m_small, band_r=12, fidx=None):
        """frame: full-res uint8 RGB; m_small: MHxMW float mask (0-1, temporally smoothed).

        The mask from the model is soft and ~20 px loose round the ears and hair, which
        leaves a bright rim of the room on the person. So the model's mask only decides
        where the edge is (a band either side of it); inside the band each pixel's alpha
        comes from its colour, placed between the person's colour and the room's colour
        just either side of it, and the room's light is taken back out of the edge pixels.
        The colour work runs on the band's pixels only, at full size."""
        hw, hh = W // 2, H // 2
        half = cv2.resize(frame_u8, (hw, hh), interpolation=cv2.INTER_AREA)
        g_mid = cv2.cvtColor(half, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        p = cv2.resize(m_small, (hw, hh), interpolation=cv2.INTER_LINEAR)
        # prior alpha: the model's mask snapped to the picture's edges (guided filter)
        pr = np.clip(guided_filter(g_mid, smoothstep(0.30, 0.80, p).astype(np.float32), 6, 2e-3), 0, 1)
        # trimap from the model's mask: sure person, sure room, and the band between
        core = (p > 0.5).astype(np.uint8)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band_r + 1, 2 * band_r + 1))
        fg_sure = cv2.erode(core, k).astype(np.float32)
        bg_sure = (1 - cv2.dilate(core, k)).astype(np.float32)
        band = cv2.GaussianBlur(1 - fg_sure - bg_sure, (0, 0), 2.0)
        fgs = cv2.GaussianBlur(fg_sure, (0, 0), 2.0)
        # colours just inside and just outside the edge: Lab with lightness turned down
        # (so a wall in the shadow of an ear, as light as skin but not its colour, is
        # still wall), plus plain RGB for taking the room's light out
        qw, qh = W // 4, H // 4
        quarter = cv2.resize(half, (qw, qh), interpolation=cv2.INTER_AREA)
        lab = cv2.cvtColor(quarter, cv2.COLOR_RGB2LAB).astype(np.float32)
        lab[..., 0] *= self.l_weight
        fq = cv2.resize(fg_sure, (qw, qh), interpolation=cv2.INTER_AREA)
        bq = cv2.resize(bg_sure, (qw, qh), interpolation=cv2.INTER_AREA)
        fq, bq = (fq > 0.99).astype(np.float32), (bq > 0.99).astype(np.float32)
        qf = quarter.astype(np.float32)
        F_loc = np.concatenate([fill_conv(lab, fq, 3.5), fill_conv(qf, fq, 3.5)], axis=2)
        B_loc = np.concatenate([fill_conv(lab, bq, 3.5), fill_conv(qf, bq, 3.5)], axis=2)
        # full size, band pixels only
        bandu = cv2.resize(band, (W, H), interpolation=cv2.INTER_LINEAR)
        alpha = cv2.resize(fgs, (W, H), interpolation=cv2.INTER_LINEAR)
        idx = np.flatnonzero(bandu > 0.01)
        ys, xs = np.divmod(idx, W)
        Fb = sample(F_loc, xs, ys, 4)
        Bb = sample(B_loc, xs, ys, 4)
        prior_b = sample(pr.astype(np.float32), xs, ys, 2).reshape(-1)
        Ib = frame_u8.reshape(-1, 3)[idx]
        Ilab = cv2.cvtColor(Ib.reshape(-1, 1, 3), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
        Ilab[:, 0] *= self.l_weight
        d = Fb[:, :3] - Bb[:, :3]
        den = (d * d).sum(1)
        ac = ((Ilab - Bb[:, :3]) * d).sum(1) / np.maximum(den, 1.0)
        ac = np.clip((ac - 0.04) / 0.92, 0, 1)          # linear: a half-covered pixel stays half
        conf = smoothstep(self.conf_lo, self.conf_hi, np.sqrt(den))   # can colour tell person from room here?
        a_band = conf * ac + (1 - conf) * prior_b
        af = alpha.reshape(-1)
        af[idx] = np.clip(af[idx] + a_band * bandu.reshape(-1)[idx], 0, 1)   # sure room stays exactly room
        alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
        # steady edges: where the picture has not changed since the last frame, the edge
        # keeps part of last frame's alpha (no shimmer); where he moves, it is all new
        g_q = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(half, (W // 4, H // 4), interpolation=cv2.INTER_AREA),
                                            cv2.COLOR_RGB2GRAY).astype(np.float32), (5, 5), 0)
        self.raw_alpha = alpha
        if self.prev is not None and fidx is not None and self.prev[0] == fidx - 1:
            dg = g_q - self.prev[2]
            keep = (self.keep * np.exp(-(dg * dg) / (2 * 5.0 ** 2))).astype(np.float32)
            keep_u = cv2.resize(keep, (W, H), interpolation=cv2.INTER_LINEAR)
            alpha = alpha + keep_u * (self.prev[1] - alpha)
        self.prev = (fidx, alpha, g_q)
        alpha = alpha.copy()
        alpha[alpha < 0.01] = 0
        # take the room's light back out of the edge pixels; an edge pixel is never
        # brighter than the person just inside it (no light rim)
        a_b = alpha.reshape(-1)[idx][:, None]
        Fpix = (Ib.astype(np.float32) - (1 - a_b) * Bb[:, 3:]) / np.maximum(a_b, 0.15)
        Fpix = np.clip(np.minimum(Fpix, Fb[:, 3:] * 1.05 + 12), 0, 255)
        F = frame_u8.astype(np.float32)
        F.reshape(-1, 3)[idx] = Fpix
        # the room at quarter size, the person filled out with the room's own colour
        # (normalised blur) so no skin or shirt bleeds into the soft background
        small = cv2.resize(frame_u8, (W // 4, H // 4), interpolation=cv2.INTER_AREA).astype(np.float32)
        hard = (cv2.resize(m_small, (W // 4, H // 4)) > 0.25).astype(np.uint8)
        hard = cv2.dilate(hard, np.ones((5, 5), np.uint8))
        b_new = self.grade(fill_conv(small, (1 - hard).astype(np.float32), 9))
        B_new = cv2.resize(b_new, (W, H), interpolation=cv2.INTER_LINEAR)
        out = cv2.blendLinear(F, B_new, alpha, 1.0 - alpha)
        return out, alpha


def fill_conv(img, wgt, sigma):
    """Normalised blur of img over the pixels where wgt is 1; far from any, the colour
    comes from a much wider blur (done small, for speed)."""
    if img.shape[2] > 3:      # OpenCV filters take at most four channels
        return np.concatenate([fill_conv(np.ascontiguousarray(img[..., c:c + 3]), wgt, sigma)
                               for c in range(0, img.shape[2], 3)], axis=2)
    near, den = normconv(img, wgt, sigma)
    h, w = wgt.shape
    s_img = cv2.resize(img, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
    s_w = cv2.resize(wgt, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
    far, _ = normconv(s_img.reshape(h // 8, w // 8, -1), s_w, 5)
    far = cv2.resize(far, (w, h), interpolation=cv2.INTER_LINEAR).reshape(near.shape)
    f = smoothstep(0.02, 0.2, den)[..., None]
    return near * f + far * (1 - f)


def sample(img, xs, ys, scale):
    """Bilinear samples of a map made at 1/scale size, at full-size pixels (xs, ys)."""
    n = len(xs)
    cols = 1024                       # remap wants maps under 32767 rows
    rows = max(1, -(-n // cols))
    mx = np.zeros(rows * cols, np.float32)
    my = np.zeros(rows * cols, np.float32)
    mx[:n] = (xs + 0.5) / scale - 0.5
    my[:n] = (ys + 0.5) / scale - 0.5
    mx, my = mx.reshape(rows, cols), my.reshape(rows, cols)
    chans = img.shape[2] if img.ndim == 3 else 1
    outs = []
    for c in range(0, chans, 4):     # and at most four channels
        part = np.ascontiguousarray(img[..., c:c + 4]) if img.ndim == 3 else img
        r = cv2.remap(part, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        outs.append(r.reshape(rows * cols, -1)[:n])
    return np.concatenate(outs, axis=1)


# ----------------------------------------------------------------------------- the clean plate (trial B)

PW, PH = W // 2, H // 2     # plate size


def build_plate(take, start, nframes, masks, step=6, margin=14):
    """The room without him. The phone does not move during a take, so each pixel's room
    colour is the median of the frames where he is not covering it, after matching each
    frame's exposure (the phone changes it as he leans in). Returns the plate (half size,
    float RGB, filled where he never moves away), how sure each pixel is (0-1) and a
    camera-stillness check (the room's residual against the plate)."""
    import warnings
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * margin + 1, 2 * margin + 1))
    frames, rooms = [], []
    for k, fr in enumerate(read_frames(decode_cmd(take, start, nframes, PW, PH), PW, PH)):
        if k >= len(masks):
            break
        if k % step:
            continue
        m = cv2.resize(masks[k], (PW, PH), interpolation=cv2.INTER_LINEAR)
        frames.append(fr.copy())
        rooms.append(cv2.dilate((m > 0.06).astype(np.uint8), ker) == 0)
    F, R = np.stack(frames), np.stack(rooms)

    def masked_median(gains=None):
        out = np.full((PH, PW, 3), np.nan, np.float32)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)
            for y0 in range(0, PH, 96):
                blk = F[:, y0:y0 + 96].astype(np.float32)
                if gains is not None:
                    blk = blk / gains[:, None, None, :]
                blk[~R[:, y0:y0 + 96]] = np.nan
                out[y0:y0 + 96] = np.nanmedian(blk, axis=0)
        return out

    ref = masked_median()
    gains = np.ones((len(F), 3), np.float32)
    for j in range(len(F)):
        sel = R[j] & ~np.isnan(ref[..., 0]) & (ref.min(2) > 20)
        if sel.sum() > 2000:
            gains[j] = np.median(F[j][sel].astype(np.float32) / ref[sel], axis=0)
    P = masked_median(gains)
    count = R.sum(0)
    valid = (count >= 3) & ~np.isnan(P[..., 0])
    P0 = np.nan_to_num(P)
    P = np.where(valid[..., None], P0, push_pull(P0, valid.astype(np.float32))).astype(np.float32)
    # stillness: how far each sampled frame's room is from the plate
    resid = []
    for j in range(len(F)):
        sel = R[j] & valid
        if sel.sum() > 2000:
            d = np.abs(F[j][sel].astype(np.float32) / gains[j] - P[sel]).mean()
            resid.append(float(d))
    soft = cv2.GaussianBlur(cv2.erode(valid.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 3)
    return {'P': P, 'valid': soft, 'valid_hard': valid, 'frames': len(F), 'gains': gains,
            'residual_mean': round(float(np.mean(resid)), 2) if resid else None,
            'residual_max': round(float(np.max(resid)), 2) if resid else None,
            'coverage': round(float(valid.mean()), 3)}


def push_pull(img, w):
    """Fill the holes in img (where w is 0) smoothly from what is around them, at every
    scale (a pyramid), so a hole of any size gets the colour of its surroundings."""
    nums, dens = [img * w[..., None]], [w.astype(np.float32)]
    while min(dens[-1].shape) > 8:
        nums.append(cv2.pyrDown(nums[-1]))
        dens.append(cv2.pyrDown(dens[-1]))
    tot = dens[-1].sum()
    mean = (nums[-1].reshape(-1, 3).sum(0) / tot) if tot > 1e-6 else np.full(3, 128.0, np.float32)
    est = np.where(dens[-1][..., None] > 1e-4, nums[-1] / np.maximum(dens[-1], 1e-6)[..., None], mean)
    for lvl in range(len(nums) - 2, -1, -1):
        h, w_ = dens[lvl].shape
        up = cv2.pyrUp(est.astype(np.float32), dstsize=(w_, h))
        here = nums[lvl] / np.maximum(dens[lvl], 1e-6)[..., None]
        t = np.clip(dens[lvl] * 4, 0, 1)[..., None]
        est = here * t + up * (1 - t)
    return est.astype(np.float32)


class PlateTreat(Treat):
    """Trial B's cut-out. With the room known exactly (the clean plate), each edge pixel's
    alpha comes from how far it is from the room behind it, towards the person's colour
    just inside; the room's own light is subtracted from the edge (no halo, the set shows
    through a half-covered pixel instead of the wall); and the set is made once from the
    plate, so nothing from the frame (a passing hand's blur, his shadow) can leak into
    it. A fast hand the model misses is held by the difference from the plate."""

    def __init__(self, plate, **kw):
        super().__init__(**kw)
        self.P, self.valid, self.valid_hard = plate['P'], plate['valid'], plate['valid_hard']
        self.g = None
        Pq = cv2.resize(self.P, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        self.set_full = cv2.resize(self.grade(cv2.GaussianBlur(Pq, (0, 0), 9)), (W, H),
                                   interpolation=cv2.INTER_LINEAR).astype(np.float32)
        self.stats = {'noise': [], 'diff_px': [], 'gain': []}
        self.offline = 1.0

    def estimate(self, frame_u8, m_small, band_r=12, face=None):
        half_u8 = cv2.resize(frame_u8, (PW, PH), interpolation=cv2.INTER_AREA)
        half = half_u8.astype(np.float32)
        p = cv2.resize(m_small, (PW, PH), interpolation=cv2.INTER_LINEAR)
        # this frame's exposure against the plate, from the sure room
        sure_room = (p < 0.03) & self.valid_hard
        sub = sure_room[::3, ::3]
        if sub.sum() > 400:
            g = np.median(half[::3, ::3][sub] / np.maximum(self.P[::3, ::3][sub], 1.0), axis=0)
            self.g = g if self.g is None else 0.5 * self.g + 0.5 * g
        elif self.g is None:
            self.g = np.ones(3, np.float32)
        Bh = self.P * self.g
        Dh = np.sqrt(((half - Bh) ** 2).sum(2))
        noise = float(np.median(Dh[::3, ::3][sub])) if sub.sum() > 400 else 4.0
        # prior alpha: the model's mask snapped to the picture's edges (guided filter)
        g_mid = cv2.cvtColor(half_u8, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        pr = np.clip(guided_filter(g_mid, smoothstep(0.30, 0.80, p).astype(np.float32), 6, 2e-3), 0, 1)
        core = (p > 0.5).astype(np.uint8)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band_r + 1, 2 * band_r + 1))
        fg_sure = cv2.erode(core, k).astype(np.float32)
        bg_sure = (1 - cv2.dilate(core, k)).astype(np.float32)
        # what the model calls room but is not the room: a fast hand's blur, mostly
        thr = 3.0 * noise + 14.0
        # where the plate never saw the room (he always covers it) only a clear difference
        # from the room filled in around it counts, and only next to him: the model
        # sometimes drops a shadowed strip of neck there, which would show the set through
        near = cv2.dilate(core, np.ones((41, 41), np.uint8)) > 0
        diff = (((Dh > thr) & self.valid_hard) | ((Dh > 1.5 * thr + 20) & ~self.valid_hard & near)) & (bg_sure > 0)
        diff = diff.astype(np.uint8)
        diff = cv2.morphologyEx(diff, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        diff = cv2.dilate(diff, np.ones((7, 7), np.uint8)).astype(np.float32)
        band = np.clip(1 - fg_sure - bg_sure + diff * bg_sure, 0, 1)
        band = cv2.GaussianBlur(band, (0, 0), 2.0)
        fgs = cv2.GaussianBlur(fg_sure, (0, 0), 2.0)
        # the person's colour just inside the edge (Lab, lightness turned down, and RGB);
        # far from him (a hand out on its own) his skin colour from the face is used
        qw, qh = W // 4, H // 4
        quarter = cv2.resize(half_u8, (qw, qh), interpolation=cv2.INTER_AREA)
        lab = cv2.cvtColor(quarter, cv2.COLOR_RGB2LAB).astype(np.float32)
        lab[..., 0] *= self.l_weight
        fq = (cv2.resize(fg_sure, (qw, qh), interpolation=cv2.INTER_AREA) > 0.99).astype(np.float32)
        qf = quarter.astype(np.float32)
        F_loc = np.concatenate([fill_conv(lab, fq, 3.5), fill_conv(qf, fq, 3.5)], axis=2)
        den = cv2.GaussianBlur(fq, (0, 0), 6.0)
        skin = None
        if face is not None and not np.isnan(face).any():
            cx, eye_y, mouth_y, _, fw, _ = [float(v) for v in face]
            y0, y1 = int((eye_y + 0.25 * (mouth_y - eye_y)) / 2), int(mouth_y / 2)
            x0, x1 = int((cx - 0.22 * fw) / 2), int((cx + 0.22 * fw) / 2)
            patch = half_u8[max(y0, 0):max(y1, 1), max(x0, 0):max(x1, 1)].reshape(-1, 3)
            if len(patch) > 50:
                srgb = np.median(patch, axis=0).astype(np.uint8)
                slab = cv2.cvtColor(srgb.reshape(1, 1, 3), cv2.COLOR_RGB2LAB).reshape(3).astype(np.float32)
                slab[0] *= self.l_weight
                skin = np.concatenate([slab, srgb.astype(np.float32)])
        # full size, edge and difference pixels only
        bandu = cv2.resize(band, (W, H), interpolation=cv2.INTER_LINEAR)
        alpha = cv2.resize(fgs, (W, H), interpolation=cv2.INTER_LINEAR)
        idx = np.flatnonzero(bandu > 0.01)
        ys, xs = np.divmod(idx, W)
        Fb = sample(F_loc, xs, ys, 4)
        if skin is not None:
            dq = sample(den[..., None], xs, ys, 4).reshape(-1)
            wsk = (1 - smoothstep(0.05, 0.25, dq))[:, None]
            Fb = Fb * (1 - wsk) + skin[None, :] * wsk
        Bb = sample(Bh, xs, ys, 2)
        prior_b = sample(pr.astype(np.float32), xs, ys, 2).reshape(-1)
        p_b = sample(p.astype(np.float32), xs, ys, 2).reshape(-1)
        Ib = frame_u8.reshape(-1, 3)[idx].astype(np.float32)

        def to_lab(rgb):
            q = np.clip(rgb, 0, 255).astype(np.uint8).reshape(-1, 1, 3)
            o = cv2.cvtColor(q, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
            o[:, 0] *= self.l_weight
            return o

        Ilab, Blab = to_lab(Ib), to_lab(Bb)
        d = Fb[:, :3] - Blab
        dn = (d * d).sum(1)
        ac = ((Ilab - Blab) * d).sum(1) / np.maximum(dn, 1.0)
        # a pixel the plate explains (within the noise) is room, whatever the projection says
        Dpix = np.sqrt(((Ib - Bb) ** 2).sum(1))
        ac = ac * smoothstep(noise * 1.5 + 2.0, noise * 3.0 + 10.0, Dpix)
        ac = np.clip((ac - 0.03) / 0.94, 0, 1)
        # a colour that is neither the room nor a mix of the room and his colour just
        # inside (far off the line between them) is another part of him, e.g. the shadowed
        # neck under the jaw next to a beard: it is him, not a half-covered pixel
        resid = np.sqrt((((Ilab - Blab) - ac[:, None] * d) ** 2).sum(1))
        # only for a coloured pixel (skin, not a dark-hair-and-wall mix, which is neutral
        # and must stay soft) that the model is sure is him
        chroma = np.sqrt(((Ilab[:, 1:] - Blab[:, 1:]) ** 2).sum(1))
        a_res = (smoothstep(10.0, 25.0, resid) * smoothstep(noise * 3 + 10, noise * 3 + 30, Dpix)
                 * smoothstep(10.0, 20.0, chroma) * smoothstep(0.85, 0.97, p_b) * self.offline)
        ac = ac + (1 - ac) * a_res
        conf = smoothstep(self.conf_lo, self.conf_hi, np.sqrt(dn))
        conf = np.maximum(conf, a_res)
        a_band = conf * ac + (1 - conf) * prior_b
        af = alpha.reshape(-1)
        af[idx] = np.clip(af[idx] + a_band * bandu.reshape(-1)[idx], 0, 1)
        if getattr(self, 'debug', False):
            self.dbg = dict(idx=idx, ac=ac, resid=resid, chroma=chroma, conf=conf, a_res=a_res, prior=prior_b,
                            Dpix=Dpix, band=bandu.reshape(-1)[idx], Fb=Fb, Bb=Bb)
        alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
        alpha[alpha < 0.01] = 0
        self.raw_alpha = alpha
        self.stats['noise'].append(noise)
        self.stats['diff_px'].append(int(diff.sum()))
        self.stats['gain'].append([round(float(v), 3) for v in self.g])
        grey_q = cv2.GaussianBlur(cv2.cvtColor(quarter, cv2.COLOR_RGB2GRAY).astype(np.float32), (5, 5), 0)
        return {'frame': frame_u8, 'alpha': alpha, 'idx': idx, 'cap': Fb[:, 3:] * 1.08 + 16, 'g': self.g.copy(),
                'grey_q': grey_q}

    def composite(self, st, alpha=None):
        """The person over the set. Wherever the alpha is partial the room's light is taken
        out and the set's put in its place (out = I - (1-a) room + (1-a) set), and an edge
        pixel is never lighter than him just inside it."""
        alpha = st['alpha'] if alpha is None else alpha
        I = st['frame'].astype(np.float32)
        out = cv2.blendLinear(I, self.set_full, alpha, 1.0 - alpha)
        fi = np.flatnonzero((alpha > 0) & (alpha < 1))
        if len(fi):
            B = cv2.resize(self.P * st['g'], (W, H), interpolation=cv2.INTER_LINEAR)
            cap = I.copy()
            cap.reshape(-1, 3)[st['idx']] = st['cap']
            a = alpha.reshape(-1)[fi][:, None]
            Ii = I.reshape(-1, 3)[fi]
            Fest = (Ii - (1 - a) * B.reshape(-1, 3)[fi]) / np.maximum(a, 0.08)
            Fest = np.clip(np.minimum(Fest, cap.reshape(-1, 3)[fi]), 0, 255)
            out.reshape(-1, 3)[fi] = a * Fest + (1 - a) * self.set_full.reshape(-1, 3)[fi]
        return out

    def apply(self, frame_u8, m_small, band_r=12, fidx=None, face=None):
        st = self.estimate(frame_u8, m_small, band_r=band_r, face=face)
        return self.composite(st), st['alpha']


def steady_alpha(prev, cur, nxt, last=None, thr=4.0, keep=0.6):
    """Steady the edge without trails. Where the picture has not changed across the last,
    this and the next frame, each edge pixel's alpha is the median of its three; then,
    where it is still a partial (edge) pixel and close to what the last output frame had
    (within 0.25), it keeps `keep` of that. A pixel the plate now says is room (alpha 0)
    or surely him (1), or one that changed a lot, takes this frame's value outright, so
    a passing hand leaves nothing behind. (Trial A carried 60% of the last frame's alpha
    forward everywhere the picture was still.)"""
    a1 = cur['alpha']
    if prev is None or nxt is None:
        return a1
    a0, a2 = prev['alpha'], nxt['alpha']
    med = np.maximum(np.minimum(a0, a1), np.minimum(np.maximum(a0, a1), a2))
    still_q = (np.abs(cur['grey_q'] - prev['grey_q']) < thr) & (np.abs(nxt['grey_q'] - cur['grey_q']) < thr)
    still = cv2.resize(still_q.astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)
    a = a1 + still * (med - a1)
    if last is not None:
        ok = still * ((a > 0.02) & (a < 0.98) & (np.abs(a - last) < 0.25))
        a = a + keep * ok * (last - a)
    return a.astype(np.float32)


# ----------------------------------------------------------------------------- dark object card

class Card:
    def __init__(self, spec, logo_dir, cache_dir, words, clip_start, seed=7):
        self.t0, self.t1 = spec['start'] - clip_start, spec['end'] - clip_start
        self.dur = self.t1 - self.t0
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        u = np.clip((xx / W * 0.35 + yy / H * 0.65), 0, 1)[..., None]           # top-right warm to bottom-left slate
        top = np.array([52, 44, 43], np.float32)
        mid = np.array([27, 27, 31], np.float32)
        bot = np.array([40, 56, 70], np.float32)
        u2 = (1 - xx / W)[..., None] * u
        bg = top * (1 - u) + mid * u
        bg = bg * (1 - u2 * 0.9) + bot * (u2 * 0.9)
        r = np.sqrt(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H * 0.52) / (H * 0.38)) ** 2)
        bg = bg + np.array([34, 24, 18], np.float32) * (np.clip(1 - r, 0, 1) ** 2)[..., None]   # lift behind the object
        rv = np.sqrt(((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
        bg = bg * (1 - 0.45 * smoothstep(0.5, 1.3, rv))[..., None]
        self.bg = bg.astype(np.float32)
        rng = np.random.default_rng(seed)
        self.grain = []
        for _ in range(8):
            g = rng.normal(0, 7.5, (H, W)).astype(np.float32)
            self.grain.append(cv2.GaussianBlur(g, (0, 0), 0.7)[..., None])
        # two words at the top, light then bold, each timed to the voice when he says it
        self.words = []
        ws = spec['words'].split()
        spoken = [w for w in words if spec['start'] - 0.3 <= w['on'] <= spec['end']]
        for k, wd in enumerate(ws):
            kind = 'light' if k == 0 and len(ws) > 1 else 'bold'
            hit = next((w for w in spoken if key_word(w['w']) == key_word(wd)), None)
            at = (hit['on'] - clip_start - 0.05) if hit else self.t0 + 0.12 + 0.18 * k
            self.words.append((text_sprite(wd, kind, CARD_WORD_SIZE), max(at, self.t0), kind))
        # logos, unaltered, each arriving when its name is said (file@word) or in turn
        self.logos = []
        for k, item in enumerate(spec['logos']):
            fname, _, cue = item.partition('@')
            path = Path(fname) if Path(fname).is_absolute() else logo_dir / fname
            if not path.exists():
                raise SystemExit(f'logo not found: {path}')
            im = raster_logo(path, cache_dir)
            hit = next((w for w in spoken if cue and key_word(w['w']) == key_word(cue)), None)
            at = (hit['on'] - clip_start - 0.04) if hit else self.t0 + 0.45 * k
            self.logos.append({'img': im, 'at': max(at, self.t0), 'name': path.name})
        n = len(self.logos)
        for k, lg in enumerate(self.logos):
            im = lg['img']
            h, w = im.shape[:2]
            aspect = w / h
            # one big object, or a stack of two or three; each fits a box, so a wide
            # wordmark is sized by its width and a mark by its height
            box_w, box_h = {1: (780, 560), 2: (700, 300)}.get(n, (560, 190))
            sc = min(box_w / w, box_h / h)
            im2 = cv2.resize(im, (max(1, int(w * sc)), max(1, int(h * sc))), interpolation=cv2.INTER_AREA)
            lg['sprite'], lg['glow'] = image_sprite(im2, glow_col=(255, 196, 150), glow=(0.75, 0.45))
            lg['h'] = im2.shape[0]
        self.word_y = H * 0.215

    def slots(self, t):
        """Logo centre ys at time t: a logo holds the centre alone, then moves up when the next arrives."""
        shown = [lg for lg in self.logos if t >= lg['at']]
        ys = {}
        gap = 120
        def stack(items):
            total = sum(lg['h'] for lg in items) + gap * (len(items) - 1)
            y = H * 0.53 - total / 2
            pos = {}
            for lg in items:
                pos[id(lg)] = y + lg['h'] / 2
                y += lg['h'] + gap
            return pos
        if not shown:
            return ys
        final = stack(shown)
        prev = stack(shown[:-1]) if len(shown) > 1 else {}
        u = ease_out_cubic((t - shown[-1]['at']) / 0.30) if len(shown) > 1 else 1.0
        for lg in shown:
            if id(lg) in prev:
                ys[id(lg)] = prev[id(lg)] * (1 - u) + final[id(lg)] * u
            else:
                ys[id(lg)] = final[id(lg)]
        return ys

    def render(self, t, fidx):
        frame = self.bg + self.grain[(fidx * 5) % len(self.grain)]
        lt = t - self.t0
        # the card is never still: a settle in, then a slow push and drift while it holds
        settle = 1.06 + (1.0 - 1.06) * ease_out_cubic(lt / 0.35)
        push = 1.0 + 0.05 * ease_in_out(lt / max(self.dur, 0.1))
        S = settle * push
        drift = -22.0 * (lt / max(self.dur, 0.1))
        cx, cy = W / 2, H / 2

        def place(x, y):
            return cx + (x - cx) * S, cy + (y - cy) * S + drift

        # the two words as one centred line, each bouncing in on its own time
        line = [(sp, at) for sp, at, _ in self.words]
        space = font('light', CARD_WORD_SIZE).getlength(' ')
        total = sum(sp.adv for sp, _ in line) + space * (len(line) - 1)
        x = (W - total) / 2
        for sp, at in line:
            ax = x + (sp.ax - sp.left)
            ay = self.word_y + (sp.ay - sp.base)
            x += sp.adv + space
            dt = t - at
            if dt < 0:
                continue
            px, py = place(ax, ay)
            blit(frame, sp, px, py + 14 * (1 - ease_out_cubic(dt / 0.2)),
                 scale=bounce_scale(dt, 0.2, 1.08, 0.05) * S, alpha=min(1.0, dt / 0.09))
        ys = self.slots(t)
        pulse = 1.0 + 0.06 * math.sin(lt * 2 * math.pi / 1.6)
        for lg in self.logos:
            dt = t - lg['at']
            if dt < 0:
                continue
            sc = bounce_scale(dt, 0.30, 1.07, 0.2) * S
            al = min(1.0, dt / 0.12)
            px, py = place(W / 2, ys[id(lg)])
            blit(frame, lg['glow'], px, py, scale=sc, alpha=al * pulse, mode='screen')
            blit(frame, lg['sprite'], px, py, scale=sc, alpha=al)
        return frame


# ----------------------------------------------------------------------------- framing (shots and push)

@dataclass
class Shot:
    t0: float
    t1: float
    zoom: float
    cx: float = W / 2
    eye_y: float = H * 0.45
    eye_target: float = 0.34
    y_shift: float = 0.0
    cx_track: object = None      # per-frame face x inside the shot (smoothed), so the frame follows him


def plan_shots(segments, words, clip_start, recipe, cuts=None, payoffs=(), group_starts=(), every=2.0):
    """Speaker segments split into shots, about every `every` seconds (trial A cut every
    three to four and a quarter seconds, slower than the reference): a cut lands on a
    payoff phrase as it arrives (a punch-in), else in a pause before a word (the silence
    measured in his voice), else as a new caption group comes in. Shots alternate a
    close and a closer framing, phased so the payoff lines fall in the closer one where
    possible. payoffs: (start, end) of each payoff line on the clip clock."""
    full = 'full-face-vertical' in recipe
    motion = 'constant-motion' in recipe
    zooms = (1.18, 1.34, 1.5) if full else (1.0, 1.12, 1.26)     # close, closer, punch-in
    shots = []
    cand = [(w['on'] - clip_start - 2.0 / FPS, False) for w in words if w.get('quiet', 0) >= 0.2]
    cand += [(g0 - 1.0 / FPS, None) for g0 in group_starts]
    cand += [(a - 1.0 / FPS, True) for a, _ in payoffs]
    pay_starts = {round((a - 1.0 / FPS) * FPS) for a, _ in payoffs}
    if cuts is not None:
        cand = [(c - clip_start, False) for c in cuts]
    prev_z = None
    for a, b in segments:
        pts = [a]
        if motion:
            last = a
            while True:
                if cuts is not None:
                    opts = [c for c, _ in cand if last + 0.5 <= c <= b - 0.5]
                    if not opts:
                        break
                    c = min(opts)
                else:
                    lo, hi, aim = last + 0.55 * every, min(last + 1.45 * every, b - 1.0), last + every
                    win = [(c, pay) for c, pay in cand if lo <= c <= hi]
                    if not win:      # a long run with no cut point in range: take the next one there is
                        later = [c for c, _ in cand if hi < c <= b - 1.0]
                        if not later:
                            break
                        c = min(later)
                    else:
                        # a payoff beats a pause, a pause beats a caption change; then the nearest the aim
                        rank = {True: 2.0, False: 1.0, None: 0.0}
                        c = max(win, key=lambda cp: rank[cp[1]] - 1.2 * abs(cp[0] - aim))[0]
                pts.append(c)
                last = c
        pts.append(b)
        spans = [(round(pts[k] * FPS) / FPS, round(pts[k + 1] * FPS) / FPS) for k in range(len(pts) - 1)]
        # framings alternate close / closer; a cut on a payoff is a push in, one step tighter
        # than the shot before (trial A could cut 1.46 to 1.34 or 1.34 to 1.28, steps of 5 to
        # 9 per cent that read as a glitch, not a cut: every step here is at least 12 per cent)
        for k, (t0, t1) in enumerate(spans):
            if not motion:
                z = zooms[0]
            elif round(t0 * FPS) in pay_starts and (k > 0 or prev_z is not None):
                z = zooms[1] if prev_z == zooms[0] else zooms[2]
            elif prev_z is None or prev_z != zooms[0]:
                z = zooms[0]
            else:
                z = zooms[1]
            shots.append(Shot(t0, t1, z))
            prev_z = z
    return shots


def frame_transform(shot: Shot, t, recipe):
    """Affine matrix (source -> output) for clip time t inside shot."""
    motion = 'constant-motion' in recipe
    u = (t - shot.t0) / max(shot.t1 - shot.t0, 1e-3)
    z = shot.zoom * (1.0 + (0.05 * ease_in_out(u) if motion else 0.0))
    ww, hh = W / z, H / z
    cx = shot.cx
    if shot.cx_track is not None and len(shot.cx_track):
        cx = float(shot.cx_track[min(max(int(round((t - shot.t0) * FPS)), 0), len(shot.cx_track) - 1)])
    x0 = min(max(cx - ww / 2, 0), W - ww)
    y0 = min(max(shot.eye_y - shot.eye_target * hh + shot.y_shift, 0), H - hh)
    return np.array([[z, 0, -x0 * z], [0, z, -y0 * z]], np.float32), z, x0, y0


# ----------------------------------------------------------------------------- render

def parse_cutaway(s):
    """'START-END|logo.svg,logo2.svg@Word|two words' on the take's clock."""
    parts = s.split('|')
    if len(parts) != 3:
        raise SystemExit(f'bad --cutaway {s!r}: want START-END|logos|two words')
    a, b = parts[0].split('-')
    return {'start': float(a), 'end': float(b), 'logos': [x.strip() for x in parts[1].split(',') if x.strip()],
            'words': parts[2].strip()}


def contact_sheet(video, out_jpg, every=0.5, cols=8, tw=216):
    th = int(tw * H / W)
    step = max(1, int(round(every * FPS)))
    raw = run(['ffmpeg', '-v', 'error', '-i', str(video), '-vf', f'select=not(mod(n\\,{step})),scale={tw}:{th}',
               '-fps_mode', 'vfr', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    n = len(raw) // (tw * th * 3)
    thumbs = np.frombuffer(raw[:n * tw * th * 3], np.uint8).reshape(n, th, tw, 3)
    rows = math.ceil(n / cols)
    lab = 26
    sheet = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + lab + 6) + 6), (16, 16, 16))
    d = ImageDraw.Draw(sheet)
    f = font('light', 20)
    for k in range(n):
        r, c = divmod(k, cols)
        x, y = 6 + c * (tw + 6), 6 + r * (th + lab + 6)
        sheet.paste(Image.fromarray(thumbs[k]), (x, y + lab))
        # safe-area guides on the thumbnail
        d.line([(x, y + lab + int(th * SAFE_TOP)), (x + 6, y + lab + int(th * SAFE_TOP))], fill=(255, 80, 80))
        d.line([(x, y + lab + int(th * SAFE_BOTTOM)), (x + 6, y + lab + int(th * SAFE_BOTTOM))], fill=(255, 80, 80))
        d.text((x + 2, y + 2), f'{k * every:4.1f}s', font=f, fill=(230, 230, 230))
    sheet.save(out_jpg, quality=90)
    return n


def render(args):
    t_start = time.time()
    take = Path(args.take)
    recipe = set(MODULES) if args.recipe == 'all' else {m.strip() for m in args.recipe.split(',') if m.strip()}
    unknown = recipe - set(MODULES)
    if unknown:
        raise SystemExit(f'unknown modules {sorted(unknown)}; known: {", ".join(MODULES)}')
    start, end = float(args.start), float(args.end)
    dur = end - start
    nframes = int(round(dur * FPS))
    dur = nframes / FPS
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    stem = out.with_suffix('')
    cutaways = [parse_cutaway(c) for c in (args.cutaway or [])] if 'dark-object-card' in recipe else []
    cut_windows = [(round((c['start'] - start) * FPS) / FPS, round((c['end'] - start) * FPS) / FPS) for c in cutaways]
    report = {'take': str(take), 'start': start, 'end': end, 'frames': nframes, 'fps': FPS,
              'recipe': sorted(recipe), 'cutaways': cutaways, 'fonts': {}}

    # words, snapped to the voice
    words, _ = load_words(args.words, start - 0.5, end)
    env_t0 = max(start - 1.0, 0)
    db = audio_envelope(take, env_t0, end + 1.0)
    thr = refine_onsets(words, db, env_t0, hiss=hiss_envelope(take, env_t0, end + 1.0))
    report['onsets'] = {'speech_threshold_db': round(thr, 1),
                        'words': [{'w': w['w'].strip(), 'whisper_s': w['s'], 'onset': w['on'],
                                   'shift_ms': int(round((w['on'] - w['s']) * 1000)), 'how': w['on_how']}
                                  for w in words if w['s'] >= start - 0.05]}
    words = [w for w in words if w['on'] >= start - 0.02 and w['on'] < end - 0.05]

    # captions
    groups = []
    if 'kinetic-serif-captions' in recipe:
        bold = [b for b in (args.bold or '').split(',') if b.strip()]
        payoffs = [p.strip() for p in (args.payoff or '').split(';') if p.strip()]
        groups = plan_groups(words, start, cut_windows, bold, payoffs, args.lead, auto_bold=not args.no_auto_bold)
        time_groups(groups, dur, cut_windows)
        check_glyphs([t.text for g in groups for ln in g.lines for t in ln] +
                     [c['words'] for c in cutaways])
        for g in groups:
            layout_group(g)
        if 'word-bounce-in' not in recipe:
            for g in groups:
                for ln in g.lines:
                    for t in ln:
                        t.on = g.t0
    report['fonts'] = {'sans': str(SANS_FILE.relative_to(REPO)), 'serif': str(SERIF_FILE.relative_to(REPO)),
                       'weights': {'light': LIGHT_WGHT, 'bold': BOLD_WGHT, 'serif': SERIF_WGHT},
                       'status': 'trial faces (OFL), not approved brand faces'}

    # analysis pass: mask + face at reduced size
    t0 = time.time()
    treat = 'treated-background' in recipe
    masks, grays, faces = analyse(take, start, nframes, args.mask_model)
    nframes = min(nframes, len(masks))
    raw_flicker = flicker_metric(masks, grays)
    masks = smooth_masks(masks, grays)
    report['mask'] = {'model': args.mask_model, 'flicker_raw': raw_flicker, 'flicker_smoothed': flicker_metric(masks, grays),
                      'analysis_s': round(time.time() - t0, 1)}
    log(f'analysis: {nframes} frames in {time.time() - t0:.1f}s; mask flicker raw {raw_flicker} -> '
        f'smoothed {report["mask"]["flicker_smoothed"]} (mean, max; 0-255 at still edges)')

    # shots and framing
    segs, cur = [], 0.0
    for a, b in sorted(cut_windows):
        if a > cur:
            segs.append((cur, a))
        cur = max(cur, b)
    if cur < dur:
        segs.append((cur, dur))
    pay_spans = [(g.t0, g.t1) for g in groups if any(t.kind == 'serif' for ln in g.lines for t in ln)]
    shots = plan_shots(segs, words, start, recipe, [float(x) for x in args.cuts.split(',')] if args.cuts else None,
                       pay_spans, [g.t0 for g in groups], every=args.shot_every)
    # a caption that would hang on for a frame or two after a cut clears on the cut
    for g in groups:
        for s_ in shots[1:]:
            if g.t0 < s_.t0 < g.t1 <= s_.t0 + 0.1:
                g.t1 = s_.t0
    # caption block height (largest group) and the caption line
    max_block = max([g.height for g in groups], default=0)
    cap_bottom_limit = H * SAFE_BOTTOM - 16
    # every caption block sits on one bottom line just above the platform UI (trial A centred
    # them, which put one-line groups 70 px higher, on his chin); a two-line payoff block
    # grows upwards. cap_top is the highest any caption reaches
    cap_bottom = cap_bottom_limit
    cap_top = cap_bottom - max_block
    prev_zoom = None
    cx_smooth = cv2.GaussianBlur(faces[:, 0].reshape(-1, 1).astype(np.float32), (1, 0), 8).reshape(-1) \
        if len(faces) else faces[:, 0]
    for s in shots:
        f0, f1 = int(s.t0 * FPS), max(int(s.t1 * FPS), int(s.t0 * FPS) + 1)
        fs = faces[f0:f1]
        s.cx = float(np.median(fs[:, 0]))
        if 'constant-motion' in recipe:
            # the frame drifts after him sideways, gently (trial A held each shot's middle, so
            # a lean cut his ear off in the tight framings, e.g. 19.25 s)
            s.cx_track = cx_smooth[f0:f1]
        s.eye_y = float(np.median(fs[:, 1]))
        # the highest caption ink in this shot (a one-line group sits lower than a two-line one)
        over = [g for g in groups if min(g.t1, s.t1) - max(g.t0, s.t0) > 0.1]
        s_cap_top = min((cap_bottom - g.height for g in over), default=H)
        if 'full-face-vertical' in recipe and over:
            # keep the chin clear of the captions: if the chin would reach them at the end of
            # the push, lift the face (move the window down) as far as the frame allows, and
            # if the frame's bottom edge stops that, frame a little wider (trial A left the
            # lead-in line on his beard for 29 frames at the end)
            # (with the window on the source's bottom edge, a closer framing is what lifts the
            # chin: the chin's height in the output is H - (H - chin) * zoom). A shot may go
            # 0.10 closer than planned, never past 1.5 (the source is only 1080 wide).
            ceiling = min(1.5, s.zoom + 0.10)
            for _ in range(80):
                worst = 0.0
                for t in (s.t0, s.t1 - 1e-3):
                    M, z, x0, y0 = frame_transform(s, t, recipe)
                    worst = max(worst, (np.percentile(fs[:, 3], 95) - y0) * z)
                if worst + 24 <= s_cap_top:
                    break
                if y0 < H - H / z - 0.5:
                    s.y_shift += 12
                elif s.zoom + 0.02 <= ceiling + 1e-6:
                    s.zoom = round(s.zoom + 0.02, 3)
                else:
                    break
        prev_zoom = s.zoom
    # report the framing against the caption line, frame by frame
    clash = []
    for k in range(nframes):
        t = k / FPS
        if any(a <= t < b for a, b in cut_windows):
            continue
        s = next((s for s in shots if s.t0 <= t < s.t1), shots[-1])
        M, z, x0, y0 = frame_transform(s, t, recipe)
        mouth_out = (faces[k, 2] - y0) * z
        chin_out = (faces[k, 3] - y0) * z
        g = next((g for g in groups if g.t0 <= t < g.t1), None)
        clash.append((t, mouth_out, chin_out, cap_bottom - g.height if g else None))
    report['framing'] = {
        'shots': [{'t0': round(s.t0, 3), 't1': round(s.t1, 3), 'take_t0': round(s.t0 + start, 3), 'zoom': s.zoom,
                   'cx': round(s.cx), 'eye_y': round(s.eye_y), 'y_shift': s.y_shift} for s in shots],
        'caption_bottom_px': round(cap_bottom), 'caption_top_px': round(cap_top), 'caption_block_max_px': round(max_block),
        'safe_area_px': [round(H * SAFE_TOP), round(H * SAFE_BOTTOM)],
        'max_mouth_y_out': round(max(c[1] for c in clash)) if clash else None,
        'max_chin_y_out': round(max(c[2] for c in clash)) if clash else None,
        'frames_chin_below_caption_top': sum(1 for c in clash if c[2] > cap_top),
        'frames_mouth_below_caption_top': sum(1 for c in clash if c[1] > cap_top),
        'frames_chin_below_showing_caption': sum(1 for c in clash if c[3] is not None and c[2] > c[3]),
    }
    if args.plan_only:
        report['captions'] = [{'t0': round(g.t0, 3), 't1': round(g.t1, 3), 'lines': [[t.text for t in ln] for ln in g.lines]}
                              for g in groups]
        print(json.dumps(report['framing'], indent=1))
        return report
    report['captions'] = [{'t0': round(g.t0, 3), 't1': round(g.t1, 3),
                           'lines': [[f'{t.text}' + ('*' if t.kind == 'bold' else '~' if t.kind == 'serif' else '')
                                      for t in ln] for ln in g.lines],
                           'arrivals': [round(t.on, 3) for ln in g.lines for t in ln]} for g in groups]

    cards = [Card(c, Path(args.logo_dir), out.parent / '_logos', words, start) for c in cutaways]

    # render pass
    enc = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-ss', f'{start:.3f}', '-t', f'{dur:.3f}', '-i', str(take),
           '-map', '0:v:0', '-map', '1:a:0',
           '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
           '-c:v', 'libx264', '-preset', args.preset, '-crf', str(args.crf), '-profile:v', 'high',
           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
           '-af', f'aresample=48000,afade=t=in:d=0.02,afade=t=out:st={max(dur - 0.05, 0):.3f}:d=0.05',
           '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-shortest', str(out)]
    treat_obj = None
    if treat:
        t_p = time.time()
        plate = build_plate(take, start, nframes, masks) if not args.no_plate else None
        if plate is not None and plate['residual_mean'] is not None and plate['residual_mean'] <= 6.0 \
                and plate['coverage'] >= 0.15:
            treat_obj = PlateTreat(plate)
            how = 'clean plate (trial B): edge alpha against the known room, set made from the plate'
        else:
            treat_obj = Treat()
            how = 'colour-band cut-out (trial A): ' + ('--no-plate' if plate is None else
                                                       'the camera moved or the room was never seen, no plate')
        report['plate'] = {'used': isinstance(treat_obj, PlateTreat), 'how': how, 's': round(time.time() - t_p, 1)}
        if plate is not None:
            report['plate'].update({k: plate[k] for k in ('frames', 'residual_mean', 'residual_max', 'coverage')})
        log(f'background: {how}')
    encp = subprocess.Popen(enc, stdin=subprocess.PIPE)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rv = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.47) / (H * 0.62)) ** 2)
    vig1 = (1 - 0.22 * smoothstep(0.55, 1.35, rv)).astype(np.float32)
    vignette = cv2.merge([vig1, vig1, vig1]) if treat else None
    rng = np.random.default_rng(3)
    fine_grain = [cv2.merge([g, g, g]) for g in (rng.normal(0, 2.2, (H, W)).astype(np.float32) for _ in range(4))] if treat else None
    prev_a = prev_r = prev_g = None
    prev_k = -9
    alpha_flicker, raw_flicker_f = [], []
    cap_boxes = []
    t1 = time.time()
    plate_mode = isinstance(treat_obj, PlateTreat)

    def finish(k, fr, img):
        """Frame the speaker, grade, caption and write output frame k (img: the treated
        frame in the source's coordinates, or None for a card)."""
        t = k / FPS
        card = next((c for c in cards if c.t0 <= t < c.t1), None)
        if card is not None:
            img = card.render(t, k)
        else:
            if img is None:
                img = fr.astype(np.float32)
            s = next((s for s in shots if s.t0 <= t < s.t1), shots[-1])
            if 'full-face-vertical' in recipe or 'constant-motion' in recipe:
                M, *_ = frame_transform(s, t, recipe)
                img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
            if vignette is not None:
                img = cv2.add(cv2.multiply(img, vignette), fine_grain[k % 4])
            if groups:
                bb = draw_captions(img, groups, t, cap_bottom, bounce='word-bounce-in' in recipe)
                if bb:
                    framed = 'full-face-vertical' in recipe or 'constant-motion' in recipe
                    M, z, x0, y0 = frame_transform(s, t, recipe) if framed else (None, 1.0, 0, 0)
                    cap_boxes.append((t,) + tuple(round(v) for v in bb) +
                                     (round((faces[k, 2] - y0) * z), round((faces[k, 3] - y0) * z)))
        encp.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
        if k % 48 == 0:
            el = time.time() - t1
            log(f'  frame {k}/{nframes}  {el:.0f}s  ({el / max(k, 1):.2f}s/frame)')

    def flicker(k, fr, alpha, raw):
        """Frame-to-frame alpha change at the edge where the picture itself is still (0-255)."""
        nonlocal prev_a, prev_r, prev_g, prev_k
        a_s = cv2.resize(alpha, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        r_s = cv2.resize(raw, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        g_s = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(fr, (W // 4, H // 4), interpolation=cv2.INTER_AREA),
                                            cv2.COLOR_RGB2GRAY).astype(np.float32), (5, 5), 0)
        if prev_a is not None and prev_k == k - 1:
            sel = (np.abs(g_s - prev_g) < 4) & (((a_s > 0.05) & (a_s < 0.95)) | ((prev_a > 0.05) & (prev_a < 0.95)))
            if sel.sum() > 50:
                alpha_flicker.append(float(np.abs(a_s - prev_a)[sel].mean() * 255))
                raw_flicker_f.append(float(np.abs(r_s - prev_r)[sel].mean() * 255))
        prev_a, prev_r, prev_g, prev_k = a_s, r_s, g_s, k

    # with the plate, each frame's cut-out is finished one frame late, so its edge can be
    # steadied against the frames either side of it
    pend = []      # (k, fr, state or None): the frame before this one, and this one
    last_a = [None, -9]          # the last output frame's alpha and its index

    def flush(j):
        kj, fj, sj = pend[j]
        img = None
        if sj is not None:
            a = steady_alpha(pend[j - 1][2] if j > 0 else None, sj, pend[j + 1][2] if j + 1 < len(pend) else None,
                             last=last_a[0] if last_a[1] == kj - 1 else None)
            last_a[:] = [a, kj]
            img = treat_obj.composite(sj, a)
            flicker(kj, fj, a, sj['alpha'])
        finish(kj, fj, img)

    for k, fr in enumerate(read_frames(decode_cmd(take, start, nframes, W, H), W, H)):
        if k >= nframes:
            break
        t = k / FPS
        card = next((c for c in cards if c.t0 <= t < c.t1), None)
        if not plate_mode:
            img = None
            if card is None and treat_obj is not None:
                img, alpha = treat_obj.apply(fr, masks[k], fidx=k)
                flicker(k, fr, alpha, treat_obj.raw_alpha)
            finish(k, fr, img)
            continue
        pend.append((k, fr, treat_obj.estimate(fr, masks[k], face=faces[k]) if card is None else None))
        if len(pend) >= 2:
            flush(len(pend) - 2)
        if len(pend) > 2:
            pend.pop(0)
    if plate_mode and pend:
        flush(len(pend) - 1)       # the last frame: nothing after it to steady against
    encp.stdin.close()
    if encp.wait() != 0:
        raise SystemExit('ffmpeg encode failed')
    report['render_s'] = round(time.time() - t1, 1)
    if isinstance(treat_obj, PlateTreat) and treat_obj.stats['noise']:
        st_ = treat_obj.stats
        report['plate'].update({'room_noise_median': round(float(np.median(st_['noise'])), 2),
                                'room_noise_max': round(float(np.max(st_['noise'])), 2),
                                'frames_with_hand_held_by_difference': int(sum(1 for d in st_['diff_px'] if d > 0)),
                                'exposure_gain_range': [round(float(np.min(st_['gain'])), 3), round(float(np.max(st_['gain'])), 3)]})
    if alpha_flicker:
        report['mask']['final_alpha_flicker'] = {'mean': round(float(np.mean(alpha_flicker)), 2),
                                                 'p95': round(float(np.percentile(alpha_flicker, 95)), 2),
                                                 'max': round(float(np.max(alpha_flicker)), 2),
                                                 'before_steadying_mean': round(float(np.mean(raw_flicker_f)), 2),
                                                 'before_steadying_p95': round(float(np.percentile(raw_flicker_f, 95)), 2),
                                                 'note': 'mean frame-to-frame change of the final alpha at the edge where the picture is still, 0-255'}
    if cap_boxes:
        report['caption_ink'] = {'min_top_px': min(b[2] for b in cap_boxes), 'max_bottom_px': max(b[4] for b in cap_boxes),
                                 'min_left_px': min(b[1] for b in cap_boxes), 'max_right_px': max(b[3] for b in cap_boxes),
                                 'inside_safe_area': bool(min(b[2] for b in cap_boxes) >= H * SAFE_TOP and
                                                          max(b[4] for b in cap_boxes) <= H * SAFE_BOTTOM),
                                 'frames_with_caption': len(cap_boxes),
                                 'frames_caption_over_mouth': sum(1 for b in cap_boxes if b[2] < b[5]),
                                 'frames_caption_over_chin': sum(1 for b in cap_boxes if b[2] < b[6]),
                                 'min_gap_caption_to_mouth_px': min(b[2] - b[5] for b in cap_boxes),
                                 'min_gap_caption_to_chin_px': min(b[2] - b[6] for b in cap_boxes),
                                 'caption_over_chin_at_s': runs([b[0] for b in cap_boxes if b[2] < b[6]])}
    if args.sheet:
        n = contact_sheet(out, args.sheet, every=args.sheet_every)
        report['sheet'] = {'path': str(args.sheet), 'frames': n, 'every_s': args.sheet_every}
    if args.stills:
        sd = Path(str(stem) + '-stills')
        sd.mkdir(exist_ok=True)
        for ts in args.stills.split(','):
            ts = float(ts)
            run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ts:.3f}', '-i', str(out), '-frames:v', '1', '-q:v', '2',
                 str(sd / f'still-{ts:05.2f}.jpg')])
        report['stills'] = str(sd)
    if args.sync_plot:
        sync_plot(db, env_t0, start, dur, groups, cut_windows, Path(str(stem) + '-sync.png'))
    probe = run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,pix_fmt,r_frame_rate,sample_rate,channels:format=duration',
                 '-of', 'json', str(out)], capture_output=True, text=True).stdout
    report['output'] = json.loads(probe)
    report['wall_s'] = round(time.time() - t_start, 1)
    Path(str(stem) + '.report.json').write_text(json.dumps(report, indent=1))
    log(f'wrote {out} ({report["wall_s"]}s); report {stem}.report.json')
    return report


def runs(ts, step=1.0 / FPS):
    """[t, t+1/24, ...] -> [[start, end], ...] of the consecutive frames."""
    out = []
    for t in ts:
        if out and t - out[-1][1] <= step * 1.5:
            out[-1][1] = round(t, 3)
        else:
            out.append([round(t, 3), round(t, 3)])
    return out


def sync_plot(db, env_t0, start, dur, groups, cut_windows, path, px_per_s=120):
    """The voice's loudness with a tick where each caption word arrives: words should sit on the rises."""
    w = int(dur * px_per_s) + 40
    hgt = 260
    im = Image.new('RGB', (w, hgt), (18, 18, 20))
    d = ImageDraw.Draw(im)
    f = font('light', 14)
    i0 = int((start - env_t0) / 0.01)
    seg = db[i0:i0 + int(dur / 0.01)]
    pts = [(20 + k * 0.01 * px_per_s, 200 - (max(v, -70) + 70) * 2.4) for k, v in enumerate(seg)]
    for a, b in cut_windows:
        d.rectangle([20 + a * px_per_s, 0, 20 + b * px_per_s, hgt], fill=(40, 34, 50))
    d.line(pts, fill=(120, 200, 160), width=1)
    for g in groups:
        for ln in g.lines:
            for t in ln:
                x = 20 + t.on * px_per_s
                d.line([(x, 30), (x, 210)], fill=(255, 170, 120))
                d.text((x + 2, 212 + (hash(t.text) % 3) * 14), t.text, font=f, fill=(240, 240, 240))
    for s in range(int(dur) + 1):
        d.text((20 + s * px_per_s, 4), f'{s}s', font=f, fill=(160, 160, 160))
    im.save(path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--take', required=True)
    ap.add_argument('--words', required=True, help='faster-whisper words JSON (s/e seconds on the take clock)')
    ap.add_argument('--start', required=True, type=float)
    ap.add_argument('--end', required=True, type=float)
    ap.add_argument('--recipe', default='all', help=f'"all" or a comma list of: {", ".join(MODULES)}')
    ap.add_argument('--cutaway', action='append', help='START-END|logo.svg,logo2.svg@SpokenWord|two words (take clock)')
    ap.add_argument('--logo-dir', default=str(DEFAULT_LOGO_DIR))
    ap.add_argument('--bold', default='', help='comma list of words set in bold; word#n for only the nth time he says it')
    ap.add_argument('--no-auto-bold', action='store_true', help='do not bold a word in groups with no bold word')
    ap.add_argument('--payoff', default='', help='semicolon list of payoff phrases set in the italic serif')
    ap.add_argument('--cuts', default='', help='optional comma list of punch-in cut times (take clock)')
    ap.add_argument('--lead', type=float, default=0.04, help='seconds a word arrives before its onset')
    ap.add_argument('--shot-every', type=float, default=2.0, help='aim for a cut about this often (seconds)')
    ap.add_argument('--mask-model', type=int, default=0, help='mediapipe selfie segmentation: 0 general, 1 landscape')
    ap.add_argument('--no-plate', action='store_true', help="trial A's cut-out (no clean plate of the room)")
    ap.add_argument('--plan-only', action='store_true', help='plan captions, shots and framing, print them, render nothing')
    ap.add_argument('--out', required=True)
    ap.add_argument('--sheet', default='')
    ap.add_argument('--sheet-every', type=float, default=0.5)
    ap.add_argument('--stills', default='', help='comma list of output times to save as single frames')
    ap.add_argument('--sync-plot', action='store_true')
    ap.add_argument('--crf', type=int, default=18)
    ap.add_argument('--preset', default='medium')
    args = ap.parse_args(argv)
    render(args)


if __name__ == '__main__':
    main()
