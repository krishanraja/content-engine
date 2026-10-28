"""Per-EDL-segment dialogue envelope correlation on the engine's 30 fps clock."""
from __future__ import annotations

import numpy as np

from .qc import audio_samples, frame_span, measurement


def _envelope(samples: np.ndarray) -> np.ndarray:
    count = len(samples) // 480
    return np.sqrt(np.mean(samples[:count * 480].reshape(count, 480) ** 2, axis=1))


def av_xcorr(render, dialogue_master, edl) -> dict:
    """EDL: engine segments, optionally wrapped in {fps, segments}.

    trimBeforeFrames selects the source-master span; absent means a master already
    assembled on the render clock. Positive lag means the rendered audio is late.
    Search up to two seconds, with at least half the segment overlapping.
    """
    fps = float(edl.get('fps', 30)) if isinstance(edl, dict) else 30.0
    segments = edl['segments'] if isinstance(edl, dict) else edl
    actual = _envelope(audio_samples(render))
    master = _envelope(audio_samples(dialogue_master))
    rows = []
    for index, segment in enumerate(segments):
        first, last = frame_span(segment, fps)
        start = round(first / fps * 100)
        source = round(float(segment.get('trimBeforeFrames', first)) / fps * 100)
        n = round((last - first) / fps * 100)
        row = {'segment': segment.get('id', index), 'lag_ms': None, 'pass': False}
        if n < 4 or start + n > len(actual) or source < 0 or source + n > len(master):
            row['reason'] = 'Segment is too short or extends beyond decoded audio'
            rows.append(row)
            continue
        ref = master[source:source + n]
        candidates = []
        for lag in range(-min(200, n // 2), min(200, n // 2) + 1):
            lo, hi = max(0, -start - lag), min(n, len(actual) - start - lag)
            if hi - lo < max(4, n // 2):
                continue
            a = actual[start + lag + lo:start + lag + hi]
            b = ref[lo:hi]
            a, b = a - a.mean(), b - b.mean()
            norm = float(np.linalg.norm(a) * np.linalg.norm(b))
            if norm > 1e-12:
                candidates.append((float(np.dot(a, b) / norm), lag))
        if candidates:
            score, lag = max(candidates, key=lambda p: (p[0], -abs(p[1])))
            row.update(lag_ms=lag * 10, correlation=round(score, 6),
                       **{'pass': abs(lag * 10) <= 33 and score >= 0.5})
            if score < 0.5:
                row['reason'] = 'No reliable envelope match (correlation < 0.5)'
        else:
            row['reason'] = 'No varying audio envelope to correlate'
        rows.append(row)
    return measurement(rows, 'every segment |lag| <= 33 ms; correlation >= 0.5')
