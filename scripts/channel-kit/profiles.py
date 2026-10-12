#!/usr/bin/env python3
"""channel-kit/profiles.py: the rest of the makeyourmindup profile kit.

    python profiles.py [--out OUTDIR] [--refresh-brand]

build.py makes the YouTube banner and watermark; this makes every other
picture the social profiles carry. Writes into OUTDIR (default:
.cache/channel-kit/profiles/ in the repository, which git ignores):

  profile-avatar-splashes-1080.png  the profile picture on YouTube, Instagram
      and the Facebook Page since 2026-10-12: the Mindmake block mark over
      paint splashes in the three day colours, on ink.
  profile-avatar-mark-1080.png      the plain mark on ink, kept as the fallback.
  facebook-cover-1640x856.png       the Page cover. Logo, line and day pills sit
      inside the part both a computer and a phone show.
  x-header-1500x500.png             the header on Krish's own X account. The
      bottom-left corner stays clear for his profile picture.
  instagram-highlight-<name>.png    five highlight covers (Start here, one per
      day, Scored), 1080 x 1920 with the disc Instagram crops to.
  profiles-sheet.jpg                every file at the size and crop each
      platform shows. Look at this before uploading.

The days, colours and channel names come from the house style in
config/studio.json; the line under the logo is channel.json's `tagline`, the
same words as the YouTube banner. The makeyourmindup logo and mark come from
the live cover site (scripts/pages/brand.py). The splashes avatar draws the
Mindmake icon from mindmake.co/favicon.svg, cached beside the brand images,
because Krish asked for "my mindmake icon but with splashes of these colors".

It only makes files; nothing is uploaded or changed on any profile.
"""
import argparse
import base64
import importlib.util
import json
import math
import random
import re
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pages'))
import brand  # noqa: E402

# The banner's page style, from this folder's build.py (scripts/pages has a
# build.py too, so it is loaded by path rather than by name).
_spec = importlib.util.spec_from_file_location('channel_kit_build', HERE / 'build.py')
_kit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_kit)
base_css, esc = _kit.base_css, _kit.esc

AVATAR = 1080
FB_W, FB_H = 1640, 856
# A computer shows the full width at 820 x 312 (so the middle 624 rows); a
# phone shows the full height at 640 x 360 (so the middle 1522 columns).
FB_SAFE = (59, 116, 1522, 624)
X_W, X_H = 1500, 500
# Where the profile picture overlaps the header on X, with a margin.
X_AVATAR_ZONE = (0, 320, 400, 180)
HL_W, HL_H = 1080, 1920
HL_DISC = (220, 640, 640)  # left, top, diameter: what the highlight circle shows

MINDMAKE_ICON = 'https://mindmake.co/favicon.svg'
# The splash layout Krish approved on 2026-10-12 (option B, redrawn as thrown
# paint). Change a seed and the splashes change shape.
SPLASHES = (('follow_the_money', 330, 370, 112, 60),
            ('under_the_hood', 690, 335, 118, 932),
            ('mind_the_gap', 455, 765, 106, 520))


# ---------------------------------------------------------------- shared

def stripes_html(hs, right, width):
    bars = ''.join(f'<div style="width:{width}px;height:100%;background:{c["accent"]}"></div>' for c in hs['channels'])
    return f'<div style="position:absolute;top:0;bottom:0;right:{right}px;display:flex">{bars}</div>'


def pills_html(hs, size, pad_v, pad_h, gap):
    return ''.join(f'<div style="margin-bottom:{gap}px"><span class="mono pill" style="background:{c["accent"]};'
                   f'font-size:{size}px;padding:{pad_v}px {pad_h}px">{esc(c["short"])} &middot; {esc(c["name"])}</span></div>'
                   for c in hs['channels'])


def page(hs, w, h, body):
    return base_css(hs) + f'''<style>.pill{{color:var(--ink);display:inline-block;border-radius:4px;white-space:nowrap}}</style>
<body style="width:{w}px;height:{h}px;position:relative;overflow:hidden;background:var(--ink)">{body}</body>'''


# ---------------------------------------------------------------- the pictures

