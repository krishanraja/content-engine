"""Cover skin selection and platform crop geometry."""
from __future__ import annotations

import datetime as dt
import importlib

ORDER = ('v5_feed',)
FIRST_WEEK = dt.date(2026, 11, 9)
# Every shape a series piece is drawn in wears the skin, so a series piece looks the same everywhere (Krish,
# 2026-11-05: "Skin the covers too"): the two video thumbnails the skins were made on, and the five cover shapes
# (receipt.COVER_FILES), each drawn on the closer of the two designs. The side layouts (the 3:2 cover, Substack's
# 1200 x 630 and the 1200 x 675 share card) take the wide thumbnail's design; the stacked ones (the square and the
# vertical cover) the tall's.
DESIGN = {'tall': 'tall', 'wide': 'wide', 'cover': 'wide', 'upload': 'wide', 'share': 'wide', 'square': 'tall', 'vertical': 'tall'}
SHAPES = tuple(DESIGN)
# What each shape's platforms do to it, for a skin's placement (handed to PLACE_JS beside the design): "grid" is the
# profile grid's middle 3:4 on the 9:16 shapes (y 240 to 1680), the part a grid tile shows, or None; "badge" a corner
# a platform lays its own mark over (YouTube's video length on the wide thumbnail), kept clean, or None. The
# thumbnails' own values are the numbers their skins were drawn to, so a thumbnail is drawn exactly as before.
GEO = {
    'tall': {'grid': [0, 240, 1080, 1680], 'badge': None},
    'wide': {'grid': None, 'badge': [968, 548, 1280, 720]},
    'vertical': {'grid': [0, 240, 1080, 1680], 'badge': None},
    'square': {'grid': None, 'badge': None},
    'cover': {'grid': None, 'badge': None},
    'upload': {'grid': None, 'badge': None},
    'share': {'grid': None, 'badge': None},
}


def geo(shape):
    """What a skin's placement is handed for this shape: its design ('tall' or 'wide'), the shape's own name, whether
    it is one of the two thumbnails the skins were drawn on ('thumb'), and its grid and badge (GEO)."""
    return {'shape': shape, 'design': DESIGN[shape], 'thumb': shape in ('tall', 'wide'), **GEO[shape]}

# After the skin has placed its decorations: any .deco on the words, and any .deco that carries words.
CHECK_JS = r"""() => {
  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const kept = ['.wmp', 'h1', '.logos', '.pill', '.tag'].flatMap(q => [...document.querySelectorAll(q)]);
  const decos = [...document.querySelectorAll('.deco')];
  // An svg's className is not a string, so every name is read from its class attribute.
  const name = e => e.getAttribute('class') || e.tagName.toLowerCase();
  const over = [];
  for (const d of decos) { const r = d.getBoundingClientRect();
    for (const k of kept) if (hits(r, k.getBoundingClientRect())) over.push(name(d) + ' on ' + name(k)); }
  const worded = decos.filter(d => (d.textContent || '').trim()).map(d => name(d) + ': ' + d.textContent.trim().slice(0, 40));
  return {over, worded, decos: decos.length};
}"""


def week_of(facts):
    """The Monday of the piece's week, from its publishing date. A series piece with no date is refused: the
    week's skin is told from the date alone, never from the day it happens to be drawn."""
    import brand
    when = facts.get('date')
    if not when:
        brand.fail('a series piece needs its "date" to tell its week\'s skin (or name one with "skin" in its cover facts)')
    try:
        day = dt.date.fromisoformat(str(when)[:10])
    except ValueError:
        brand.fail(f'the publishing date {when!r} is not YYYY-MM-DD, so its week\'s series skin cannot be told')
    return day - dt.timedelta(days=day.weekday())


def pick(facts, look):
    named = facts.get('skin', 'v5_feed')
    if named not in ORDER:
        import brand
        brand.fail(f'cover skin {named!r} is unavailable under v5')
    return named


def load(skin_id):
    """The skin's module (skins/<id>.py)."""
    if skin_id not in ORDER:
        import brand
        brand.fail(f'there is no series skin {skin_id!r}: the skins are {", ".join(ORDER)}')
    return importlib.import_module(f'{__name__}.{skin_id}')


def kit_for(skin_id, shape, size, look):
    """The kit for one drawing: the house helpers, and this shape's size, its design (DESIGN) and whether that is the
    tall one, and the series day."""
    from ._kit import DAY_OF, Kit
    kit = Kit()
    kit.design = DESIGN.get(shape, 'tall' if shape != 'wide' else 'wide')
    kit.tall = kit.design == 'tall'
    kit.shape = shape
    kit.W, kit.H = size
    kit.day = DAY_OF.get(look.get('owner') or '', 'off')
    kit.concept = skin_id
    return kit


def for_shape(facts, look, shape):
    """The skin this shape wears before any is tried (receipt.settle moves a piece on when its skin cannot be drawn):
    the week's or the named one (pick) on a shape the skins are drawn on (SHAPES), else None."""
    return pick(facts, look) if shape in SHAPES else None
