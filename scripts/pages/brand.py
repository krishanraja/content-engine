"""brand: the makeyourmindup look, shared by scripts/pages and scripts/channel-kit.

Everything here is read from a source that already exists, so nothing is
copied into this folder that could drift:

  * Colours, each subchannel's day, its sticker and the call's words come from
    the house style in `config/studio.json` (the same values the Studio renders
    with). When the schedule changes, that file changes, and every page,
    banner and pill follows.
  * The four faces (Anton, Archivo, Fraunces italic, IBM Plex Mono) come from
    the repository's own pinned font packages in `node_modules/@fontsource*`,
    installed by `npm ci`. They are the same files, byte for byte, that the
    first hand-built pages used (fetched then from Google Fonts).
  * The logo images come from the live cover site, makeyourmindup.ai/brand/,
    and are cached in `.cache/makeyourmindup/` (git-ignored). Image files are
    never committed (scripts/check-no-secrets.ts).

It also starts the browser the tools use for screenshots and the clipboard
check (Playwright for Python).
"""
import base64
import io
import json
import mimetypes
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache' / 'makeyourmindup'
SITE_URL = 'https://www.makeyourmindup.ai'
SUBSTACK = 'https://mindmakerlive.substack.com'
AUTHOR = 'Krish Raja'

# The live cover site serves these. `max_width` is the size inlined into a page
# (a 2415-pixel masthead would add weight a reader never sees).
REMOTE = {
    'masthead': ('/brand/masthead.png', 1600),
    'mark': ('/brand/mark.png', 400),
    'wordmark': ('/brand/wordmark.png', 1400),
    'krish': ('/krish-closer-look.jpg', 160),
}
REFRESH_DAYS = 7

WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
        '.gif': 'image/gif', '.svg': 'image/svg+xml'}

# A Windows console reached through a pipe (Codex reads the output that way)
# may not take every character a sentence holds; print a stand-in rather than stop.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors='replace')
    except (AttributeError, ValueError):
        pass


def fail(msg):
    sys.exit(f'error: {msg}')


# ---------------------------------------------------------------- house style

def house():
    """The publication's house style from config/studio.json: tokens, the copy
    the call uses, and the three subchannels in the order of the week."""
    cfg = json.loads((ROOT / 'config' / 'studio.json').read_text(encoding='utf-8'))
    themes = [t for t in cfg.get('brand_themes', []) if (t.get('publication') or {}).get('house_style')]
    if not themes:
        fail('config/studio.json has no brand theme with publication.house_style')
    style = themes[0]['publication']['house_style']
    channels = []
    for sid, ch in style['channels'].items():
        series = cfg['series'][sid]
        day = ch['day'].rstrip('s')  # "Mondays" -> "Monday"
        if day not in WEEK:
            fail(f'config/studio.json: {sid} has a day this tool cannot read: {ch["day"]!r}')
        channels.append({
            'id': sid,
            'name': series['public_name'],
            'accent': series['accent'],
            'day': day,
            'days': ch['day'],
            'short': day[:3],
            'sticker': ch.get('sticker', ''),
            'question': ch.get('question', ''),
        })
    channels.sort(key=lambda c: WEEK.index(c['day']))
    return {'tokens': style['tokens'], 'copy': style.get('copy', {}), 'channels': channels}


def channel(house_style, slug):
    """A subchannel by id (follow_the_money) or by name (follow.the.money)."""
    key = slug.strip().lower().replace('.', '_')
    for c in house_style['channels']:
        if c['id'] == key:
            return c
    fail(f'unknown subchannel {slug!r}; one of: ' + ', '.join(c['name'] for c in house_style['channels']))


def day_list(house_style, short=False):
    """'Mon · Wed · Fri', or 'Monday, Wednesday and Friday'."""
    days = [c['short'] if short else c['day'] for c in house_style['channels']]
    if short:
        return ' · '.join(days)
    return ', '.join(days[:-1]) + ' and ' + days[-1] if len(days) > 1 else days[0]


# ---------------------------------------------------------------- fonts