def fb_cover_html(hs, cfg):
    line = '<br>'.join(esc(t) for t in cfg['tagline'])
    return page(hs, FB_W, FB_H, f'''
<div class="content" style="position:absolute;left:150px;top:{FB_H // 2 - 105}px">
  <img src="{brand.brand_uri('masthead', full=True)}" style="height:210px;display:block" alt="makeyourmindup"></div>
<div class="content" style="position:absolute;left:895px;top:300px">
  <div class="serif" style="color:var(--cream);font-size:29px;line-height:1.25;margin-bottom:26px;white-space:nowrap">{line}</div>
  {pills_html(hs, 22, 9, 16, 14)}
</div>
{stripes_html(hs, FB_SAFE[0], 30)}''')


def x_header_html(hs, cfg):
    line = '<br>'.join(esc(t) for t in cfg['tagline'])
    return page(hs, X_W, X_H, f'''
<div class="content" style="position:absolute;left:70px;top:62px">
  <img src="{brand.brand_uri('masthead', full=True)}" style="height:200px;display:block" alt="makeyourmindup"></div>
<div class="content" style="position:absolute;left:820px;top:96px">
  <div class="serif" style="color:var(--cream);font-size:31px;line-height:1.25;margin-bottom:26px;white-space:nowrap">{line}</div>
  {pills_html(hs, 20, 8, 14, 12)}
</div>
{stripes_html(hs, 0, 30)}''')


def mark_avatar_html(hs):
    return page(hs, AVATAR, AVATAR, f'''
<img src="{brand.brand_uri('mark', full=True)}" style="position:absolute;width:600px;left:240px;top:283px" alt="makeyourmindup">''')


def highlight_html(hs, label, colour, size):
    left, top, d = HL_DISC
    return page(hs, HL_W, HL_H, f'''
<div style="position:absolute;left:{left}px;top:{top}px;width:{d}px;height:{d}px;border-radius:50%;background:{colour};
display:flex;align-items:center;justify-content:center">
<span style="font-family:Anton;font-size:{size}px;color:var(--ink);letter-spacing:.01em;line-height:1">{esc(label)}</span></div>''')


def highlights(hs):
    t = hs['tokens']
    out = [('start-here', 'START', t['mint'], 190)]
    out += [(c['name'].replace('.', '-'), c['short'].upper(), c['accent'], 260) for c in hs['channels']]
    out.append(('scored', 'SCORED', t['cream'], 170))
    return out


# ---------------------------------------------------------------- the splashes avatar

def mindmake_icon(refresh=False):
    """The Mindmake icon's gradients and four shapes, from the live site
    through the local cache (refreshed weekly, like the brand images)."""
    brand.CACHE.mkdir(parents=True, exist_ok=True)
    path = brand.CACHE / 'mindmake-favicon.svg'
    fresh = path.exists() and time.time() - path.stat().st_mtime < brand.REFRESH_DAYS * 86400
    if refresh or not fresh:
        try:
            req = urllib.request.Request(MINDMAKE_ICON, headers={'User-Agent': 'makeyourmindup-pages/1'})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            if b'<svg' not in body[:200]:
                raise ValueError('the reply was not an SVG')
            path.write_bytes(body)
        except Exception as e:  # noqa: BLE001
            if not path.exists():
                brand.fail(f'could not fetch {MINDMAKE_ICON} ({e}), and there is no cached copy in {brand.CACHE}')
            print(f'note: could not refresh {MINDMAKE_ICON} ({e}); using the cached copy', file=sys.stderr)
    svg = path.read_text(encoding='utf-8')
    defs = re.search(r'<defs>(.*?)</defs>', svg, re.S)
    shapes = dict(re.findall(r'<path fill="url\(#(mm-mark-[a-d])\)" d="([^"]+)"', svg))
    if not defs or sorted(shapes) != ['mm-mark-a', 'mm-mark-b', 'mm-mark-c', 'mm-mark-d']:
        brand.fail(f'{MINDMAKE_ICON} no longer has the four shapes this tool draws; look at it before changing anything')
    return defs.group(1), shapes


