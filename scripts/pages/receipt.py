"""The Receipt: the house template for every cover and video thumbnail.

Krish picked it on 2 November 2026 ("Go with the number one ... make this the floor level standard moving
forward, inviolable"), after a frame grabbed from his take went onto Monday's card ("absolutely fucking awful
headshot") and he showed what good thumbnails do ("They usually don't have just the authors face in them and
usually not juts a black background"), then asked for the wordmark and the logos back and for room around
the words ("the text is cramped, and the word "of" is on its own line").

One look in every shape:
  - a sage ground, never flat black, and no face;
  - the proof: a real picture from one of the piece's checked sources (a chart, a page, a document), framed
    and tilted like a pinned receipt, with an optional ring around the one number it is about and a tag
    naming whose it is ("ANTHROPIC'S OWN DATA");
  - the words: the lead in ink, the last part on the subchannel's colour, never a short word alone on a line;
  - the Make Your Mind Up wordmark on an ink plate, the real logo of every company the piece names on an
    ink plate, and the subchannel's pill.

Facts ("cover", and "thumbs" over it field by field):
  "headline": ["the lead, in ink", "the last part, on the subchannel's colour"]
  "proof": {"image": a path (from the facts' folder), "source": a key of the facts' "sources",
            "tag": "whose it is, in capitals", "ring": [x0, y0, x1, y1] as fractions of the image (optional)}
  "rows": [{"logo": a logo that reads on dark ink, "name": the company}]  (their tags are not drawn here)

Each shape lays everything inside its safe box (the part every place it is shown keeps), finds the largest
headline that fits in its lines with no lone short word, and holds every word to the phone floors in card.py.
"""
import datetime as dt
import hashlib
import html
import json
import sys
from pathlib import Path

import brand
import card

SAGE = '#B9D3C3'
GROUND_STOPS = ('#D6E6DB', '#B9D3C3', '#8FB3A0')
GROUND = 'radial-gradient(circle at 30% 38%, {0} 0, {1} 55%, {2} 100%)'


def ground(look):
    """The sage ground, leaned lightly toward a series day's colour (brand.day_look); plain on an off day."""
    stops = [brand.lean(s, look['colour'], look['tint']) for s in GROUND_STOPS]
    return GROUND.format(*stops), stops[1]
TEMPLATE = 'receipt'
# A line holding one word this short reads as a mistake ("the word "of" is on its own line").
LONE_WORD_MAX = 3
# The proof is the hero: at least this share of the safe box's width, so the words never shrink it to a stamp.
PROOF_MIN = {'side': .27, 'stack': .74, 'square': .55}

# Every shape the drawer makes. 'layout': side puts the proof left of the words; stack puts the words over it.
SHAPES = {
    'cover':    {'w': 1200, 'h': 800,  'layout': 'side',  'safe': (220, 84, 980, 716), 'lines': 4, 'heads': range(96, 46, -2)},
    'upload':   {'w': 1200, 'h': 630,  'layout': 'side',  'safe': (152, 36, 1048, 594), 'lines': 4, 'heads': range(96, 46, -2)},
    'share':    {'w': 1200, 'h': 675,  'layout': 'side',  'safe': (88, 72, 1112, 603), 'lines': 4, 'heads': range(100, 46, -2)},
    'square':   {'w': 1080, 'h': 1080, 'layout': 'stack', 'safe': (167, 72, 913, 1008), 'lines': 4, 'heads': range(110, 42, -2)},
    'vertical': {'w': 1080, 'h': 1920, 'layout': 'stack', 'safe': (96, 286, 984, 1444), 'lines': 5, 'heads': range(136, 42, -2)},
    'wide':     {'w': 1280, 'h': 720,  'layout': 'side',  'safe': (56, 40, 1224, 680), 'lines': 4, 'heads': range(112, 50, -2), 'proofw': '50%', 'tag_on_proof': True,
                 'clear': [("YouTube's video length, bottom right", (968, 548, 1280, 720))]},
    'tall':     {'w': 1080, 'h': 1920, 'layout': 'stack', 'safe': (72, 260, 1008, 1660), 'lines': 5, 'heads': range(150, 42, -2)},
}

CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: @SAGE@; }
#card { position: relative; overflow: hidden; background: @GROUND@; }
#safe { position: absolute; display: flex; flex-direction: column; gap: var(--gap); }
.top { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); }
.wmp { background: var(--ink); padding: calc(var(--wm) * .3) calc(var(--wm) * .45); }
.wmp img { height: var(--wm); display: block; }
.main { flex: 1; min-height: 0; display: flex; gap: var(--gap); }
.side .main { flex-direction: row; align-items: center; }
.stack .main { flex-direction: column; }
.proof { position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; min-width: 0; }
.side .proof { flex: 0 0 var(--proofw); height: 100%; }
.stack .proof { flex: 1 1 0; order: 2; }
.pin { position: relative; transform: rotate(-2.5deg); display: flex; flex-direction: column; align-items: flex-start; gap: calc(var(--edge) * 1.2); }
.frame { position: relative; border: var(--edge) solid #fff; box-shadow: calc(var(--edge) * 1.8) calc(var(--edge) * 2.2) 0 rgba(12, 21, 18, .35); background: #fff; }
.frame img { display: block; }
.ring { position: absolute; border: calc(var(--edge) * .6) solid var(--ink); border-radius: 50%; }
.tag { align-self: flex-start; font-family: "IBM Plex Mono", monospace; font-weight: 700;
       font-size: var(--fine); line-height: 1.15; letter-spacing: .03em; text-transform: uppercase; background: var(--accent); color: var(--ink); padding: .28em .5em; max-width: 100%; }
.col { display: flex; flex-direction: column; gap: calc(var(--gap) * .7); min-width: 0; }
.side .col { flex: 1 1 auto; align-self: stretch; justify-content: flex-start; padding-top: calc(var(--gap) * .5); }
.stack .col { order: 1; flex: none; }
h1 { font-family: "Anton", Impact, sans-serif; font-weight: 400; text-transform: uppercase; font-size: var(--head); line-height: 1.24; color: var(--ink); text-wrap: balance; }
h1 mark { background: var(--accent); color: var(--ink); padding: 0 .12em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.foot { display: flex; align-items: center; gap: var(--gap); flex-wrap: wrap; }
.stack .foot { order: 3; justify-content: space-between; }
.logos { display: flex; flex-wrap: wrap; max-width: 100%; align-items: center; row-gap: calc(var(--logo) * .35); column-gap: calc(var(--logo) * .5); background: var(--ink); padding: calc(var(--logo) * .28) calc(var(--logo) * .4); }
.logos img { height: var(--logo); display: block; }
.pill { font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: var(--fine); line-height: 1; background: var(--accent); color: var(--ink);
        padding: .3em .6em; border-radius: 999px; white-space: nowrap; }
"""

# The largest headline that fits: its lines, no lone short word, everything inside the safe box and out of
# any clear zone, and the column not spilling. Returns what it settled on.
FIT_JS = r"""([heads, maxLines, loneMax, safe, clear, proofMin, proofWs]) => {
  const s = document.documentElement.style, h1 = document.querySelector('h1');
  const inBox = (r, b) => r.left >= b[0] - .5 && r.top >= b[1] - .5 && r.right <= b[2] + .5 && r.bottom <= b[3] + .5;
  const hits = (r, b) => r.left < b[2] && r.right > b[0] && r.top < b[3] && r.bottom > b[1];
  const words = () => {
    const out = [];
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const b = r.getClientRects()[0]; if (b) out.push({w: m[0], top: Math.round(b.top), left: b.left}); }
    }
    return out;
  };
  const fitImage = () => {
    const box = document.querySelector('.proof').getBoundingClientRect(), img = document.querySelector('.frame img');
    const edge = parseFloat(getComputedStyle(document.querySelector('.frame')).borderTopWidth);
    const pinTag = document.querySelector('.pin .tag'), tag = pinTag ? pinTag.getBoundingClientRect().height + edge * 1.2 : 0;
    const nw = img.naturalWidth, nh = img.naturalHeight, k = Math.min((box.width * .9 - 2 * edge) / nw, ((box.height - tag) * .92 - 2 * edge) / nh);
    img.style.width = Math.max(40, nw * k) + 'px'; img.style.height = Math.max(20, nh * k) + 'px';
    if (pinTag) pinTag.style.maxWidth = (Math.max(40, nw * k) + 2 * edge) + 'px';
  };
  let last = null;
  for (const pw of proofWs) {
  s.setProperty('--proofw', pw);
  for (const head of heads) {
    s.setProperty('--head', head + 'px');
    fitImage();
    const ws = words(), lines = [...new Set(ws.map(w => w.top))].sort((a, b) => a - b);
    const lone = lines.map(t => ws.filter(w => w.top === t)).filter(l => l.length === 1 && l[0].w.replace(/[^A-Za-z0-9%]/g, '').length <= loneMax).map(l => l[0].w);
    const parts = ['.wmp', 'h1', '.logos', '.pill', '.tag', '.ring'].flatMap(q => [...document.querySelectorAll(q)]);
    const cut = parts.filter(e => !inBox(e.getBoundingClientRect(), safe)).map(e => e.className || e.tagName);
    const hit = parts.filter(e => clear.some(c => hits(e.getBoundingClientRect(), c[1]))).map(e => e.className || e.tagName);
    const main = document.querySelector('.main').getBoundingClientRect(), hb = h1.getBoundingClientRect(), fb = document.querySelector('.foot')?.getBoundingClientRect();
    const spill = hb.bottom > main.bottom + 1 || (fb && fb.bottom > main.bottom + 1) || h1.scrollWidth > h1.clientWidth + 1;
    const img = document.querySelector('.frame img').getBoundingClientRect();
    last = {head, lines: lines.length, lone, cut, hit, spill, proof: [Math.round(img.width), Math.round(img.height)]};
    last.small_proof = img.width < proofMin * (safe[2] - safe[0]);
    last.ok = lines.length <= maxLines && !lone.length && !cut.length && !hit.length && !spill && !last.small_proof;
    last.proofw = pw;
    if (last.ok) return last;
  }
  }
  return last;
}"""


def esc(t):
    return html.escape(str(t), quote=False)


def words_of(c, facts):
    """The headline as (lead, last part). A list of two is taken as it is; a string is split at its last
    comma, full stop, colon or question mark, else its last three words go on the colour."""
    head = c.get('headline') or facts.get('headline')
    if isinstance(head, list) and len(head) == 2:
        return str(head[0]).strip(), str(head[1]).strip()
    if isinstance(head, str):
        import re
        m = re.match(r'^(.*[,.:?])\s+(\S.*)$', head.strip())
        if m:
            return m.group(1), m.group(2)
        w = head.split()
        return ' '.join(w[:-3]), ' '.join(w[-3:])
    brand.fail('"headline" is one line of text, or two: the lead in ink, then the last part on the subchannel\'s colour')


PROOFS = brand.ROOT / '.cache' / 'proofs'


def pdf_proof(spec):
    """{"url", "page", "crop": [x0, y0, x1, y1] fractions}: the source PDF fetched once, the page drawn at
    300 dpi and cut, kept under .cache/proofs. Any machine makes the same picture from the facts alone, so a
    cover never depends on a file only one session had (2026-10-31: a missing headshot became a frame grab)."""
    import subprocess
    import urllib.request
    url, page_no, crop = spec.get('url'), int(spec.get('page') or 0), spec.get('crop')
    if not (url and page_no >= 1 and isinstance(crop, list) and len(crop) == 4):
        brand.fail('"proof": "pdf" is {"url": the source PDF, "page": its page number, "crop": [x0, y0, x1, y1] as fractions of the page}')
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    PROOFS.mkdir(parents=True, exist_ok=True)
    pdf = PROOFS / f'{key}.pdf'
    if not pdf.is_file():
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'makeyourmindup-pages/1', 'Accept': '*/*'})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
        except Exception:  # noqa: BLE001
            body = b''
        for wait in (0, 3, 8, 15):  # some court sites refuse Python's client, or throttle and then serve; curl is on every runner
            if body.startswith(b'%PDF'):
                break
            import time
            time.sleep(wait)
            body = subprocess.run(['curl', '-sSL', '--max-time', '120', '-A', 'makeyourmindup-pages/1', url], capture_output=True).stdout
        if not body.startswith(b'%PDF'):
            brand.fail(f'"proof": {url} did not return a PDF')
        pdf.write_bytes(body)
    shot = PROOFS / f'{key}-p{page_no}'
    if not (PROOFS / f'{shot.name}.png').is_file():
        try:
            subprocess.run(['pdftoppm', '-f', str(page_no), '-l', str(page_no), '-r', '300', '-png', '-singlefile', str(pdf), str(shot)], check=True)
        except (OSError, subprocess.CalledProcessError) as e:
            brand.fail(f'"proof": could not draw page {page_no} of the PDF with pdftoppm (poppler-utils): {e}')
    from PIL import Image
    im = Image.open(PROOFS / f'{shot.name}.png')
    x0, y0, x1, y1 = (float(v) for v in crop)
    out = PROOFS / f'{shot.name}-{"-".join(f"{v:.4f}" for v in (x0, y0, x1, y1))}.png'
    if not out.is_file():
        im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))).save(out)
    return out


def shot_proof(spec, base, kind):
    """"page": {"url", "crop"} a live source page, or "html": {"path", "crop"} one of the piece's own figures
    (drawn from its checked facts), shot at 2x in a 1280-wide window and cut to "crop" (fractions of the
    full page). Kept under .cache/proofs, keyed by what was asked for."""
    width = int(spec.get('width') or (1280 if kind == 'page' else 1200))
    crop = spec.get('crop') or [0, 0, 1, 1]
    if kind == 'page':
        url = spec.get('url')
        if not (isinstance(url, str) and url.startswith('https://')):
            brand.fail('"proof": "page" is {"url": the source page (https), "crop": [x0, y0, x1, y1] fractions of the page}')
    else:
        path = Path(spec.get('path') or '')
        path = path if path.is_absolute() else Path(base) / path
        if not path.is_file():
            brand.fail(f'"proof": "html" names a figure that is missing: {path}')
        url = path.resolve().as_uri()
    if not (isinstance(crop, list) and len(crop) == 4 and all(0 <= float(v) <= 1 for v in crop)):
        brand.fail('"proof": "crop" is [x0, y0, x1, y1], fractions of the page from 0 to 1')
    key = hashlib.sha256(json.dumps([kind, url, width, crop, spec.get('height')]).encode()).hexdigest()[:16]
    PROOFS.mkdir(parents=True, exist_ok=True)
    out = PROOFS / f'{kind}-{key}.png'
    if out.is_file():
        return out
    with brand.playwright() as pw:
        b = brand.browser(pw)
        pg = b.new_page(viewport={'width': width, 'height': int(spec.get('height') or 900)}, device_scale_factor=2)
        pg.goto(url, wait_until='domcontentloaded', timeout=60000)
        pg.wait_for_timeout(2500)
        full = spec.get('height') is None and kind == 'html'
        png = pg.screenshot(full_page=full)
        b.close()
    import io
    from PIL import Image
    im = Image.open(io.BytesIO(png))
    x0, y0, x1, y1 = (float(v) for v in crop)
    im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))).save(out)
    return out


def proof_of(c, facts, base):
    """The proof facts, checked: a real image that exists, named to one of the piece's sources."""
    p = c.get('proof')
    if not isinstance(p, dict) or not any(p.get(k) for k in ('image', 'pdf', 'page', 'html')):
        brand.fail('"proof" is required (the Receipt, Krish, 2026-11-02): {"image": a real picture from one of the piece\'s checked sources, '
                   'or "pdf": {"url", "page", "crop"}, "source": its key in "sources", "tag": whose it is, "ring": [x0, y0, x1, y1] optional}. '
                   'No face stands in for it.')
    if p.get('pdf'):
        path = pdf_proof(p['pdf'])
    elif p.get('page'):
        path = shot_proof(p['page'], base, 'page')
    elif p.get('html'):
        path = shot_proof(p['html'], base, 'html')
    else:
        path = Path(p['image'])
        path = path if path.is_absolute() else Path(base) / path
    if not path.is_file():
        brand.fail(f'the proof image is missing: {path}')
    sources = facts.get('sources') or {}
    if sources and p.get('source') not in sources:
        brand.fail(f'"proof": "source" must be one of the piece\'s sources ({", ".join(sources)}), not {p.get("source")!r}: '
                   'the picture is a receipt, so it comes from a source the fact gate checked')
    live = (p.get('pdf') or p.get('page') or {}).get('url')
    if live and sources:
        named = sources[p['source']]
        named_url = named[1] if isinstance(named, list) and len(named) > 1 else (named.get('url') if isinstance(named, dict) else None)
        if named_url and named_url != live:
            brand.fail(f'"proof": the picture is not from the source it names ({p["source"]} is {named_url})')
    ring = p.get('ring')
    if ring is not None and not (isinstance(ring, list) and len(ring) == 4 and all(0 <= float(v) <= 1 for v in ring) and ring[0] < ring[2] and ring[1] < ring[3]):
        brand.fail('"proof": "ring" is [x0, y0, x1, y1], each a fraction of the image from 0 to 1')
    if not str(p.get('tag') or '').strip():
        brand.fail('"proof": "tag" says whose the picture is, e.g. "ANTHROPIC\'S OWN DATA"')
    return dict(p, path=path)


