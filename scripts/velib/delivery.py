"""How each word sounded: its length against his norm, its pitch and its loudness. And his voice profile.

Two uses, one set of numbers:
  - the fumble pass and conform's choice of reading: a word far longer than his norm for its letters often has a
    hesitation folded into it ("so" said "sooo uh"); a word both clocks place with low confidence is often garbled;
  - his voice profile (Krish, 5 Nov 2026: cloned voiceovers in his name, later): pitch range, how his pitch falls at
    the end of a point, his pauses and pace, gathered over his takes into config/voice/profile.json, numbers only.
    It is the yardstick a cloned voice is held to before anything in his voice is published. Nothing here makes,
    buys or sends a voice.
"""
from __future__ import annotations

import math
import re
from datetime import date
from pathlib import Path

from .common import write_json

ROOT = Path(__file__).resolve().parents[2]
PROFILE = ROOT / 'config' / 'voice' / 'profile.json'
PROFILE_SCHEMA = 'voice-profile/1'
END_PAUSE_S = 0.40     # a word followed by this much quiet ends a phrase


def _letters(text: str) -> int:
    return len(re.sub(r'[^a-z0-9]', '', text.lower()))


def _text(w: dict) -> str:
    return w.get('text', w.get('word', ''))


def _semitones(hz_hi: float, hz_lo: float) -> float:
    return 12 * math.log2(hz_hi / hz_lo) if hz_hi > 0 and hz_lo > 0 else 0.0


def fit(words: list[dict]) -> tuple[float, float]:
    """seconds = a + b * letters, fitted to this take's words by least squares on the middle 80% of their residuals:
    his own norm, which a long word is measured against."""
    pts = [(_letters(_text(w)), w['end_s'] - w['onset_s']) for w in words if _letters(_text(w))]
    if len(pts) < 4:
        return 0.08, 0.06
    for _ in range(2):
        n = len(pts)
        mx, my = sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n
        vx = sum((p[0] - mx) ** 2 for p in pts) or 1e-9
        b = max(0.0, sum((p[0] - mx) * (p[1] - my) for p in pts) / vx)
        a = max(0.04, my - b * mx)
        resid = sorted(pts, key=lambda p: abs(p[1] - (a + b * p[0])))
        pts = resid[:max(4, int(len(resid) * 0.8))]
    return round(a, 4), round(b, 4)


def measure(words: list[dict], fr: dict) -> list[dict]:
    """Per clock word (by its index in the clock): length, length against his norm, pitch median, range and slope,
    loudness and how much of it is voiced; with each clock's own confidence where it gave one."""
    import numpy as np  # noqa: PLC0415
    a, b = fit(words)
    hop = fr['hop_s']
    out = []
    for index, w in enumerate(words):
        lo, hi = int(w['onset_s'] / hop), max(int(w['onset_s'] / hop) + 1, int(math.ceil(w['end_s'] / hop)))
        f0 = fr['f0'][lo:hi]
        db = fr['db'][lo:hi]
        voiced = f0[f0 > 0]
        duration = w['end_s'] - w['onset_s']
        row = {'i': index, 'dur_s': round(duration, 3),
               'dur_ratio': round(duration / max(0.08, a + b * _letters(_text(w))), 2),
               'db': round(float(np.mean(db)), 1) if len(db) else None,
               'voiced_share': round(len(voiced) / len(f0), 2) if len(f0) else 0.0}
        if len(voiced) >= 3:
            row['f0_hz'] = round(float(np.median(voiced)), 1)
            row['f0_range_st'] = round(_semitones(float(np.percentile(voiced, 90)), float(np.percentile(voiced, 10))), 2)
            t = np.arange(len(f0))[f0 > 0] * hop
            st = 12 * np.log2(voiced / np.median(voiced))
            row['f0_slope_st_s'] = round(float(np.polyfit(t, st, 1)[0]), 2) if np.ptp(t) > 0 else 0.0
        for key in ('probability', 'score'):
            if isinstance(w.get(key), (int, float)):
                row[key] = w[key]
        out.append(row)
    return out


# ------------------------------------------------------------------ his voice profile

def _median(xs):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    m = len(xs) // 2
    return round(xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2, 3)


def _pct(xs, q):
    xs = sorted(x for x in xs if x is not None)
    return round(xs[min(len(xs) - 1, int(q * (len(xs) - 1)))], 3) if xs else None


def profile(records: list[dict], today: str | None = None) -> dict:
    """His voice in numbers, over every take whose listen pass measured its words."""
    from .hear import valid  # noqa: PLC0415
    takes, pitch, ranges, ends, mids, pauses, before_numbers, wps, ratios = [], [], [], [], [], [], [], [], []
    for record in records:
        block = valid(record)
        if not block:
            continue
        words = record['aligners']['a']['words']
        rows = {r['i']: r for r in block['words']}
        takes.append({'take': record['take'], 'piece': record.get('piece'), 'media_sha256': record['media']['sha256']})
        span = words[-1]['end_s'] - words[0]['onset_s'] if words else 0
        if span > 0:
            wps.append(len(words) / span)
        for i, w in enumerate(words):
            row = rows.get(i, {})
            if row.get('f0_hz'):
                pitch.append(row['f0_hz'])
                ranges.append(row.get('f0_range_st'))
            ratios.append(row.get('dur_ratio'))
            gap = words[i + 1]['onset_s'] - w['end_s'] if i + 1 < len(words) else None
            if gap is not None and gap > 0.05:
                pauses.append(gap)
                if re.search(r'\d', words[i + 1]['text']):
                    before_numbers.append(gap)
            if 'f0_slope_st_s' in row:
                (ends if gap is None or gap >= END_PAUSE_S else mids).append(row['f0_slope_st_s'])
    return {
        'schema': PROFILE_SCHEMA, 'made_on': today or date.today().isoformat(),
        'about': ('His voice in numbers, from the listen pass over his own takes (ve voice profile). The yardstick for '
                  'a cloned voice before anything in his voice is published; nothing here makes or sends a voice.'),
        'takes': takes,
        'pitch': {'median_hz': _median(pitch), 'p10_hz': _pct(pitch, 0.1), 'p90_hz': _pct(pitch, 0.9),
                  'range_st': round(_semitones(_pct(pitch, 0.9) or 0, _pct(pitch, 0.1) or 0), 2),
                  'word_range_st_median': _median(ranges)},
        'intonation': {'phrase_end_slope_st_s': _median(ends), 'mid_phrase_slope_st_s': _median(mids),
                       'phrase_ends_measured': len(ends)},
        'pace': {'words_per_s_median': _median(wps), 'pause_median_s': _median(pauses), 'pause_p90_s': _pct(pauses, 0.9),
                 'pause_before_numbers_median_s': _median(before_numbers)},
        'length': {'dur_ratio_p90': _pct(ratios, 0.9), 'dur_ratio_p99': _pct(ratios, 0.99)},
    }


def write_profile(doc: dict, path: Path | str | None = None) -> Path:
    return write_json(Path(path or PROFILE), doc)
