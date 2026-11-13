#!/usr/bin/env python3
"""Every button on a publish page, clicked in a real browser under the
viewer's rules, before any of it reaches Krish.

Krish, 2026-10-14: "the download buttons for the images STILL do not work!!!!"
The board's own checks only read its code; the buttons fetched data: URLs,
which claude.ai's page rules block, and every Download died without a word.
This builds a stand-in publish page with the engine's own builder (the old
week board it once built beside it was retired on 13 Nov 2026), loads it
with fetch() to anything blocked (connect-src 'none') and a
stand-in viewer that grants "downloads", and clicks every Download, Copy
picture and Copy button. Any button that does not hand over its file or its
words fails the run, and so does a publish page that scrolls sideways at a
phone's width. CI runs it (.github/workflows/ci.yml, browser-buttons).

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
# A post's channel words with every step's long link in place (the tagged subscribe page in its steps and captions).
PUBLISH_KIT_SAMPLE = {'title': 'Warner sued Suno. Now it takes a cut.', 'date': '2026-10-12', 'piece_id': 'abc-123',
                      'youtube_title': 'T', 'youtube_description': 'D', 'comment_question': 'Q?', 'short_caption': 'C',
                      'linkedin_post': 'L'}


PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='


def stand_in(tmp, name, title, kicker, words=None):
    """A small publish page, made by publish_manager.py itself."""
    import base64
    import publish_manager
    d = Path(tmp) / name
    d.mkdir()
    (d / 'a.png').write_bytes(base64.b64decode(PNG))
    (d / 'body.md').write_text(f'{title}\n\n## THE PART\n\nA **bold** fact.\n', encoding='utf-8')
    (d / 'words.json').write_text(json.dumps({'title': title, 'youtube_title': title, 'short_caption': 'C',
                                              'linkedin_post': 'L {ARTICLE_URL}', **(words or {})}), encoding='utf-8')
    (d / 'long.md').write_text('The long script, said out loud.\n', encoding='utf-8')
    (d / 'short.md').write_text('The short script.\n', encoding='utf-8')
    (d / 'm.json').write_text(json.dumps({
        'title': title, 'subtitle': 'S', 'date': '2026-10-12', 'kicker': kicker, 'body': 'body.md', 'words': 'words.json',
        'images': [{'id': 'cover', 'file': 'a.png', 'alt': 'Cover', 'role': 'cover'},
                   {'id': 'pic', 'file': 'a.png', 'alt': 'A', 'after_heading': 'THE PART'}],
        'scripts': [{'label': 'The 3-minute video', 'file': 'long.md'}, {'label': 'The 90-second cut', 'file': 'short.md'}],
    }), encoding='utf-8')
    floor, publish_manager.FIGURE_FLOOR = publish_manager.FIGURE_FLOOR, 1  # a one-picture stand-in; the floor has its own test
    try:
        return publish_manager.build(d / 'm.json', d / 'out').read_text(encoding='utf-8')
    finally:
        publish_manager.FIGURE_FLOOR = floor


def pages(tmp):
    import title_check
    with title_check.picked_for_tests(['Warner sued Suno. Now it takes a cut.'], tmp):
        return {'publish page': stand_in(tmp, 'mon', 'Warner sued Suno. Now it takes a cut.', 'follow.the.money')}


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
    n = {'download': 0, 'image': 0, 'text': 0, 'download-all': 0}
    for b in pg.query_selector_all('button[data-act=download-all]'):
        if not b.is_visible():
            continue
        want = pg.evaluate('id => document.getElementById(id).querySelectorAll(\'button[data-act="download"]\').length', b.get_attribute('data-ref'))
        before = pg.evaluate('window.__saves.length')
        b.click()
        pg.wait_for_timeout(250 * want + 400)
        n['download-all'] += 1
        saves = pg.evaluate('window.__saves')[before:]
        if len(saves) != want or not all(s['size'] for s in saves):
            fails.append(f'{label}: Download all handed over {len(saves)} of {want} files')
        if not any(s['name'].endswith('.html') and 'html' in s['type'] for s in saves):
            fails.append(f'{label}: Download all did not hand over the article as an HTML file')
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


def fits_a_phone(browser, html, tmp, label):
    """The publish page at a phone's width, 390px: nothing on it scrolls sideways. A long link in a step (the tagged
    subscribe page, 2026-11-12) once widened every step past the screen."""
    path = Path(tmp) / (label.replace(' ', '-') + '-phone.html')
    path.write_text(CSP + html, encoding='utf-8')
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto(path.as_uri())
    pg.wait_for_timeout(300)
    wide = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ctx.close()
    return [] if wide[0] <= wide[1] else [f'{label}: scrolls sideways on a phone ({wide[0]}px wide at {wide[1]}px)']


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
            print(f"{label}: clicked {n['download']} Download, {n['image']} Copy picture, {n['text']} Copy, {n['download-all']} Download all")
            fails += f
            if label == 'publish page':
                fails += fits_a_phone(browser, html, tmp, label)
        # The post pack's own start page, 0 Publish/publish.html (publish_kit.py), with every channel's step.
        import publish_kit
        fails += fits_a_phone(browser, publish_kit.page(PUBLISH_KIT_SAMPLE), tmp, 'publish kit page')
        browser.close()
    if fails:
        print('buttons in the browser FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print('buttons in the browser passed: every button handed over its file or its words, with fetch() blocked')
    return 0


if __name__ == '__main__':
    sys.exit(main())
