#!/usr/bin/env python3
"""card: check that artwork made from HTML can be read on a phone, before it
becomes a PNG.

    python card.py ARTWORK.html [--out OUTDIR] [--size 1360x1000]

Substack keeps an image inside a post whole and shrinks it to the column: on a
phone the column is about 358 CSS pixels wide, so a 1360-wide image shows at
about a quarter of its size. This draws the artwork at its own size, reads the
font size of every word you can see on it, works out how big that word comes
out on a phone, and fails when a word a reader needs is under 14 pixels there,
or fine print (anything inside an element marked `data-fine-print`, such as
sources) is under 11. It lists every word that is too small.

Writes into OUTDIR (default: .cache/cards/ in the repository, which git
ignores):

  NAME.png        the artwork at its own size, ready for the page facts.
                  Only when every word can be read on a phone.
  NAME-phone.png  the artwork as a phone shows it, 358 pixels wide

The artwork's size is, in order: --size, a <meta name="artwork-size"
content="1360x1000"> in the file, or the size of its element with id "card".

It is a tool of its own, apart from build.py, because it checks one piece of
artwork before there is a piece to build: build.py works on a whole piece and
only ever sees finished PNGs, whose words cannot be measured.
"""
import argparse
import base64
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402

# Measured on 2026-10-05 from article 1 as Substack published it (walk log
# F64). Substack serves a post's images to phones at w_424,c_limit, and on a
# phone the column is about 358 CSS pixels wide. On the article's three
# explainer images, 1360 wide, body text set at 28 to 30 px came out at about
# 7.5 to 8 CSS pixels there: the headlines could be read, the labels, table
# text and sources could not. These are the floors set after that measurement.
PHONE_COLUMN = 358  # CSS pixels: how wide a phone shows an image inside a post
MIN_READ_PX = 14    # CSS pixels on a phone: the smallest a word a reader needs may be
MIN_FINE_PX = 11    # CSS pixels on a phone: the smallest fine print (data-fine-print) may be

# Every word drawn on the page, with its size once transforms and an SVG's
# own scaling are counted. Words from ::before and ::after count too.
TEXTS_JS = r"""([x0, y0, x1, y1]) => {
  const scaleOf = (el) => {
    if (el instanceof SVGElement && el.getScreenCTM && el.getScreenCTM()) {
      const m = el.getScreenCTM();
      return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    }
    let s = 1;
    for (let e = el; e; e = e.parentElement) {
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t); s *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
    }
    return s;
  };
  const shown = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true });
  const onCard = (r) => r.width > 0 && r.height > 0 && r.right > x0 && r.left < x1 && r.bottom > y0 && r.top < y1;
  const found = new Map();
  const add = (key, el, text, size) => {
    const had = found.get(key);
    if (had) { had.text += ' ' + text; return; }
    found.set(key, { text, px: size * scaleOf(el), fine: !!el.closest('[data-fine-print]') });
  };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = n.nodeValue.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!text || !el || el.closest('script, style, noscript, template, title') || !shown(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    if (![...range.getClientRects()].some(onCard)) continue;
    add(el, el, text, parseFloat(getComputedStyle(el).fontSize));
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!shown(el) || !onCard(el.getBoundingClientRect())) continue;
    for (const which of ['::before', '::after']) {
      const cs = getComputedStyle(el, which);
      const m = /^"(.*)"$/s.exec(cs.content || '');
      if (m && m[1].trim() && cs.display !== 'none') add(el.tagName + which + found.size, el, m[1].trim(), parseFloat(cs.fontSize));
    }
  }
  return [...found.values()];
}"""

# Every element inside `selector`, and every run of words (which can spill out
# of its element), with the box it takes on the page.
BOXES_JS = r"""(selector) => {
  const root = document.querySelector(selector);
  if (!root) return [];
  const words = (t) => t.replace(/\s+/g, ' ').trim();
  const out = [];
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const text = words(el.innerText ?? el.textContent);
    const what = el.tagName === 'IMG' ? `the image "${el.alt}"` : text ? `"${text}"` : `a ${el.tagName.toLowerCase()} box`;
    out.push({ what, box: [r.left, r.top, r.right, r.bottom] });
  }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!words(n.nodeValue)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width && r.height) out.push({ what: `"${words(n.nodeValue)}"`, box: [r.left, r.top, r.right, r.bottom] });
  }
  return out;
}"""

