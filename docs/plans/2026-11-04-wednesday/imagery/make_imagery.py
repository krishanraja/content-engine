#!/usr/bin/env python3
"""Wednesday 4 November (Claude Duet): his screen grabs, covered, and set in the approved hand-held phone.

Reads frames from his Duet screen recording (.cache/recordings), puts ink bars over everything private (the
direction's do_not), and composites each screen into the hand-held-screen plates (assets/plates/hand-held-screen,
approved 28 Oct) on the ink desk with an under.the.hood lilac glow. Also renders a short demo clip: the recording
playing sped up inside the phone, with a slow camera push. Run from the repository root:

    python3 docs/plans/2026-11-04-wednesday/imagery/make_imagery.py [--video]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
PLATES = ROOT / 'assets/plates/hand-held-screen'
FONTS = ROOT / 'assets/fonts/makeyourmindup'
REC = ROOT / '.cache/recordings/Claude duet run-through.mp4'
INK, CREAM, MINT, LILAC = (12, 21, 18), (244, 239, 228), (126, 240, 192), (183, 166, 255)
AVATAR = (588, 72, 692, 178)   # the "K" avatar, top right of every Duet screen

# Each grab: the second in the recording, and the ink bars over what is private (frame px, 720x1560).
GRABS = {
    'connect-apps': ('00:28', []),
    'first-message': ('01:10', [AVATAR, (86, 298, 184, 342)]),
    'reply-to-dos': ('03:50', [AVATAR] + [(56, y - 14, 600 - (y * 7) % 90, y + 14) for y in (37, 75, 114, 152, 190, 229, 267, 306, 344)]
                     + [(226, 640, 356, 680), (204, 798, 338, 838)]),
    'todo-list': ('08:00', [AVATAR, (134, 172, 510, 212),
                            (288, 343, 518, 380), (134, 380, 402, 414),
                            (434, 521, 572, 558), (134, 555, 372, 591),
                            (308, 698, 528, 736), (134, 732, 438, 769),
                            (282, 875, 522, 913), (134, 910, 302, 946),
                            (434, 1055, 560, 1092), (134, 1089, 330, 1125)]),
    'tasks-up-next': ('11:10', [AVATAR, (382, 422, 674, 454), (88, 462, 640, 492)]),
    'make-artifacts': ('11:50', [AVATAR, (34, 1002, 352, 1312), (366, 1002, 690, 1312)]),
    'calendar-scheduler': ('14:30', [(70, 460, 216, 494)]),
    'morning-brief': ('19:20', [(76, y - 15, 664 - (y * 13) % 90 if y > 1040 else 664, y + 15) for y in (707, 750, 794, 837, 880, 923, 966, 1010, 1053)]),
}
KEEP = {'reply-to-dos': (285, 62, 435, 238)}   # Duet's own mark sits over the covered lines: put it back on top
IN_PHONE = ['first-message', 'todo-list', 'calendar-scheduler', 'reply-to-dos', 'make-artifacts']


def grab(at):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', at, '-i', str(REC), '-frames:v', '1', '-f', 'image2pipe',
                          '-vcodec', 'png', '-'], capture_output=True, check=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(raw)).convert('RGB')


def cover(im, bars):
    """Ink bars, like cut paper: flat ink, a hair of shadow. Never a blur (letters stay unguessable)."""
    d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1) in bars:
        d.rectangle((x0 + 3, y0 + 4, x1 + 3, y1 + 4), fill=(190, 186, 178))
        d.rectangle((x0, y0, x1, y1), fill=INK)
    return im


def coeffs(dst, src):
    """PIL perspective coefficients mapping output (dst) points back to input (src) points."""
    a = []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = [c for p in src for c in p]
    return np.linalg.solve(np.array(a, float), np.array(b, float)).tolist()


def desk(size):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w * 0.33) / w) ** 2 + ((yy - h * 0.30) / h) ** 2)
    glow = np.clip(1 - r * 1.9, 0, 1)[..., None] ** 2
    base = np.array(INK, float) * (1 - glow * 0.0) + (np.array(LILAC, float) - np.array(INK, float)) * glow * 0.22
    rng = np.random.default_rng(7)
    base += rng.normal(0, 4.5, (h, w, 1))  # the brand's grain, behind everything
    return Image.fromarray(np.clip(base, 0, 255).astype('uint8'))


_PLATES = {}


def plates(scale):
    if scale not in _PLATES:
        size = (round(941 * scale), round(1672 * scale))
        bezel = Image.open(PLATES / 'phone-bezel.png').convert('RGBA').resize(size, Image.LANCZOS)
        glass = Image.open(PLATES / 'phone-glass.png').convert('RGBA').resize(size, Image.LANCZOS)
        quad = [(x * scale, y * scale) for x, y in json.loads((PLATES / 'quad.json').read_text())]
        _PLATES[scale] = (size, bezel, glass, quad, desk(size))
    return _PLATES[scale]


def in_phone(screen, scale=2.0):
    size, bezel, glass, quad, bg = plates(scale)
    sw, sh = screen.size
    warped = screen.convert('RGBA').transform(size, Image.PERSPECTIVE, coeffs(quad, [(0, 0), (sw, 0), (sw, sh), (0, sh)]),
                                              Image.BICUBIC)
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(quad, fill=255)
    frame = bg.copy().convert('RGBA')
    frame.paste(warped, (0, 0), mask)
    frame.alpha_composite(bezel)
    frame.alpha_composite(glass)
    return frame


VIEW = (0, 0, 740, 1316)   # plate px: the 9:16 window the phone fills, as in the approved hand-held frames


def framed(frame, scale=2.0, z=1.0):
    pad = int(150 * scale)   # room above the phone for the wordmark and the pill
    padded = Image.new(frame.mode, (frame.width, frame.height + pad), INK + ((255,) if frame.mode == 'RGBA' else ()))
    padded.paste(frame, (0, pad))
    frame = padded
    x0, y0, x1, y1 = [v * scale for v in VIEW]
    cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / z, (y1 - y0) / z
    return frame.resize((1080, 1920), Image.LANCZOS, box=(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))


def brand(frame):
    """The wordmark and the under.the.hood pill in the corners, as every cut carries them from the first frame."""
    w, h = frame.size
    d = ImageDraw.Draw(frame)
    k = w / 1080
    anton = ImageFont.truetype(str(FONTS / 'Anton-Regular.ttf'), int(46 * k))
    mono = ImageFont.truetype(str(FONTS / 'IBMPlexMono-Medium.ttf'), int(26 * k))
    x, y = int(48 * k), int(52 * k)
    for part, col in (('make', CREAM), ('your', MINT), ('mind', CREAM), ('up', MINT)):
        d.text((x, y), part, font=anton, fill=col); x += d.textlength(part, font=anton)
    label = 'under.the.hood'
    tw = d.textlength(label, font=mono)
    px1, py0 = w - int(48 * k), int(56 * k)
    px0 = px1 - tw - int(36 * k)
    d.rounded_rectangle((px0, py0, px1, py0 + int(48 * k)), radius=int(24 * k), fill=LILAC)
    d.text((px0 + int(18 * k), py0 + int(8 * k)), label, font=mono, fill=INK)
    return frame


def stills():
    (OUT / 'screens').mkdir(exist_ok=True)
    (OUT / 'phone').mkdir(exist_ok=True)
    for name, (at, bars) in GRABS.items():
        src = grab(at)
        im = cover(src.copy(), bars)
        if name in KEEP:
            box = KEEP[name]; disc = Image.new('L', (box[2] - box[0], box[3] - box[1]), 0)
            ImageDraw.Draw(disc).ellipse((0, 0, box[2] - box[0] - 1, box[3] - box[1] - 1), fill=255)
            im.paste(src.crop(box), box[:2], disc)
        im.save(OUT / 'screens' / f'{name}.png')
        if name in IN_PHONE:
            f = brand(framed(in_phone(im)))
            f.convert('RGB').save(OUT / 'phone' / f'{name}.jpg', quality=90)
        print('wrote', name)


def ease(t):
    """The brand's enter curve, cubic-bezier(0.05, 0.7, 0.1, 1.0), solved for y at x=t."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        m = (lo + hi) / 2
        x = 3 * (1 - m) ** 2 * m * 0.05 + 3 * (1 - m) * m ** 2 * 0.1 + m ** 3
        lo, hi = (m, hi) if x < t else (lo, m)
    m = (lo + hi) / 2
    return 3 * (1 - m) ** 2 * m * 0.7 + 3 * (1 - m) * m ** 2 * 1.0 + m ** 3


