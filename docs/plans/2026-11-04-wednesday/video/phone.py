#!/usr/bin/env python3
"""Wednesday 4 Nov's phone panels: his Duet screen recording playing as video inside the approved hand-held phone.

Each screen beat of creative-direction.json plays the stretch of the recording it names, sped up to the beat's length,
with every private detail under ink bars in every frame (the direction's do_not: his name, the K avatar, the job hunt,
his ventures, the people, places and amounts, the morning brief's body, the Artifacts titles). The stretches below are
narrower than the beat's own source range wherever the full range would show something the bars do not hold still over
(the Google account chooser with his addresses at 0:32 to 0:41, the task page at 11:00, the scrolling brief at 19:00 to
19:08, the artifact grid at 11:41 to 11:47, the task list at 13:52 to 14:20); review/covers-*.jpg proves each one.

The phone never rests (Krish, 2026-10-31: "way more animation than ever before and movement"): it drifts and tilts in
the hand, the camera pushes in across the beat, and the desk behind moves slower than the phone.

    python3 docs/plans/2026-11-04-wednesday/video/phone.py [NAME ...] [--sheets]
Writes .cache/produce/2026-11-04-b63d2507/panels/<name>-16x9.mp4 (1314x1080) and -9x16.mp4 (1080x1000), 30 fps.
"""
import math
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'docs/plans/2026-11-04-wednesday/imagery'))
import make_imagery as mi   # noqa: E402  the approved plates, the bars, the brand dress

WORK = ROOT / '.cache/produce/2026-11-04-b63d2507'
PANELS = WORK / 'panels'
REVIEW = WORK / 'review'
FPS = 30
FONTS = ROOT / 'assets/fonts/makeyourmindup'
INK, CREAM, MINT, LILAC = mi.INK, mi.CREAM, mi.MINT, mi.LILAC
AV = mi.AVATAR
G = mi.GRABS


def sec(at):
    m, s = at.split(':')
    return int(m) * 60 + float(s)


# name: (source stretches [(from, to)], the bars, seconds on screen, the 16:9 label, focus y (0..1) of the tall crop)
SHOTS = {
    # Long 3, short 2: its first message arriving.
    'first': ([('01:02', '01:40')], G['first-message'][1], 10.5, '', 0.30),
    # Long 5, short 3: the morning brief it wrote, body covered; the card settles.
    'brief': ([('19:09', '19:40')], G['morning-brief'][1] + [(60, 640, 690, 1100)], 11.6, 'REFRESHES 6:30 EVERY MORNING', 0.45),
    # Long 7, short 5: no setup quiz: the onboarding, then Google Drive connecting (never the account chooser).
    'setup': ([('00:22', '00:31'), ('00:44', '00:50')], [], 8.3, '', 0.32),
    # Long 13: the tasks it pulled.
    'tasks': ([('11:03', '11:20')], G['tasks-up-next'][1] + [(88, 500, 660, 540)], 3.2, '', 0.30),
    # Long 14: his reply: drop the first task, find ten more.
    'reply': ([('03:48', '04:00')], G['reply-to-dos'][1], 8.7, '', 0.40),
    # Long 15, short 7: the ten jobs it brought back, each verb kept.
    'todo': ([('07:12', '09:18')], G['todo-list'][1] + [(410, 521, 572, 558), (410, 1055, 560, 1092)], 16.0, '', 0.40),
    # Long 16, short 8: the wait, 8 times faster ("Thinking it through").
    'think': ([('05:00', '06:30')], G['reply-to-dos'][1], 6.9, 'THE WAIT, SPED UP 8×', 0.25),
    # Long 17: Make, the Calendar scheduler tile he tapped.
    'make': ([('11:48', '11:51')], G['make-artifacts'][1], 3.7, '', 0.55),
    # Long 18, short 10: the dashboard it built from one ask, building, then done.
    'calendar': ([('12:00', '13:48'), ('14:28', '14:40')], G['calendar-scheduler'][1] + [(70, 440, 330, 500)], 10.1, '', 0.38),
}
# Short-cut lengths differ from the long cut's; the same stretch is rendered again at the short's length.
SHORT_SECONDS = {'first': 4.8, 'brief': 7.2, 'setup': 5.7, 'todo': 5.6, 'think': 3.5, 'calendar': 6.2}
LONG_ONLY = {'tasks', 'reply', 'make'}

