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

A weekly series piece wears the week's series skin over this in every shape, its covers as its video thumbnails
(skins/__init__.py: one of nine, one per week in rotation, or the one its facts name in "skin"; Krish, 2026-11-05:
"keep all of them and rotate them all at will over the coming weeks", and of the covers the same day, "Skin the
covers too"), so a series piece looks the same everywhere. When its skin cannot be drawn on one of its shapes without
touching the words or the logos, the whole piece moves on to the next skin in the rotation that draws on every shape,
and says why (settle; Krish, 2026-11-05: "Yeah just move on automatically"); when none of the nine can, it wears the
plain series Receipt and says so. Anything else wears none and is drawn exactly as above.
"""
import datetime as dt
import hashlib
import html
import json
import sys
from pathlib import Path

import brand
import card
import skins

SAGE = '#B9D3C3'
GROUND_STOPS = ('#D6E6DB', '#B9D3C3', '#8FB3A0')
GROUND = 'radial-gradient(circle at 30% 38%, {0} 0, {1} 55%, {2} 100%)'


def ground(look):
    """The house sage ground (brand.series_look decides the colours on it)."""
    return GROUND.format(*GROUND_STOPS), GROUND_STOPS[1]
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
       font-size: var(--fine); line-height: 1.15; letter-spacing: .03em; text-transform: uppercase; background: var(--tag-bg); color: var(--tag-fg); padding: .28em .5em; max-width: 100%; }
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

# Where everything stands, held to the shape: every part inside the safe box (cut), none in a zone the platform
# covers (hit), and the proof at its floor (small_proof). The fit runs it at every size it tries, and a series
# skin's placement runs it again after it has moved things (RECHECK_JS).
PLACED_JS = r"""
  const inBox = (r, b) => r.left >= b[0] - .5 && r.top >= b[1] - .5 && r.right <= b[2] + .5 && r.bottom <= b[3] + .5;
  const hits = (r, b) => r.left < b[2] && r.right > b[0] && r.top < b[3] && r.bottom > b[1];
  const placed = (safe, clear, proofMin) => {
    const parts = ['.wmp', 'h1', '.logos', '.pill', '.tag', '.ring'].flatMap(q => [...document.querySelectorAll(q)]);
    const cut = parts.filter(e => !inBox(e.getBoundingClientRect(), safe)).map(e => e.className || e.tagName);
    const hit = parts.filter(e => clear.some(c => hits(e.getBoundingClientRect(), c[1]))).map(e => e.className || e.tagName);
    const img = document.querySelector('.frame img').getBoundingClientRect();
    return {cut, hit, proof: [Math.round(img.width), Math.round(img.height)], small_proof: img.width < proofMin * (safe[2] - safe[0])};
  };
"""

# The largest headline that fits: its lines, no lone short word, everything inside the safe box and out of
# any clear zone, and the column not spilling. Returns what it settled on.
FIT_JS = r"""([heads, maxLines, loneMax, safe, clear, proofMin, proofWs]) => {
  const s = document.documentElement.style, h1 = document.querySelector('h1');""" + PLACED_JS + r"""
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
    const pinTag = document.querySelector('.pin .tag'), tag = pinTag ? pinTag.getBoundingClientRect().height + edge * 1.2 : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pin-reserve')) || 0);
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
    const {cut, hit, proof, small_proof} = placed(safe, clear, proofMin);
    // Nothing sits on the words (Krish, 2026-11-04: "Stuff can't just randomly overlap on titles like that"): any
    // decoration (.deco) that touches the headline, the wordmark, the logos, the pill or the tag refuses the shape.
    const kept = ['.wmp', 'h1', '.logos', '.pill', '.tag'].flatMap(q => [...document.querySelectorAll(q)]).map(e => e.getBoundingClientRect());
    const over = [...document.querySelectorAll('.deco')].filter(d => kept.some(w => hits(d.getBoundingClientRect(), [w.left, w.top, w.right, w.bottom]))).map(e => e.className);
    const main = document.querySelector('.main').getBoundingClientRect(), hb = h1.getBoundingClientRect(), fb = document.querySelector('.foot')?.getBoundingClientRect();
    const spill = hb.bottom > main.bottom + 1 || (fb && fb.bottom > main.bottom + 1) || h1.scrollWidth > h1.clientWidth + 1;
    last = {head, lines: lines.length, lone, cut, hit, over, spill, proof};
    last.small_proof = small_proof;
    last.ok = lines.length <= maxLines && !lone.length && !cut.length && !hit.length && !over.length && !spill && !last.small_proof;
    last.proofw = pw;
    if (last.ok) return last;
  }
  }
  return last;
}"""

# After a series skin has placed its decorations: the same safe box, clear zones and proof floor, measured again,
# since a placement may move the pin, the tag or the ring, or resize the proof.
RECHECK_JS = r"""([safe, clear, proofMin]) => {""" + PLACED_JS + r"""
  return placed(safe, clear, proofMin);
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


def page(facts, c, base, shape, skin=...):
    """One shape of the Receipt as a page, before fitting, in the week's series skin (skins.for_shape) or the one
    given (None for the plain Receipt)."""
    spec = SHAPES[shape]
    W, H = spec['w'], spec['h']
    hs = brand.house()
    t = hs['tokens']
    ch = brand.channel(hs, facts['subchannel'])
    look = brand.series_look(hs, facts['subchannel'], facts.get('date'), facts.get('carries'))
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
        '--ink': t['ink'], '--accent': look['colour'], '--cream': t['cream'],
        '--tag-bg': look['colour'] if look['series'] else t['ink'], '--tag-fg': t['ink'] if look['series'] else t['cream'],
        '--head': f'{spec["heads"][0]}px', '--fine': f'{fine_px + 2}px', '--wm': f'{round(min(W / 30, (r - l) / 26))}px',
        # "headline_first" (default true, docs/production/COVER-STANDARD.md) puts the logos under the headline, smaller, so the headline leads (Krish, 2026-11-09:
        # "The headline should take precedence").
        '--logo': f'{round(max(fine_px + 2, (r - l) / 24 * (.7 if c.get("headline_first", True) else 1)) * (1 if n_logos <= 3 else .78))}px', '--gap': f'{round(W / 40)}px', '--edge': f'{edge}px',
        '--proofw': spec.get('proofw', '58%') if side else '100%',
    }
    root = ';'.join(f'{k}:{v}' for k, v in vars_.items())
    head = (f'{esc(lead)} ' if lead else '') + f'<mark>{esc(last)}</mark>'
    # Only the subchannel's weekly piece names it: anything else sits under no series panel.
    pill = f'<div class="pill" data-fine-print>{esc(ch["name"])}</div>' if look['series'] else ''
    # "quiet_pill" (default true, the cover standard) keeps the series name at the phone floor but drops its capsule, ring and glow, so it reads as
    # a small label, not a second headline. Krish, 2026-11-09: "The \"Follow the Money\" badge doesn't need to be that big."
    quiet = ('<style>.pill{background:transparent!important;box-shadow:none!important;padding:0!important;'
             'color:var(--accent)!important;opacity:.9}</style>') if c.get('quiet_pill', True) else ''
    # With its tag off, a pinned proof keeps the room the tag gave it, so a skin's light round the frame clears the
    # headline above and the logos below.
    if pin_tag and not p.get('show_tag', False):
        quiet += f'<style>:root{{--pin-reserve:{edge * 10}px}}</style>'
    foot = f'<div class="foot"><div class="logos">{logos}</div></div>' if logos else ''
    # "show_tag" (default false, the cover standard: no badges on a cover) leaves the tag off the picture (it stays the picture's alt text and its record). Krish,
    # 2026-11-09: "We don't need the badge that says \"the court filing.\""
    tag = f'<div class="tag" data-fine-print>{esc(p["tag"])}</div>' if p.get('show_tag', False) else ''
    doc = f"""<!doctype html><html style="{root}"><head><meta charset="utf-8"><style>{brand.font_css()}
{CSS.replace('@SAGE@', body_ground).replace('@GROUND@', card_ground)}</style></head><body>
{quiet}<div id="card" class="{spec['layout']}" style="width:{W}px;height:{H}px">
 <div id="safe" style="left:{l}px;top:{tp}px;width:{r - l}px;height:{b - tp}px">
  <div class="top"><div class="wmp"><img src="{brand.data_uri(brand.fetch('wordmark'), 1400)}" alt="Make Your Mind Up"></div>{pill}</div>
  <div class="main">
   <div class="proof"><div class="pin">{tag if pin_tag else ''}<div class="frame"><img src="{brand.data_uri(p['path'], 2400)}" alt="{esc(p.get('alt') or p['tag'])}">{ring}</div></div></div>
   <div class="col">{('' if pin_tag else tag) + ('' if c.get('headline_first', True) else foot) if side else ''}<h1>{head}</h1>{foot if side and c.get('headline_first', True) else ''}</div>
   {'' if side else foot}
  </div>
 </div>
</div></body></html>"""
    # The series skin on a weekly series piece (skins.apply); anything else is the page as it is.
    return skins.apply(doc, facts, shape, (W, H), look, skin)[0]


