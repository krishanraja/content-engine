#!/usr/bin/env python3
"""video_card: the pictures that cut in while Krish talks, drawn in the house style.

    python scripts/pages/video_card.py CARDS.json [--out FOLDER] [--sheet]

Krish, 2026-10-13, on Wednesday's video: "there are font consistency issues
throughout ... brand guidelines have been seriously violated", "having 'where
the money moves' inside under the hood makes no sense because we have a
separate segment called 'Follow the Money'", and "we've not made any use of
business logos as we're supposed to". The cards had been drawn by a one-off
script with a system fallback font. This is the one tool for them now:

  * Faces and colours come from brand.py (Anton for headlines, Archivo for
    words, IBM Plex Mono for labels and sources; ink, cream, mint and the
    series accent from config/studio.json). Nothing else is drawn.
  * Every card carries at least one company logo people recognise.
  * A kicker never names another series' territory (money on a card that is
    not follow.the.money, and so on).
  * Every word must sit inside the card with nothing clipped or wrapped past
    its box; a card that does not fit is refused, never drawn.

CARDS.json: {"series": "under_the_hood", "logos": "logos/", "cards": [CARD, ...]}
with logo paths relative to the JSON file, and each CARD one of:

  {"file": "score-job.png", "kind": "bars", "kicker": "My scores, out of 10",
   "title": "Can it do the job?", "highlight": "Muse",
   "rows": [{"name": "Muse", "logos": ["meta-cream.svg"], "score": 9, "group": "Ready-made assistants"}, ...],
   ("group" is optional: rows in the same group sit under one labelled band, in the order given)
   "note": "Muse books, buys and negotiates"}
  {"file": "scorecard.png", "kind": "table", "kicker": ..., "title": ...,
   "columns": ["Does the job", ...], "highlight": "Muse",
   "rows": [{"name": "Muse", "logos": [...], "scores": [9, 10, ...]}, ...]}
  {"file": "picked.png", "kind": "statement", "kicker": ..., "logos": [...],
   "lines": [{"text": "Shops paid to be seen.", "tone": "dim"},
             {"text": "Now they'll pay to be picked.", "tone": "answer"}],
   "note": "An assistant gives you one answer, not a list"}

tone: "plain" (cream), "dim" (muted), "answer" (mint: the answer, and only the answer), "moved" (the series accent).
The card's subject ("highlight") is drawn in the series accent; mint is kept for the answer.
"""
import argparse
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402

W, H = 1600, 900
PAD = 96
# Another series' ground, by the words that name it. A kicker on one series'
# card never uses the others' (Krish, 2026-10-13).
TERRITORY = {'follow_the_money': ('money',), 'under_the_hood': ('hood', 'under the hood'),
             'mind_the_gap': ('gap',)}
TONES = {'plain': 'var(--cream)', 'dim': 'var(--muted)', 'answer': 'var(--mint)', 'moved': 'var(--accent)'}

CSS = """
:root { --ink: INK; --ink-soft: INKSOFT; --cream: CREAM; --mint: MINT; --muted: #AEAEA5; --line: #2A3430; --accent: ACCENT; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1600px; height: 900px; overflow: hidden; background: var(--ink); color: var(--cream); }
body { padding: 84px 96px; display: flex; flex-direction: column; justify-content: center; gap: 28px;
       font-family: 'Archivo', sans-serif; -webkit-font-smoothing: antialiased; }
.k { font: 700 26px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
h1 { font: 400 80px/1.0 'Anton', sans-serif; text-transform: uppercase; letter-spacing: .005em; }
.rows { display: flex; flex-direction: column; gap: 14px; }
/* Rows grouped into labelled bands ("group" on a row): a mono label over each band, rows a little tighter. */
h1.g { font-size: 68px; }
.rows.g { gap: 8px; }
.rows.g .r { height: 56px; }
.band { font: 700 20px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
        border-top: 2px solid var(--line); padding-top: 12px; margin-top: 8px; }
.band:first-child { margin-top: 0; }
tr.bandrow td { font: 700 18px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
                text-align: left; padding: 14px 8px 4px; }
.r { display: grid; grid-template-columns: 400px 1fr 90px; align-items: center; gap: 28px; height: 70px; }
.who { display: flex; align-items: center; gap: 16px; min-width: 0; }
.who img { height: 40px; width: 120px; object-fit: contain; object-position: left center; flex: none; }
.who span { font: 700 36px/1 'Archivo', sans-serif; white-space: nowrap; }
.bar { height: 40px; background: var(--ink-soft); border: 2px solid var(--line); position: relative; }
.bar i { position: absolute; inset: 0 auto 0 0; background: #5C6A64; }
.s { font: 400 64px/1 'Anton', sans-serif; text-align: right; }
.hi .who span, .hi .s { color: var(--accent); }
.hi .bar i { background: var(--accent); }
.note { font: 500 24px/1.3 'IBM Plex Mono', monospace; color: var(--muted); }
table { border-collapse: collapse; width: 100%; }
th { font: 700 20px/1.1 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted);
     text-align: center; padding: 0 8px 14px; vertical-align: bottom; }
td { font: 400 46px/1 'Anton', sans-serif; text-align: center; padding: 12px 8px; border-top: 2px solid var(--line); }
td.who { display: flex; align-items: center; gap: 14px; text-align: left; font: 700 32px/1 'Archivo', sans-serif; }
td.who img { height: 36px; width: 100px; object-fit: contain; object-position: left center; }
td.t { border-left: 2px solid var(--line); }
tr.hi td { color: var(--accent); }
.lines { display: flex; flex-direction: column; gap: 6px; }
.lines div { font: 400 104px/1.02 'Anton', sans-serif; text-transform: uppercase; }
.logos { display: flex; align-items: center; gap: 40px; }
.logos img { height: 56px; width: auto; max-width: 260px; object-fit: contain; }
"""

