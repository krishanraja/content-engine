"""Measure the exhibit words in a real browser with the house faces, so exhibits.json can give true heights.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/measure_text.py
Reads exhibits.json; writes .cache/visual-intel/design/text-heights.json. Nothing else.
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path('/home/user/content-engine')
EX = json.loads((ROOT / 'docs/plans/2026-10-09-friday/visual-intel/exhibits.json').read_text(encoding='utf-8'))
NM = ROOT / 'node_modules'
OUT = ROOT / '.cache/visual-intel/design/text-heights.json'
EXE = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'

FONTS = f"""
@font-face {{ font-family: 'Anton'; src: url('file://{NM}/@fontsource/anton/files/anton-latin-400-normal.woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Archivo'; src: url('file://{NM}/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2'); font-weight: 100 900; }}
@font-face {{ font-family: 'Plex'; src: url('file://{NM}/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Plex'; src: url('file://{NM}/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'); font-weight: 500; }}
"""
STYLES = {
    'kicker': "font: 500 44px/1.2 'Plex'; letter-spacing: .06em; text-transform: uppercase;",
    'heading': "font: 400 92px/1.04 'Anton';",
    'standfirst': "font: 500 54px/1.25 'Archivo';",
    'source': "font: 400 42px/1.3 'Plex';",
    'label54': "font: 700 54px/1.15 'Archivo';",
    'label54r': "font: 500 54px/1.15 'Archivo';",
    'big104': "font: 400 104px/1 'Anton';",
    'big96': "font: 400 96px/1 'Anton';",
    'big80': "font: 400 80px/1 'Anton';",
    'big64': "font: 400 64px/1 'Anton';",
    'tick54': "font: 500 54px/1 'Plex';",
}
CONTENT = 1232


def blocks():
    out = []
    for e in EX['exhibits']:
        i = e['id']
        out += [(i, 'kicker', e['kicker'], 'kicker', CONTENT), (i, 'heading', e['heading'], 'heading', CONTENT),
                (i, 'standfirst', e['standfirst'], 'standfirst', CONTENT), (i, 'source', e['source_line'], 'source', CONTENT - 0)]
        for n, note in enumerate(e.get('notes', [])):
            out.append((i, f'note{n}', note['text'], 'source', CONTENT))
    # labels that must fit where the spec puts them (single line, natural width)
    singles = [
        ('model-or-thinking-level', 'label', 'Non-reasoning (thinking off)', 'label54'),
        ('model-or-thinking-level', 'label', 'Claude Opus 5.5 · 22 Sep 2026', 'label54'),
        ('model-or-thinking-level', 'label', 'Claude Opus 5 · 24 Jul 2026', 'label54'),
        ('model-or-thinking-level', 'label', 'GPT-6.1 Sol · 29 Sep 2026', 'label54'),
        ('model-or-thinking-level', 'label', 'Opus 5 at Max beat Opus 5.5 at Low', 'label54'),
        ('model-or-thinking-level', 'label', 'Thinking off cost more to run than Low', 'label54'),
        ('model-or-thinking-level', 'tick', '$0.10', 'tick54'),
        ('each-step-buys-less', 'label', 'Claude Sonnet 5.5', 'label54'),
        ('each-step-buys-less', 'label', '15.8 times the cost', 'label54r'),
        ('each-step-buys-less', 'label', '+20.1 points', 'label54'),
        ('each-step-buys-less', 'label', 'Last step: +0.2 points for 28% more', 'label54'),
        ('new-version-or-more-thinking', 'big', '+2.9 to +6.8', 'big96'),
        ('new-version-or-more-thinking', 'big', '+4.2 to +8.0', 'big96'),
        ('new-version-or-more-thinking', 'big', '+15.3', 'big104'),
        ('new-version-or-more-thinking', 'label', 'New version, same thinking level', 'label54'),
        ('new-version-or-more-thinking', 'label', 'More thinking, same model', 'label54'),
        ('cheapest-route-to-each-score', 'label', 'Claude Opus 5.5 at Xhigh', 'label54'),
        ('cheapest-route-to-each-score', 'label', 'Claude Haiku 5.5 at Xhigh *', 'label54'),
        ('cheapest-route-to-each-score', 'label', "Claude Opus 5.5 at Medium, Anthropic's default", 'label54'),
        ('cheapest-route-to-each-score', 'label', "Gemini 4 Argon at High, Google's top score here", 'label54'),
        ('cheapest-route-to-each-score', 'label', '11 times the cost for 5.8 more points', 'label54'),
        ('cheapest-route-to-each-score', 'big', 'The top score', 'big64'),
        ('cheapest-route-to-each-score', 'big', '$5.98', 'big64'),
        ('launches', 'label', 'Anthropic: 15 new Claude names on 13 days', 'label54'),
        ('launches', 'label', 'OpenAI: at least 16 launch days', 'label54'),
        ('launches', 'label', '6 launches in 16 days', 'label54'),
        ('launches', 'label', 'GPT-6.1 Sol', 'label54'),
        ('launches', 'tick', 'Nov', 'tick54'),
    ]
    out += [(i, kind, t, s, None) for i, kind, t, s in singles]
    return out


def main():
    items = blocks()
    html = ['<!doctype html><html><head><meta charset="utf-8"><style>', FONTS,
            'body{margin:0;background:#0C1512;color:#F4EFE4} div{display:block} span{white-space:nowrap}', '</style></head><body>']
    for n, (i, kind, text, style, width) in enumerate(items):
        safe = text.replace('&', '&amp;').replace('<', '&lt;')
        if width:
            html.append(f'<div id="b{n}" style="width:{width}px;{STYLES[style]}">{safe}</div>')
        else:
            html.append(f'<div><span id="b{n}" style="{STYLES[style]}">{safe}</span></div>')
    html.append('</body></html>')
    page_file = ROOT / '.cache/visual-intel/design/measure.html'
    page_file.write_text('\n'.join(html), encoding='utf-8')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE)
        pg = b.new_page(viewport={'width': 1600, 'height': 1000})
        pg.goto(page_file.as_uri())
        pg.evaluate('document.fonts.ready')
        pg.wait_for_timeout(300)
        loaded = pg.evaluate("[...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status)")
        res = {}
        for n, (i, kind, text, style, width) in enumerate(items):
            box = pg.evaluate(f"(() => {{ const r = document.getElementById('b{n}').getBoundingClientRect(); return [r.width, r.height]; }})()")
            lh = {'kicker': 44 * 1.2, 'heading': 92 * 1.04, 'standfirst': 54 * 1.25, 'source': 42 * 1.3}.get(style)
            entry = {'text': text, 'style': style, 'width_px': round(box[0]), 'height_px': round(box[1])}
            if lh:
                entry['lines'] = round(box[1] / lh)
            res.setdefault(i, []).append(dict(entry, kind=kind))
        b.close()
    OUT.write_text(json.dumps({'fonts': loaded, 'content_width': CONTENT, 'blocks': res}, indent=1, ensure_ascii=False), encoding='utf-8')
    print('fonts:', loaded)
    for i, ents in res.items():
        print('==', i)
        for e in ents:
            print(f"  {e['kind']:<10} {e['style']:<10} w={e['width_px']:>5} h={e['height_px']:>4} lines={e.get('lines', '-')}  {e['text'][:70]}")


main()
