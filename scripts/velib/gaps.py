"""The one join rule for speech edits (F09): a join sits only in a gap both aligners agree on.

A gap is time that neither aligner hears as speech. It counts only when it is at least MIN_GAP_S long, and a join
inside it keeps CLEARANCE_S from the nearest word edge of either aligner. Crossfades at a join last 20 to 40 ms.

One rule (29 Oct 2026): the gaps come from scripts/cutgates/gaps.py and the 80 ms and 30 ms thresholds from
config/gates.json `joins`, the same rule the joins gate holds every cut to. This module only adapts it to the
dialogue editor's words (onset_s, end_s) and adds what conform alone needs: crossfades and the cut point.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # scripts/, for the shared cutgates package
from cutgates import gaps as _shared, settings as _settings  # noqa: E402

MIN_GAP_S = _settings.rule('joins')['min_gap_ms'] / 1000
CLEARANCE_S = _settings.rule('joins')['clearance_ms'] / 1000
CROSSFADE_MIN_S = 0.020
CROSSFADE_MAX_S = 0.040


def _intervals(words) -> list[tuple[float, float]]:
    out = []
    for word in words or []:
        onset, end = word.get('onset_s'), word.get('end_s')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (onset, end)):
            raise ValueError(f'a word needs finite onset_s and end_s: {word!r}')
        if end < onset:
            raise ValueError(f'a word ends before it starts: {word!r}')
        out.append((float(onset), float(end)))
    return out


def speech(words_a, words_b) -> list[tuple[float, float]]:
    """The union of every word either aligner heard, merged into sorted intervals."""
    merged: list[list[float]] = []
    for onset, end in sorted(_intervals(words_a) + _intervals(words_b)):
        if merged and onset <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([onset, end])
    return [(a, b) for a, b in merged]


def agreed_gaps(words_a, words_b, *, start_s: float = 0.0, end_s: float | None = None,
                min_gap_s: float = MIN_GAP_S) -> list[tuple[float, float]]:
    """Gaps of at least min_gap_s that neither aligner hears as speech, between start_s and end_s.

    Both aligners must have heard something: a single clock cannot agree with itself."""
    if not words_a or not words_b:
        raise ValueError('agreed gaps need two aligners; a single clock cannot agree with itself')
    speech(words_a, words_b)  # validates both clocks
    timed = {name: [{'w': w.get('word', ''), 's': w['onset_s'], 'e': w['end_s']} for w in words]
             for name, words in (('a', words_a), ('b', words_b))}
    last = max(w['end_s'] for w in list(words_a) + list(words_b)) if end_s is None else float(end_s)
    return [(g['from_s'], min(g['to_s'], last)) for g in _shared.agreed_gaps(timed, float(start_s), last)
            if min(g['to_s'], last) - g['from_s'] >= min_gap_s - 1e-9]


def join_problem(at_s: float, gaps, *, clearance_s: float = CLEARANCE_S) -> str | None:
    """None when a join at at_s sits inside an agreed gap with clearance on both sides, else the reason."""
    for start, end in gaps:
        if start - 1e-9 <= at_s <= end + 1e-9:
            room = min(at_s - start, end - at_s)
            if room + 1e-9 < clearance_s:
                return f'join at {at_s:.3f} s keeps {room * 1000:.0f} ms from a word, under {clearance_s * 1000:.0f} ms'
            return None
    return f'join at {at_s:.3f} s is not in a gap of {MIN_GAP_S * 1000:.0f} ms or more that both aligners agree on'


def crossfade_problem(seconds: float) -> str | None:
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not math.isfinite(seconds):
        return 'crossfade must be a finite number of seconds'
    if not CROSSFADE_MIN_S - 1e-9 <= seconds <= CROSSFADE_MAX_S + 1e-9:
        return f'crossfade {seconds * 1000:.0f} ms is outside 20 to 40 ms'
    return None


def cut_point(gap: tuple[float, float], *, clearance_s: float = CLEARANCE_S) -> float | None:
    """The join time chosen inside a gap: its middle, when the gap leaves clearance on both sides."""
    start, end = gap
    if end - start + 1e-9 < max(MIN_GAP_S, 2 * clearance_s):
        return None
    return round((start + end) / 2, 4)
