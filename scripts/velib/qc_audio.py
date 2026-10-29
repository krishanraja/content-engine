"""Bed check from the premix's own measurements (`<stem>.bed.json`, written by velib.audio.premix).

The stem is already summed, so the music cannot be separated from the voice at QC time. The premix measures the
bed against the voice from the separate stems; this row reads those numbers (and the stem it sits beside, by hash
of nothing: the numbers are relative and the sidecar carries the mode) and judges them. Missing numbers are
not_run, never a pass."""
from __future__ import annotations

import json
from pathlib import Path

from .qc import measurement

# Krish, 28 Oct 2026: "ensure the background music is present and well treated".
SPEECH_RANGE = (-21.0, -12.0)   # dB re the voice, music under speech
PAUSE_RANGE = (-13.0, -6.0)     # dB re the voice, music in real pauses (ducked mode)
MIN_BREATH_DB = 4.0             # pause level above speech level (ducked mode)
MIN_PRESENT_DB = -30.0          # a bed quieter than this under speech or in pauses is not music
MAX_TP = -1.0


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
    if ducked:
        rows += [
            {'check': 'in pauses', 'value': pause, 'target': f'{PAUSE_RANGE[0]} to {PAUSE_RANGE[1]} dB re voice',
             'pass': pause is not None and PAUSE_RANGE[0] <= pause <= PAUSE_RANGE[1]},
            {'check': 'the music breathes', 'value': report.get('duck_depth_db'), 'target': f'>= {MIN_BREATH_DB} dB',
             'pass': report.get('duck_depth_db') is not None and report['duck_depth_db'] >= MIN_BREATH_DB},
        ]
    return measurement(rows, 'bed present, under speech in range, true peak, and (ducked) breathing in pauses')
