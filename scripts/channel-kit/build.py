#!/usr/bin/env python3
"""channel-kit: the YouTube channel's art in the makeyourmindup look.

    python build.py [--out OUTDIR]

Writes into OUTDIR (default: .cache/channel-kit/ in the repository, which git
ignores):

  makeyourmindup-youtube-banner-2560x1440.png  the banner. The logo, the line
      and the three day pills sit inside the middle 1546 x 423, the only part
      every screen shows; the strip of the three day colours sits at the right
      end of the band a computer shows.
  makeyourmindup-youtube-watermark-150.png     the mark on an ink tile, for
      the corner of every video.
  banner-how-it-crops.jpg  what a TV, a computer and a phone each show of the
      banner, and the watermark over light and dark video.
  description.txt          the channel description, with the days filled in.

The days, colours and channel names come from the house style in
config/studio.json, so a schedule change there changes the pills, the strip
and the description. The line under the logo, each day's promise and the
description's other words are in channel.json, next to this file.
"""
import argparse
import base64
import html
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pages'))
import brand  # noqa: E402

W, H = 2560, 1440
SAFE = (507, 508, 1546, 423)  # x, y, w, h: what every screen shows
BAND = (0, 508, 2560, 423)    # what a computer shows
BANNER = 'makeyourmindup-youtube-banner-2560x1440.png'
WATERMARK = 'makeyourmindup-youtube-watermark-150.png'


def esc(t):
    return html.escape(t, quote=False)


def base_css(hs):
    t = hs['tokens']
    return (f'<meta charset="utf-8"><style>{brand.font_css()}\n'
            '*{box-sizing:border-box;margin:0}'
            f':root{{--ink:{t["ink"]};--cream:{t["cream"]};--mint:{t["mint"]}}}'
            ".mono{font-family:'IBM Plex Mono',monospace;font-weight:600;text-transform:uppercase;letter-spacing:.08em}"
            '.serif{font-family:Fraunces,Georgia,serif;font-style:italic}</style>')


def banner_html(hs, cfg):
    pills = ''.join(f'<div class="mono pill" style="background:{c["accent"]}">{esc(c["short"])} &middot; {esc(c["name"])}</div>'
                    for c in hs['channels'])
    strip = ''.join(f'<div style="flex:1;background:{c["accent"]}"></div>' for c in hs['channels'])
    line = '<br>'.join(esc(t) for t in cfg['tagline'])
    x, y, w, h = SAFE
    return base_css(hs) + f'''<style>.pill{{color:var(--ink);font-size:24px;padding:10px 18px;white-space:nowrap}}</style>
<body style="width:{W}px;height:{H}px;position:relative;overflow:hidden;background:var(--ink)">
<div style="position:absolute;inset:0;background:radial-gradient(38% 55% at 82% 30%,rgba(126,240,192,.16),transparent 70%),radial-gradient(30% 40% at 10% 85%,rgba(126,240,192,.07),transparent 70%)"></div>
<div style="position:absolute;right:0;top:{BAND[1]}px;height:{BAND[3]}px;width:150px;display:flex">{strip}</div>
<div id="safe" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;display:flex;align-items:center;justify-content:center;gap:54px">
  <img src="{brand.brand_uri('masthead', full=True)}" style="height:222px" alt="makeyourmindup">
  <div style="display:flex;flex-direction:column;gap:26px">
    <div class="serif" style="color:var(--cream);font-size:33px;line-height:1.22;white-space:nowrap">{line}</div>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">{pills}</div>
  </div>
</div>
</body>'''


def watermark_html(hs):
    return base_css(hs) + f'''<body style="width:150px;height:150px;position:relative;overflow:hidden;background:transparent">
<div style="position:absolute;inset:0;background:var(--ink);border-radius:22px;display:flex;align-items:center;justify-content:center">
<img src="{brand.brand_uri('mark', full=True)}" style="width:104px" alt="makeyourmindup"></div></body>'''


