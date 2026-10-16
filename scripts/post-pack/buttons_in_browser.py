#!/usr/bin/env python3
"""Every button on the week's publish board and on a publish page, clicked in
a real browser under the viewer's rules, before any of it reaches Krish.

Krish, 2026-10-14: "the download buttons for the images STILL do not work!!!!"
The board's own checks only read its code; the buttons fetched data: URLs,
which claude.ai's page rules block, and every Download died without a word.
This builds a stand-in board and publish page with the engine's own builders,
loads each with fetch() to anything blocked (connect-src 'none') and a
stand-in viewer that grants "downloads", and clicks every Download, Copy
picture and Copy button. Any button that does not hand over its file or its
words fails the run. CI runs it (.github/workflows/ci.yml, browser-buttons).

    python scripts/post-pack/buttons_in_browser.py [--browser PATH]
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

CSP = '<meta http-equiv="Content-Security-Policy" content="connect-src \'none\'">\n'
VIEWER = '''
window.__saves = [];
const downloads = { save: async r => { const d = r.data; window.__saves.push({ name: r.filename, size: d.size ?? d.length ?? d.byteLength,
                                                                              type: d.type || '' }); return { status: "saved" } } };
window.claude = { use: async n => n === "downloads" ? downloads : null };
'''
DRIVE = 'https://drive.google.com/file/d/{}/view'


def pages(tmp):
    import title_check
    import week_board as wb
    with title_check.picked_for_tests(['Warner sued Suno. Now it takes a cut.'], tmp):
        pub = wb.stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money')
        videos = {'mon': [{'cut': c, 'seconds': 90, 'url': DRIVE.format(f'1{c}VideoAAAAAAAAAAAAAAAAAAAAAAAA'),
                           'thumbnail': {'path': f'x/{c}.jpg', 'url': DRIVE.format(f'1{c}ThumbAAAAAAAAAAAAAAAAAAAAAAAA')}}
                          for c in ('long', 'short')]}
        page, _, _ = wb.board(wb.monday_of('2026-10-12'), {'mon': pub}, {'mon': wb.MON_ID}, videos=videos)
    return {'publish page': pub, 'week board': page}


def click_all(browser, html, tmp, label):
    fails = []
    path = Path(tmp) / (label.replace(' ', '-') + '.html')
    path.write_text(CSP + html, encoding='utf-8')
    ctx = browser.new_context(viewport={'width': 1400, 'height': 900})
    try:
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    except Exception:
        pass
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script(VIEWER)
    pg.goto(path.as_uri())
    pg.wait_for_timeout(800)
    n = {'download': 0, 'image': 0, 'text': 0}
    # Every tab of the board in turn, so hidden days' buttons are clicked too.
    tabs = pg.query_selector_all('[role=tab]') or [None]
    for tab in tabs:
        if tab:
            tab.click()
            pg.wait_for_timeout(200)
        for act in ('download', 'image', 'text'):
            for b in pg.query_selector_all(f'button[data-act={act}]'):
                if not b.is_visible():
                    continue
                before = pg.evaluate('window.__saves.length')
                b.click()
                pg.wait_for_timeout(250)
                n[act] += 1
                toast = pg.evaluate('(document.getElementById("toast") || {}).textContent || ""')
                ref = b.get_attribute('data-ref')
                if act == 'download':
                    saves = pg.evaluate('window.__saves')
                    if len(saves) != before + 1 or not saves[-1]['size']:
                        fails.append(f'{label}: Download {ref} handed over no file ({toast or "no message"})')
                elif 'blocked' in toast.lower() or 'could not' in toast.lower():
                    fails.append(f'{label}: {act} {ref} failed: {toast}')
    if not n['download']:
        fails.append(f'{label}: no Download button to click')
    if errors:
        fails.append(f'{label}: page errors: ' + ' | '.join(errors[:3]))
    ctx.close()
    return n, fails


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--browser', help='a Chromium to launch (default: Playwright\'s own)')
    a = ap.parse_args(argv)
    from playwright.sync_api import sync_playwright
    fails = []
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        browser = p.chromium.launch(executable_path=a.browser) if a.browser else p.chromium.launch()
        for label, html in pages(tmp).items():
            n, f = click_all(browser, html, tmp, label)
            print(f'{label}: clicked {n["download"]} Download, {n["image"]} Copy picture, {n["text"]} Copy')
            fails += f
        browser.close()
    if fails:
        print('buttons in the browser FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print('buttons in the browser passed: every button handed over its file or its words, with fetch() blocked')
    return 0


if __name__ == '__main__':
    sys.exit(main())
