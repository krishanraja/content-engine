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


def text_sprite(text, kind, size, glow=True):
    f = font(kind, size)
    asc, desc = f.getmetrics()
    adv = f.getlength(text)
    pad = int(size * 0.55)
    w, h = int(math.ceil(adv)) + 2 * pad, asc + desc + 2 * pad
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).text((pad, pad + asc), text, font=f, fill=255, anchor='ls')
    m = np.asarray(mask, np.float32) / 255.0
    if kind == 'serif':
        xs = np.clip((np.arange(w, dtype=np.float32) - pad) / max(adv, 1.0), 0, 1)
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


def refine_onsets(words, db, env_t0, hop=0.01):
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

    prev_on = -1e9
    for k, w in enumerate(words):
        s, e = w['s'], w['e']
        lo = max(s - 0.45, prev_on + 0.06)
        if k > 0:
            lo = max(lo, words[k - 1]['s'] + 0.06)
        j = idx(s)
        new, how = s, 'kept'
        if not speech[max(j - 1, 0):j + 2].any():
            hi = max(e - 0.03, s)
            jj = j
            while jj < idx(hi) and not speech[jj]:
                jj += 1
            if speech[jj]:
                new, how = t_of(jj), 'moved later (whisper start was in silence)'
        else:
            jj = j
            while jj - 1 >= idx(lo) and speech[jj - 1]:
                jj -= 1
            # a genuine onset: at least 60 ms of quiet just before it
            if jj > idx(lo) and not speech[max(jj - 6, 0):jj].any() and jj < j:
                new, how = t_of(jj), 'moved earlier (voice starts before whisper)'
        w['on'] = round(new, 3)
        w['on_how'] = how
        prev_on = new
    return thr


# ----------------------------------------------------------------------------- captions

@dataclass
class Token:
    text: str
    kind: str            # light | bold | serif
    on: float            # arrival on the clip clock (seconds from clip start)
    end: float
    src: dict = field(default_factory=dict)


@dataclass
class Group:
    lines: list          # list of list[Token]
    t0: float = 0.0
    t1: float = 0.0
    layout: list = field(default_factory=list)   # (token, sprite, x_anchor, y_anchor)
    height: float = 0.0


def plan_groups(words, clip_start, cut_windows, bold, payoffs, lead, max_words=3):
    """Group the spoken words into 2-4 word captions; payoff phrases get their own serif line."""
    toks = []
    for w in words:
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
        toks.append(Token(txt, 'light', max(on - lead, 0.0), w['e'] - clip_start, w))
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
    boldk = {key_word(b) for b in bold}
    for t, k, p in zip(toks, keys, pay_id):
        if p is None and k in boldk:
            t.kind = 'bold'

    def ends_sentence(t):
        return bool(re.search(r'[.?!]\s*$', t.src['w']))

    def ends_clause(t):
        return bool(re.search(r'[,;:]\s*$', t.src['w']))

    def crosses_cut(a, b):
        return any(a.on < x <= b.on for x, _ in cut_windows) or any(a.on < x <= b.on for _, x in cut_windows)

    groups, cur, i = [], [], 0
    while i < len(toks):
        t = toks[i]
        if pay_id[i] is not None:
            j = i
            while j < len(toks) and pay_id[j] == pay_id[i]:
                j += 1
            phrase = toks[i:j]
            lead_ok = cur and len(cur) <= 3 and not ends_sentence(cur[-1]) and phrase[0].on - cur[-1].end < 0.5 \
                and not crosses_cut(cur[-1], phrase[0])
            if cur and not lead_ok:
                groups.append(Group([cur]))
            groups.append(Group([cur, phrase] if lead_ok else [phrase]))
            cur, i = [], j
            continue
        cur.append(t)
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        close = (nxt is None or ends_sentence(t) or (ends_clause(t) and len(cur) >= 2)
                 or nxt.on - t.end > 0.45 or crosses_cut(t, nxt))
        if not close and len(cur) >= max_words:
            close = pay_id[i + 1] is None or len(cur) > 3
        if close:
            groups.append(Group([cur]))
            cur = []
        i += 1
    if cur:
        groups.append(Group([cur]))
    # a group with no emphasis gets its strongest content word in bold (the reference
    # sets the word that carries the meaning in bold)
    for g in groups:
        flat = [t for ln in g.lines for t in ln]
        if any(t.kind != 'light' for t in flat):
            continue
        cands = [t for t in flat if key_word(t.src['w']) not in STOP and len(t.text) >= 4]
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
            sps = [text_sprite(t.text, t.kind, size) for t in line]
            space = font('light', size).getlength(' ') * (0.9 if serif else 1.0)
            total = sum(s.adv for s in sps) + space * (len(sps) - 1)
            if total <= max_w or size <= 40:
                break
            size = int(size * 0.92)
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