def page(facts, c, base, shape):
    """One shape of the Receipt as a page, before fitting."""
    spec = SHAPES[shape]
    W, H = spec['w'], spec['h']
    hs = brand.house()
    t = hs['tokens']
    ch = brand.channel(hs, facts['subchannel'])
    look = brand.day_look(hs, facts.get('date'), facts['subchannel'])
    card_ground, body_ground = ground(look)
    lead, last = words_of(c, facts)
    sys.path.insert(0, str(brand.ROOT / "scripts" / "post-pack"))
    import title_check
    why = title_check.gate(f'{lead} {last}'.strip(), piece_id=facts.get('piece_id'))
    if why:
        brand.fail(f'the words "{lead} {last}" are not ready (house rule TITLE_EARNS_THE_CLICK: the anti-dumb floor, then only words Krish picked): ' + '; '.join(why))
    p = proof_of(c, facts, base)
    words_px, fine_px = card.needed(W)
    l, tp, r, b = spec['safe']
    side = spec['layout'] == 'side'
    n_logos = len([x for x in [*c.get('rows', []), *c.get('strip', [])] if x.get('logo')])
    pin_tag = not side or spec.get('tag_on_proof', False)
    edge = max(8, round(W / 128))
    ring = ''
    if p.get('ring'):
        x0, y0, x1, y1 = (float(v) for v in p['ring'])
        ring = f'<div class="ring" style="left:{x0 * 100:.2f}%;top:{y0 * 100:.2f}%;width:{(x1 - x0) * 100:.2f}%;height:{(y1 - y0) * 100:.2f}%"></div>'
    logos = ''.join(f'<img src="{brand.data_uri(Path(base) / row["logo"] if not Path(row["logo"]).is_absolute() else row["logo"], 600)}" alt="{esc(row.get("name", ""))}">'
                    for row in [*c.get('rows', []), *c.get('strip', [])] if row.get('logo'))
    vars_ = {
        '--ink': t['ink'], '--accent': look['colour'],
        '--head': f'{spec["heads"][0]}px', '--fine': f'{fine_px + 2}px', '--wm': f'{round(min(W / 30, (r - l) / 26))}px',
        '--logo': f'{round(max(fine_px + 2, (r - l) / 24) * (1 if n_logos <= 3 else .78))}px', '--gap': f'{round(W / 40)}px', '--edge': f'{edge}px',
        '--proofw': spec.get('proofw', '58%') if side else '100%',
    }
    root = ';'.join(f'{k}:{v}' for k, v in vars_.items())
    head = (f'{esc(lead)} ' if lead else '') + f'<mark>{esc(last)}</mark>'
    foot = f'<div class="foot"><div class="logos">{logos}</div></div>' if logos else ''
    tag = f'<div class="tag" data-fine-print>{esc(p["tag"])}</div>'
    return f"""<!doctype html><html style="{root}"><head><meta charset="utf-8"><style>{brand.font_css()}
{CSS.replace('@SAGE@', body_ground).replace('@GROUND@', card_ground)}</style></head><body>
<div id="card" class="{spec['layout']}" style="width:{W}px;height:{H}px">
 <div id="safe" style="left:{l}px;top:{tp}px;width:{r - l}px;height:{b - tp}px">
  <div class="top"><div class="wmp"><img src="{brand.data_uri(brand.fetch('wordmark'), 1400)}" alt="Make Your Mind Up"></div><div class="pill" data-fine-print>{esc(ch["name"])}</div></div>
  <div class="main">
   <div class="proof"><div class="pin">{tag if pin_tag else ''}<div class="frame"><img src="{brand.data_uri(p['path'], 2400)}" alt="{esc(p.get('alt') or p['tag'])}">{ring}</div></div></div>
   <div class="col">{('' if pin_tag else tag) + foot if side else ''}<h1>{head}</h1></div>
   {'' if side else foot}
  </div>
 </div>
</div></body></html>"""