# Every visible element must sit inside the page box, and no text box may
# overflow its own width (a word pushed past its cell or clipped).
FIT_JS = """() => {
  const bad = [];
  const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const name = (el.textContent || el.getAttribute('alt') || el.tagName).trim().slice(0, 50);
    if (r.left < 40 || r.top < 40 || r.right > W - 40 || r.bottom > H - 40) bad.push(`outside the card: ${name}`);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') bad.push(`clipped: ${name}`);
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim()) bad.push(`too wide: ${name}`);
  }
  return [...new Set(bad)];
}"""


def fail(msg):
    sys.exit(f'video_card: {msg}')


def check_spec(spec):
    series = spec.get('series')
    if series not in TERRITORY:
        fail(f'"series" must be one of {", ".join(TERRITORY)}')
    others = [w for s, words in TERRITORY.items() if s != series for w in words]
    for card in spec['cards']:
        name = card.get('file', '?')
        kicker = (card.get('kicker') or '').lower()
        hit = next((w for w in others if w in kicker), None)
        if hit:
            fail(f'{name}: the kicker "{card["kicker"]}" uses "{hit}", another series\' ground (Krish, 2026-10-13: '
                 '"having \'where the money moves\' inside under the hood makes no sense")')
        logos = list(card.get('logos') or []) + [l for r in card.get('rows', []) for l in r.get('logos', [])]
        if not logos:
            fail(f'{name}: no company logo on it; every card shows the companies it is about (Krish, 2026-10-13: '
                 '"we\'ve not made any use of business logos as we\'re supposed to")')
        if card.get('kind') not in ('bars', 'table', 'statement'):
            fail(f'{name}: kind must be bars, table or statement')


TRIMMED = {}  # logo path -> data URI of the SVG cut to its own artwork


def trim_svg(pg, path):
    """A logo SVG with its viewBox cut to the artwork, so every logo draws at
    the same visual size (Meta's and OpenAI's files carry wide empty margins)."""
    import base64
    import re
    text = path.read_text(encoding='utf-8')
    pg.set_content(f'<html><body style="margin:0">{text}</body></html>')
    box = pg.evaluate("""() => { const s = document.querySelector('svg'); const b = s.getBBox();
                                 return [b.x, b.y, b.width, b.height]; }""")
    if box[2] <= 0 or box[3] <= 0:
        return brand.data_uri(path)
    vb = f'viewBox="{box[0]:.2f} {box[1]:.2f} {box[2]:.2f} {box[3]:.2f}"'
    text = re.sub(r'\sviewBox="[^"]*"', ' ' + vb, text, count=1) if 'viewBox' in text else text.replace('<svg', f'<svg {vb}', 1)
    text = re.sub(r'(<svg[^>]*?)\s(width|height)="[^"]*"', r'\1', text, count=2)
    return 'data:image/svg+xml;base64,' + base64.b64encode(text.encode()).decode()


def img(base, rel):
    path = (base / rel).resolve()
    if not path.exists():
        fail(f'logo not found: {path}')
    return f'<img src="{TRIMMED.get(path) or brand.data_uri(path)}" alt="{html.escape(path.stem)}">'


