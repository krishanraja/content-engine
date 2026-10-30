"""Bed check from the premix's own measurements (`<stem>.bed.json`, written by velib.audio.premix).

The stem is already summed, so the music cannot be separated from the voice at QC time. The premix measures the
bed against the voice from the separate stems; this row reads those numbers (and the stem it sits beside, by hash
of nothing: the numbers are relative and the sidecar carries the mode) and judges them. Missing numbers are
not_run, never a pass."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

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
DROPOUT_BELOW_LU = 12.0         # momentary level this far under bed_lufs is a drop-out...
DROPOUT_MIN_S = 0.3             # ...when it lasts this long
DEFAULT_FLOOR_LUFS = -45.0      # render floor in the body when the sidecar names no bed level


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


def _quiet_runs(frames: list, floor: float, start: float, end: float, skip: list) -> list:
    """Runs of 100 ms frames inside [start, end), outside `skip` windows, below `floor`: [(from_s, length_s)]."""
    runs, first, last = [], None, None
    for t, value in frames:
        inside = start <= t < end and not any(a <= t <= b for a, b in skip)
        if inside and value < floor:
            first = t if first is None else first
            last = t
        elif first is not None:
            runs.append((first, round(last - first + 0.1, 2)))
            first = None
    if first is not None:
        runs.append((first, round(last - first + 0.1, 2)))
    return [r for r in runs if r[1] >= DROPOUT_MIN_S]


def _lift_skip(report: dict) -> list:
    from .audio import LIFT_FALL_S, LIFT_RISE_S
    return [(a - LIFT_RISE_S - 3.0, b + LIFT_FALL_S + 3.0) for a, b in report.get('lifts') or []]


def episode_rows(sidecar: Path, report: dict) -> list:
    """Level, steadiness and drop-outs of the episode bed alone, from the music stem the premix kept beside the
    stem (already at the master's gain), on ffmpeg's meter. Short-term windows reach 3 s back, so a lift window is
    left out with 3 s either side."""
    from .audio import ebur128
    music = sidecar.parent / str(report.get('music_stem') or '')
    target = report.get('levels', {}).get('bed_lufs')
    if not report.get('music_stem') or not music.is_file() or target is None:
        return [{'check': 'episode bed metered', 'value': None, 'pass': False,
                 'target': 'the music stem and bed_lufs beside the stem (re-run the premix)'}]
    start, end = report['body_s']
    skip = _lift_skip(report)
    meter = ebur128(str(music))
    short = [v for t, v in meter['S'] if start + 3.0 <= t < end and not any(a <= t <= b for a, b in skip)]
    median = float(np.median(short)) if short else None
    spread = float(np.percentile(short, 95) - np.percentile(short, 5)) if short else None
    gaps = _quiet_runs(meter['M'], target - DROPOUT_BELOW_LU, start, end, [])
    return [
        {'check': 'bed level in the master', 'value': None if median is None else round(median, 1),
         'target': f'{target} ±{LEVEL_TOLERANCE_LU} LUFS short-term median',
         'pass': median is not None and abs(median - target) <= LEVEL_TOLERANCE_LU},
        {'check': 'bed holds one level', 'value': None if spread is None else round(spread, 1),
         'target': f'<= {MAX_SPREAD_LU} LU short-term p95-p5 outside lifts', 'pass': spread is not None and spread <= MAX_SPREAD_LU},
        {'check': 'bed never drops out', 'value': gaps,
         'target': f'no {DROPOUT_MIN_S} s under {target - DROPOUT_BELOW_LU} LUFS momentary', 'pass': not gaps},
    ]


def continuity(render: str, stem: str, sidecar: str | None = None) -> dict:
    """Drop-outs on the render itself: the mix's momentary loudness, between the first and the last word, never
    falls under the bed's floor for DROPOUT_MIN_S. Speech only adds to the bed, so a quiet run here is a stretch
    with no music under a pause. Reads the bed level and the body from the premix's sidecar when there is one."""
    from .audio import ebur128
    path = Path(sidecar) if sidecar else sidecar_for(stem)
    report = json.loads(path.read_text(encoding='utf-8')).get('bed', {}) if path.is_file() else {}
    if not report.get('bed_present', bool(report) or None):
        return {'value': None, 'target': 'a bed under the cut', 'pass': None, 'status': 'not_run',
                'reason': f'{path.name} names no bed'}
    target = report.get('levels', {}).get('bed_lufs')
    floor = target - DROPOUT_BELOW_LU if target is not None else DEFAULT_FLOOR_LUFS
    meter = ebur128(render)
    end_s = meter['M'][-1][0] if meter['M'] else 0.0
    start, end = report.get('body_s') or (1.5, report.get('last_word_end_s') or max(1.5, end_s - 3.5))
    gaps = _quiet_runs(meter['M'], floor, start, end, [])
    return {'value': gaps, 'target': f'no {DROPOUT_MIN_S} s under {floor} LUFS momentary from {start:.1f} to {end:.1f} s',
            'pass': not gaps, 'status': 'measured'}
