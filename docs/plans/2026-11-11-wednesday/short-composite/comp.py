# One-off composite for the Wed 11 short (Ruling, Krish, 2026-11-10: "One-off composite").
# Trimmed timeline (t = take time - 1.0 before 59.5 s, - 2.1 after 60.6 s). 1080x1920, 30 fps.
# usage: python comp.py OUT.mp4 [from_s to_s step]
import json, math, subprocess, sys
import cv2, numpy as np, mediapipe as mp
from PIL import Image, ImageDraw, ImageFont

FPS, W, H, SH = 30, 1080, 1920, 1240
SRC = '/tmp/claude-0/rec2/sources'
DEV = '/tmp/claude-0/w11s'
FONT = '/home/user/content-engine/assets/fonts/makeyourmindup'
TAKE = '/tmp/claude-0/rec2/eye/out/clip.ai-music-short.eyeline.mp4'
INK, INKD, INKS, CREAM, MINT = (12, 21, 18), (7, 13, 11), (22, 34, 29), (244, 239, 228), (126, 240, 192)
bgr = lambda c: (c[2], c[1], c[0])

def font(name, size, wght=None):
    f = ImageFont.truetype(f'{FONT}/{name}', size)
    if wght:
        try: f.set_variation_by_axes([wght])
        except Exception: pass
    return f

ANTON = lambda s: font('Anton-Regular.ttf', s)
ARCH = lambda s: font('Archivo-Variable.ttf', s, 900)
MONO = lambda s: font('IBMPlexMono-SemiBold.ttf', s)

def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def back(x):
    x = min(1, max(0, x)); c = 1.7
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2

# ---------------------------------------------------------------- words
words = json.load(open('/home/user/content-engine/docs/plans/2026-11-11-wednesday/ve/takes/short-1110.json'))['aligners']['a']['words']
def T(t): return t - 1.0 if t < 59.5 else t - 2.1
WORDS = [(T(w['onset_s']), T(w['end_s']), w['text']) for w in words]

# ---------------------------------------------------------------- media
class Clip:
    def __init__(self, f, crop=None):
        self.c = cv2.VideoCapture(f'{SRC}/{f}'); self.fps = self.c.get(5); self.n = int(self.c.get(7)); self.pos = -1; self.img = None
    def at(self, s):
        k = int(s * self.fps) % max(1, self.n - 1)
        if k != self.pos:
            if k < self.pos or k > self.pos + 8: self.c.set(cv2.CAP_PROP_POS_FRAMES, k); self.pos = k - 1
            while self.pos < k:
                ok, im = self.c.read(); self.pos += 1
                if not ok: break
                self.img = im
        return self.img
CLIPS = {k: Clip(f) for k, f in {
    'gran': 'tiktok_01_grandma_kitchen_crazyauntieann.mp4', 'kids': 'tiktok_02_kids_dance_onedaykidsafrika.mp4',
    'cat': 'tiktok_03_ai_cat_dance_ashanolas.mp4', 'car': 'tiktok_04_man_car_dancing_thegmanshow.mp4',
    'wigs': 'tiktok_05_grandmas_dressup_celindabradshaw.mp4', 'granny': 'tiktok_06_granny_original_version_hennythegranny.mp4',
    'trackid': 'tiktok_07_track_id_original_version_dancewithema0.mp4', 'hugel': 'tiktok_08_hugel_ai_singer_live_hugelthug.mp4',
    'ytcat': 'ytcat_duet.mp4'}.items()}

def shot(name, x0, y0, x1, y1):
    return cv2.imread(f'{SRC}/{name}.png')[y0:y1, x0:x1]
SHOTS = {
    'charts': shot('officialcharts_song_page', 125, 225, 1875, 1500),
    'grammys': shot('grammys_substack_how_human', 600, 150, 2250, 600),
    'edmtunes': shot('hugel_ai_controversy_edmtunes', 0, 125, 2880, 1400),
    'weraveyou': shot('hugel_ai_breakdown_weraveyou', 300, 200, 2250, 760),
    'apple': shot('applemusic_single_cover', 595, 75, 2000, 740),
    'spotify': shot('spotify_track_page', 725, 150, 2400, 650),
}

