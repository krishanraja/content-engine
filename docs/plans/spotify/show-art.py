"""show-art: the Spotify show art for "Make Your Mind Up", 3000 x 3000.

    python docs/plans/spotify/show-art.py [--out docs/plans/spotify/show-art.jpg] [--refresh]

Krish picked the show name on 2026-10-14 ("Spotify is just S1"; S1 was "Make
Your Mind Up"), recorded in config/title-verdicts.json (surface spotify-show).
Spotify asks for a square JPEG or PNG, 3000 x 3000, under 1 MB, and shows it
as small as about 60 pixels (docs/SPOTIFY.md).

The house look only, nothing new: the masthead logo from the cover site (it
is the show name, set as the brand sets it), the deep ink ground and cream
and mint from config/studio.json, Archivo for the line and the byline, and Krish's original photo ('krish') in a mint circle, as
on the covers. All of it through scripts/pages/brand.py. Every word and logo
sits inside the middle 90 per cent (an outer margin of 150 px), and the JPEG
is re-saved at falling quality until it is under 1,000,000 bytes.

Images are never committed (scripts/check-no-secrets.ts; *.jpg is
git-ignored), so this script is the record: run it to draw the art again.
"""
import argparse
import io
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import brand  # noqa: E402

SIZE = 3000
MARGIN = 150            # the outer 5 per cent: nothing that matters goes here
MAX_BYTES = 1_000_000
LINE = ("What's coming in AI,", "before it's obvious.")


def html(refresh=False):
    t = brand.house()['tokens']
    return f"""<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<style>{brand.font_css()}</style>
<style>
* {{ box-sizing: border-box; margin: 0; }}
body {{ background: {t['ink_deep']}; }}
#art {{ position: relative; width: {SIZE}px; height: {SIZE}px; overflow: hidden; background: {t['ink_deep']}; color: {t['cream']}; }}
#safe {{ position: absolute; left: {MARGIN}px; top: {MARGIN}px; right: {MARGIN}px; bottom: {MARGIN}px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; }}
.mast {{ width: 2700px; display: block; }}
.line {{ margin-top: 170px; font-family: "Archivo", Arial, sans-serif; font-weight: 800; font-size: 205px; line-height: 1.08;
         letter-spacing: -.01em; text-align: center; }}
.line span {{ display: block; }}
.line span + span {{ color: {t['mint']}; }}
.by {{ margin-top: 190px; display: flex; align-items: center; gap: 64px; }}
.face {{ width: 440px; height: 440px; border-radius: 50%; background-size: cover; background-position: center 28%;
         border: 12px solid {t['mint']}; box-shadow: 22px 22px 0 rgba(0, 0, 0, .35); }}
.name {{ font-family: "Archivo", Arial, sans-serif; font-weight: 800; font-size: 160px; line-height: 1; }}
</style></head>
<body><div id="art"><div id="safe">
<img class="mast" src="{brand.brand_uri('masthead', refresh, full=True)}" alt="Make Your Mind Up">
<p class="line"><span>{LINE[0]}</span><span>{LINE[1]}</span></p>
<div class="by">
 <div class="face" role="img" aria-label="{brand.AUTHOR}" style="background-image:url({brand.data_uri(brand.fetch('krish', refresh), 940)})"></div>
 <p class="name">{brand.AUTHOR}</p>
</div>
</div></div></body></html>"""


def outside(pg):
    """Every drawn box that crosses into the outer margin."""
    return pg.evaluate("""(m) => [...document.querySelectorAll('#safe *')].map(e => {
        const r = e.getBoundingClientRect(); return [e.className || e.tagName, r.left, r.top, r.right, r.bottom];
      }).filter(([, l, t, r, b]) => l < m || t < m || r > 3000 - m || b > 3000 - m)""", MARGIN)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=str(HERE / 'show-art.jpg'))
    ap.add_argument('--refresh', action='store_true', help='fetch the logo and photo again from the cover site')
    a = ap.parse_args()
    from PIL import Image
    page = html(a.refresh)
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': SIZE, 'height': SIZE})
        pg.set_content(page)
        pg.evaluate('document.fonts.ready')
        pg.wait_for_timeout(300)
        cut = outside(pg)
        png = pg.locator('#art').screenshot()
        b.close()
    if cut:
        brand.fail(f'something sits in the outer margin: {cut}')
    im = Image.open(io.BytesIO(png)).convert('RGB')
    if im.size != (SIZE, SIZE):
        brand.fail(f'drew {im.size}, not {SIZE}x{SIZE}')
    from PIL import ImageCms
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()  # tagged sRGB, as Spotify asks
    for q in (92, 90, 88, 85, 82, 80, 75, 70):
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=0 if q >= 88 else 2, icc_profile=srgb)
        if buf.tell() < MAX_BYTES:
            break
    else:
        brand.fail('could not get the JPEG under 1,000,000 bytes')
    Path(a.out).write_bytes(buf.getvalue())
    print(f'{a.out}: {SIZE}x{SIZE}, {buf.tell():,} bytes, JPEG quality {q}, sRGB')


if __name__ == '__main__':
    main()