_FONT = {}


def font(name, size):
    if (name, size) not in _FONT:
        _FONT[(name, size)] = ImageFont.truetype(str(FONTS / name), size)
    return _FONT[(name, size)]


def source_frames(stretches, n):
    """n frames spread evenly over the stretches, as RGB images (720x1560)."""
    total = sum(sec(b) - sec(a) for a, b in stretches)
    frames = []
    for a, b in stretches:
        share = max(1, round(n * (sec(b) - sec(a)) / total))
        rate = share / (sec(b) - sec(a))
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', a, '-t', f'{sec(b) - sec(a):.3f}', '-i', str(mi.REC),
                              '-vf', f'fps={rate:.5f},scale=720:1560', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                             capture_output=True, check=True).stdout
        shot = 720 * 1560 * 3
        frames += [Image.frombytes('RGB', (720, 1560), raw[i * shot:(i + 1) * shot]) for i in range(len(raw) // shot)]
    while len(frames) < n:
        frames.append(frames[-1])
    return frames[:n]


DESK = {}


def desk(w, h):
    if (w, h) not in DESK:
        DESK[(w, h)] = mi.desk((w, h)).convert('RGB')
    return DESK[(w, h)]


def label(img, text, x, y, size=30):
    if not text:
        return
    d = ImageDraw.Draw(img)
    f = font('IBMPlexMono-Medium.ttf', size)
    tw = d.textlength(text, font=f)
    d.rounded_rectangle((x - 18, y - 12, x + tw + 18, y + size + 16), radius=10, fill=INK, outline=LILAC, width=2)
    d.text((x, y), text, font=f, fill=CREAM)


def phone_view(screen):
    """The covered screen in the hand-held plate, cropped to the approved 9:16 window (1080x1920)."""
    return mi.framed(mi.in_phone(screen, scale=1.0), scale=1.0).convert('RGB')


def frame16(view, t, T, text):
    """1314x1080: the phone in his hand on the ink desk, drifting; the label on the left if the beat has one."""
    W, H = 1314, 1080
    p = mi.ease(min(1.0, t / max(T, 0.1)))
    bg = desk(W + 120, H + 80)
    ox = int(40 + 30 * math.sin(t * 0.35))                 # the desk moves slower than the phone
    canvas = bg.crop((ox, 20, ox + W, 20 + H)).copy()
    z = 1.0 + 0.07 * p                                       # the camera pushes in across the beat
    ph = int(1520 * z)
    pw = int(ph * 1080 / 1920)
    v = view.resize((pw, ph), Image.LANCZOS)
    rot = 1.4 * math.sin(t * 0.55 + 0.4)                     # a hand is never still
    v = v.convert('RGBA').rotate(rot, resample=Image.BICUBIC, expand=True)
    mask = v.split()[3]
    cx = (W * 0.62 if text else W * 0.5) + 16 * math.sin(t * 0.8)
    cy = H * 0.56 + 12 * math.sin(t * 0.63 + 1.1)
    canvas.paste(v.convert('RGB'), (int(cx - v.width / 2), int(cy - v.height / 2)), mask)
    if text:
        a = min(1.0, max(0.0, (t - 0.3) / 0.4))
        if a > 0:
            layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            label(layer, text, 70 - int((1 - mi.ease(a)) * 40), 880, 30)
            canvas = Image.alpha_composite(canvas.convert('RGBA'), Image.eval(layer, lambda c: c) if a >= 1 else
                                           Image.blend(Image.new('RGBA', (W, H), (0, 0, 0, 0)), layer, a)).convert('RGB')
    return canvas


def frame9(view, t, T, text, focus):
    """1080x1000: the part of the phone that proves the words, pushed in slowly and drifting."""
    W, H = 1080, 1000
    p = mi.ease(min(1.0, t / max(T, 0.1)))
    z = 1.18 + 0.10 * p
    big = view.resize((int(1080 * z), int(1920 * z)), Image.LANCZOS)
    cx = big.width / 2 + 14 * math.sin(t * 0.7)
    cy = big.height * focus + 18 * math.sin(t * 0.5 + 0.7)
    x0 = int(min(max(0, cx - W / 2), big.width - W))
    y0 = int(min(max(0, cy - H / 2), big.height - H))
    canvas = big.crop((x0, y0, x0 + W, y0 + H))
    if text:
        a = min(1.0, max(0.0, (t - 0.3) / 0.4))
        if a > 0:
            layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            label(layer, text, 60, 900 - int((1 - mi.ease(a)) * 30), 28)
            canvas = Image.alpha_composite(canvas.convert('RGBA'), layer if a >= 1 else
                                           Image.blend(Image.new('RGBA', (W, H), (0, 0, 0, 0)), layer, a)).convert('RGB')
    return canvas


# Duet's own mark and its status pill ("Thinking it through", "Searching your email") sit over the covered chat: they are
# the point of the wait, so they are put back on top of the bars, as the approved reply-to-dos still does. Both are opaque.
MARK = (285, 64, 436, 202)
PILL = (242, 196, 478, 247)
KEEP_MARK = {'think', 'reply'}


def covered(src, bars, name=None):
    from PIL import ImageDraw as _D
    im = mi.cover(src.copy(), bars)
    if name in KEEP_MARK:
        m = Image.new('L', src.size, 0)
        d = _D.Draw(m)
        d.ellipse(MARK, fill=255)
        # the pill only while it is on screen: without it, that patch is his chat (a frame whose pill's top band is
        # not white throughout keeps its bars)
        import numpy as _np
        band = _np.asarray(src.crop((PILL[0] + 20, PILL[1] + 4, PILL[2] - 20, PILL[1] + 10))).astype(int).mean(axis=2)
        if (band > 246).mean() >= 0.97:
            d.rounded_rectangle(PILL, radius=25, fill=255)
        im.paste(src, (0, 0), m)
    return im


def render(job):
    name, shape, seconds = job
    stretches, bars, _, text, focus = SHOTS[name]
    n = int(round(seconds * FPS))
    frames = source_frames(stretches, n)
    PANELS.mkdir(parents=True, exist_ok=True)
    out = PANELS / f'{name}-{shape}.mp4'
    size = '1314x1080' if shape == '16x9' else '1080x1000'
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', size, '-r', str(FPS),
                            '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', str(out)],
                           stdin=subprocess.PIPE)
    last = None
    for i, src in enumerate(frames):
        if src is not last:   # a repeated frame (the tail) is drawn once
            view = phone_view(covered(src, bars, name))
            last = src
        t = i / FPS
        img = frame16(view, t, seconds, text) if shape == '16x9' else frame9(view, t, seconds, text if name != 'brief' else 'GMAIL · CALENDAR · SLACK · EVERY FEW HOURS', focus)
        enc.stdin.write(img.tobytes())
    enc.stdin.close(); enc.wait()
    return f'{out.name} {n} frames'


def sheets(names):
    """Every screen panel at 0.5 s, to prove the bars hold over the whole stretch."""
    REVIEW.mkdir(parents=True, exist_ok=True)
    for name in names:
        for shape in ('16x9', '9x16'):
            p = PANELS / f'{name}-{shape}.mp4'
            if p.exists():
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(p), '-vf', 'fps=2,scale=360:-1,tile=8x4', '-frames:v', '1',
                                str(REVIEW / f'covers-{name}-{shape}.jpg')], check=True)


if __name__ == '__main__':
    names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(SHOTS)
    jobs = []
    for name in names:
        jobs.append((name, '16x9', SHOTS[name][2] + 1.0))
        if name not in LONG_ONLY:
            jobs.append((name, '9x16', SHORT_SECONDS[name] + 1.0))
    import os
    with ProcessPoolExecutor(int(os.environ.get('JOBS', 4))) as pool:
        for r in pool.map(render, jobs):
            print(r)
    if '--sheets' in sys.argv:
        sheets(names)
