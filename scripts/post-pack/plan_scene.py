#!/usr/bin/env python3
"""plan_scene: one mocked scene of a production plan, drawn from a real still in the picked styles, for Krish to see
before the cut is made.

Krish, 2026-11-17: "The UI should also have mocked up 2 or 3 scenes using my real content stills using the visual styles
I selected, and give me the final opportunity to switch something out if it does not work".

    python3 scripts/post-pack/plan_scene.py --frame TAKE.mp4 --at 12.4 --caption "Blame the computer" --mark computer \
        --series mind_the_gap --placement lower --face anton --out .scratch/plan/scene-b3.png
    python3 scripts/post-pack/plan_scene.py --image SOURCE.jpg ... --out ...
    python3 scripts/post-pack/plan_scene.py --self-test

The still is real: a frame of his take (--frame, --at seconds) or a real photo, screenshot or post image saved from its
source (--image, a file; keep its link in the plan). Nothing here generates a picture. The scene is 1080 x 1920, the
still filling it, the caption in a house face (Anton, Archivo, Fraunces, Plex Mono) in the house white with at most one
marked word in the series' colour (config/caption-themes.json: follow.the.money #FFD84D, under.the.hood #B7A6FF,
mind.the.gap #FF6A4D, an off-day post house mint #7EF0C0), inside the tall core box (config/brand-palette.json safe).
It is a mock of the look, not a frame of the cut: ve draws the real one.
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / 'assets' / 'fonts' / 'makeyourmindup'
FACES = {'anton': 'Anton-Regular.ttf', 'archivo': 'Archivo-Variable.ttf', 'fraunces': 'Fraunces-Upright-Variable.ttf',
         'mono': 'IBMPlexMono-Bold.ttf'}
ACCENT = {'follow_the_money': '#FFD84D', 'under_the_hood': '#B7A6FF', 'mind_the_gap': '#FF6A4D', 'off': '#7EF0C0'}
W, H = 1080, 1920
# The tall core box every critical word stays inside (the platform UI covers the edges).
SAFE = (90, 260, W - 150, H - 420)
PLACES = {'upper': 0.22, 'middle': 0.5, 'lower': 0.72}


def frame_of(take, at, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{float(at):.3f}', '-i', str(take), '-frames:v', '1', str(out)], check=True)
    return out


def cover(img):
    from PIL import Image
    s = max(W / img.width, H / img.height)
    img = img.convert('RGB').resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - W) // 2, (img.height - H) // 2
    return img.crop((x, y, x + W, y + H))


def wrap(draw, words, font, width):
    lines, line = [], []
    for w in words:
        trial = ' '.join(line + [w])
        if line and draw.textlength(trial, font=font) > width:
            lines.append(line)
            line = [w]
        else:
            line.append(w)
    if line:
        lines.append(line)
    return lines


def scene(still, caption, mark=None, series='off', placement='lower', face='anton', size=96, upper=True):
    from PIL import Image, ImageDraw, ImageFont
    base = cover(still)
    # A soft shade behind the words so they read on any still.
    shade = Image.new('L', (W, H), 0)
    top = int(H * PLACES[placement]) - 260
    ImageDraw.Draw(shade).rectangle((0, max(0, top), W, min(H, top + 520)), fill=130)
    base = Image.composite(Image.new('RGB', (W, H), '#0B0B0F'), base, shade)
    draw = ImageDraw.Draw(base)
    font = ImageFont.truetype(str(FONTS / FACES[face]), size)
    text = caption.upper() if upper and face == 'anton' else caption
    lines = wrap(draw, text.split(), font, SAFE[2] - SAFE[0])
    lh = int(size * 1.12)
    y = int(H * PLACES[placement]) - lh * len(lines) // 2
    y = max(SAFE[1], min(y, SAFE[3] - lh * len(lines)))
    marked = (mark or '').strip().lower()
    for line in lines:
        x = (W - draw.textlength(' '.join(line), font=font)) / 2
        for w in line:
            hit = marked and w.strip('.,!?"\'').lower() == marked
            draw.text((x, y), w, font=font, fill=ACCENT.get(series, ACCENT['off']) if hit else '#FFFFFF',
                      stroke_width=4, stroke_fill='#0B0B0F')
            x += draw.textlength(w + ' ', font=font)
        y += lh
    return base


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    src = p.add_mutually_exclusive_group()
    src.add_argument('--frame', help='his take, to take a frame of')
    src.add_argument('--image', help='a real still: a file, or the https link of the image at its source')
    p.add_argument('--at', type=float, default=0.0)
    p.add_argument('--caption', default='')
    p.add_argument('--mark')
    p.add_argument('--series', default='off', choices=sorted(ACCENT))
    p.add_argument('--placement', default='lower', choices=sorted(PLACES))
    p.add_argument('--face', default='anton', choices=sorted(FACES))
    p.add_argument('--size', type=int, default=96)
    p.add_argument('--out')
    p.add_argument('--self-test', action='store_true')
    a = p.parse_args(argv)
    from PIL import Image
    if a.self_test:
        img = scene(Image.new('RGB', (1920, 1080), '#335577'), 'Blame the computer and see what happens', mark='computer',
                    series='mind_the_gap')
        assert img.size == (W, H)
        assert img.getpixel((W // 2, 40)) != (11, 11, 15)
        # The marked word is drawn in the series colour somewhere on the frame.
        assert (255, 106, 77) in {img.getpixel((x, y)) for x in range(0, W, 3) for y in range(900, 1800, 3)}
        print('plan_scene self-test: ok')
        return 0
    if not a.out or not (a.frame or a.image):
        p.error('--out and one of --frame or --image are required')
    with tempfile.TemporaryDirectory() as tmp:
        if a.frame:
            path = frame_of(a.frame, a.at, Path(tmp) / 'frame.png')
        elif a.image.startswith('https://'):
            import urllib.request
            path = Path(tmp) / 'source'
            req = urllib.request.Request(a.image, headers={'User-Agent': 'content-engine plan_scene'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read(25 * 1024 * 1024 + 1)
            if len(data) > 25 * 1024 * 1024:
                raise SystemExit('plan_scene: the image is over 25 MB')
            path.write_bytes(data)
        else:
            path = Path(a.image)
        img = scene(Image.open(path), a.caption, a.mark, a.series, a.placement, a.face, a.size)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, 'PNG')
    print(a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