def render(b, facts, c, base, shape, jpeg=None):
    """Draw one shape in an open browser. Returns (bytes or None, fit, small words)."""
    spec = SHAPES[shape]
    W, H = spec['w'], spec['h']
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.set_content(page(facts, c, base, shape))
    card.settle(pg)
    fit = pg.evaluate(FIT_JS, [list(spec['heads']), spec['lines'], LONE_WORD_MAX, list(spec['safe']), spec.get('clear', []), PROOF_MIN.get(shape, PROOF_MIN[spec['layout']]),
                                  [spec.get('proofw', '58%'), '50%', '44%'] if spec['layout'] == 'side' else ['100%']])
    small = card.too_small(card.texts(pg, (0, 0, W, H)), W)
    shot = None
    if fit['ok'] and not small:
        clip = {'x': 0, 'y': 0, 'width': W, 'height': H}
        shot = pg.screenshot(type='jpeg', quality=jpeg, clip=clip) if jpeg else pg.screenshot(clip=clip)
    pg.close()
    return shot, fit, small


def explain(name, fit, small):
    print(f'{name}: not drawn.')
    if fit['lines']:
        print(f'  at the smallest headline tried ({fit["head"]} px) it takes {fit["lines"]} line(s)')
    if fit['lone']:
        print(f'  a short word sits alone on a line: {", ".join(fit["lone"])}. Reword or rebalance the "headline"')
    for what in fit['cut']:
        print(f'  {what} falls outside the safe box')
    for what in fit['hit']:
        print(f'  {what} reaches into a zone the platform covers')
    if fit['spill']:
        print('  the words do not fit their column: shorten the "headline"')
    if fit.get('small_proof'):
        print('  the proof is too small beside the words: shorten the "headline"')
    for w in small:
        print(f'  too small to read on a phone: {w["phone"]:.1f} px  "{card.short(w["text"])}"')


