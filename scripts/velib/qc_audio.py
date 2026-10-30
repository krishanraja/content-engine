"""Bed check from the premix's own measurements (`<stem>.bed.json`, written by velib.audio.premix).

The stem is already summed, so the music cannot be separated from the voice at QC time. The premix measures the
bed against the voice from the separate stems; this row reads those numbers (and the stem it sits beside, by hash
of nothing: the numbers are relative and the sidecar carries the mode) and judges them. Missing numbers are
not_run, never a pass."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .lint import LONG_CUT_S
from .qc import measurement

# Krish, 28 Oct 2026: "ensure the background music is present and well treated".
SPEECH_RANGE = (-21.0, -12.0)   # dB re the voice, music under speech
PAUSE_RANGE = (-13.0, -6.0)     # dB re the voice, music in real pauses (ducked mode)
MIN_BREATH_DB = 4.0             # pause level above speech level (ducked mode)
MIN_PRESENT_DB = -30.0          # a bed quieter than this under speech or in pauses is not music
MAX_TP = -1.0
# The episode bed, metered by ffmpeg's EBU R128 meter on the music stem the premix keeps, and on the render.
# Krish, Gate 2, 2026-10-30: "Sometimes it just turns off randomly. Sometimes it's quiet. Sometimes it gets louder."
LEVEL_TOLERANCE_LU = 1.5        # median short-term level of the bed in the body, re the ledger's bed_lufs
MAX_SPREAD_LU = 4.0             # short-term (3 s) p95 - p5 of the bed in the body, outside lift windows
MAX_SWING_LU, SWING_HOLD_S = 3.0, 1.0   # no stretch of a second or more this far from the bed's median
RENDER_FLOOR_BELOW_DB = 18.0    # the render's 50 ms RMS this far under bed_lufs is a stretch with no music
DEFAULT_FLOOR_DBFS = -50.0      # the render floor when the sidecar names no bed level


def sidecar_for(stem: str) -> Path:
    return Path(stem).with_suffix('.bed.json')


def bed(stem: str, mode: str | None = None, sidecar: str | None = None) -> dict:
    path = Path(sidecar) if sidecar else sidecar_for(stem)
    if not path.is_file():
        return {'value': None, 'target': 'bed measured by the premix', 'pass': None, 'status': 'not_run',
                'reason': f'{path.name} is missing: re-run the premix'}
    data = json.loads(path.read_text(encoding='utf-8'))
    report = data.get('bed', {})
    speech, pause = report.get('bed_under_speech_db'), report.get('bed_in_pauses_db')
    ducked = report.get('mode') == 'ducked'
    rows = [
        {'check': 'bed present', 'value': report.get('bed_present'), 'pass': bool(report.get('bed_present'))
         and speech is not None and speech > MIN_PRESENT_DB and (report.get('bed_loud_windows_pct') or 0) >= 80},
        {'check': 'under speech', 'value': speech, 'target': f'{SPEECH_RANGE[0]} to {SPEECH_RANGE[1]} dB re voice',
         'pass': speech is not None and SPEECH_RANGE[0] <= speech <= SPEECH_RANGE[1]},
        {'check': 'true peak', 'value': data.get('true_peak_dbtp'), 'target': f'<= {MAX_TP} dBTP',
         'pass': data.get('true_peak_dbtp') is not None and data['true_peak_dbtp'] <= MAX_TP},
    ]
    # Krish, Gate 2, 2026-10-30, of both of Friday 23's ducked cuts: a bed that swings with the voice is refused,
    # and a long cut carries the episode bed, whatever the spec in hand says
    built = report.get('mode')
    long_cut = float(data.get('duration_s') or 0) > LONG_CUT_S
    rows.append({'check': 'a steady bed', 'value': built, 'target': 'episode_bed' + ('' if long_cut else ' or continuous'),
                 'pass': built == 'episode_bed' or (built == 'continuous' and not long_cut)})
    if mode is not None and mode != report.get('mode'):
        rows.append({'check': 'mode matches the spec', 'value': report.get('mode'), 'target': mode, 'pass': False})
    if report.get('mode') == 'episode_bed':
        rows += episode_rows(path, report)
    if ducked:
        rows += [
            {'check': 'in pauses', 'value': pause, 'target': f'{PAUSE_RANGE[0]} to {PAUSE_RANGE[1]} dB re voice',
             'pass': pause is not None and PAUSE_RANGE[0] <= pause <= PAUSE_RANGE[1]},
            {'check': 'the music breathes', 'value': report.get('duck_depth_db'), 'target': f'>= {MIN_BREATH_DB} dB',
             'pass': report.get('duck_depth_db') is not None and report['duck_depth_db'] >= MIN_BREATH_DB},
        ]
    return measurement(rows, 'bed present, under speech in range, true peak, (ducked) breathing in pauses, '
                             '(episode) one steady level with no drop-outs')


def _lift_skip(report: dict) -> list:
    from .audio import LIFT_FALL_S, LIFT_RISE_S
    return [(a - LIFT_RISE_S - 3.0, b + LIFT_FALL_S + 3.0) for a, b in report.get('lifts') or []]


def episode_rows(sidecar: Path, report: dict) -> list:
    """Level, steadiness and drop-outs of the episode bed alone, from the music stem the premix kept beside the
    stem (already at the master's gain). Level and steadiness on ffmpeg's EBU R128 short-term meter (3 s), so a lift
    window is left out with 3 s either side; drop-outs on 50 ms windows against the music's own running level, so a
    0.3 s stop is seen."""
    from .audio import _decode, ebur128, gaps
    music = sidecar.parent / str(report.get('music_stem') or '')
    target = report.get('levels', {}).get('bed_lufs')
    if not report.get('music_stem') or not music.is_file() or target is None:
        return [{'check': 'episode bed metered', 'value': None, 'pass': False,
                 'target': 'the music stem and bed_lufs beside the stem (re-run the premix)'}]
    start, end = report['body_s']
    skip = _lift_skip(report)
    meter = ebur128(str(music))
    short = np.array([v for t, v in meter['S'] if start + 3.0 <= t < end and not any(a <= t <= b for a, b in skip)])
    median = float(np.median(short)) if len(short) else None
    spread = float(np.percentile(short, 95) - np.percentile(short, 5)) if len(short) else None
    # the largest departure from the median held for SWING_HOLD_S: a swell too short for the percentiles to see
    hold = int(SWING_HOLD_S / 0.1)
    swing = None
    if len(short) >= hold:
        dev = np.abs(short - median)
        swing = float(np.lib.stride_tricks.sliding_window_view(dev, hold).min(axis=1).max())
    holes = gaps(_decode(str(music)), start_s=start, end_s=end)
    return [
        {'check': 'bed level in the master', 'value': None if median is None else round(median, 1),
         'target': f'{target} ±{LEVEL_TOLERANCE_LU} LUFS short-term median',
         'pass': median is not None and abs(median - target) <= LEVEL_TOLERANCE_LU},
        {'check': 'bed holds one level', 'value': None if spread is None else round(spread, 1),
         'target': f'<= {MAX_SPREAD_LU} LU short-term p95-p5 outside lifts', 'pass': spread is not None and spread <= MAX_SPREAD_LU},
        {'check': 'bed never swells or sags', 'value': None if swing is None else round(swing, 1),
         'target': f'<= {MAX_SWING_LU} LU from the median, held {SWING_HOLD_S} s, outside lifts',
         'pass': swing is not None and swing <= MAX_SWING_LU},
        {'check': 'bed never drops out', 'value': holes,
         'target': 'no 0.25 s 15 dB under its own running level (50 ms windows)', 'pass': not holes},
    ]


def continuity(render: str, stem: str, sidecar: str | None = None) -> dict:
    """Drop-outs on the render itself, on 50 ms windows: from the first word to the start of the final fade the mix
    never falls under the bed's floor (bed_lufs - RENDER_FLOOR_BELOW_DB, in dBFS RMS) for 0.25 s. Speech only adds to
    the bed, so a quiet run is a stretch with no music under a pause, or after the dialogue ends. The render must
    run as long as the premixed cut. Reads the bed level, the body and the length from the premix's sidecar."""
    from .audio import _decode, gaps
    path = Path(sidecar) if sidecar else sidecar_for(stem)
    data = json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}
    report = data.get('bed', {})
    if not report.get('bed_present'):
        return {'value': None, 'target': 'a bed under the cut', 'pass': None, 'status': 'not_run',
                'reason': f'{path.name} names no bed'}
    target = report.get('levels', {}).get('bed_lufs')
    floor = (target - RENDER_FLOOR_BELOW_DB) if target is not None else DEFAULT_FLOOR_DBFS
    try:
        mono = _decode(render)
    except Exception as error:  # noqa: BLE001 - an unreadable render is a failure, never a pass
        mono, reason = np.array([]), str(error)[:200]
    else:
        reason = ''
    length = len(mono) / 48000
    duration = float(data.get('duration_s') or 0)
    if not len(mono) or (duration and abs(length - duration) > 1 / 30 + 0.05):
        return {'value': {'render_s': round(length, 3), 'cut_s': duration}, 'target': 'a render as long as the cut',
                'pass': False, 'status': 'measured', 'reason': reason or 'the render has no audio or the wrong length'}
    start = (report.get('body_s') or [1.5])[0]
    end = max(start, (duration or length) - 1.5)
    holes = gaps(mono, start_s=start, end_s=end, floor_dbfs=floor)
    return {'value': holes, 'target': f'no 0.25 s under {floor} dBFS (50 ms RMS) from {start:.1f} to {end:.1f} s',
            'pass': not holes, 'status': 'measured'}
