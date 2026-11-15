#!/usr/bin/env python3
"""The carousel's pictures, measured: a cover that looks like a front cover, and body cards that use the page centrally
with real visual effort (Ruling, Krish, 2026-11-15).

Krish, 15 Nov 2026, on the "AI is catching decades-old mistakes" carousel: "the front cover card does not look like a
front cover. It looks like all the rest of the cards. ... That and the other cards in this carousel don't look very
good and aren't using the page space centrally or correctly. They look too bland and too plain, and not enough effort
has been put into the visual treatment."

Run through the deck check: python3 scripts/carousel_check.py --cards card-1.png ... card-n.png (in order, the cover
first). Exit 1 with every reason. The bars live in config/carousel-layout.json; the safe box is the brand palette's
(config/brand-palette.json safe.feed_canvas and feed_margin_px), never a copy. Measured on the finished 1080x1350 PNGs:

  The cover (C)
    C1  its headline cap height is at least 1.3 times the median body card's headline (decades 14 Nov: 1.03, fails;
        the Git deck of 13 Nov: 1.46).
    C2  it differs from the body cards in at least two of three: headline scale (C1), where the headline block sits
        (moved by at least 10% of the height), and how much of the card is picture (full bleed against not).
  Every card after the cover (L)
    L1  no type outside the safe box (80 px in from every edge); a picture may bleed.
    L2  no empty band taller than 12% of the height inside the safe box (the Git body cards: up to 26%).
    L3  at most 35% of the rows inside the safe box empty (the Git body cards: 34 to 60%).
    L4  every line of type centred: its centre within 24 px of the middle (the Git cards: up to 408 px left).
    L5  a visual anchor of meaningful size: picture (neither ground nor type) on at least 12% of the card (the Git body
        cards: 1 to 9%).
    L6  body type no smaller than the house mobile floor: 14 CSS px on a 390 px phone, a line of type at least 35 px
        of ink on the 1080 px card (decades 14 Nov: about 32 px).

Proxies, never approval: a deck that passes still needs the look at full size and at phone size, and the reviewer.
Standard library plus Pillow and NumPy (requirements-ci.txt).
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BARS = ROOT / 'config' / 'carousel-layout.json'
PALETTE = ROOT / 'config' / 'brand-palette.json'


def bars() -> dict:
    return json.loads(BARS.read_text(encoding='utf-8'))


def safe_box() -> tuple[int, int, int, int]:
    safe = json.loads(PALETTE.read_text(encoding='utf-8'))['safe']
    w, h = safe['feed_canvas']
    m = safe['feed_margin_px']
    return (m, m, w - m, h - m)


def _runs(flags, gap: int):
    out, start, last = [], None, None
    for i, on in enumerate(flags):
        if on:
            if start is None:
                start = i
            elif i - last > gap + 1:
                out.append((start, last))
                start = i
            last = i
    if start is not None:
        out.append((start, last))
    return out


def measure(path: str | Path, b: dict | None = None) -> dict:
    """One card's numbers: its ground, type lines, empty bands, picture share."""
    import numpy as np
    from PIL import Image
    b = b or bars()
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    sx0, sy0, sx1, sy1 = safe_box()
    sx0, sx1 = round(sx0 * w / 1080), round(sx1 * w / 1080)
    sy0, sy1 = round(sy0 * h / 1350), round(sy1 * h / 1350)
    # The ground is the card's modal colour along its border, so a light or coloured ground is read as fairly as ink.
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    q = (border // 16).astype(np.int32)
    keys = q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2]
    mode = np.bincount(keys).argmax()
    ground = border[keys == mode].mean(0)
    off = np.abs(a - ground).sum(-1) > b['ground_tolerance']
    # Type: the house's type colours (cream or white, mint, the series colours), set in character-sized runs.
    mn, mx = a.min(-1), a.max(-1)
    light = (mn > 170) & ((mx - mn) < 60)
    house = np.zeros((h, w), bool)
    for hexc in b['type_colours']:
        c = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)])
        house |= np.abs(a - c).sum(-1) < 90
    # A glyph sits against a darker ground within a few pixels; a bright sky or a lit wall in a photograph does not.
    lum = a.mean(-1)
    dark = np.pad((lum < b['type_dark_below']).astype(np.int32), ((0, 0), (1, 0))).cumsum(1)
    r = b['type_edge_px']
    idx = np.arange(w)
    near = (dark[:, np.minimum(idx + r + 1, w)] - dark[:, np.maximum(idx - r, 0)]) > 0
    tmask = (light | house) & near
    trans = (np.diff(tmask.astype(np.int8), axis=1) == 1).sum(1)
    text_rows = (trans >= b['type_row_transitions']) & (tmask.sum(1) > 8)
    lines = []
    for s, e in _runs(text_rows, 3):
        cols = np.where(tmask[s:e + 1].any(0))[0]
        if not len(cols) or e - s + 1 < b['line_min_px']:
            continue
        x0, x1 = int(cols.min()), int(cols.max())
        # Set type fills a fair share of its own box and changes many times a row; an edge-to-edge band or a sparse
        # scatter of highlights is picture.
        density = float(tmask[s:e + 1, x0:x1 + 1].mean())
        if x1 - x0 > w - 2 * b['type_edge_px'] - 40 or not b['type_density'][0] <= density <= b['type_density'][1] \
                or float(trans[s:e + 1].mean()) < b['type_row_transitions'] * 1.5:
            continue
        mark = s >= h * b['mark_zone'][1] and x0 >= w * b['mark_zone'][0]
        lines.append({'y': [int(s), int(e)], 'x': [x0, x1], 'height': int(e - s + 1),
                      'centre_offset': round((x0 + x1) / 2 - w / 2), 'mark': bool(mark)})
    story = [ln for ln in lines if not ln['mark']]
    heads = [ln['height'] for ln in story if ln['height'] >= b['headline_min_px']]
    body = [ln['height'] for ln in story if b['body']['body_min_ink_px'] // 2 <= ln['height'] < b['headline_min_px']]
    rows_in = off[sy0:sy1, sx0:sx1].sum(1) <= 3
    tallest = max((e - s + 1 for s, e in _runs(rows_in, 0)), default=0)
    type_rows = np.zeros(h, bool)
    for ln in lines:
        type_rows[ln['y'][0]:ln['y'][1] + 1] = True
    picture = off & ~tmask
    picture[type_rows, :] = False
    return {
        'size': [int(w), int(h)],
        'lines': lines,
        'headline_px': max(heads) if heads else 0,
        'headline_top': min((ln['y'][0] for ln in story if ln['height'] >= b['headline_min_px']), default=None),
        'smallest_body_ink_px': min(body) if body else None,
        'tallest_empty_band_pct': round(tallest / h * 100, 1),
        'empty_rows_pct': round(float(rows_in.mean()) * 100, 1),
        'picture_pct': round(float(picture.mean()) * 100, 1),
        'off_ground_pct': round(float(off.mean()) * 100, 1),
        'type_outside_safe': [ln for ln in story + [ln for ln in lines if ln['mark']]
                              if ln['x'][0] < sx0 or ln['x'][1] > sx1 or ln['y'][0] < sy0 or ln['y'][1] > sy1],
    }


def problems(paths: list, b: dict | None = None) -> tuple[list[str], list[dict]]:
    b = b or bars()
    if len(paths) < 2:
        return ['a deck needs a cover and at least one card after it'], []
    cards = [measure(p, b) for p in paths]
    out: list[str] = []
    cover, rest = cards[0], cards[1:]
    body_heads = sorted(c['headline_px'] for c in rest if c['headline_px'])
    median = body_heads[len(body_heads) // 2] if body_heads else 0
    ratio = round(cover['headline_px'] / median, 2) if median else None
    scale = ratio is not None and ratio >= b['cover']['headline_ratio']
    if not scale:
        out.append(f'card 1: the cover headline is {ratio}x the body headlines (at least {b["cover"]["headline_ratio"]}x): '
                   'a front cover is unmistakably bigger than the cards after it')
    tops = [c['headline_top'] for c in rest if c['headline_top'] is not None]
    moved = cover['headline_top'] is not None and tops and all(
        abs(cover['headline_top'] - t) >= b['cover']['headline_moved_pct'] / 100 * cover['size'][1] for t in tops)
    bleed = all(abs(cover['off_ground_pct'] - c['off_ground_pct']) >= b['cover']['bleed_differs_pct'] for c in rest)
    differs = sum(bool(x) for x in (scale, moved, bleed))
    if differs < b['cover']['differs_in']:
        out.append(f'card 1: the cover differs from the body cards in {differs} of 3 (scale, where the headline sits, how '
                   f'much is picture); at least {b["cover"]["differs_in"]}: it looks like the rest of the cards')
    L = b['body']
    for n, c in enumerate(rest, 2):
        for ln in c['type_outside_safe'][:2]:
            out.append(f'card {n}: type at x {ln["x"][0]} to {ln["x"][1]}, y {ln["y"][0]} to {ln["y"][1]} is outside the '
                       'safe box (80 px in from every edge)')
        if c['tallest_empty_band_pct'] > L['empty_band_max_pct']:
            out.append(f'card {n}: an empty band of {c["tallest_empty_band_pct"]}% of the height (at most '
                       f'{L["empty_band_max_pct"]}%): the page is not used')
        if c['empty_rows_pct'] > L['empty_rows_max_pct']:
            out.append(f'card {n}: {c["empty_rows_pct"]}% of the rows in the safe box are empty (at most '
                       f'{L["empty_rows_max_pct"]}%)')
        off = [ln['centre_offset'] for ln in c['lines'] if not ln['mark'] and abs(ln['centre_offset']) > L['centre_px']]
        if off:
            worst = max(off, key=abs)
            out.append(f'card {n}: {len(off)} line(s) of type off centre, the worst by {worst} px (within '
                       f'{L["centre_px"]} px): set the story centrally')
        if c['picture_pct'] < L['picture_min_pct']:
            out.append(f'card {n}: picture on {c["picture_pct"]}% of the card (at least {L["picture_min_pct"]}%): too '
                       'bland and plain, give it a visual anchor of real size')
        if c['smallest_body_ink_px'] is not None and c['smallest_body_ink_px'] < L['body_min_ink_px']:
            out.append(f'card {n}: body type {c["smallest_body_ink_px"]} px of ink (at least {L["body_min_ink_px"]}, the '
                       'house mobile floor of 14 CSS px on a 390 px phone)')
    return out, cards
