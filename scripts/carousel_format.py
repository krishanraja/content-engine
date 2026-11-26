#!/usr/bin/env python3
"""The 3-second carousel format, enforced: refusals that fail the run, never warnings.

Krish, 26 Nov 2026 (relayed verbatim by the rebrand session): "Tell the Content-engine story intelligence for
makeyourmindup v5 session that it is to enforce carousel formatting." Production sessions do not "just randomly go off
piste": the format is a floor, and a session is creative only above it. The rules are rows in
config/carousel-format.json, from the locked v5 Library's CAROUSEL-FORMAT.md, TITLES.md and library.json.

A deck (schema carousel-deck/3) is the carousel as the Library will draw it, written before anything is drawn:

  {"schema": "carousel-deck/3", "piece": "docs/plans/<day>", "set": "piece",
   "slides": [
     {"template": "carousel-cover", "made_by": "make_covers.py", "title_shape": "who_did_what",
      "text": {"headline": {"words": "...", "px": 130}, "dek": {"words": "...", "px": 96}},
      "visual": {"kind": "photo", "share": 0.6}, "wordmark": "V4"},
     {"template": "carousel-chart",
      "text": {"glance": {"words": "...", "px": 96, "slot": "headline_1"}, "source": {"words": "...", "px": 34}},
      "visual": {"kind": "number", "share": 0.55}},
     ...,
     {"template": "carousel-close", "text": {"takeaway": {"words": "...", "px": 90, "lines": 2},
      "site": {"words": "makeyourmindup.ai", "px": 34}}, "payoff": "the words set in mint", "wordmark": "S3h"}]}

A text element's size is its "px" or, when the Library is on this checkout, its slot's min_size_px (the smallest the
renderer may set it). Its slot is "slot", or the role's slot in config library_slots.

    python3 scripts/carousel_format.py DECK.json     exit 0 the deck may be made, 1 with every reason
    python3 scripts/carousel_format.py --library     the config rows against library.json (exit 1 when they disagree)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORMAT = ROOT / 'config' / 'carousel-format.json'
SCHEMA = 'carousel-deck/3'


def rules(path: Path | str = FORMAT) -> dict:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def library_path(fmt: dict | None = None, root: Path | str = ROOT) -> Path:
    fmt = fmt or rules()
    return Path(root) / fmt['source']['registry']


def library(fmt: dict | None = None, root: Path | str = ROOT) -> dict | None:
    """library.json when the v5 Library is on this checkout, else None."""
    p = library_path(fmt, root)
    return json.loads(p.read_text(encoding='utf-8')) if p.is_file() else None


def library_note(lib: dict | None, fmt: dict | None = None) -> str:
    fmt = fmt or rules()
    if lib is None:
        return f'checked against config/carousel-format.json only: {fmt["absent"]} (no {fmt["source"]["registry"]})'
    return f'checked against config/carousel-format.json and {fmt["source"]["registry"]} (the stricter of the two)'


def absent_refusal(fmt: dict | None = None, root: Path | str = ROOT) -> str | None:
    """None when both Library commands are on the checkout, else the refusal in the config's own words."""
    fmt = fmt or rules()
    for argv in (fmt['route']['covers'], fmt['route']['carousel']):
        script = argv[1]
        if not (Path(root) / script).is_file():
            return f'{fmt["absent"]}: ' + fmt['absent_detail'].format(script=script)
    return None


def words(text) -> list[str]:
    return re.findall(r"[A-Za-z0-9£$€][A-Za-z0-9'’,.%+×£$€/-]*", str(text or ''))


def _items(lib: dict | None) -> dict:
    return {i.get('id'): i for i in (lib or {}).get('items') or [] if isinstance(i, dict)}


def _slot(lib_items: dict, template: str, slot: str | None) -> dict:
    if not slot:
        return {}
    s = ((lib_items.get(template) or {}).get('slots') or {}).get(slot)
    return s if isinstance(s, dict) else {}


def sets_of(fmt: dict, lib: dict | None) -> dict:
    return (lib or {}).get('carousel_sets') or fmt['sets']


def _never(fmt: dict, text: str) -> list[str]:
    out = []
    low = text.lower()
    for row in fmt['never']:
        pat = row['pattern']
        hit = pat in text if row.get('literal') else re.search(r'(?<![a-z0-9])' + re.escape(pat) + r'(?![a-z0-9])', low)
        if hit:
            out.append(f'"{pat}": {row["why"]}')
    return out