def skin_of(facts, shape):
    """The series skin this shape wears before any is tried (skins.for_shape): the week's, or the one the facts name,
    on a weekly series piece; None on anything that is not a weekly series piece and on a piece dated before the
    rotation starts (skins.FIRST_WEEK) unless its facts name one. settle() moves the piece on from it when it cannot
    be drawn."""
    look = brand.series_look(brand.house(), facts['subchannel'], facts.get('date'), facts.get('carries'))
    return skins.for_shape(facts, look, shape)


def place_skin(pg, skin_id, shape, fit):
    """After the house fit: the skin places its decorations against the laid-out page (its PLACE_JS, run with the
    shape's design and geometry, skins.geo), then the shape is refused if any decoration touches the words or carries
    words (skins.CHECK_JS), if anything now falls outside the safe box or in a zone the platform covers, or the proof
    is under its floor (RECHECK_JS). A placement that fails outright refuses the shape too, in plain words (explain),
    never with a traceback."""
    from playwright.sync_api import Error as PlaywrightError
    module = skins.load(skin_id)
    fit = {**fit, 'skin': skin_id, 'fitted': fit['ok']}
    if getattr(module, 'PLACE_JS', None):
        try:
            pg.evaluate(module.PLACE_JS, [skins.DESIGN[shape], skins.geo(shape)])
        except PlaywrightError as e:
            return {**fit, 'ok': False, 'skin_error': str(e).strip().splitlines()[0]}
        card.settle(pg)
    found = pg.evaluate(skins.CHECK_JS)
    fit.update(skin_over=found['over'], worded=found['worded'])
    spec = SHAPES[shape]
    again = pg.evaluate(RECHECK_JS, [list(spec['safe']), spec.get('clear', []), PROOF_MIN.get(shape, PROOF_MIN[spec['layout']])])
    fit.update(cut=[*fit.get('cut', []), *(x for x in again['cut'] if x not in fit.get('cut', []))],
               hit=[*fit.get('hit', []), *(x for x in again['hit'] if x not in fit.get('hit', []))],
               small_proof=bool(fit.get('small_proof') or again['small_proof']), proof=again['proof'])
    if found['over'] or found['worded'] or again['cut'] or again['hit'] or again['small_proof']:
        fit['ok'] = False
    return fit


