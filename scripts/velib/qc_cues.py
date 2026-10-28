"""Event timing from frame-difference peaks inside resolved object slot boxes."""
from __future__ import annotations

import numpy as np

from .qc import gray_frames, measurement

FLOOR = 1e-6  # Existing absolute change threshold, in mean grey levels.


def cue_sync(render, events, slots) -> dict:
    """Slots map event.obj (or event.slot) to a pixel box, optionally under box.

    Frames stay on the original engine clock. Flat slots fail as unmeasurable;
    equal peaks choose the one nearest the expected event time.
    """
    rows = []
    for index, event in enumerate(events):
        at = int(event['atFrame'])
        key = event.get('slot', event.get('obj'))
        slot = slots[event['id']] if event.get('id') in slots else slots[key]
        box = slot.get('box', slot) if isinstance(slot, dict) else slot
        first, last = max(1, at - 15), at + 6
        frames = gray_frames(render, first - 1, last, box)
        changes = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
        baseline = changes[:max(0, at - first)]
        threshold = max(FLOOR, 3 * float(np.median(baseline))) if len(baseline) else FLOOR
        search = changes[max(0, at - 6 - first):]
        search_first = max(first, at - 6)
        maximum = float(search.max())
        candidates = np.flatnonzero(np.isclose(search, maximum, rtol=1e-6, atol=1e-6)) + search_first
        peak = int(min(candidates, key=lambda f: abs(int(f) - at)))
        lag = peak - at
        local = changes[max(0, at - 2 - first):at + 2 - first + 1]
        difference = float(local.max())
        rows.append({'event': event.get('id', index), 'atFrame': at, 'peak_frame': peak,
                     'lag_frames': lag, 'peak_difference': maximum, 'event_difference': difference,
                     'threshold': threshold, 'pass': difference > threshold})
    report = measurement(rows, 'change within +/-2 frames > max(FLOOR, 3x median of previous 15 frames)')
    if not rows:
        report['reason'] = 'no cues to check'
    return report