def receipt_record(facts, c, shape, name, data, fit):
    p = c.get('proof') or {}
    return {
        'drawer': 'scripts/pages/build.py (receipt)', 'template': TEMPLATE, 'shape': shape, 'file': name,
        'width': SHAPES[shape]['w'], 'height': SHAPES[shape]['h'], 'sha256': hashlib.sha256(data).hexdigest(),
        'portrait': False, 'proof': {k: p.get(k) for k in ('image', 'pdf', 'page', 'html', 'source', 'tag', 'ring')},
        'day': {k: v for k, v in brand.day_look(brand.house(), facts.get('date'), facts['subchannel']).items() if k != 'tint'},
        'rows': [r.get('name', '') for r in c.get('rows', [])], 'strip': [x.get('name', '') for x in c.get('strip', [])],
        'headline': list(words_of(c, facts)), 'headline_px': fit['head'], 'lines': fit['lines'],
        'safe': list(SHAPES[shape]['safe']), 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }


COVER_FILES = {'cover': 'cover.png', 'upload': 'cover-1200x630.png', 'share': 'cover-1200x675.png',
               'square': 'cover-1080x1080.png', 'vertical': 'cover-1080x1920.png'}
THUMB_FILES = {'wide': 'thumb-wide-1280x720.jpg', 'tall': 'thumb-tall-1080x1920.jpg'}