def cover(img, w, h, zoom=1.0, fy=0.5):
    ih, iw = img.shape[:2]; s = max(w / iw, h / ih) * zoom
    r = cv2.resize(img, (max(w, int(iw * s + 1)), max(h, int(ih * s + 1))), interpolation=cv2.INTER_AREA)
    y = int((r.shape[0] - h) * fy); x = (r.shape[1] - w) // 2
    return r[y:y + h, x:x + w]
def fitw(img, w):
    ih, iw = img.shape[:2]; return cv2.resize(img, (w, max(1, int(ih * w / iw))), interpolation=cv2.INTER_AREA)

def rounded_mask(h, w, r):
    m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (r, 0), (w - r, h), 255, -1); cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return m.astype(np.float32) / 255

def paste(dst, img, cx, cy, scale=1.0, alpha=1.0, radius=18, rot=0.0, shadow=True):
    if scale <= 0.01 or alpha <= 0.01: return
    img = cv2.resize(img, (max(2, int(img.shape[1] * scale)), max(2, int(img.shape[0] * scale))), interpolation=cv2.INTER_AREA)
    h, w = img.shape[:2]; m = rounded_mask(h, w, max(2, int(radius * scale)))
    if rot:
        pad = int(0.25 * max(h, w)); img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT); m = cv2.copyMakeBorder(m, pad, pad, pad, pad, cv2.BORDER_CONSTANT)
        h, w = img.shape[:2]; R = cv2.getRotationMatrix2D((w / 2, h / 2), rot, 1)
        img = cv2.warpAffine(img, R, (w, h), flags=cv2.INTER_LINEAR); m = cv2.warpAffine(m, R, (w, h))
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    if shadow:
        sm = cv2.GaussianBlur(m, (0, 0), 14) * 0.45 * alpha
        _blend(dst, np.zeros_like(img), sm, x0 + 6, y0 + 18)
    _blend(dst, img, m * alpha, x0, y0)

def _blend(dst, img, a, x0, y0):
    H_, W_ = dst.shape[:2]; h, w = img.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W_, x0 + w), min(H_, y0 + h)
    if xa >= xb or ya >= yb: return
    sub = img[ya - y0:yb - y0, xa - x0:xb - x0].astype(np.float32); aa = a[ya - y0:yb - y0, xa - x0:xb - x0][..., None]
    reg = dst[ya:yb, xa:xb].astype(np.float32); dst[ya:yb, xa:xb] = (sub * aa + reg * (1 - aa)).astype(np.uint8)

def hatch(h, w, phase=0):
    im = np.full((h, w, 3), bgr(INK), np.uint8)
    for k in range(-h, w + h, 22):
        x = k + int(phase) % 22; cv2.line(im, (x, 0), (x + h, h), bgr(INKS), 7, cv2.LINE_AA)
    return im

def text(dst, s, f, x, y, fill=CREAM, anchor='la', alpha=1.0):
    if alpha <= 0.01: return
    l, t_, r, b = f.getbbox(s, anchor=anchor); x0, y0 = int(x + l) - 4, int(y + t_) - 4; w, h = int(r - l) + 8, int(b - t_) + 8
    ov = Image.new('L', (w, h), 0); ImageDraw.Draw(ov).text((x - x0, y - y0), s, font=f, fill=255, anchor=anchor)
    a = np.asarray(ov, np.float32) / 255 * alpha
    _blend(dst, np.full((h, w, 3), bgr(fill), np.uint8), a, x0, y0)

def devframe(name, t, t0):
    k = int(round((t - t0) * FPS)); import os
    p = f'{DEV}/{name}/f{max(0, k):05d}.png'
    while not os.path.exists(p) and k > 0: k -= 1; p = f'{DEV}/{name}/f{k:05d}.png'
    return cv2.imread(p)