def render(b, facts, c, base, shape, jpeg=None, skin=...):
    """Draw one shape in an open browser, in the week's series skin (skin_of) or the one given (None for the plain
    Receipt). Returns (bytes or None, fit, small words)."""
    spec = SHAPES[shape]
    W, H = spec['w'], spec['h']
    skin_id = skin_of(facts, shape) if skin is ... else skin
    if skin_id and not (shape in skins.SHAPES and brand.series_look(brand.house(), facts['subchannel'], facts.get('date'), facts.get('carries'))['series']):
        skin_id = None
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.set_content(page(facts, c, base, shape, skin_id))
    card.settle(pg)
    fit = pg.evaluate(FIT_JS, [list(spec['heads']), spec['lines'], LONE_WORD_MAX, list(spec['safe']), spec.get('clear', []), PROOF_MIN.get(shape, PROOF_MIN[spec['layout']]),
                                  [spec.get('proofw', '58%'), '50%', '44%'] if spec['layout'] == 'side' else ['100%']])
    if skin_id:
        fit = place_skin(pg, skin_id, shape, fit)
    small = card.too_small(card.texts(pg, (0, 0, W, H)), W)
    shot = None
    if fit['ok'] and not small:
        clip = {'x': 0, 'y': 0, 'width': W, 'height': H}
        shot = pg.screenshot(type='jpeg', quality=jpeg, clip=clip) if jpeg else pg.screenshot(clip=clip)
    pg.close()
    return shot, fit, small


