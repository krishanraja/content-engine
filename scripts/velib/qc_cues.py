"""Event timing from frame-difference peaks inside resolved object slot boxes."""
from __future__ import annotations

import numpy as np

from .qc import gray_frames, measurement


def cue_sync(render, events, slots) -> dict:
    """Slots map event.obj (or event.slot) to a pixel box, optionally under box.

    Frames stay on the original engine clock. Flat slots fail as unmeasurable;
    equal peaks choose the one nearest the expected event time.
    """
    rows = []
    for index, event in enumerate(events):
        at = int(event['atFrame'])
        key = event.get('slot', event.get('obj'))
        slot = slots[key]
        box = slot.get('box', slot) if isinstance(slot, dict) else slot
        first, last = max(1, at - 6), at + 6
        frames = gray_frames(render, first - 1, last, box)
        changes = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
        maximum = float(changes.max())
        candidates = np.flatnonzero(np.isclose(changes, maximum, rtol=1e-6, atol=1e-6)) + first
        peak = int(min(candidates, key=lambda f: abs(int(f) - at)))
        lag = peak - at
        rows.append({'event': event.get('id', index), 'atFrame': at, 'peak_frame': peak,
                     'lag_frames': lag, 'peak_difference': maximum, 'pass': maximum > 1e-6 and abs(lag) <= 2})
    report = measurement(rows, 'frame-difference peak within +/-2 frames (search +/-6)')
    if not rows:
        report['pass'] = True
    return report
