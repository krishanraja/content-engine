# Wed 11 brand frames (Krish, 2026-11-10: "closing card is wrong, zero makeyourmindup branding ... I just want the one
# 'AI Music or Human Music' title, but it to be more epic"). Real logo files only: the stacked logo and the mark are
# the engine's own (config/studio.json sha256 5a0e8a08... matches makeyourmindup.ai/brand/masthead.png).
import math
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = '/home/user/content-engine/assets/fonts/makeyourmindup'
INK, INKD, INKS, CREAM, MINT, LILAC = (12, 21, 18), (7, 13, 11), (22, 34, 29), (244, 239, 228), (126, 240, 192), (183, 166, 255)
bgr = lambda c: (c[2], c[1], c[0])
def F(name, size, wght=None):
    f = ImageFont.truetype(f'{FONT}/{name}', size)
    if wght:
        try: f.set_variation_by_axes([wght])
        except Exception: pass
    return f
ANTON = lambda s: F('Anton-Regular.ttf', s)
MONO = lambda s: F('IBMPlexMono-SemiBold.ttf', s)
FRAU = lambda s: F('Fraunces-Italic-Variable.ttf', s)
def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def back(x):
    x = min(1, max(0, x)); c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2

def _rgba(path): return cv2.imread(path, cv2.IMREAD_UNCHANGED)
STACKED = _rgba('/tmp/claude-0/brand/masthead.png')
MARK = _rgba('/tmp/claude-0/brand/icon.png')

def over(dst, rgba, x, y, w, alpha=1.0):
    h = int(rgba.shape[0] * w / rgba.shape[1]); im = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_AREA)
    a = im[..., 3:].astype(np.float32) / 255 * alpha; x, y = int(x), int(y)
    H, W = dst.shape[:2]; xa, ya, xb, yb = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if xa >= xb or ya >= yb: return
    s = im[ya - y:yb - y, xa - x:xb - x, :3].astype(np.float32); aa = a[ya - y:yb - y, xa - x:xb - x]
    dst[ya:yb, xa:xb] = (s * aa + dst[ya:yb, xa:xb].astype(np.float32) * (1 - aa)).astype(np.uint8)

def text(dst, s, f, x, y, fill, anchor='la', alpha=1.0):
    if alpha <= 0.01: return
    l, t, r, b = f.getbbox(s, anchor=anchor); x0, y0 = int(x + l) - 4, int(y + t) - 4; w, h = int(r - l) + 8, int(b - t) + 8
    ov = Image.new('L', (w, h), 0); ImageDraw.Draw(ov).text((x - x0, y - y0), s, font=f, fill=255, anchor=anchor)
    a = np.asarray(ov, np.float32)[..., None] / 255 * alpha
    H, W = dst.shape[:2]; xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb: return
    aa = a[ya - y0:yb - y0, xa - x0:xb - x0]
    dst[ya:yb, xa:xb] = (np.array(bgr(fill), np.float32) * aa + dst[ya:yb, xa:xb].astype(np.float32) * (1 - aa)).astype(np.uint8)

def hatch(h, w, phase=0):
    im = np.full((h, w, 3), bgr(INK), np.uint8)
    for k in range(-h, w + h, 22):
        x = k + int(phase) % 22; cv2.line(im, (x, 0), (x + h, h), bgr(INKS), 7, cv2.LINE_AA)
    return im

def pill(dst, label, x, y, size=34, anchor='l'):
    f = MONO(size); w = int(f.getlength(label)) + 2 * int(size * 0.7); h = int(size * 1.7)
    if anchor == 'r': x -= w
    if anchor == 'm': x -= w // 2
    cv2.rectangle(dst, (int(x), int(y)), (int(x + w), int(y + h)), bgr(LILAC), -1)
    text(dst, label, f, x + w / 2, y + h / 2, INK, 'mm'); return w, h

