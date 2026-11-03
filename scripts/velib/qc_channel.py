"""channel.safe_zones: ve's drawn boxes against every channel's own buttons (scripts/channel_safe.py).

Captions, the held title and each beat's slot boxes come from the renderer's own geometry (WordCaption.tsx and the
layouts table qc already parses), so the check measures what is drawn, not a copy of it.
"""
from __future__ import annotations

import sys

from .common import ROOT

sys.path.insert(0, str(ROOT / 'scripts'))
import channel_safe  # noqa: E402

WHOLE_STAGE = {'STAGE', 'SPLIT'}
# Measured and listed, never blocking, until card ve-motion-4-channel-safe-tall moves the tall layouts out of the
# zones: today the house caption region and the word caption sit in Instagram's handle zone, so blocking would hold
# every tall cut. Then this becomes a measured row that counts toward measured_pass.
ADVISORY = True


def drawn_boxes(pages, beats, aspect, region, style, layouts=None) -> list:
    from . import qc_faces
    boxes = []
    for page in pages or []:
        boxes.append((f"caption '{qc_faces.page_text(page)[:24]}'", qc_faces.caption_box(page, style, aspect, region)))
    if style == 'word':
        g = qc_faces.word_geometry(aspect)
        boxes.append(('held title', (80, g['titleTop'], g['width'] - 160, int(g['titleSize'] * 2.4))))
    if layouts is None:
        from .qc import _renderer_layouts
        layouts = _renderer_layouts()
    table = layouts.get(aspect, {})
    for beat in beats or []:
        if beat.get('layout') in WHOLE_STAGE:  # the stage is the canvas; its devices place themselves inside it
            continue
        slots = table.get(beat.get('layout'), [])
        for name, box in zip(beat.get('uses') or [], slots):
            boxes.append((f"{beat.get('id', 'beat')}:{name}", tuple(box)))
    return boxes


def safe_zones(pages, beats, aspect, region, style='house', layouts=None) -> dict:
    target = 'no caption, title or device box under a channel button (config/channel-safe-zones.json)'
    if aspect != '9:16':
        return {'value': None, 'target': target, 'pass': None, 'status': 'not applicable'}
    hits = channel_safe.box_violations(drawn_boxes(pages, beats, aspect, region, style, layouts), 'tall')
    row = {'value': {'under_buttons': hits[:20], 'count': len(hits)}, 'target': target, 'pass': not hits}
    if ADVISORY:
        row['status'] = 'advisory'
    return row