def body_of(card, base):
    e = html.escape
    out = [f'<div class="k">{e(card["kicker"])}</div>'] if card.get('kicker') else []
    if card['kind'] == 'bars':
        grouped = any(r.get('group') for r in card['rows'])
        out.append(f'<h1{" class=g" if grouped else ""}>{e(card["title"])}</h1><div class="rows{" g" if grouped else ""}">')
        last = None
        for r in card['rows']:
            if r.get('group') and r['group'] != last:
                out.append(f'<div class="band">{e(r["group"])}</div>')
                last = r['group']
            hi = ' hi' if r['name'] == card.get('highlight') else ''
            logos = ''.join(img(base, l) for l in r.get('logos', []))
            out.append(f'<div class="r{hi}"><div class="who">{logos}<span>{e(r["name"])}</span></div>'
                       f'<div class="bar"><i style="width:{max(0, min(10, r["score"])) * 10}%"></i></div>'
                       f'<div class="s">{r["score"]}</div></div>')
        out.append('</div>')
    elif card['kind'] == 'table':
        out.append(f'<h1 style="font-size:64px">{e(card["title"])}</h1><table><tr><th></th>'
                   + ''.join(f'<th>{e(c)}</th>' for c in card['columns']) + '<th>Total</th></tr>')
        last = None
        for r in card['rows']:
            if r.get('group') and r['group'] != last:
                out.append(f'<tr class="bandrow"><td colspan="{len(card["columns"]) + 2}">{e(r["group"])}</td></tr>')
                last = r['group']
            hi = ' class="hi"' if r['name'] == card.get('highlight') else ''
            logos = ''.join(img(base, l) for l in r.get('logos', []))
            out.append(f'<tr{hi}><td class="who">{logos}{e(r["name"])}</td>'
                       + ''.join(f'<td>{v}</td>' for v in r['scores']) + f'<td class="t">{sum(r["scores"])}</td></tr>')
        out.append('</table>')
    else:
        out.append('<div class="lines">' + ''.join(
            f'<div style="color:{TONES.get(l.get("tone", "plain"), TONES["plain"])}">{e(l["text"])}</div>'
            for l in card['lines']) + '</div>')
        out.append('<div class="logos">' + ''.join(img(base, l) for l in card['logos']) + '</div>')
    if card.get('note'):
        out.append(f'<div class="note">{e(card["note"])}</div>')
    return ''.join(out)


def page(card, base, accent):
    t = brand.house()['tokens']
    css = (CSS.replace('INKSOFT', t['ink_soft']).replace('INK', t['ink']).replace('CREAM', t['cream'])
           .replace('MINT', t['mint']).replace('ACCENT', accent))
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{brand.font_css()}{css}</style></head>'
            f'<body>{body_of(card, base)}</body></html>')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('cards', help='the cards file (JSON)')
    ap.add_argument('--out', help='where to write the PNGs (default: pics/ beside the cards file)')
    ap.add_argument('--sheet', action='store_true', help='also write sheet.png, every card at a glance')
    a = ap.parse_args(argv)
    src = Path(a.cards).resolve()
    spec = json.loads(src.read_text(encoding='utf-8'))
    check_spec(spec)
    base = src.parent / spec.get('logos', '.')
    out = Path(a.out) if a.out else src.parent / 'pics'
    out.mkdir(parents=True, exist_ok=True)
    accent = next(c['accent'] for c in brand.house()['channels'] if c['id'] == spec['series'])
    from playwright.sync_api import sync_playwright
    problems, drawn = [], []
    with sync_playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': W, 'height': H})
        for card in spec['cards']:
            for rel in list(card.get('logos') or []) + [l for r in card.get('rows', []) for l in r.get('logos', [])]:
                path = (base / rel).resolve()
                if path.suffix == '.svg' and path.exists() and path not in TRIMMED:
                    TRIMMED[path] = trim_svg(pg, path)
        for card in spec['cards']:
            pg.set_content(page(card, base, accent))
            pg.evaluate('document.fonts.ready')
            pg.wait_for_timeout(100)
            missing = pg.evaluate("""async () => {
              const want = ['400 20px "Anton"', '700 20px "Archivo"', '500 20px "IBM Plex Mono"', '700 20px "IBM Plex Mono"'];
              const out = [];
              for (const f of want) { const got = await document.fonts.load(f); if (!got.length) out.push(f); }
              return out;
            }""")
            bad = pg.evaluate(FIT_JS)
            if missing or bad:
                problems.append(f'{card["file"]}: ' + '; '.join([f'font not loaded: {f}' for f in missing] + bad))
                continue
            pg.screenshot(path=str(out / card['file']))
            drawn.append(out / card['file'])
        b.close()
    for d in drawn:
        print(f'drew   {d}')
    # The receipt the video run checks: every picture it cuts in must be one this
    # tool drew (scripts/produce_day.py, check_cards). Kept beside cards.json.
    import hashlib
    receipt = src.parent / 'cards.receipt.json'
    old = json.loads(receipt.read_text(encoding='utf-8')) if receipt.exists() else {}
    old.update({d.name: hashlib.sha256(d.read_bytes()).hexdigest() for d in drawn})
    receipt.write_text(json.dumps(dict(sorted(old.items())), indent=1) + '\n', encoding='utf-8')
    print(f'receipt {receipt}')
    if a.sheet and drawn:
        from PIL import Image
        cols = 3
        rows = (len(drawn) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 640, rows * 360), '#0C1512')
        for i, d in enumerate(drawn):
            sheet.paste(Image.open(d).convert('RGB').resize((640, 360)), ((i % cols) * 640, (i // cols) * 360))
        sheet.save(out / 'sheet.png')
        print(f'sheet  {out / "sheet.png"}')
    if problems:
        fail('not drawn, fix the words or the layout:\n  ' + '\n  '.join(problems))
    return 0


if __name__ == '__main__':
    sys.exit(main())