def deck_problems(deck: dict, fmt: dict | None = None, lib: dict | None = None) -> list[str]:
    """Why the deck breaks the format, [] when it holds. `lib` is library.json (None before the Library lands)."""
    fmt = fmt or rules()
    out: list[str] = []
    if not isinstance(deck, dict) or deck.get('schema') != SCHEMA:
        return [f'not a {SCHEMA} deck: every carousel is written as the v5 Library will draw it (config/carousel-format.json)']
    sets = sets_of(fmt, lib)
    name = deck.get('set')
    if name not in sets:
        return [f'set "{name}" is not a Library carousel set ({", ".join(sets)}): a carousel is made only by '
                'make_piece.py --set <set>']
    if not str(deck.get('piece') or '').strip():
        out.append('the deck names its piece ("piece": the piece folder make_piece.py and make_covers.py read)')
    the_set = sets[name]
    slides = deck.get('slides')
    if not isinstance(slides, list) or not all(isinstance(s, dict) for s in slides):
        return out + ['"slides" is the list of slides, cover first']
    n = len(slides)
    S = fmt['slides']
    if not S['min'] <= n <= S['max']:
        out.append(f'{n} slides: a carousel is {S["min"]} to {S["max"]} (the cover, {S["inside_min"]} to {S["inside_max"]} '
                   'inside, the close)')
    want = fmt.get('set_slides', {}).get(name)
    if want and n != want:
        out.append(f'{n} slides: the {name} carousel is {want} ({fmt.get("set_slides_why", "")})')
    if n < 2:
        return out
    cover, inside, close = slides[0], slides[1:-1], slides[-1]
    # The registry's set order: the cover, the inside list repeated whole, the close.
    if cover.get('template') != the_set['cover']:
        out.append(f'slide 1 is {cover.get("template")}; the {name} set opens on {the_set["cover"]}')
    if close.get('template') != the_set['close']:
        out.append(f'slide {n} is {close.get("template")}; the {name} set closes on {the_set["close"]}')
    cycle = list(the_set['inside'])
    got = [s.get('template') for s in inside]
    if not cycle or len(got) % len(cycle) or got != cycle * (len(got) // len(cycle)) or not got:
        out.append(f'the inside slides are {", ".join(map(str, got)) or "none"}; the {name} set runs '
                   f'{", ".join(cycle)} in that order (repeated whole), never another template or order')
    if not S['inside_min'] <= len(inside) <= S['inside_max']:
        out.append(f'{len(inside)} inside slides: {S["inside_min"]} to {S["inside_max"]}')
    if name == 'good-news' and len(inside) != fmt['good_news']['items']:
        out.append(f'{len(inside)} good-news items: the roundup carries {fmt["good_news"]["items"]} '
                   f'({fmt["good_news"]["why"]})')
    if cover.get('made_by') != fmt['route']['first_slide_from']:
        out.append(f'slide 1 comes from {fmt["route"]["first_slide_from"]} ("made_by"), never another renderer')
    items = _items(lib)
    for i, s in enumerate(slides, 1):
        out += _text_problems(fmt, items, lib is not None, i, s, 'cover' if i == 1 else 'close' if i == n else 'inside')
    out += _cover_problems(fmt, items, cover)
    total = 0
    for i, s in enumerate(inside, 2):
        found, count = _inside_problems(fmt, items, i, s, name)
        out += found
        total += count
    if total > fmt['inside']['inside_words_max']:
        out.append(f'{total} words across the inside slides: at most {fmt["inside"]["inside_words_max"]}')
    if inside:
        g = str(((inside[0].get('text') or {}).get('glance') or {}).get('words') or '').strip().lower()
        for opener in fmt['slide_two']['vague_openers']:
            if g == opener or g.startswith(opener + ' ') or g.startswith(opener + "'") or g.startswith(opener + '’'):
                out.append(f'slide 2 opens on "{opener}": it stands alone, naming its subject ({fmt["slide_two"]["why"]})')
                break
    out += _close_problems(fmt, items, n, close)
    return out


def _elements(slide: dict) -> dict:
    t = slide.get('text')
    return {k: v for k, v in t.items()} if isinstance(t, dict) else {}


def _text_problems(fmt, items, have_lib, i, slide, part) -> list[str]:
    out = []
    spec = fmt[part]
    text = _elements(slide)
    if not isinstance(slide.get('text'), dict):
        return [f'slide {i}: "text" holds its words by role ({", ".join(spec["roles"])})']
    for role in spec['required']:
        if not str((text.get(role) or {}).get('words') or '').strip():
            out.append(f'slide {i}: no {role}; the {part} carries one')
    for role, el in text.items():
        if role not in spec['roles']:
            out.append(f'slide {i}: "{role}" is not a {part} role ({", ".join(spec["roles"])}): nothing else goes on it')
            continue
        if not isinstance(el, dict):
            out.append(f'slide {i}: {role} is {{"words", "px"}}')
            continue
        said = str(el.get('words') or '')
        out += [f'slide {i}: {role} says {x}' for x in _never(fmt, said)]
        slot_name = el.get('slot') or (fmt['library_slots'].get(role) or {}).get(slide.get('template'))
        slot = _slot(items, slide.get('template'), slot_name)
        px = el.get('px')
        if px is None:
            px = slot.get('min_size_px')
        if not isinstance(px, (int, float)) or isinstance(px, bool):
            out.append(f'slide {i}: {role} has no size ("px"); '
                       + ('its slot gives none either' if have_lib else f'{fmt["absent"]}, so give its px'))
        elif px < fmt['type_floor_px']:
            out.append(f'slide {i}: {role} is set at {px} px; nothing goes below {fmt["type_floor_px"]} px anywhere')
        chars = slot.get('max_chars')
        if isinstance(chars, int) and len(said) > chars:
            out.append(f'slide {i}: {role} is {len(said)} characters; its Library slot {slot_name} holds {chars}')
        lines = slot.get('max_lines')
        if isinstance(lines, int) and isinstance(el.get('lines'), int) and el['lines'] > lines:
            out.append(f'slide {i}: {role} runs {el["lines"]} lines; its Library slot {slot_name} holds {lines}')
    return out


def _size(el: dict, slot: dict):
    px = el.get('px')
    return slot.get('min_size_px') if px is None else px


def _cover_problems(fmt, items, cover) -> list[str]:
    C = fmt['cover']
    out = []
    head = ((cover.get('text') or {}).get('headline') or {}) if isinstance(cover.get('text'), dict) else {}
    said = str(head.get('words') or '').strip()
    if said:
        w, c = len(words(said)), len(said)
        if w > C['headline_words_max']:
            out.append(f'slide 1: the cover headline has {w} words; at most {C["headline_words_max"]}')
        if c > C['headline_chars_max']:
            out.append(f'slide 1: the cover headline is {c} characters; at most {C["headline_chars_max"]}')
        slot = _slot(items, cover.get('template'), head.get('slot') or fmt['library_slots']['headline'].get(cover.get('template')))
        px = _size(head, slot)
        if isinstance(px, (int, float)) and px < C['headline_px_min']:
            out.append(f'slide 1: the cover headline is {px} px; at least {C["headline_px_min"]} px at {fmt["width_px"]} wide')
    dek = ((cover.get('text') or {}).get('dek') or {}) if isinstance(cover.get('text'), dict) else {}
    if len(words(dek.get('words'))) > C['dek_words_max']:
        out.append(f'slide 1: the dek has {len(words(dek.get("words")))} words; at most {C["dek_words_max"]}, one line')
    if cover.get('title_shape') not in C['title_shapes']:
        out.append(f'slide 1: the headline is in one of his title shapes (TITLES.md; "title_shape": '
                   f'{", ".join(C["title_shapes"])})')
    if not isinstance(cover.get('visual'), dict) or not str(cover['visual'].get('kind') or '').strip():
        out.append('slide 1: one dominant hero visual ("visual": {"kind", "share"})')
    if cover.get('visuals', 1) != C['visuals']:
        out.append(f'slide 1: {cover.get("visuals")} visuals; the cover is one hero visual plus the wordmark')
    if cover.get('wordmark') != C['wordmark']:
        out.append(f'slide 1: the cover carries the {C["wordmark"]} wordmark ("wordmark")')
    return out


def _inside_problems(fmt, items, i, slide, set_name) -> tuple[list[str], int]:
    I = fmt['inside']
    out = []
    text = _elements(slide)
    count = sum(len(words((text.get(r) or {}).get('words'))) for r in I['counted'] if isinstance(text.get(r), dict))
    glance = text.get('glance') if isinstance(text.get('glance'), dict) else {}
    g = str(glance.get('words') or '').strip()
    if g:
        if len(words(g)) > I['glance_words_max']:
            out.append(f'slide {i}: the glance line has {len(words(g))} words; at most {I["glance_words_max"]}, and it '
                       'carries the slide alone')
        slot = _slot(items, slide.get('template'), glance.get('slot') or fmt['library_slots']['glance'].get(slide.get('template')))
        px = _size(glance, slot)
        if isinstance(px, (int, float)) and px < I['glance_px_min']:
            out.append(f'slide {i}: the glance line is {px} px; at least {I["glance_px_min"]} px')
    if count > I['slide_words_max']:
        out.append(f'slide {i}: {count} words on the slide; at most {I["slide_words_max"]} (glance, support, labels and '
                   'prompt; the counter, the source and the site do not count)')
    if slide.get('template') not in I['question_templates']:
        for r in I['counted']:
            if '?' in str((text.get(r) or {}).get('words') or '') if isinstance(text.get(r), dict) else False:
                out.append(f'slide {i}: the {r} asks a question; every inside slide is a statement (the question '
                           'lives on the cover or in the caption)')
                break
    visual = slide.get('visual')
    share = visual.get('share') if isinstance(visual, dict) else None
    if not isinstance(visual, dict) or not str(visual.get('kind') or '').strip():
        out.append(f'slide {i}: one dominant visual ("visual": {{"kind", "share"}})')
    elif not isinstance(share, (int, float)) or share < I['visual_share_min']:
        out.append(f'slide {i}: the visual fills {share} of the slide; at least {I["visual_share_min"]}')
    if slide.get('visuals', 1) != I['visuals']:
        out.append(f'slide {i}: {slide.get("visuals")} visuals; one dominant visual a slide')
    if set_name == 'how-to':
        H = fmt['how_to']
        if isinstance(visual, dict) and visual.get('kind') != H['visual_kind']:
            out.append(f'slide {i}: a how-to step shows the real {H["visual_kind"]} as its dominant visual')
        if isinstance(slide.get('steps'), list) and len(slide['steps']) > 1:
            out.append(f'slide {i}: {len(slide["steps"])} steps on one slide; one step a slide')
        prompt = (text.get('prompt') or {}).get('words') if isinstance(text.get('prompt'), dict) else None
        if len(words(prompt)) > H['prompt_words_max']:
            out.append(f'slide {i}: the overlay prompt has {len(words(prompt))} words; at most {H["prompt_words_max"]} '
                       '(a longer prompt shows typed in the screenshot and goes in the caption)')
    return out, count


def _close_problems(fmt, items, n, close) -> list[str]:
    C = fmt['close']
    out = []
    text = _elements(close)
    take = text.get('takeaway') if isinstance(text.get('takeaway'), dict) else {}
    said = str(take.get('words') or '').strip()
    if said:
        if len(said) > C['takeaway_chars_max']:
            out.append(f'slide {n}: the takeaway is {len(said)} characters; at most {C["takeaway_chars_max"]}')
        if len(words(said)) > C['takeaway_words_max']:
            out.append(f'slide {n}: the takeaway has {len(words(said))} words; at most {C["takeaway_words_max"]}')
        lines = take.get('lines')
        if not isinstance(lines, int) or isinstance(lines, bool) or not 1 <= lines <= C['takeaway_lines_max']:
            out.append(f'slide {n}: the takeaway runs {lines} lines ("lines"); at most {C["takeaway_lines_max"]}')
        payoff = str(close.get('payoff') or '').strip()
        if not payoff or payoff.lower() not in said.lower():
            out.append(f'slide {n}: the takeaway names its payoff, the words set in {C["payoff_colour"]} ("payoff", '
                       'words of the takeaway)')
    else:
        out.append(f'slide {n}: the close is the takeaway; a carousel with no takeaway close is refused')
    site = str((text.get('site') or {}).get('words') or '').strip() if isinstance(text.get('site'), dict) else ''
    if site and site.lower() != C['site']:
        out.append(f'slide {n}: the site is {C["site"]}')
    if close.get('wordmark') != C['wordmark']:
        out.append(f'slide {n}: the close carries the {C["wordmark"]} wordmark ("wordmark")')
    return out


def drawn_problems(paths: list, fmt: dict | None = None, deck: dict | None = None) -> list[str]:
    """The drawn slides: 4 to 7 of them, as many as the deck has."""
    fmt = fmt or rules()
    S = fmt['slides']
    out = []
    if not S['min'] <= len(paths) <= S['max']:
        out.append(f'{len(paths)} slides drawn: a carousel is {S["min"]} to {S["max"]}')
    if isinstance(deck, dict) and isinstance(deck.get('slides'), list) and len(deck['slides']) != len(paths):
        out.append(f'{len(paths)} slides drawn for a deck of {len(deck["slides"])}')
    return out


# Role -> the config numbers a Library slot must not loosen.
def library_disagreements(fmt: dict | None = None, lib: dict | None = None) -> list[str]:
    """Where library.json and config/carousel-format.json disagree: a set that differs, a mapped slot that allows more
    characters or a smaller size than the rows, or any text slot of a set template that may go below the floor."""
    fmt = fmt or rules()
    if lib is None:
        return []
    out = []
    lib_sets = lib.get('carousel_sets') or {}
    if lib_sets != fmt['sets']:
        out.append(f'carousel_sets differ: library.json has {json.dumps(lib_sets, sort_keys=True)}, config/carousel-format.json '
                   f'sets {json.dumps(fmt["sets"], sort_keys=True)}')
    items = _items(lib)
    limits = {'headline': (fmt['cover']['headline_chars_max'], fmt['cover']['headline_px_min']),
              'glance': (None, fmt['inside']['glance_px_min']),
              'takeaway': (fmt['close']['takeaway_chars_max'], None)}
    for role, by_template in fmt['library_slots'].items():
        if role.startswith('_'):
            continue
        chars_max, px_min = limits[role]
        for template, slot_name in by_template.items():
            if template not in items:
                out.append(f'{template}: not a Library item (config library_slots.{role})')
                continue
            slot = _slot(items, template, slot_name)
            if not slot:
                out.append(f'{template}.{slot_name}: not a slot of that template (config library_slots.{role})')
                continue
            if chars_max is not None and isinstance(slot.get('max_chars'), int) and slot['max_chars'] > chars_max:
                out.append(f'{template}.{slot_name} ({role}) holds {slot["max_chars"]} characters; the format allows {chars_max}')
            if role == 'takeaway' and isinstance(slot.get('max_lines'), int) and slot['max_lines'] > fmt['close']['takeaway_lines_max']:
                out.append(f'{template}.{slot_name} (takeaway) runs {slot["max_lines"]} lines; the format allows '
                           f'{fmt["close"]["takeaway_lines_max"]}')
            if px_min is not None and isinstance(slot.get('min_size_px'), (int, float)) and slot['min_size_px'] < px_min:
                out.append(f'{template}.{slot_name} ({role}) may shrink to {slot["min_size_px"]} px; the format floor is {px_min} px')
    seen = set()
    for s in lib_sets.values():
        for template in [s.get('cover'), *(s.get('inside') or []), s.get('close')]:
            if template in seen:
                continue
            seen.add(template)
            for slot_name, slot in ((items.get(template) or {}).get('slots') or {}).items():
                px = slot.get('min_size_px') if isinstance(slot, dict) else None
                if isinstance(px, (int, float)) and px < fmt['type_floor_px']:
                    out.append(f'{template}.{slot_name} may shrink to {px} px; nothing goes below {fmt["type_floor_px"]} px')
    return out


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    fmt = rules()
    lib = library(fmt)
    if argv[:1] == ['--library']:
        if lib is None:
            print(f'carousel_format: {library_note(None, fmt)}; nothing to compare yet')
            return 0
        bad = library_disagreements(fmt, lib)
        for b in bad:
            print(f'carousel_format: DISAGREE {b}')
        print('carousel_format: the config rows and library.json agree' if not bad else f'{len(bad)} disagreement(s)')
        return 1 if bad else 0
    if len(argv) != 1:
        print(__doc__)
        return 2
    deck = json.loads(Path(argv[0]).read_text(encoding='utf-8'))
    found = deck_problems(deck, fmt, lib)
    for p in found:
        print(f'carousel_format: REFUSED {p}')
    print(f'carousel_format: {library_note(lib, fmt)}')
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main())