def wave(dst, x0, y0, w, h, t, col, amp=1.0, seed=0):
    n = 46; bw = w / n
    for i in range(n):
        v = 0.25 + 0.75 * abs(math.sin(i * 0.7 + seed + t * 6.0) * math.sin(i * 0.23 + t * 2.3 + seed))
        bh = int(h * v * amp / 2); cx = int(x0 + i * bw + bw / 2)
        cv2.line(dst, (cx, y0 + h // 2 - bh), (cx, y0 + h // 2 + bh), bgr(col), max(3, int(bw * 0.55)), cv2.LINE_AA)

# ---------------------------------------------------------------- scenes (stage is 1080 x 1240)
def ground(): return np.full((SH, W, 3), bgr(INK), np.uint8)

def s_cold(t):
    g = ground()
    if t < 3.4:  # one real TikTok, full bleed, the song up
        z = 1.0 + 0.04 * t
        g[:] = cover(CLIPS['gran'].at(t + 2.0), W, SH, z, 0.35)
        text(g, 'TikTok', MONO(30), 48, SH - 70, CREAM, alpha=0.9)
        return g
    if t < 5.0:  # the wall fills on the beat
        order = ['gran', 'trackid', 'cat', 'car', 'wigs', 'granny']; tw, th = 340, 590
        for i, k in enumerate(order):
            ti = 3.4 + i * 0.22
            if t < ti: continue
            p = back((t - ti) / 0.35); col, row = i % 3, i // 3
            cx, cy = 30 + tw / 2 + col * (tw + 15), 40 + th / 2 + row * (th + 20)
            paste(g, cover(CLIPS[k].at(t + i), tw, th), cx, cy + (1 - p) * 220, 0.6 + 0.4 * p, min(1, p * 1.5), 22)
        return g
    if t < 6.9:  # the charts slam in over the wall: No. 2
        dim = s_cold(4.99) // 3; g[:] = dim
        p = back((t - 5.0) / 0.4); paste(g, SHOTS['charts'], W / 2, SH / 2 - 40, (0.58 + 0.08 * (1 - p)) * min(1, p + 0.2), min(1, p * 2), 20)
        if t > 5.2:
            q = back((t - 5.2) / 0.3); cv2.circle(g, (int(W / 2 + 0.58 * (1785 - 125 - 875)), int(SH / 2 - 40 + 0.58 * (1215 - 225 - 637))), int(60 * q), bgr(MINT), 6, cv2.LINE_AA)
            text(g, 'No. 2', ANTON(int(150 * min(1, q))), W - 70, 120, MINT, 'ra', min(1, q))
        return g
    if t < 9.4:  # which came first? a marker swings between them
        p = ease((t - 6.9) / 0.4)
        paste(g, cover(CLIPS['gran'].at(t + 2), 400, 700), 280 - (1 - p) * 500, SH / 2 + 20, 1, 1, 24, rot=-3)
        paste(g, fitw(SHOTS['charts'], 900)[0:620, 0:640], 800 + (1 - p) * 500, SH / 2 + 20, 0.62, 1, 22, rot=3)
        text(g, 'TikTok', ANTON(64), 280, 140, CREAM, 'ma', p); text(g, 'Charts', ANTON(64), 800, 140, CREAM, 'ma', p)
        sw = math.sin((t - 6.9) * 5.0); x = int(W / 2 + 230 * sw)
        text(g, '?', ANTON(220), x, SH / 2 - 120, MINT, 'ma', p)
        return g
    if t < 13.95:  # AI or human: the waveform splits, mint above, hatched ink below
        p = ease((t - 9.4) / 0.5); split = ease((t - 10.2) / 0.6); g[:] = bgr(INK)
        top = g[: SH // 2]; bot = g[SH // 2:]
        if split > 0:
            top[:] = (np.array(bgr(INK)) * (1 - split) + np.array(bgr(INKD)) * split).astype(np.uint8)
            bot[:] = hatch(SH - SH // 2, W, t * 30) if split > 0.5 else bot
        wave(g, 60, int(SH / 2 - 260 - 120 * split), W - 120, 300, t, MINT, p)
        wave(g, 60, int(SH / 2 - 40 + 120 * split), W - 120, 300, t + 0.5, CREAM if split < 0.5 else (150, 160, 155), p * max(0.2, split), 2)
        g[:] = (g.astype(np.float32) * 0.45).astype(np.uint8)
        title(g, t)
        return g
    # episode card
    p = ease((t - 13.95) / 0.35); g[:] = bgr(INKD)
    text(g, 'under.the.hood', MONO(42), W / 2, SH / 2 - 150, MINT, 'ma', p)
    text(g, 'WHO MADE', ANTON(150), W / 2, SH / 2 - 70, CREAM, 'ma', p)
    text(g, 'THIS No. 2 HIT?', ANTON(150), W / 2, SH / 2 + 100, CREAM, 'ma', p)
    return g

def kb(img, z, fx=0.5, fy=0.5):
    z = max(1.0, z)
    h, w = img.shape[:2]; cw, ch = int(w / z), int(h / z); x = int((w - cw) * fx); y = int((h - ch) * fy)
    return cv2.resize(img[y:y + ch, x:x + cw], (w, h), interpolation=cv2.INTER_LINEAR)

TITLE = [(9.55, 'IS IT', 0), (10.25, 'AI MUSIC', 1), (10.75, 'OR', 2), (11.35, 'HUMAN MUSIC?', 3)]
def title(g, t):
    rows = {0: (150, 130), 1: (310, 210), 2: (640, 110), 3: (790, 190)}
    for at, s, r in TITLE:
        if t < at: continue
        p = back((t - at) / 0.28); y, size = rows[r]
        if r == 1:
            band = hatch(size + 60, W - 80, t * 30); text(band, s, ANTON(size), (W - 80) / 2, 20, CREAM, 'ma')
            paste(g, band, W / 2, y + size / 2 + 30, 1.25 - 0.25 * min(1, p), min(1, p * 2), 20, rot=-2 * (1 - min(1, p)))
        elif r == 3:
            band = np.full((size + 60, W - 80, 3), bgr(MINT), np.uint8); text(band, s, ANTON(size - 20), (W - 80) / 2, 30, INK, 'ma')
            paste(g, band, W / 2, y + size / 2 + 30, 1.25 - 0.25 * min(1, p), min(1, p * 2), 20, rot=2 * (1 - min(1, p)))
        else:
            f = ANTON(size) if r == 0 else ANTON(size)
            text(g, s, f, W / 2, y + (1 - min(1, p)) * 60, CREAM, 'ma', min(1, p * 2))

def suno_form(t):
    g = ground(); z = 1 + 0.05 * ease((t - 15.9) / 7)
    card = np.full((900, 960, 3), bgr(CREAM), np.uint8)
    text(card, 'Suno', ARCH(60), 40, 34, INK); text(card, 'rebuilt from suno.com, Nov 2026', MONO(24), 42, 110, (90, 100, 95))
    lyr, sty = "I\u2019m movin\u2019 to the sun", 'the vibe she wanted'
    def field(y0, h, label, s, t0, t1):
        on = t0 <= t < t1 + 0.6
        cv2.rectangle(card, (30, y0), (930, y0 + h), bgr(MINT) if on else (180, 185, 182), 4 if on else 2, cv2.LINE_AA)
        text(card, label, ARCH(28), 54, y0 + 18, INK if on or t >= t0 else (120, 128, 124))
        n = 0 if t < t0 else min(len(s), int(len(s) * (t - t0) / max(0.1, t1 - t0)) + 1)
        text(card, s[:n] if n else ' ', MONO(46), 54, y0 + 74, INK)
        if on and int(t * 3.4) % 2 == 0:
            cx = 54 + int(MONO(46).getlength(s[:n])) + 4; cv2.rectangle(card, (cx, y0 + 74), (cx + 5, y0 + 128), bgr(INK), -1)
    field(170, 250, 'Lyrics', lyr, 19.9, 20.9)
    field(460, 170, 'Style of music', sty, 21.6, 22.4)
    press = 1 - 0.06 * math.sin(min(1, max(0, (t - 22.8) / 0.25)) * math.pi)
    btn = np.full((110, 900, 3), bgr(MINT), np.uint8); text(btn, 'Create', ARCH(40), 450, 30, INK, 'ma')
    if t > 22.8: btn[:] = np.clip(btn.astype(np.int16) + int(60 * math.sin(min(1, (t - 22.8) / 0.3) * math.pi)), 0, 255).astype(np.uint8)
    paste(card, btn, 480, 750, press, 1, 20, shadow=False)
    p = back((t - 15.9) / 0.4)
    paste(g, card, W / 2, SH / 2 + (1 - min(1, p)) * 200, 1.0, min(1, p * 2), 36)
    return kb(g, z, 0.5, 0.35)

ROBOT = cv2.imread('/tmp/claude-0/w11l/real/robot.png')
def robot_fly(g, t, at, end):
    """Krish, 2026-11-11: "an absurd image fly in of a robot passionately humming in a recording studio with
    headphones". It spins in from far away, lands with a thump, then bobs to the beat like it means it."""
    if not (at <= t < end): return
    k = t - at; Hh, Ww = g.shape[:2]; w = int(min(Ww * 0.62, Hh * 0.8 * 4 / 3)); h = int(w * 3 / 4)
    p = min(1, back(k / 0.45)); out = ease((t - (end - 0.35)) / 0.35)
    spin = (1 - ease(k / 0.45)) * 540
    beat = math.sin(k * 2 * math.pi * 2.1)
    sc = (0.15 + 0.85 * p) * (1 + 0.04 * max(0, beat)) * (1 - 0.9 * out)
    rot = spin + 4 * beat * min(1, k / 0.6)
    paste(g, cover(ROBOT, w, h), Ww / 2 + out * Ww, Hh / 2 - (1 - p) * Hh * 0.3, sc, min(1, p * 2), 24, rot=rot)

def s_slot(t):
    if t < 22.9: return suno_form(t)
    dev = kb(devframe('slot', t, 15.9), 1 + 0.08 * ease((t - 15.9) / 9.7), 0.5, 0.3)
    if t < 23.2:
        a = ease((t - 22.9) / 0.3); return (suno_form(t).astype(np.float32) * (1 - a) + dev.astype(np.float32) * a).astype(np.uint8)
    return dev

def _old_slot(t): return kb(devframe('slot', t, 15.9), 1 + 0.08 * ease((t - 15.9) / 9.7), 0.5, 0.3)

def s_feed(t):  # people put it under their own videos: cats, weddings, dads dancing badly
    g = ground()
    seq = [(25.6, 'gran'), (26.6, 'trackid'), (27.6, 'granny'), (28.6, 'cat'), (29.7, 'wigs'), (30.6, 'car')]
    cur = [k for k in seq if t >= k[0]][-1]; nxt = seq.index(cur)
    if t >= 28.4:  # Krish, 2026-11-10: the cat duet, with its own sound, from "cats" (about 5 s); weddings and dads pop in beside it
        p = min(1, back((t - 28.4) / 0.3)); g[:] = cover(CLIPS['ytcat'].at(t - 26.4), W, SH, 1.1) // 3
        paste(g, cover(CLIPS['ytcat'].at(t - 26.4), 560, 996), 330 + (1 - p) * -400, SH / 2, 1, 1, 30, rot=(1 - p) * -6)
        for at, k, y in [(29.7, 'wigs', 330), (30.6, 'car', 900)]:
            if t >= at:
                q = min(1, back((t - at) / 0.3)); paste(g, cover(CLIPS[k].at(t), 400, 520), 850 + (1 - q) * 400, y, 1, 1, 26, rot=4 if k == 'wigs' else -4)
        return g
    if t < 28.6:  # a phone feed scrolling, one under the other
        off = (t - 25.6) / 1.0
        for i, (_, k) in enumerate(seq[:4]):
            y = SH / 2 + (i - off) * (SH * 0.82)
            if -SH < y < 2 * SH: paste(g, cover(CLIPS[k].at(t), 560, 990), W / 2, y, 1, 1, 34)
        return g
    p = back((t - cur[0]) / 0.3)
    prev = seq[nxt - 1][1] if nxt > 3 else None
    if prev: g[:] = cover(CLIPS[prev].at(t), W, SH, 1.05) // 2
    paste(g, cover(CLIPS[cur[1]].at(t), 720, 1180), W / 2 + (1 - p) * 300, SH / 2 + 10, 0.85 + 0.15 * p, 1, 30, rot=(1 - p) * 6)
    return g

def s_hunt(t):  # strangers went hunting for the song; a top producer found it
    g = ground()
    if t < 35.5:
        p = back((t - 33.0) / 0.35)
        paste(g, cover(CLIPS['trackid'].at(t + 3), 700, 1180), W / 2, SH / 2 + (1 - p) * 300, 1, min(1, p * 2), 30)
        return g
    p = back((t - 35.5) / 0.35)
    g[:] = cover(CLIPS['trackid'].at(t + 3), W, SH, 1.1) // 3
    paste(g, cover(CLIPS['hugel'].at(t - 34), 700, 1180), W / 2 + (1 - p) * 500, SH / 2, 1, 1, 30, rot=(1 - p) * -8)
    text(g, 'HUGEL', ANTON(120), 60, 50, MINT, alpha=ease((t - 35.8) / 0.3))
    return g

def s_arr(t):
    g = devframe('arr1', t, 37.1)
    z = 1 + 0.06 * ease((t - 37.1) / 5) + 0.22 * ease((t - 43.0) / 14)
    g = kb(g, z, 0.3, 0.15 + 0.06 * math.sin((t - 43) * 0.45) * ease((t - 43) / 3))
    if 42.5 <= t < 48.0:  # Ultra Nate's voice, her own single page
        p = back((t - 42.5) / 0.35); out = ease((t - 47.6) / 0.4)
        paste(g, SHOTS['apple'], W / 2 + 120, SH - 260 + out * 600, 0.5 * min(1, p), min(1, p * 2) * (1 - out), 18)
    robot_fly(g, t, 56.1, 58.35)
    return g

def s_grammys(t):  # headlines stack in; writing ruled out (reportedly), singing still in
    g = ground()
    heads = [(58.4, 'grammys'), (59.4, 'edmtunes'), (60.2, 'weraveyou')]
    for i, (ti, k) in enumerate(heads):
        if t < ti: continue
        p = back((t - ti) / 0.35); dim = 1 - 0.55 * ease((t - 60.1) / 0.4)
        im = (SHOTS[k].astype(np.float32) * dim).astype(np.uint8)
        paste(g, fitw(im, 960), W / 2 + (i - 1) * 30, 260 + i * 300 + (1 - p) * 400, 1, min(1, p * 2), 18, rot=(i - 1) * 2)
    if t >= 60.1:
        cards = [(60.1, 'SONGWRITING', 'RULED OUT', 'reportedly', True), (64.6, 'SINGING', 'STILL IN', 'can compete', False)]
        for j, (ti, a, b, c, ai) in enumerate(cards):
            if t < ti: continue
            p = back((t - ti) / 0.35); cw, chh = 470, 620
            card = hatch(chh, cw, t * 20) if ai else np.full((chh, cw, 3), bgr(MINT), np.uint8)
            fg = CREAM if ai else INK
            text(card, a, ANTON(70), cw / 2, 60, fg, 'ma'); text(card, b, ANTON(96), cw / 2, 330, fg, 'ma'); text(card, c, MONO(34), cw / 2, 470, fg, 'ma')
            paste(g, card, 285 + j * 510, SH - 400 + (1 - p) * 500, 1, min(1, p * 2), 26, rot=(-3 if j == 0 else 3))
    return kb(g, 1.06 + 0.12 * ease((t - 61.3) / 8.6) + 0.04 * math.sin(t * 1.3), 0.5 + 0.08 * math.sin(t * 0.9), 0.6)

def s_question(t):  # AI versus human is the wrong question
    g = ground(); p = ease((t - 69.9) / 0.4)
    ai = hatch(380, 900, t * 20); text(ai, 'AI', ANTON(260), 450, 30, CREAM, 'ma')
    hu = np.full((380, 900, 3), bgr(MINT), np.uint8); text(hu, 'HUMAN', ANTON(260), 450, 30, INK, 'ma')
    d = 60 * ease((t - 70.5) / 3.2)
    paste(g, ai, W / 2 - (1 - p) * 700, 300 + d, 1, 1, 30, rot=-2 * math.sin(t * 2)); paste(g, hu, W / 2 + (1 - p) * 700, SH - 300 - d, 1, 1, 30, rot=2 * math.sin(t * 2))
    text(g, 'VS', ANTON(120), W / 2, SH / 2 - 80, CREAM, 'ma', p)
    if t > 73.7:
        q = ease((t - 73.7) / 0.35); cv2.line(g, (80, SH // 2), (int(80 + (W - 160) * q), SH // 2), bgr(MINT), 18, cv2.LINE_AA)
    return g

def s_credits(t): return kb(devframe('arr2', t, 74.4), 1 + 0.25 * ease((t - 76.5) / 5) - 0.2 * ease((t - 82.0) / 1.5), 0.15, 0.5)

def s_end(t):
    g = ground(); g[:] = bgr(INKD); p = ease((t - 84.5) / 0.4)
    text(g, 'the full deep dive', ANTON(76), W / 2, SH / 2 - 170, CREAM, 'ma', p)
    text(g, 'makeyourmindup.ai', ANTON(118), W / 2, SH / 2 - 40, CREAM, 'ma', p)
    q = ease((t - 85.4) / 0.6); cv2.line(g, (110, SH // 2 + 130), (int(110 + (W - 220) * q), SH // 2 + 130), bgr(MINT), 12, cv2.LINE_AA)
    return g

SCENES = [(0.0, s_cold), (15.9, s_slot), (25.6, s_feed), (33.0, s_hunt), (37.1, s_arr), (58.4, s_grammys),
          (69.9, s_question), (74.4, s_credits), (84.5, s_end)]
WHIP = 0.3

def stage(t):
    idx = max(i for i, (s, _) in enumerate(SCENES) if t >= s)
    s0, fn = SCENES[idx]; img = fn(t)
    if idx > 0 and t < s0 + WHIP:  # whip: the old scene leaves left, blurred, the new one arrives from the right
        p = ease((t - s0) / WHIP); old = SCENES[idx - 1][1](s0 - 0.01)
        k = int(1 + 60 * math.sin(p * math.pi)) | 1
        old = cv2.blur(old, (k, 1)); new = cv2.blur(img, (k, 1)); off = int(W * p)
        out = np.zeros_like(img); out[:, :W - off] = old[:, off:]; out[:, W - off:] = new[:, :off]; return out
    return img

# ---------------------------------------------------------------- him, cut out, bottom right
seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
take = cv2.VideoCapture(TAKE)
def take_time(t): return t + 1.0 if t < 58.5 else t + 2.1
def him(t):
    take.set(cv2.CAP_PROP_POS_MSEC, take_time(t) * 1000) if abs(take.get(cv2.CAP_PROP_POS_MSEC) / 1000 - take_time(t)) > 0.05 else None
    ok, fr = take.read()
    m = seg.process(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)).segmentation_mask
    a = np.clip((cv2.GaussianBlur(m, (0, 0), 2) - 0.3) / 0.4, 0, 1).astype(np.float32)
    a[:, :90] *= np.linspace(0, 1, 90, dtype=np.float32)[None, :]  # no hard edge where his arm leaves the frame
    return fr, a

def caption(dst, t):
    cur = [w for w in WORDS if w[0] - 0.05 <= t < max(w[1], w[0] + 0.25) + 0.12]
    if not cur or 9.4 < t < 15.9 or t > 84.4: return
    s = cur[-1][2].strip(',.?!').replace('UltraNate', 'Ultra Naté')
    size = 120
    while size > 50 and ARCH(size).getlength(s) > 420: size -= 4
    x, y = 40, 1520
    bw = int(ARCH(size).getlength(s)) + 40
    cv2.rectangle(dst, (x - 14, y - 14), (x - 14 + bw, y + size + 18), bgr(INK), -1)
    text(dst, s, ARCH(size), x + 6, y, MINT if s.lower() in ('ai', 'human', 'tiktok', 'charts', 'suno', 'grammys') else CREAM)

def frame(t):
    out = np.full((H, W, 3), bgr(CREAM), np.uint8)
    st = stage(t); m = rounded_mask(SH + 60, W, 56)[60:]  # rounded bottom corners
    m[:, :] = m; _blend(out, st, m, 0, 0)
    fr, a = him(t); s = 0.62
    fr = cv2.resize(fr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); a = cv2.resize(a, None, fx=s, fy=s)
    _blend(out, fr, a, 450, 720)
    caption(out, t)
    return out

if __name__ == '__main__':
    out = sys.argv[1]; t_from = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0; t_to = float(sys.argv[3]) if len(sys.argv) > 3 else 88.8
    step = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    if out.endswith('.jpg'):  # contact sheet of one frame a step
        ims = [cv2.resize(frame(i / FPS), (216, 384)) for i in range(int(t_from * FPS), int(t_to * FPS), step)]
        rows = [np.hstack(ims[i:i + 10] + [np.zeros_like(ims[0])] * (10 - len(ims[i:i + 10]))) for i in range(0, len(ims), 10)]
        cv2.imwrite(out, np.vstack(rows)); print('sheet', len(ims)); sys.exit()
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for i in range(int(t_from * FPS), int(t_to * FPS)):
        ff.stdin.write(frame(i / FPS).tobytes())
        if i % 300 == 0: print('frame', i, flush=True)
    ff.stdin.close(); ff.wait(); print('video', out)