def corner(dst, aspect):
    """The house dress from the first frame: the mark on its ink tile (lilac shadow) and the series pill."""
    # both at the top right, so the screens' own titles at the top left stay clear
    tall = aspect == '9:16'; s = 96 if tall else 90; right = (1080 - 40) if tall else 1250; y = 30 if tall else 58
    x = right - s
    cv2.rectangle(dst, (x + 8, y + 8), (x + s + 8, y + s + 8), bgr(LILAC), -1)
    cv2.rectangle(dst, (x, y), (x + s, y + s), bgr(INK), -1); over(dst, MARK, x + 9, y + 9, s - 18)
    pill(dst, 'under.the.hood', x - 18, y + (s - 51) // 2, 30, 'r')

def wave_bars(dst, y0, h, t, col, amp=1.0, seed=0.0, n=60):
    W = dst.shape[1]; bw = W / n
    for i in range(n):
        v = 0.2 + 0.8 * abs(math.sin(i * 0.61 + seed + t * 7.0) * math.sin(i * 0.19 + t * 2.9 + seed))
        bh = int(h * v * amp / 2); cx = int(i * bw + bw / 2)
        cv2.line(dst, (cx, y0 + h // 2 - bh), (cx, y0 + h // 2 + bh), bgr(col), max(3, int(bw * 0.5)), cv2.LINE_AA)

def title_full(W, H, t, t0):
    """The one title, full frame, in the pause after his question: AI MUSIC (hatched, glitching) slams against
    HUMAN MUSIC? (mint), the song's waveform pulsing behind, the house lockup underneath."""
    k = t - t0; g = np.full((H, W, 3), bgr(INKD), np.uint8); tall = H > W
    beat = 0.5 + 0.5 * math.cos(k * 2 * math.pi * 2.1)                       # pulse at about 126 bpm
    wave_bars(g, int(H * 0.08), int(H * 0.84), k, (40, 70, 58), 0.6 + 0.4 * beat, 1.3, 70 if not tall else 46)
    push = 1.0 + 0.06 * k; shake = (1 - ease(k / 0.35)) * 18
    bw = int(W * 0.92); size = int((W * 0.17) if tall else (H * 0.18))
    ai = hatch(int(size * 1.25), bw, k * 60); text(ai, 'AI MUSIC', ANTON(size), bw / 2, size * 0.1, CREAM, 'ma')
    hu = np.full((int(size * 1.25), bw, 3), bgr(MINT), np.uint8); text(hu, 'HUMAN MUSIC?', ANTON(int(size * 0.86)), bw / 2, size * 0.18, INK, 'ma')
    def place(img, cy, dx, rot, sc):
        h, w = img.shape[:2]; M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, sc * push)
        M[0, 2] += W / 2 - w / 2 + dx + shake * math.sin(k * 90); M[1, 2] += cy - h / 2 + shake * math.cos(k * 77)
        warped = cv2.warpAffine(img, M, (W, H), borderValue=(0, 0, 0)); m = cv2.warpAffine(np.full((h, w), 255, np.uint8), M, (W, H))
        a = m.astype(np.float32)[..., None] / 255; g[:] = (warped * a + g * (1 - a)).astype(np.uint8)
    p1 = back(k / 0.3); p2 = back((k - 0.12) / 0.3)
    cy1, cy2 = (H * 0.31, H * 0.57) if tall else (H * 0.25, H * 0.66)
    place(ai, cy1, -(1 - min(1, p1)) * W, -3, 1.35 - 0.35 * min(1, p1))
    # the AI band glitches: a channel-split copy jitters for a few frames on every beat
    if beat > 0.85:
        sh = int(10 * (beat - 0.85) / 0.15)
        g[:, sh:, 2] = np.maximum(g[:, sh:, 2], g[:, :-sh or None, 2]) if sh else g[:, :, 2]
    text(g, 'or', FRAU(int(size * 0.7)), W / 2, (cy1 + cy2) / 2 - size * 0.42, MINT, 'ma', ease((k - 0.2) / 0.25))
    place(hu, cy2, (1 - min(1, p2)) * W, 3, 1.35 - 0.35 * min(1, p2))
    # a light sweep across both bands
    sx = int(-W * 0.3 + (W * 1.6) * ease((k - 0.35) / 0.9))
    sweep = np.zeros_like(g); cv2.line(sweep, (sx, 0), (sx - int(H * 0.5), H), (255, 255, 255), int(W * 0.05)); sweep = cv2.GaussianBlur(sweep, (0, 0), 25)
    g[:] = np.clip(g.astype(np.int16) + (sweep.astype(np.int16) * 0.25).astype(np.int16), 0, 255).astype(np.uint8)
    lw = int(W * (0.42 if tall else 0.2)); la = ease((k - 0.5) / 0.4)
    over(g, STACKED, (W - lw) / 2, H * (0.80 if tall else 0.83), lw, la)
    return g

TICKER = 'FREE FROM JARGON  *  WEDNESDAYS  *'
_units = {}
def _ticker_unit(th):
    # one seamless repeat of the promise strip: drawn once, measured by its ink, tiled (no overlap at the loop)
    if th not in _units:
        f = ANTON(int(th * 0.62)); im = Image.new('L', (4000, th), 0); ImageDraw.Draw(im).text((20, int(th * 0.16)), TICKER, font=f, fill=255)
        a = np.asarray(im); cols = np.where(a.max(0) > 0)[0]; x0, x1 = cols[0], cols[-1] + 1; gap = int(th * 0.45)
        ink = a[:, x0:x1].astype(np.float32)[..., None] / 255; w = x1 - x0 + gap
        unit = np.full((th, w, 3), bgr(LILAC), np.uint8); seg = unit[:, :x1 - x0].astype(np.float32)
        unit[:, :x1 - x0] = (np.array(bgr(INK), np.float32) * ink + seg * (1 - ink)).astype(np.uint8); _units[th] = unit
    return _units[th]
def ending(W, H, t, t0):
    """The house close: ink, the stacked logo, the day, the series pill and the site, the promise strip running."""
    k = t - t0; g = np.full((H, W, 3), bgr(INK), np.uint8); tall = H > W; p = ease(k / 0.33)
    th = 84 if tall else 70; strip = np.full((th, W, 3), bgr(LILAC), np.uint8)
    unit = _ticker_unit(th); cyc = unit.shape[1]; off = int(k * 140) % cyc
    row = np.tile(unit, (1, W // cyc + 3, 1)); strip[:] = row[:, off:off + W]
    ys = int(H * (0.18 if tall else 0.14)); g[ys:ys + th] = strip
    lw = int(W * (0.78 if tall else 0.46)); lh = int(lw * 740 / 2415); ly = int(H * (0.36 if tall else 0.32)) + int((1 - p) * 60)
    over(g, STACKED, (W - lw) / 2, ly, lw, p)
    y2 = ly + lh + (90 if tall else 60)
    text(g, 'WEDNESDAYS', MONO(44 if tall else 38), W / 2, y2, CREAM, 'ma', ease((k - 0.25) / 0.3))
    if k > 0.4:
        a = ease((k - 0.4) / 0.3); w, h = pill(np.zeros((1, 1, 3), np.uint8), 'under.the.hood', 0, 0, 40)
        tmp = g.copy(); pill(tmp, 'under.the.hood', W / 2, y2 + 80, 40, 'm'); g[:] = (tmp * a + g * (1 - a)).astype(np.uint8)
    text(g, 'makeyourmindup.ai', MONO(56 if tall else 48), W / 2, y2 + (210 if tall else 190), MINT, 'ma', ease((k - 0.55) / 0.3))
    return g