def video(start='01:02', source_seconds=40, seconds=8, fps=30):
    """His first message arriving, sped up 5x inside the phone, with a slow push in. Bars over his name and avatar."""
    n = seconds * fps
    rate = source_seconds / seconds
    frames = subprocess.run(['ffmpeg', '-v', 'error', '-ss', start, '-t', str(source_seconds), '-i', str(REC),
                             '-vf', f'fps={fps / rate:.4f},scale=720:1560', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                            capture_output=True, check=True).stdout
    shot = 720 * 1560 * 3
    count = min(n, len(frames) // shot)
    out = OUT / 'demo-first-message.mp4'
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920',
                            '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23',
                            '-preset', 'medium', '-movflags', '+faststart', str(out)], stdin=subprocess.PIPE)
    bars = GRABS['first-message'][1]
    for i in range(count):
        im = Image.frombytes('RGB', (720, 1560), frames[i * shot:(i + 1) * shot])
        f = in_phone(cover(im, bars), scale=1.0).convert('RGB')
        z = 1.0 + 0.12 * ease(i / max(1, count - 1))      # the camera pushes in, slowly, the whole shot
        f = framed(f, scale=1.0, z=z)
        enc.stdin.write(brand(f.convert('RGBA')).convert('RGB').tobytes())
    enc.stdin.close(); enc.wait()
    print('wrote', out, count, 'frames')


if __name__ == '__main__':
    stills()
    if '--video' in sys.argv:
        video()