def _angdiff(a, b):
    d = (a - b) % (2 * math.pi)
    return d - 2 * math.pi if d > math.pi else d


def splat(cx, cy, r, seed, col):
    """One splash of thrown paint: a wobbly body whose outline runs out into
    tapered spikes, a drop beyond most long spikes, and a loose spray."""
    rnd = random.Random(seed)
    waves = [(rnd.uniform(0.05, 0.10), k, rnd.uniform(0, 6.28)) for k in (2, 3, 5)]
    n = rnd.randint(7, 9)
    base = rnd.uniform(0, 2 * math.pi)
    spikes = []
    for i in range(n):
        a = base + 2 * math.pi * i / n + rnd.uniform(-0.25, 0.25)
        long_ = rnd.random() < 0.45
        length = r * (rnd.uniform(0.55, 0.95) if long_ else rnd.uniform(0.18, 0.38))
        w = rnd.uniform(0.07, 0.11) if long_ else rnd.uniform(0.10, 0.17)
        spikes.append((a, length, w, long_))
    pts = []
    for j in range(360):
        t = 2 * math.pi * j / 360
        rr = r * (1 + sum(amp * math.sin(k * t + ph) for amp, k, ph in waves))
        rr += sum(length * math.exp(-(_angdiff(t, a) / w) ** 2) for a, length, w, _ in spikes)
        pts.append((cx + rr * math.cos(t), cy + rr * math.sin(t)))
    out = f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x, y in pts)}Z" fill="{col}"/>'
    for a, length, _, long_ in spikes:
        if long_ and rnd.random() < 0.8:
            dist = r + length + r * rnd.uniform(0.16, 0.30)
            rad = r * rnd.uniform(0.07, 0.11)
            x, y = cx + dist * math.cos(a), cy + dist * math.sin(a)
            out += (f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rad * 1.35:.1f}" ry="{rad:.1f}" '
                    f'transform="rotate({math.degrees(a):.1f} {x:.1f} {y:.1f})" fill="{col}"/>')
    for _ in range(rnd.randint(4, 6)):
        a = rnd.uniform(0, 2 * math.pi)
        dist = r * rnd.uniform(1.35, 1.9)
        out += (f'<circle cx="{cx + dist * math.cos(a):.1f}" cy="{cy + dist * math.sin(a):.1f}" '
                f'r="{r * rnd.uniform(0.025, 0.06):.1f}" fill="{col}"/>')
    return out


def splashes_svg(hs, refresh=False):
    defs, shapes = mindmake_icon(refresh)
    accent = {c['id']: c['accent'] for c in hs['channels']}
    paint = ''.join(splat(cx, cy, r, seed, accent[cid]) for cid, cx, cy, r, seed in SPLASHES)
    s = 1.45  # the icon's shapes span 380 x 330 units; centred in a 1000 box
    tx, ty = 500 - 380 * s / 2, 505 - 330 * s / 2
    mark = ''.join(f'<path fill="url(#{k})" d="{shapes[k]}"/>' for k in ('mm-mark-a', 'mm-mark-b', 'mm-mark-c', 'mm-mark-d'))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="{AVATAR}" height="{AVATAR}">'
            f'<defs>{defs}</defs><rect width="1000" height="1000" fill="{hs["tokens"]["ink"]}"/>{paint}'
            f'<g transform="translate({tx:.1f} {ty:.1f}) scale({s})">{mark}</g></svg>')


# ---------------------------------------------------------------- the check sheet