def draw_captions(frame, groups, t, centre, bounce=True):
    """Draw the caption group showing at clip time t, its block centred on y=centre. Returns ink bbox."""
    bbox = None
    for g in groups:
        if not (g.t0 <= t < g.t1):
            continue
        top = centre - g.height / 2
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

    def __init__(self, l_weight=0.4, conf_lo=8.0, conf_hi=22.0):
        self.l_weight, self.conf_lo, self.conf_hi = l_weight, conf_lo, conf_hi
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

    def apply(self, frame_u8, m_small, band_r=12):
        """frame: full-res uint8 RGB; m_small: MHxMW float mask (0-1, temporally smoothed).

        The mask from the model is soft and ~20 px loose round the ears and hair, which
        leaves a bright rim of the room on the person. So the model's mask only decides
        where the edge is (a band either side of it); inside the band each pixel's alpha
        comes from its colour, placed between the person's colour and the room's colour
        just either side of it, and the room's light is taken back out of the edge pixels."""
        I = frame_u8.astype(np.float32)
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
        # colour space for the edge: Lab with lightness turned down, so a wall in the
        # shadow of an ear (same lightness as skin, different colour) is still wall
        lab = cv2.cvtColor(half, cv2.COLOR_RGB2LAB).astype(np.float32)
        lab[..., 0] *= self.l_weight
        halff = lab
        F_far, _ = normconv(halff, fg_sure, 30)
        F_loc, dF = normconv(halff, fg_sure, 7)
        F_loc = F_loc * smoothstep(0.02, 0.2, dF)[..., None] + F_far * (1 - smoothstep(0.02, 0.2, dF)[..., None])
        B_far, _ = normconv(halff, bg_sure, 30)
        B_loc, dB = normconv(halff, bg_sure, 7)
        B_loc = B_loc * smoothstep(0.02, 0.2, dB)[..., None] + B_far * (1 - smoothstep(0.02, 0.2, dB)[..., None])
        band = cv2.GaussianBlur(1 - fg_sure - bg_sure, (0, 0), 2.0)
        B_rgb, dBr = normconv(half.astype(np.float32), bg_sure, 7)
        B_rgbf, _ = normconv(half.astype(np.float32), bg_sure, 30)
        B_rgb = B_rgb * smoothstep(0.02, 0.2, dBr)[..., None] + B_rgbf * (1 - smoothstep(0.02, 0.2, dBr)[..., None])
        # colour alpha at full size
        Fu = cv2.resize(F_loc, (W, H), interpolation=cv2.INTER_LINEAR)
        Bu = cv2.resize(B_loc, (W, H), interpolation=cv2.INTER_LINEAR)
        Il = cv2.cvtColor(frame_u8, cv2.COLOR_RGB2LAB).astype(np.float32)
        Il[..., 0] *= self.l_weight
        d = Fu - Bu
        den = (d * d).sum(2)
        ac = ((Il - Bu) * d).sum(2) / np.maximum(den, 1.0)
        ac = cv2.GaussianBlur(np.clip(ac, 0, 1), (0, 0), 0.8)
        ac = np.clip((ac - 0.04) / 0.92, 0, 1)          # linear: a half-covered pixel stays half
        conf = smoothstep(self.conf_lo, self.conf_hi, np.sqrt(den))   # can colour tell person from room here?
        prior = cv2.resize(pr, (W, H), interpolation=cv2.INTER_LINEAR)
        bandu = cv2.resize(band, (W, H), interpolation=cv2.INTER_LINEAR)
        a_band = conf * ac + (1 - conf) * prior
        fgs = cv2.resize(cv2.GaussianBlur(fg_sure, (0, 0), 2.0), (W, H), interpolation=cv2.INTER_LINEAR)
        alpha = np.clip(fgs + a_band * bandu, 0, 1)     # sure room stays exactly room
        alpha[alpha < 0.01] = 0
        # the room at quarter size, the person filled out with the room's own colour
        # (normalised blur) so no skin or shirt bleeds into the soft background
        small = cv2.resize(frame_u8, (W // 4, H // 4), interpolation=cv2.INTER_AREA).astype(np.float32)
        hard = (cv2.resize(m_small, (W // 4, H // 4)) > 0.25).astype(np.uint8)
        hard = cv2.dilate(hard, np.ones((5, 5), np.uint8))
        wgt = (1 - hard).astype(np.float32)
        far, _ = normconv(small, wgt, 40)
        soft, den2 = normconv(small, wgt, 9)
        fill2 = smoothstep(0.02, 0.25, den2)[..., None]
        b_new = self.grade(soft * fill2 + far * (1 - fill2))
        B_new = cv2.resize(b_new, (W, H), interpolation=cv2.INTER_LINEAR)
        # take the room's light back out of the edge pixels, then lay them on the set
        a3 = alpha[..., None]
        Brgb = cv2.resize(B_rgb, (W, H), interpolation=cv2.INTER_LINEAR)
        F = np.clip((I - (1 - a3) * Brgb) / np.maximum(a3, 0.15), 0, 255)
        # an edge pixel is never brighter than the person just inside it: no light rim
        F_rgb, dFr = normconv(half.astype(np.float32), fg_sure, 7)
        F_rgbf, _ = normconv(half.astype(np.float32), fg_sure, 30)
        F_rgb = F_rgb * smoothstep(0.02, 0.2, dFr)[..., None] + F_rgbf * (1 - smoothstep(0.02, 0.2, dFr)[..., None])
        cap = cv2.resize(F_rgb, (W, H), interpolation=cv2.INTER_LINEAR) * 1.05 + 12
        F = np.where(bandu[..., None] > 0.02, np.minimum(F, cap), F)
        out = a3 * F + (1 - a3) * B_new
        return out, alpha


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
            at = (hit['on'] - clip_start - 0.04) if hit else self.t0 + 0.10 + 0.45 * k
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


def plan_shots(segments, words, clip_start, recipe, cuts=None):
    """Speaker segments split into shots at the pauses before sentences (a punch-in cut),
    roughly every three seconds, alternating a close and a closer framing."""
    full = 'full-face-vertical' in recipe
    motion = 'constant-motion' in recipe
    zooms = (1.18, 1.34) if full else (1.0, 1.12)
    shots = []
    cand = []
    prev_e = None
    for w in words:
        if prev_e is not None and w['s'] - prev_e >= 0.25:
            cand.append(w['on'] - clip_start - 2.0 / FPS)
        prev_e = w['e']
    if cuts is not None:
        cand = [c - clip_start for c in cuts]
    flip = 0
    for a, b in segments:
        pts = [a]
        if motion:
            last = a
            while True:
                opts = [c for c in cand if last + 1.8 <= c <= last + 4.5 and c <= b - 1.2]
                if cuts is not None:
                    opts = [c for c in cand if last + 0.5 <= c <= b - 0.5]
                if not opts:
                    break
                c = min(opts, key=lambda c: abs(c - (last + 3.0))) if cuts is None else opts[0]
                pts.append(c)
                last = c
        pts.append(b)
        for k in range(len(pts) - 1):
            t0 = round(pts[k] * FPS) / FPS
            t1 = round(pts[k + 1] * FPS) / FPS
            z = zooms[flip % 2] if motion else zooms[0]
            shots.append(Shot(t0, t1, z))
            flip += 1
    return shots


def frame_transform(shot: Shot, t, recipe):
    """Affine matrix (source -> output) for clip time t inside shot."""
    motion = 'constant-motion' in recipe
    u = (t - shot.t0) / max(shot.t1 - shot.t0, 1e-3)
    z = shot.zoom * (1.0 + (0.05 * ease_in_out(u) if motion else 0.0))
    ww, hh = W / z, H / z
    x0 = min(max(shot.cx - ww / 2, 0), W - ww)
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
    thr = refine_onsets(words, db, env_t0)
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
        groups = plan_groups(words, start, cut_windows, bold, payoffs, args.lead)
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
    shots = plan_shots(segs, words, start, recipe, [float(x) for x in args.cuts.split(',')] if args.cuts else None)
    # caption block height (largest group) and the caption line
    max_block = max([g.height for g in groups], default=0)
    cap_bottom_limit = H * SAFE_BOTTOM - 16
    # every caption block is centred on one line, set as low as the tallest block allows;
    # cap_top is the highest any caption reaches
    cap_centre = H * 0.72
    if groups:
        cap_centre = cap_bottom_limit - max_block / 2
    cap_top = cap_centre - max_block / 2
    for s in shots:
        f0, f1 = int(s.t0 * FPS), max(int(s.t1 * FPS), int(s.t0 * FPS) + 1)
        fs = faces[f0:f1]
        s.cx = float(np.median(fs[:, 0]))
        s.eye_y = float(np.median(fs[:, 1]))
        if 'full-face-vertical' in recipe:
            # keep the chin clear of the caption line: if the chin would reach it at the end
            # of the push, lift the face (move the window down) as far as the frame allows
            for _ in range(40):
                worst = 0.0
                for t in (s.t0, s.t1 - 1e-3):
                    M, z, x0, y0 = frame_transform(s, t, recipe)
                    chin_out = (np.percentile(fs[:, 3], 95) - y0) * z
                    worst = max(worst, chin_out)
                if not groups or worst + 24 <= cap_top:
                    break
                s.y_shift += 12
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
        clash.append((t, mouth_out, chin_out))
    report['framing'] = {
        'shots': [{'t0': round(s.t0, 3), 't1': round(s.t1, 3), 'take_t0': round(s.t0 + start, 3), 'zoom': s.zoom,
                   'cx': round(s.cx), 'eye_y': round(s.eye_y), 'y_shift': s.y_shift} for s in shots],
        'caption_centre_px': round(cap_centre), 'caption_top_px': round(cap_top), 'caption_block_max_px': round(max_block),
        'safe_area_px': [round(H * SAFE_TOP), round(H * SAFE_BOTTOM)],
        'max_mouth_y_out': round(max(c[1] for c in clash)) if clash else None,
        'max_chin_y_out': round(max(c[2] for c in clash)) if clash else None,
        'frames_chin_below_caption_top': sum(1 for c in clash if c[2] > cap_top),
        'frames_mouth_below_caption_top': sum(1 for c in clash if c[1] > cap_top),
    }
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
    encp = subprocess.Popen(enc, stdin=subprocess.PIPE)
    treat_obj = Treat() if treat else None
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rv = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.47) / (H * 0.62)) ** 2)
    vignette = (1 - 0.22 * smoothstep(0.55, 1.35, rv))[..., None].astype(np.float32) if treat else None
    rng = np.random.default_rng(3)
    fine_grain = [rng.normal(0, 2.2, (H, W, 1)).astype(np.float32) for _ in range(4)] if treat else None
    cap_boxes = []
    t1 = time.time()
    for k, fr in enumerate(read_frames(decode_cmd(take, start, nframes, W, H), W, H)):
        if k >= nframes:
            break
        t = k / FPS
        card = next((c for c in cards if c.t0 <= t < c.t1), None)
        if card is not None:
            img = card.render(t, k)
        else:
            if treat_obj is not None:
                img, _ = treat_obj.apply(fr, masks[k])
            else:
                img = fr.astype(np.float32)
            s = next((s for s in shots if s.t0 <= t < s.t1), shots[-1])
            if 'full-face-vertical' in recipe or 'constant-motion' in recipe:
                M, *_ = frame_transform(s, t, recipe)
                img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
            if vignette is not None:
                img = img * vignette + fine_grain[k % 4]
            if groups:
                bb = draw_captions(img, groups, t, cap_centre, bounce='word-bounce-in' in recipe)
                if bb:
                    framed = 'full-face-vertical' in recipe or 'constant-motion' in recipe
                    M, z, x0, y0 = frame_transform(s, t, recipe) if framed else (None, 1.0, 0, 0)
                    cap_boxes.append((t,) + tuple(round(v) for v in bb) +
                                     (round((faces[k, 2] - y0) * z), round((faces[k, 3] - y0) * z)))
        encp.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
        if k % 48 == 0:
            el = time.time() - t1
            log(f'  frame {k}/{nframes}  {el:.0f}s  ({el / max(k, 1):.2f}s/frame)')
    encp.stdin.close()
    if encp.wait() != 0:
        raise SystemExit('ffmpeg encode failed')
    report['render_s'] = round(time.time() - t1, 1)
    if cap_boxes:
        report['caption_ink'] = {'min_top_px': min(b[2] for b in cap_boxes), 'max_bottom_px': max(b[4] for b in cap_boxes),
                                 'min_left_px': min(b[1] for b in cap_boxes), 'max_right_px': max(b[3] for b in cap_boxes),
                                 'inside_safe_area': bool(min(b[2] for b in cap_boxes) >= H * SAFE_TOP and
                                                          max(b[4] for b in cap_boxes) <= H * SAFE_BOTTOM),
                                 'frames_with_caption': len(cap_boxes),
                                 'frames_caption_over_mouth': sum(1 for b in cap_boxes if b[2] < b[5]),
                                 'frames_caption_over_chin': sum(1 for b in cap_boxes if b[2] < b[6]),
                                 'min_gap_caption_to_mouth_px': min(b[2] - b[5] for b in cap_boxes),
                                 'min_gap_caption_to_chin_px': min(b[2] - b[6] for b in cap_boxes)}
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
    ap.add_argument('--bold', default='', help='comma list of words set in bold')
    ap.add_argument('--payoff', default='', help='semicolon list of payoff phrases set in the italic serif')
    ap.add_argument('--cuts', default='', help='optional comma list of punch-in cut times (take clock)')
    ap.add_argument('--lead', type=float, default=0.04, help='seconds a word arrives before its onset')
    ap.add_argument('--mask-model', type=int, default=0, help='mediapipe selfie segmentation: 0 general, 1 landscape')
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