def draw_covers(facts, base, out):
    """Every cover shape in the Receipt. Writes all of them or none, each with its receipt json."""
    out = Path(out)
    c = dict(facts.get('cover') or {})
    stems = {s: f.rsplit('.', 1)[0] for s, f in COVER_FILES.items()}
    for s, f in COVER_FILES.items():
        for n in (f, stems[s] + '.json', stems[s] + '-crops.png'):
            (out / n).unlink(missing_ok=True)
    proof_of(c, facts, base)  # fetch and cut the proof before the drawing browser opens
    shots = {}
    with brand.playwright() as pw:
        b = brand.browser(pw)
        for s, f in COVER_FILES.items():
            shot, fit, small = render(b, facts, c, base, s)
            if not shot:
                explain(f, fit, small)
            else:
                shots[s] = (shot, fit)
        b.close()
    if len(shots) != len(COVER_FILES):
        print('covers: none written. Every post needs every shape, so fix the facts and draw them again.')
        return False
    out.mkdir(parents=True, exist_ok=True)
    for s, f in COVER_FILES.items():
        shot, fit = shots[s]
        (out / f).write_bytes(shot)
        (out / (stems[s] + '.json')).write_text(json.dumps(receipt_record(facts, c, s, f, shot, fit), indent=1) + '\n', encoding='utf-8')
        print(f'{out / f}  {SHAPES[s]["w"]} x {SHAPES[s]["h"]}: headline {fit["head"]} px in {fit["lines"]} line(s), proof {fit["proof"][0]} x {fit["proof"][1]}')
    return True