def explain(name, fit, small):
    print(f'{name}: not drawn.')
    if fit['lines'] and not fit.get('fitted'):  # the headline's own fit; when only the skin refused, its lines are fine
        print(f'  at the smallest headline tried ({fit["head"]} px) it takes {fit["lines"]} line(s)')
    if fit['lone']:
        print(f'  a short word sits alone on a line: {", ".join(fit["lone"])}. Reword or rebalance the "headline"')
    for what in fit['cut']:
        print(f'  {what} falls outside the safe box')
    for what in fit['hit']:
        print(f'  {what} reaches into a zone the platform covers')
    for what in fit.get('over', []):
        print(f'  a decoration ({what}) touches the words: nothing may sit on a title, the tag, the pill or a mark')
    for what in fit.get('skin_over', []):
        print(f'  the {fit["skin"]} series skin puts a decoration on the words ({what}): nothing may sit on a title, the tag, the pill or a mark')
    for what in fit.get('worded', []):
        print(f'  the {fit["skin"]} series skin puts words in a decoration ({what}): no stickers, badges or slogans')
    if fit.get('skin_error'):
        print(f'  the {fit["skin"]} series skin could not place its drawing on this piece ({fit["skin_error"]}): '
              'name another with "skin" in the cover facts')
    if fit['spill']:
        print('  the words do not fit their column: shorten the "headline"')
    if fit.get('small_proof'):
        print('  the proof is too small beside the words: shorten the "headline"')
    for w in small:
        print(f'  too small to read on a phone: {w["phone"]:.1f} px  "{card.short(w["text"])}"')


COVER_FILES = {'cover': 'cover.png', 'upload': 'cover-1200x630.png', 'share': 'cover-1200x675.png',
               'square': 'cover-1080x1080.png', 'vertical': 'cover-1080x1920.png'}
THUMB_FILES = {'wide': 'thumb-wide-1280x720.jpg', 'tall': 'thumb-tall-1080x1920.jpg'}
# Each shape by the name a person knows it by, for what the drawer says.
SHAPE_NAMES = {'cover': 'the 3:2 cover', 'upload': "Substack's 1200 x 630 cover", 'share': 'the 1200 x 675 share card',
               'square': 'the square cover', 'vertical': 'the vertical cover', 'wide': 'the wide thumbnail', 'tall': 'the tall thumbnail'}
# What a skin's decoration touched, by the class the check names it by (skins.CHECK_JS).
TOUCHED = {'h1': 'the words', 'logos': 'the logos', 'tag': 'the tag', 'pill': 'the pill', 'wmp': 'the wordmark'}
STEPS = {1: 'next', 2: 'two on', 3: 'three on', 4: 'four on', 5: 'five on', 6: 'six on', 7: 'seven on', 8: 'eight on'}


def refusal(fit, small):
    """Why a skin was refused on a shape, as what it could not be drawn without: "touching the logos"."""
    if fit.get('skin_error'):
        return f'its drawing failing to place ({fit["skin_error"]})'
    on = []
    for o in fit.get('skin_over') or []:
        what = TOUCHED.get(o.rsplit(' on ', 1)[-1].split()[0], 'the words')
        if what not in on:
            on.append(what)
    if fit.get('over') and 'the words' not in on:
        on.append('the words')
    if on:
        return 'touching ' + ' and '.join(on)
    if fit.get('worded'):
        return 'words in a decoration'
    if fit.get('cut'):
        return 'pushing ' + ', '.join(sorted(set(fit['cut']))) + ' out of the safe box'
    if fit.get('hit'):
        return 'pushing ' + ', '.join(sorted(set(fit['hit']))) + ' into a corner the platform covers'
    if fit.get('small_proof'):
        return 'shrinking the proof under its floor'
    if not fit.get('fitted', fit.get('ok')):
        return 'crowding the headline out of its lines'
    if small:
        return 'a word too small to read on a phone'
    return 'breaking the layout'