# Every run of words that the card's edge, or a box that hides what spills out
# of it (overflow hidden), cuts through. Krish, 2026-10-07, of a source line
# cut off at the bottom of the Higgsfield picture "Who keeps what": "stuff like
# this can't happen - why do we not check basic things like this?"
CUT_JS = r"""([x0, y0, x1, y1]) => {
  const words = (t) => t.replace(/\s+/g, ' ').trim();
  const inside = (r, a) => r.left >= a[0] - .5 && r.top >= a[1] - .5 && r.right <= a[2] + .5 && r.bottom <= a[3] + .5;
  const cut = new Map();
  // The words that belong to the artwork: everything inside #card when there
  // is one, else the whole page. A word wholly outside the card is lost too.
  const root = document.getElementById('card') || document.body;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = words(n.nodeValue);
    const el = n.parentElement;
    if (!text || !el || el.closest('script, style, noscript, template, title')) continue;
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (!r.width || !r.height) continue;
      let clip = [x0, y0, x1, y1];
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const b = a.getBoundingClientRect();
          clip = [Math.max(clip[0], b.left), Math.max(clip[1], b.top), Math.min(clip[2], b.right), Math.min(clip[3], b.bottom)];
        }
      }
      if (!inside(r, clip)) cut.set(text, true);
    }
  }
  return [...cut.keys()];
}"""

SIZE_JS = r"""() => {
  const meta = document.querySelector('meta[name="artwork-size"]');
  if (meta) return meta.content;
  const card = document.getElementById('card');
  if (card) { const r = card.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }
  return null;
}"""


def settle(pg):
    """Wait for the fonts, then a moment for layout."""
    pg.evaluate('document.fonts.ready.then(() => true)')
    pg.wait_for_timeout(300)


def texts(pg, box):
    """Every visible run of words inside box (left, top, right, bottom), as
    {text, px, fine}: px is the size it is drawn at on the artwork."""
    return pg.evaluate(TEXTS_JS, list(box))


def boxes(pg, selector):
    """Every element and run of words inside selector, as {what, box}."""
    return pg.evaluate(BOXES_JS, selector)


def outside(found, safe):
    """The boxes that are not wholly inside safe (left, top, right, bottom),
    one per thing named. Half a pixel is allowed for rounding."""
    l, t, r, b = safe
    bad = {}
    for x in found:
        x0, y0, x1, y1 = x['box']
        if x0 < l - .5 or y0 < t - .5 or x1 > r + .5 or y1 > b + .5:
            had = bad.get(x['what'])
            bad[x['what']] = [min(had[0], x0), min(had[1], y0), max(had[2], x1), max(had[3], y1)] if had else [x0, y0, x1, y1]
    return [{'what': k, 'box': v} for k, v in bad.items()]


def on_phone(px, width):
    """How big a size on the artwork comes out on a phone. Substack never
    makes an image bigger than it is, so a narrow one keeps its own size."""
    return px * min(1.0, PHONE_COLUMN / width)


def too_small(found, width):
    """The words that come out under the floor on a phone, smallest first."""
    bad = []
    for t in found:
        need = MIN_FINE_PX if t['fine'] else MIN_READ_PX
        phone = on_phone(t['px'], width)
        if round(phone, 2) < need:
            bad.append(dict(t, phone=phone, need=need))
    return sorted(bad, key=lambda t: t['phone'])


def needed(width):
    """The sizes to draw at on an artwork this wide: (words, fine print)."""
    k = min(1.0, PHONE_COLUMN / width)
    return math.ceil(MIN_READ_PX / k), math.ceil(MIN_FINE_PX / k)


def short(text, n=70):
    return text if len(text) <= n else text[:n - 1].rstrip() + '…'


def phone_preview(b, png, width):
    """The artwork the size a phone shows it, in a phone's 390-pixel screen."""
    shown = min(PHONE_COLUMN, width)
    pg = b.new_page(viewport={'width': PHONE_COLUMN + 32, 'height': 100})
    pg.set_content('<body style="margin:0;padding:16px;background:#fff"><img style="display:block;width:'
                   f'{shown}px" src="data:image/png;base64,{base64.b64encode(png).decode()}"></body>')
    shot = pg.screenshot(full_page=True)
    pg.close()
    return shot