def sheet_html(hs, files):
    def uri(name):
        return 'data:image/png;base64,' + base64.b64encode(files[name]).decode()
    label = "font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.06em;color:#333;margin:18px 0 8px"
    s = 0.5
    x, y, w, h = FB_SAFE
    ax, ay, aw, ah = X_AVATAR_ZONE
    avatars = ''.join(f'<img src="{uri(n)}" style="width:{d}px;height:{d}px;border-radius:50%;margin-right:18px">'
                      for n in ('profile-avatar-splashes-1080.png', 'profile-avatar-mark-1080.png') for d in (160, 40))
    discs = ''.join(f'<div style="width:84px;height:84px;border-radius:50%;margin-right:14px;background:url({uri(n)}) '
                    f'-{HL_DISC[0] * 84 / HL_DISC[2]:.1f}px -{HL_DISC[1] * 84 / HL_DISC[2]:.1f}px / {HL_W * 84 / HL_DISC[2]:.1f}px auto no-repeat"></div>'
                    for n in files if n.startswith('instagram-highlight-'))
    return base_css(hs) + f'''<body style="width:{FB_W * s + 40}px;background:#fff;padding:0 20px 24px">
<p style="{label}">The profile picture, at channel-page and comment size (splashes, then the plain mark)</p>
<div style="display:flex;align-items:center">{avatars}</div>
<p style="{label}">Facebook cover: a computer shows inside the dashed band, a phone inside the solid box</p>
<div style="position:relative;width:{FB_W * s}px;height:{FB_H * s}px;background:url({uri('facebook-cover-1640x856.png')}) 0 0 / 100% 100%">
  <div style="position:absolute;left:0;top:{y * s}px;width:100%;height:{h * s}px;outline:2px dashed #e33"></div>
  <div style="position:absolute;left:{x * s}px;top:0;width:{w * s}px;height:100%;outline:2px solid #e33"></div></div>
<p style="{label}">X header: the box is where the profile picture sits over it</p>
<div style="position:relative;width:{X_W * s}px;height:{X_H * s}px;background:url({uri('x-header-1500x500.png')}) 0 0 / 100% 100%">
  <div style="position:absolute;left:{ax * s}px;top:{ay * s}px;width:{aw * s}px;height:{ah * s}px;outline:2px solid #e33"></div></div>
<p style="{label}">Instagram highlight covers, as the circle shows them</p>
<div style="display:flex">{discs}</div>
</body>'''


# ---------------------------------------------------------------- checks

def content_boxes(pg):
    """One box per block of words or logo: [left, top, right, bottom]."""
    return pg.evaluate('''() => [...document.querySelectorAll('.content')].map(c => {
      const r = [c, ...c.querySelectorAll('*')].map(e => e.getBoundingClientRect()).filter(r => r.width);
      return [Math.min(...r.map(x => x.left)), Math.min(...r.map(x => x.top)), Math.max(...r.map(x => x.right)), Math.max(...r.map(x => x.bottom))];
    })''')


def union(boxes):
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


def outside_circle(png_path, ink):
    """How far past the circle a platform crops to anything that is not ink
    reaches, in pixels (0 when it all fits). None without Pillow."""
    try:
        from PIL import Image
    except ImportError:
        return None
    im = Image.open(png_path).convert('RGB')
    w, h = im.size
    ink_rgb = tuple(int(ink[i:i + 2], 16) for i in (1, 3, 5))
    px = im.load()
    worst = 0.0
    for yy in range(0, h, 2):
        for xx in range(0, w, 2):
            p = px[xx, yy]
            if max(abs(p[i] - ink_rgb[i]) for i in range(3)) > 24:
                worst = max(worst, math.hypot(xx - w / 2, yy - h / 2) - w / 2)
    return max(0.0, worst)