def settle(b, facts, base, cs, need):
    """The one skin a weekly series piece wears on every shape (cs: {shape: the facts it is drawn from}, every shape
    the piece is drawn in), tried in an open browser. The week's skin (or the one the facts name) first; when it cannot
    be drawn on any one shape without touching the words or the logos (or otherwise refused there), the whole piece
    moves on to the next skin in the rotation, wrapping round, until one draws on every shape (Krish, 2026-11-05:
    "Yeah just move on automatically"), so all its shapes wear the same skin. When none of the nine draws, it wears
    the plain series Receipt. Never stops: a shape the plain Receipt cannot draw either is the facts' own problem,
    left out of the trial for the drawer to explain.

    need: the shapes the caller writes; a piece that wears no skin is drawn in those alone.

    Returns {'skin', 'week' (the skin it was due to wear), 'named', 'tried' ([{'skin', 'shape', 'why'}] for each skin
    it moved on from), 'note' (what moved it on, in words, or None), 'shots' ({shape: (bytes, fit, small)} drawn in
    the skin it wears, or the plain Receipt's), 'unfit' ({shape: (fit, small)} the plain Receipt cannot draw)}."""
    look = brand.series_look(brand.house(), facts['subchannel'], facts.get('date'), facts.get('carries'))
    first = skins.pick(facts, look)   # an unknown "skin", or a series piece with no date, stops here
    named = facts.get('skin') is not None and first is not None
    plain, unfit = {}, {}

    def draw_plain(shape):
        if shape not in plain:
            plain[shape] = render(b, facts, cs[shape], base, shape, skin=None)
            if not plain[shape][0]:
                unfit[shape] = plain[shape][1:]
        return plain[shape]

    if not first:
        shots = {s: draw_plain(s) for s in need}
        return {'skin': None, 'week': None, 'named': False, 'tried': [], 'note': None,
                'shots': {s: v for s, v in shots.items() if v[0]}, 'unfit': unfit}
    i = skins.ORDER.index(first)
    tried = []
    for skin_id in skins.ORDER[i:] + skins.ORDER[:i]:
        shots, refused = {}, None
        for shape in cs:
            if shape in unfit:
                continue
            got = render(b, facts, cs[shape], base, shape, skin=skin_id)
            if got[0]:
                shots[shape] = got
                continue
            if not draw_plain(shape)[0]:
                continue   # the plain Receipt cannot draw it either: not the skin's doing
            refused = (shape, got)
            break
        if refused is None:
            return {'skin': skin_id, 'week': first, 'named': named, 'tried': tried, 'note': skin_note(first, named, tried, skin_id),
                    'shots': shots, 'unfit': unfit}
        shape, (_, fit, small) = refused
        tried.append({'skin': skin_id, 'shape': shape, 'why': refusal(fit, small)})
    shots = {s: draw_plain(s) for s in cs}
    return {'skin': None, 'week': first, 'named': named, 'tried': tried, 'note': skin_note(first, named, tried, None),
            'shots': {s: v for s, v in shots.items() if v[0]}, 'unfit': unfit}


def skin_note(first, named, tried, worn):
    """What moved a piece on from the skin it was due to wear, in words, or None when it wears that one:
    "neon could not be drawn on the square cover without touching the logos; wore sunburst, next in the rotation"."""
    if not tried:
        return None
    said = []
    for k, t in enumerate(tried):
        lead = f'the facts name {t["skin"]}, which' if named and k == 0 else t['skin']
        said.append(f'{lead} could not be drawn on {SHAPE_NAMES.get(t["shape"], t["shape"])} without {t["why"]}')
    if worn:
        return '; '.join(said) + f'; wore {worn}, {STEPS.get(len(tried), f"{len(tried)} on")} in the rotation'
    return ('none of the nine series skins could be drawn on every shape (' + '; '.join(said) +
            '); wore the plain series Receipt')


def skin_record(settled):
    """The skin fields of a cover's or the thumbnails' record."""
    return {'skin': settled['skin'], 'skin_week': settled['week'], 'skin_named': settled['named'],
            'skin_tried': settled['tried'], 'skin_note': settled['note']}


def every_shape(facts, thumb_facts):
    """{shape: the facts it is drawn from} for every shape of the piece: the covers from "cover", the thumbnails
    from thumb_facts (build.thumb_facts: "thumbs" over "cover")."""
    c = dict(facts.get('cover') or {})
    t = thumb_facts(facts)
    return {**{s: c for s in COVER_FILES}, **{s: t for s in THUMB_FILES}}


def receipt_record(facts, c, shape, name, data, fit, settled=None):
    p = c.get('proof') or {}
    return {
        'drawer': 'scripts/pages/build.py (receipt)', 'template': TEMPLATE, 'shape': shape, 'file': name,
        'width': SHAPES[shape]['w'], 'height': SHAPES[shape]['h'], 'sha256': hashlib.sha256(data).hexdigest(),
        'portrait': False, 'proof': {k: p.get(k) for k in ('image', 'pdf', 'page', 'html', 'source', 'tag', 'ring')},
        'series_look': brand.series_look(brand.house(), facts['subchannel'], facts.get('date'), facts.get('carries')),
        **(skin_record(settled) if settled else {'skin': skin_of(facts, shape)}),
        'rows': [r.get('name', '') for r in c.get('rows', [])], 'strip': [x.get('name', '') for x in c.get('strip', [])],
        'headline': list(words_of(c, facts)), 'headline_px': fit['head'], 'lines': fit['lines'],
        'safe': list(SHAPES[shape]['safe']), 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }


