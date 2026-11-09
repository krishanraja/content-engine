"""board_shots: phone screenshots of a built publish board, for Krish to see before it goes live.

    python3 scripts/post-pack/board_shots.py PAGE --out DIR [--views desk,wednesday/creative,...] [--scale 2]

Opens the board as week_board.py built it (no network: every outside request is refused, so the page shows exactly
what it holds) at 390 x 844, Krish's phone width, and saves one full-page PNG per view (a tab, or a tab's step:
"wednesday/creative"). Says, per view, whether the page scrolls sideways there. Used by .github/workflows/board-rebuild.yml
(Krish, 2026-11-07, on board v4: show him the rebuilt board before it is live). Reads and writes nothing else.
"""
import argparse
import re
import sys
from pathlib import Path

DEFAULT_VIEWS = ('desk', 'monday', 'tuesday', 'wednesday/creative', 'thursday', 'friday/creative', 'saturday/brief', 'lastweek')


def shoot(page, out, views, scale=2, assets=None):
    from playwright.sync_api import sync_playwright
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    lines = []
    exe = Path('/opt/pw-browsers/chromium')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**({'executable_path': str(exe)} if exe.exists() else {}))
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=scale, is_mobile=True, has_touch=True)
        tab = ctx.new_page()
        # The board's own API stays offline; the brand fonts (Anton, Archivo, IBM Plex Mono from Google Fonts, which the
        # live board's CSP allows) must load, or the shots show system fonts the live board never shows (Krish,
        # 2026-11-08: "I preferred my brand fonts being there").
        tab.route(re.compile(r'^https?://(?!fonts\.(?:googleapis|gstatic)\.com/)'), lambda r: r.abort())
        if assets:
            # The board's stored pictures, as the live board serves them (/api/board/<week>/assets/<id>?sha=<sha>): a file
            # the publish would store is read from assets/<sha> (board_web.py publish-web --save); one already stored by an
            # earlier build is fetched from the board with the engine key. Anything else stays offline.
            tab.route(re.compile(r'^file:///api/board/\d{4}-\d{2}-\d{2}/assets/'), lambda r: _asset(r, Path(assets)))
        uri = Path(page).resolve().as_uri()
        for view in views:
            tab.goto(f'{uri}#{view}')
            tab.wait_for_timeout(300)
            fonts = tab.evaluate('''async () => {
                const want = ['Anton', 'Archivo', 'IBM Plex Mono'];
                await Promise.all(want.map(f => document.fonts.load(`16px "${f}"`)));
                await document.fonts.ready;
                const ok = new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')));
                return want.filter(f => !ok.has(f));
            }''')
            if fonts:
                raise SystemExit(f'{view}: brand fonts did not load ({", ".join(fonts)}); the shot would not match the live board')
            # A full-page shot freezes a phone's fixed bottom tab bar halfway down the page, over the content: pin it to
            # the end of the page instead, where it sits once the page is scrolled to the bottom.
            tab.add_style_tag(content='body{position:relative}.wk.fixed .wk-in{position:absolute!important;top:auto!important;bottom:0!important}')
            wide = tab.evaluate('() => document.documentElement.scrollWidth > document.documentElement.clientWidth')
            name = out / (view.replace('/', '-') + '.png')
            tab.screenshot(path=str(name), full_page=True)
            lines.append(f'{name.name}: {"SCROLLS SIDEWAYS" if wide else "fits 390px"}')
        browser.close()
    return lines


def _asset(route, folder):
    import os
    import urllib.request
    m = re.search(r'/api/board/(\d{4}-\d{2}-\d{2})/assets/([^?]+)\?sha=([a-f0-9]{64})', route.request.url)
    if not m:
        return route.abort()
    local = folder / m.group(3)
    if local.exists():
        return route.fulfill(body=local.read_bytes())
    key, base = os.environ.get('ENGINE_OPERATOR_TOKEN'), os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
    if not key:
        return route.abort()
    try:
        req = urllib.request.Request(f'{base}/api/board/{m.group(1)}/assets/{m.group(2)}?sha={m.group(3)}',
                                     headers={'Authorization': 'Bearer ' + key})
        with urllib.request.urlopen(req, timeout=120) as r:
            return route.fulfill(body=r.read())
    except Exception:  # noqa: BLE001 - a picture that cannot be fetched shows as missing, as it would live
        return route.abort()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('page')
    ap.add_argument('--out', required=True)
    ap.add_argument('--views', default=','.join(DEFAULT_VIEWS))
    ap.add_argument('--scale', type=int, default=2)
    ap.add_argument('--assets', help='the folder board_web.py publish-web --save wrote (its assets/ folder)')
    a = ap.parse_args(argv)
    views = [v.strip() for v in a.views.split(',') if re.fullmatch(r'[a-z]+(/[a-z]+)?', v.strip())]
    lines = shoot(a.page, a.out, views, a.scale, a.assets)
    print('\n'.join(lines))
    return 1 if any('SIDEWAYS' in x for x in lines) else 0


if __name__ == '__main__':
    sys.exit(main())