def main():
    ap = argparse.ArgumentParser(description='The profile pictures, covers, header and highlight covers.')
    ap.add_argument('--out', help='output folder (default: .cache/channel-kit/profiles/ in the repository)')
    ap.add_argument('--refresh-brand', action='store_true', help='fetch the logo images and the Mindmake icon again now')
    a = ap.parse_args()
    out = Path(a.out) if a.out else brand.ROOT / '.cache' / 'channel-kit' / 'profiles'
    out.mkdir(parents=True, exist_ok=True)
    hs = brand.house()
    cfg = json.loads((HERE / 'channel.json').read_text(encoding='utf-8'))
    if a.refresh_brand:
        for name in ('masthead', 'mark'):
            brand.fetch(name, refresh=True)

    jobs = [('profile-avatar-splashes-1080.png', AVATAR, AVATAR,
             '<style>body{margin:0}svg{display:block}</style><body>' + splashes_svg(hs, a.refresh_brand) + '</body>'),
            ('profile-avatar-mark-1080.png', AVATAR, AVATAR, mark_avatar_html(hs)),
            ('facebook-cover-1640x856.png', FB_W, FB_H, fb_cover_html(hs, cfg)),
            ('x-header-1500x500.png', X_W, X_H, x_header_html(hs, cfg))]
    jobs += [(f'instagram-highlight-{n}.png', HL_W, HL_H, highlight_html(hs, label, col, size))
             for n, label, col, size in highlights(hs)]

    boxes = {}
    with brand.playwright() as p:
        b = brand.browser(p)
        for name, w, h, html_ in jobs:
            pg = b.new_page(viewport={'width': w, 'height': h})
            pg.set_content(html_)
            pg.evaluate('document.fonts.ready.then(() => true)')
            pg.wait_for_timeout(300)
            if name.startswith(('facebook', 'x-header')):
                boxes[name] = content_boxes(pg)
            pg.screenshot(path=str(out / name))
            pg.close()
        files = {name: (out / name).read_bytes() for name, *_ in jobs}
        pg = b.new_page(viewport={'width': int(FB_W * 0.5 + 40), 'height': 800})
        pg.set_content(sheet_html(hs, files))
        pg.evaluate('document.fonts.ready.then(() => true)')
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / 'profiles-sheet.jpg'), full_page=True, type='jpeg', quality=88)
        b.close()

    ok = True
    for name, *_ in jobs:
        print(out / name)
    print(out / 'profiles-sheet.jpg')

    fb = union(boxes['facebook-cover-1640x856.png'])
    x, y, w, h = FB_SAFE
    stripes_left = FB_W - FB_SAFE[0] - 30 * len(hs['channels'])
    fb_ok = fb[0] >= x and fb[1] >= y and fb[3] <= y + h and fb[2] <= stripes_left - 20
    ok &= fb_ok
    print(f'  facebook cover: words and logo span x {fb[0]:.0f}-{fb[2]:.0f}, y {fb[1]:.0f}-{fb[3]:.0f}; both screens show '
          f'x {x}-{x + w}, y {y}-{y + h}, and the day strip starts at x {stripes_left}: '
          + ('inside' if fb_ok else 'OUTSIDE or touching the strip; shorten the line'))

    xb = boxes['x-header-1500x500.png']
    xh = union(xb)
    ax, ay, aw, ah = X_AVATAR_ZONE
    clear = not any(b[0] < ax + aw and b[2] > ax and b[1] < ay + ah and b[3] > ay for b in xb)
    x_ok = clear and xh[2] <= X_W - 30 * len(hs['channels']) - 20
    ok &= x_ok
    print(f'  x header: words and logo span x {xh[0]:.0f}-{xh[2]:.0f}, y {xh[1]:.0f}-{xh[3]:.0f}; the profile picture covers '
          f'x {ax}-{ax + aw}, y {ay}-{ay + ah}: ' + ('clear' if x_ok else 'OVERLAPPING or touching the strip; move the logo up'))

    for name in ('profile-avatar-splashes-1080.png', 'profile-avatar-mark-1080.png'):
        past = outside_circle(out / name, hs['tokens']['ink'])
        if past is None:
            print(f'  {name}: circle check skipped (install Pillow to run it)')
            continue
        ok &= past <= 0
        print(f'  {name}: ' + ('everything sits inside the circle every platform crops to' if past <= 0
                               else f'reaches {past:.0f} px past the circle, so a platform would cut it'))

    sizes = {name: (out / name).stat().st_size for name, *_ in jobs}
    limits = {'profile-avatar-splashes-1080.png': 4e6, 'profile-avatar-mark-1080.png': 4e6,  # YouTube's picture limit
              'x-header-1500x500.png': 2e6}
    for name, cap in limits.items():
        ok &= sizes[name] <= cap
    print('  sizes: ' + ', '.join(f'{n} {s / 1e3:.0f} KB' for n, s in sizes.items() if not n.startswith('instagram')))
    print('  days: ' + ', '.join(f'{c["short"]} {c["name"]}' for c in hs['channels']))
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