def say_skin(settled):
    """Print which skin the piece wears and, when it moved on, why."""
    if settled['note']:
        print(f'series skin: {settled["note"]}')
    elif settled['skin']:
        print(f'series skin: {settled["skin"]}')


def draw_covers(facts, base, out, thumb_facts):
    """Every cover shape in the Receipt. Writes all of them or none, each with its receipt json. A weekly series
    piece's covers wear the skin settle() finds for every shape of the piece, its thumbnails' included."""
    out = Path(out)
    cs = every_shape(facts, thumb_facts)
    c = cs['cover']
    skin_of(facts, 'cover')  # an unknown "skin", or a series piece with no date, stops here, before anything is removed
    stems = {s: f.rsplit('.', 1)[0] for s, f in COVER_FILES.items()}
    for s, f in COVER_FILES.items():
        for n in (f, stems[s] + '.json', stems[s] + '-crops.png'):
            (out / n).unlink(missing_ok=True)
    proof_of(c, facts, base)  # fetch and cut the proof before the drawing browser opens
    if skin_of(facts, 'cover'):
        proof_of(cs['tall'], facts, base)   # and the thumbnails', which the skin is tried on too
    with brand.playwright() as pw:
        b = brand.browser(pw)
        settled = settle(b, facts, base, cs, tuple(COVER_FILES))
        b.close()
    say_skin(settled)
    shots = {}
    for s, f in COVER_FILES.items():
        if s in settled['unfit']:
            explain(f, *settled['unfit'][s])
        else:
            shot, fit, _ = settled['shots'][s]
            shots[s] = (shot, fit)
    if len(shots) != len(COVER_FILES):
        print('covers: none written. Every post needs every shape, so fix the facts and draw them again.')
        return False
    out.mkdir(parents=True, exist_ok=True)
    for s, f in COVER_FILES.items():
        shot, fit = shots[s]
        (out / f).write_bytes(shot)
        (out / (stems[s] + '.json')).write_text(json.dumps(receipt_record(facts, c, s, f, shot, fit, settled), indent=1) + '\n', encoding='utf-8')
        print(f'{out / f}  {SHAPES[s]["w"]} x {SHAPES[s]["h"]}: headline {fit["head"]} px in {fit["lines"]} line(s), proof {fit["proof"][0]} x {fit["proof"][1]}')
    return True


def draw_thumbs(facts, base, out, thumb_facts, companies_of):
    """Both video thumbnails in the Receipt, under 2 MB, and thumbs.json. Both or neither. A weekly series piece's
    thumbnails wear the skin settle() finds for every shape of the piece, its covers' included."""
    out = Path(out)
    cs = every_shape(facts, thumb_facts)
    c = cs['tall']
    skin_of(facts, 'tall')  # an unknown "skin", or a series piece with no date, stops here, before anything is removed
    for n in list(THUMB_FILES.values()) + ['thumbs.json', 'thumbs-check.png']:
        (out / n).unlink(missing_ok=True)
    proof_of(c, facts, base)  # fetch and cut the proof before the drawing browser opens
    if skin_of(facts, 'tall'):
        proof_of(cs['cover'], facts, base)   # and the covers', which the skin is tried on too
    shots = {}
    with brand.playwright() as pw:
        b = brand.browser(pw)
        settled = settle(b, facts, base, cs, tuple(THUMB_FILES))
        say_skin(settled)
        for s, f in THUMB_FILES.items():
            if s in settled['unfit']:
                explain(f, *settled['unfit'][s])
                continue
            for q in (92, 88, 84, 80):
                shot, fit, small = render(b, facts, c, base, s, jpeg=q, skin=settled['skin'])
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
        'series_look': brand.series_look(brand.house(), facts['subchannel'], facts.get('date'), facts.get('carries')), **skin_record(settled),
        'headline': list(words_of(c, facts)), 'portrait': False, 'proof': {k: (c.get('proof') or {}).get(k) for k in ('image', 'pdf', 'page', 'html', 'source', 'tag', 'ring')},
        'logos': [n for n in logos if n], 'companies': companies_of([n for n in logos if n]), 'background': False,
        'files': files, 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }, indent=1) + '\n', encoding='utf-8')
    return True