FONT_FILES = [
    # (family, style, weight range, file under node_modules)
    ('Anton', 'normal', '400', '@fontsource/anton/files/anton-latin-400-normal.woff2'),
    ('Archivo', 'normal', '100 900', '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2'),
    ('Fraunces', 'italic', '100 900', '@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2'),
    ('IBM Plex Mono', 'normal', '400', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'),
    ('IBM Plex Mono', 'normal', '500', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'),
    # No 600 on purpose: the approved pages and banner had none, so a 600
    # label drew at 700, and the 600 file's taller line box would make every
    # pill and label taller than the ones Krish saw.
    ('IBM Plex Mono', 'normal', '700', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2'),
]
SERIF_FILE = ('Source Serif 4', 'normal', '200 900', '@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2')
LATIN = ('U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, '
         'U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD')


def font_css(extra=()):
    """@font-face rules with every face inlined, so a page needs no network."""
    out = []
    for family, style, weight, rel in [*FONT_FILES, *extra]:
        path = ROOT / 'node_modules' / rel
        if not path.exists():
            fail(f'font file missing: node_modules/{rel}. Run `npm ci` in the repository first.')
        data = base64.b64encode(path.read_bytes()).decode()
        out.append(f"@font-face {{ font-family: '{family}'; font-style: {style}; font-weight: {weight}; font-display: block; "
                   f"src: url(data:font/woff2;base64,{data}) format('woff2'); unicode-range: {LATIN}; }}")
    return '\n'.join(out)


# ---------------------------------------------------------------- images

def fetch(name, refresh=False):
    """A brand image from the live cover site, through the local cache. Fresh
    copies are fetched once a week; if the site cannot be reached, the cached
    copy is used and the tool says so."""
    rel, _ = REMOTE[name]
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / Path(rel).name
    fresh = path.exists() and time.time() - path.stat().st_mtime < REFRESH_DAYS * 86400
    if fresh and not refresh:
        return path
    try:
        req = urllib.request.Request(SITE_URL + rel, headers={'User-Agent': 'makeyourmindup-pages/1'})
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
        if not (body.startswith(b'\x89PNG') or body.startswith(b'\xff\xd8')):
            raise ValueError('the reply was not an image')
        path.write_bytes(body)
    except Exception as e:  # noqa: BLE001
        if path.exists():
            print(f'note: could not refresh {SITE_URL + rel} ({e}); using the cached copy', file=sys.stderr)
        else:
            fail(f'could not fetch {SITE_URL + rel} ({e}), and there is no cached copy in {CACHE}')
    return path


def data_uri(path, max_width=None):
    """A file as a data: URI. With Pillow installed, an image wider than
    `max_width` is scaled down first (photos as JPEG, the rest as PNG)."""
    path = Path(path)
    if not path.exists():
        fail(f'image not found: {path}')
    mime = MIME.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    body = path.read_bytes()
    if max_width and mime in ('image/png', 'image/jpeg', 'image/webp'):
        try:
            from PIL import Image
        except ImportError:
            Image = None
        if Image:
            im = Image.open(io.BytesIO(body))
            if im.width > max_width:
                im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
                buf = io.BytesIO()
                if mime == 'image/jpeg':
                    im.convert('RGB').save(buf, 'JPEG', quality=86, optimize=True)
                else:
                    im.save(buf, 'PNG', optimize=True)
                    mime = 'image/png'
                body = buf.getvalue()
    return f'data:{mime};base64,' + base64.b64encode(body).decode()


def brand_uri(name, refresh=False, full=False):
    """A brand image, inlined. `full` keeps the original size (for renders)."""
    return data_uri(fetch(name, refresh), None if full else REMOTE[name][1])


# ---------------------------------------------------------------- browser

def browser(playwright):
    """Start Chromium through Playwright for Python. MYMU_BROWSER may name a
    browser to use instead: a path to chrome or msedge, or the word `msedge`
    or `chrome` for the installed one (Edge is on every Windows machine)."""
    want = os.environ.get('MYMU_BROWSER', '').strip()
    if want in ('msedge', 'chrome'):
        return playwright.chromium.launch(channel=want)
    if want:
        return playwright.chromium.launch(executable_path=want)
    try:
        return playwright.chromium.launch()
    except Exception as first:  # noqa: BLE001
        for ch in ('msedge', 'chrome'):
            try:
                return playwright.chromium.launch(channel=ch)
            except Exception:  # noqa: BLE001
                pass
        fail(f'no browser to drive ({first}). Run `python -m playwright install chromium`, '
             'or set MYMU_BROWSER=msedge to use Microsoft Edge.')


def playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        fail('this step needs Playwright for Python: `pip install playwright`, then `python -m playwright install chromium`.')
    return sync_playwright()
