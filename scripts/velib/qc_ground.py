"""No bare ground at a handover: the frames around each beat edge always carry something drawn.

From keyframes@0.2.13 (docs/ve/sources/keyframes.md; _corpus/keyframes-full-visual.md section 3.4): "a scene hands over
only in a silence between sentences, as one move, and the ground is never bare". Bare means the stage band holds
almost no picture: its grey levels barely vary (an empty ground, a fade through flat colour). Captions and corner
chrome sit outside the band measured, so a caption over an empty stage still reads as bare.
"""
from __future__ import annotations

import numpy as np

from .qc import gray_frames, measurement

STD_FLOOR = 3.0   # grey levels: a flat ground with grain or a soft gradient stays under this; any drawn object is over it
WINDOW = 3        # frames each side of the edge


def stage_band(aspect: str) -> tuple[int, int, int, int]:
    """The stage: the frame without its top 15% (header, title) and bottom 25% (captions, channel buttons)."""
    width, height = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    top, bottom = round(height * 0.15), round(height * 0.75)
    return 0, top, width, bottom - top


def bare_ground(render, beats, aspect: str, *, window: int = WINDOW, floor: float = STD_FLOOR,
                total_frames: int | None = None) -> dict:
    """One row per beat edge: the least-busy frame within +/-window frames, and whether it is over the floor."""
    band = stage_band(aspect)
    edges = sorted({int(b['fromFrame']) for b in beats or [] if int(b['fromFrame']) > 0})
    rows = []
    for edge in edges:
        first = max(0, edge - window)
        last = edge + window if total_frames is None else min(total_frames - 1, edge + window)
        frames = gray_frames(render, first, last, band)
        spread = frames.reshape(len(frames), -1).std(axis=1)
        worst = int(np.argmin(spread))
        rows.append({'edge_frame': edge, 'barest_frame': first + worst, 'stage_std': round(float(spread[worst]), 2),
                     'floor': floor, 'pass': bool(spread[worst] > floor)})
    report = measurement(rows, f'every frame within {window} of a beat edge has stage spread > {floor} grey levels')
    if not rows:
        report.update(value=[], reason='no beat edges to check')
        report['pass'] = True
    return report
