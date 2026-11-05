"""The nine series skins: one per week, in rotation, on the week's three series covers and thumbnails.

Krish, 5 November 2026, of the finished skins: "keep all of them and rotate them all at will over the coming
weeks"; asked how, he chose one skin per week, rotating by itself. So the week's follow.the.money (Monday),
under.the.hood (Wednesday) and mind.the.gap (Friday) pieces all wear the same skin, each in its own series colour,
the skin moves on to the next one every Monday through all nine (ORDER), and a piece can name another with "skin"
in its facts. Anything that is not a weekly series piece (brand.series_look) wears no skin at all.

A skin is a module here defining
    skin(html, facts, shape, look, kit) -> html
over the Receipt page as receipt.page draws it (the house sage ground, the series colour on the highlight and the
pill). Every element it adds that is decoration carries the class "deco", and it may define PLACE_JS, a JS arrow
function the drawer runs with [shape] after the house fit, to place its decorations against the laid-out page.
receipt.render then refuses the shape if any decoration touches the headline, the tag, the pill, the wordmark plate
or the logos, or carries words (CHECK_JS: Krish, 2026-11-04, "Stuff can't just randomly overlap on titles like
that", and no stickers, badges or slogans), if anything has left the safe box or a platform's clear zone or the proof
is under its floor (receipt.RECHECK_JS), or if the placement fails (in plain words, never a traceback). A placement
measures the logo plate as it measures the headline and the tag, and keeps its drawing off it: a real series piece
carries logo rows whenever it names a company. The kit is _kit.Kit.
"""
from __future__ import annotations

import datetime as dt
import importlib

# The rotation: the week of Monday 9 November 2026 wears neon, the week of 16 November sunburst, and so on.
ORDER = ('neon', 'sunburst', 'painted_scene', 'series_worlds', 'bauhaus', 'papercut', 'extruded', 'brandbook', 'memphis')
FIRST_WEEK = dt.date(2026, 11, 9)
# The shapes the skins were made, reviewed and checked on: the two video thumbnails. On the five cover shapes
# (receipt.COVER_FILES) they were tried on 5 November 2026 and do not hold: bauhaus and brandbook put a decoration on
# the headline, a placement fails outright when handed the wide design, and the rest lose their device on the side
# layouts. Those covers keep the series colour on the house sage, and their records say "skin": null, until a skin is
# drawn for them.
SHAPES = ('tall', 'wide')

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
    """The skin a cover wears: None unless it is a weekly series piece (look['series']); the one its facts name
    ("skin"), which must be one of ORDER; otherwise the week's own, ORDER[weeks % 9], weeks counted in whole weeks
    from Monday 9 November 2026 to the Monday of the piece's date, so Monday, Wednesday and Friday share one.
    A piece dated before the week of 9 November wears none unless its facts name one: the rotation starts there,
    and whether the earlier weeks wear a skin is Krish's call, never the modulo's."""
    if not look.get('series'):
        return None
    named = facts.get('skin')
    if named is not None:
        if named not in ORDER:
            import brand
            brand.fail(f'"skin" is {named!r}, which is not one of the series skins: {", ".join(ORDER)}')
        return named
    week = week_of(facts)
    if week < FIRST_WEEK:
        return None
    return ORDER[(week - FIRST_WEEK).days // 7 % len(ORDER)]


def load(skin_id):
    """The skin's module (skins/<id>.py)."""
    if skin_id not in ORDER:
        import brand
        brand.fail(f'there is no series skin {skin_id!r}: the skins are {", ".join(ORDER)}')
    return importlib.import_module(f'{__name__}.{skin_id}')


def kit_for(skin_id, shape, size, look):
    """The kit for one drawing: the house helpers, and this shape's size, whether it is tall, and the series day."""
    from ._kit import DAY_OF, Kit
    kit = Kit()
    kit.tall = shape != 'wide'
    kit.W, kit.H = size
    kit.day = DAY_OF.get(look.get('owner') or '', 'off')
    kit.concept = skin_id
    return kit


def for_shape(facts, look, shape):
    """The skin this shape wears: the week's (pick) on a shape the skins are made for (SHAPES), else None."""
    return pick(facts, look) if shape in SHAPES else None


def apply(html, facts, shape, size, look):
    """(the page with the week's skin on it, the skin's id), or (the page unchanged, None) when it wears none."""
    skin_id = for_shape(facts, look, shape)
    if not skin_id:
        return html, None
    return load(skin_id).skin(html, facts, shape, look, kit_for(skin_id, shape, size, look)), skin_id