def declared_size(pg, override):
    raw = override or pg.evaluate(SIZE_JS)
    m = re.fullmatch(r'\s*(\d+)\s*[xX×]\s*(\d+)\s*', raw or '')
    if not m:
        brand.fail('say how big the artwork is: <meta name="artwork-size" content="1360x1000"> in the file, '
                   'an element with id="card", or --size 1360x1000')
    return int(m.group(1)), int(m.group(2))


def report(name, width, height, found):
    """Print what a phone does to the artwork's words. True when every word
    can be read."""
    bad = too_small(found, width)
    k = min(1.0, PHONE_COLUMN / width)
    print(f'phone check: {name}')
    print(f'  drawn at {width} x {height}; a phone shows it {min(PHONE_COLUMN, width)} px wide, so every size comes out '
          + (f'at {k:.2f} times what it is drawn at' if k < 1 else 'as drawn'))
    print(f'  {len(found)} run(s) of words: {len(found) - len(bad)} big enough, {len(bad)} too small')
    if bad:
        print(f'  too small to read on a phone (words need {MIN_READ_PX} px there, fine print {MIN_FINE_PX} px):')
        for t in bad:
            kind = 'fine print, ' if t['fine'] else ''
            print(f'    {t["phone"]:4.1f} px  ({kind}drawn at {t["px"]:.0f} px)  "{short(t["text"])}"')
        words, fine = needed(width)
        print(f'  to fix: on this {width}-wide artwork draw words at {words} px or more and fine print at {fine} px or more, '
              'or take the words out of the picture and put them in the article')
        print('  result: too small to read on a phone')
    else:
        print('  result: every word can be read on a phone')
    return not bad


def main():
    ap = argparse.ArgumentParser(description='Check that artwork made from HTML can be read on a phone, and draw it as a PNG.')
    ap.add_argument('html', help='the artwork, an HTML file')
    ap.add_argument('--out', help='output folder (default: .cache/cards/ in the repository, which git ignores)')
    ap.add_argument('--size', help='WIDTHxHEIGHT, if the file does not say how big it is')
    a = ap.parse_args()
    src = Path(a.html).resolve()
    if not src.exists():
        brand.fail(f'artwork not found: {src}')
    out = Path(a.out) if a.out else brand.ROOT / '.cache' / 'cards'
    out.mkdir(parents=True, exist_ok=True)
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': 1600, 'height': 1200})
        pg.goto(src.as_uri())
        settle(pg)
        w, h = declared_size(pg, a.size)
        at = pg.evaluate("() => { const c = document.getElementById('card'); if (!c) return [0, 0]; const r = c.getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY]; }")
        x, y = round(at[0]), round(at[1])
        pg.set_viewport_size({'width': x + w, 'height': y + h})
        settle(pg)
        found = texts(pg, (x, y, x + w, y + h))
        cut = pg.evaluate(CUT_JS, [x, y, x + w, y + h])
        png = pg.screenshot(clip={'x': x, 'y': y, 'width': w, 'height': h})
        phone = phone_preview(b, png, w)
        b.close()
    ok = report(src.name, w, h, found)
    if cut:
        print('  cut off by an edge (the card, or a box that hides what spills out of it):')
        for text in cut:
            print(f'    "{short(text)}"')
        print('  to fix: make the card taller, or the words fewer or smaller, so every word sits inside it')
        print('  result: words are cut off')
        ok = False
    (out / f'{src.stem}-phone.png').write_bytes(phone)
    print(f'  {out / f"{src.stem}-phone.png"}  how a phone shows it')
    if ok:
        (out / f'{src.stem}.png').write_bytes(png)
        print(f'  {out / f"{src.stem}.png"}  the artwork, ready for the page facts')
    else:
        (out / f'{src.stem}.png').unlink(missing_ok=True)
        print(f'  {src.stem}.png was not written: make the words bigger, or fewer, and run this again')
        sys.exit(1)


if __name__ == '__main__':
    main()