def draw_thumbs(facts, base, out, thumb_facts, companies_of):
    """Both video thumbnails in the Receipt, under 2 MB, and thumbs.json. Both or neither."""
    out = Path(out)
    c = thumb_facts(facts)
    for n in list(THUMB_FILES.values()) + ['thumbs.json', 'thumbs-check.png']:
        (out / n).unlink(missing_ok=True)
    proof_of(c, facts, base)  # fetch and cut the proof before the drawing browser opens
    shots = {}
    with brand.playwright() as pw:
        b = brand.browser(pw)
        for s, f in THUMB_FILES.items():
            for q in (92, 88, 84, 80):
                shot, fit, small = render(b, facts, c, base, s, jpeg=q)
                if not shot or len(shot) <= 2 * 1024 * 1024:
                    break
            if not shot:
                explain(f, fit, small)
            else:
                shots[s] = (shot, fit, q)
        b.close()
    if len(shots) != len(THUMB_FILES):
        print('thumbnails: none written. A thumbnail for every video size, every time, so both or neither.')
        return False
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for s, f in THUMB_FILES.items():
        shot, fit, q = shots[s]
        (out / f).write_bytes(shot)
        files.append({'file': f, 'shape': s, 'width': SHAPES[s]['w'], 'height': SHAPES[s]['h'], 'bytes': len(shot),
                      'sha256': hashlib.sha256(shot).hexdigest(), 'headline_px': fit['head'], 'face_px': 0, 'jpeg_quality': q})
        print(f'{out / f}  {SHAPES[s]["w"]} x {SHAPES[s]["h"]}, {len(shot) / 1e3:.0f} KB: headline {fit["head"]} px in {fit["lines"]} line(s)')
    logos = [r.get('name', '') for r in [*c.get('rows', []), *c.get('strip', [])]]
    (out / 'thumbs.json').write_text(json.dumps({
        'schema_version': 1, 'drawer': 'scripts/pages/build.py --thumbs (receipt)', 'template': TEMPLATE, 'subchannel': facts['subchannel'],
        'headline': list(words_of(c, facts)), 'portrait': False, 'proof': {k: (c.get('proof') or {}).get(k) for k in ('image', 'pdf', 'page', 'html', 'source', 'tag', 'ring')},
        'logos': [n for n in logos if n], 'companies': companies_of([n for n in logos if n]), 'background': False,
        'files': files, 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }, indent=1) + '\n', encoding='utf-8')
    return True