def sheet_html(hs, banner_png, wm_png):
    """A TV shows the whole banner, a computer the full-width band, a phone
    only the middle. Drawn at half size."""
    b = 'data:image/png;base64,' + base64.b64encode(banner_png).decode()
    m = 'data:image/png;base64,' + base64.b64encode(wm_png).decode()
    s = 0.5

    def crop(x, y, w, h):
        return (f'<div style="width:{w * s}px;height:{h * s}px;background:url({b}) -{x * s}px -{y * s}px / {W * s}px {H * s}px no-repeat;'
                'outline:1px solid #ccc"></div>')

    def frame(bg):
        return (f'<div style="width:300px;height:169px;background:{bg};position:relative;outline:1px solid #ccc">'
                f'<img src="{m}" style="position:absolute;right:12px;bottom:12px;width:60px"></div>')
    label = "font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.06em;color:#333;margin:18px 0 8px"
    return base_css(hs) + f'''<body style="width:1320px;background:#fff;padding:0 20px 24px">
<p style="{label}">A TV shows all of it</p>{crop(0, 0, W, H)}
<p style="{label}">A computer shows the middle band, the full width</p>{crop(*BAND)}
<p style="{label}">A phone shows only the middle: the logo, the line and the days must fit here</p>
<div style="display:flex;justify-content:center;width:{W * s}px">{crop(*SAFE)}</div>
<p style="{label}">The watermark, over light and dark video, and at full size</p>
<div style="display:flex;gap:20px;align-items:center">{frame(brand.house()['tokens']['cream'])}{frame('#1E2128')}<img src="{m}" style="width:150px"></div>
</body>'''


def description(hs, cfg):
    days = '\n'.join(f'{c["day"]}, {c["name"]}: {cfg["promises"][c["id"]]}.' for c in hs['channels'])
    return '\n\n'.join(days if p == '{days}' else p for p in cfg['description']) + '\n'


def main():
    ap = argparse.ArgumentParser(description="The YouTube channel's banner, watermark and description.")
    ap.add_argument('--out', help='output folder (default: .cache/channel-kit/ in the repository)')
    ap.add_argument('--refresh-brand', action='store_true', help='fetch the logo images again now')
    a = ap.parse_args()
    out = Path(a.out) if a.out else brand.ROOT / '.cache' / 'channel-kit'
    out.mkdir(parents=True, exist_ok=True)
    hs = brand.house()
    cfg = json.loads((HERE / 'channel.json').read_text(encoding='utf-8'))
    missing = [c['name'] for c in hs['channels'] if c['id'] not in cfg['promises']]
    if missing:
        brand.fail('channel.json has no promise for: ' + ', '.join(missing))
    if a.refresh_brand:
        for name in ('masthead', 'mark'):
            brand.fetch(name, refresh=True)

    ok = True
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(banner_html(hs, cfg))
        pg.evaluate('document.fonts.ready.then(() => true)')
        pg.wait_for_timeout(300)
        box = pg.evaluate('''() => {
          const r = [...document.querySelectorAll('#safe > *, #safe > * *')].map(e => e.getBoundingClientRect()).filter(r => r.width);
          return [Math.min(...r.map(x => x.left)), Math.min(...r.map(x => x.top)), Math.max(...r.map(x => x.right)), Math.max(...r.map(x => x.bottom))];
        }''')
        pg.screenshot(path=str(out / BANNER))
        pg.close()
        pg = b.new_page(viewport={'width': 150, 'height': 150})
        pg.set_content(watermark_html(hs))
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / WATERMARK), omit_background=True)
        pg.close()
        pg = b.new_page(viewport={'width': 1320, 'height': 800})
        pg.set_content(sheet_html(hs, (out / BANNER).read_bytes(), (out / WATERMARK).read_bytes()))
        pg.evaluate('document.fonts.ready.then(() => true)')
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / 'banner-how-it-crops.jpg'), full_page=True, type='jpeg', quality=88)
        b.close()
    (out / 'description.txt').write_text(description(hs, cfg), encoding='utf-8')

    x, y, w, h = SAFE
    inside = box[0] >= x and box[1] >= y and box[2] <= x + w and box[3] <= y + h
    ok &= inside
    sizes = {n: (out / n).stat().st_size for n in (BANNER, WATERMARK)}
    ok &= sizes[BANNER] <= 6 * 1024 * 1024 and sizes[WATERMARK] <= 1024 * 1024
    for n in (BANNER, WATERMARK, 'banner-how-it-crops.jpg', 'description.txt'):
        print(f'{out / n}')
    print(f'  the words and logo span x {box[0]:.0f}-{box[2]:.0f}, y {box[1]:.0f}-{box[3]:.0f}; every screen shows x {x}-{x + w}, y {y}-{y + h}: '
          + ('inside' if inside else 'OUTSIDE, so a phone would cut them; shorten the line'))
    print(f'  banner {sizes[BANNER] / 1e6:.1f} MB (YouTube takes up to 6 MB); watermark {sizes[WATERMARK] / 1e3:.0f} KB (up to 1 MB)')
    print('  days: ' + ', '.join(f'{c["short"]} {c["name"]}' for c in hs['channels']))
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
