"""ve pace: how fast a cut moves and how much of the frame it uses, in numbers, beside the cuts Krish keeps.

Why (Krish, 2026-11-13, of the two 3D style test cuts): "the use of the screen space is terrible, the motion is 10X
too slow, not immersive and engaging at all." Those cuts were judged from stills every 2 s (failure note
docs/ve/FAILURE_2026-11-13_3d-styles.md). `ve study` counts hard cuts and whether the picture changed in each second;
a motion-graphics Short can hold one shot for a minute and still change something every few frames, and a cut that
nudges a small set every second reads as "changing" too. This measures what he named:

- events: the moments something new happens on screen (a cut, an entrance, a burst of movement), from the onsets of
  picture change over the whole frame and in each tile of it, merged within 0.15 s. events_per_s and the longest gap
  with no event (dead air) are the pace.
- energy: how much the picture moves between frames (mean grey change per frame, 0 to 255), median and 75th
  percentile. A slow drift scores low, a whip or a slam high.
- coverage: the share of the frame in use. `used` is the share of tiles that hold anything (not flat ground) on a
  typical frame; `active` is the share of tiles that change within each second. A small set in a band with empty
  floor scores low on both.

The numbers describe; they are never a target (THE_BAR: cut counts, rates and levels are not the bar). `compare`
places a cut among the references he keeps (config/style-references.json, `ve pace --refs`) and says where it falls
below every one of them, for the Critic and the session to watch at speed, never as a refusal.
"""
from __future__ import annotations

import json
import statistics
import subprocess
from pathlib import Path

import numpy as np

from .common import ROOT, ffmpeg

SAMPLE_FPS = 15
GRID_W, GRID_H = 90, 160          # 9:16 sampling grid; a wide cut is letterboxed into it by scale+pad, never stretched
TILE = 10                         # 9 x 16 tiles on the tall grid
MERGE_S = 0.15                    # onsets closer than this are one event
FLAT_STD = 4.0                    # a tile whose grey spread is under this holds nothing (flat ground)
ACTIVE_DIFF = 6.0                 # a tile changed this second if its mean grey change passes this on some frame
NOTE = 'Describes the cut; never a target (THE_BAR). Compared with the references he keeps, it flags; it never refuses.'


def frames(path: str | Path, seconds: float | None = None) -> np.ndarray:
    """Grey frames at SAMPLE_FPS on the 90x160 grid (a wide picture padded, not stretched), as float32 [n, 160, 90]."""
    vf = (f'fps={SAMPLE_FPS},scale={GRID_W}:{GRID_H}:force_original_aspect_ratio=decrease,'
          f'pad={GRID_W}:{GRID_H}:(ow-iw)/2:(oh-ih)/2,format=gray')
    cmd = [ffmpeg(), '-v', 'error', '-i', str(path)]
    if seconds:
        cmd += ['-t', str(seconds)]
    raw = subprocess.run(cmd + ['-vf', vf, '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, GRID_H, GRID_W).astype(np.float32)


def _tiles(a: np.ndarray) -> np.ndarray:
    """[n, H, W] -> [n, H/T, W/T, T*T]."""
    n, h, w = a.shape
    return a.reshape(n, h // TILE, TILE, w // TILE, TILE).transpose(0, 1, 3, 2, 4).reshape(n, h // TILE, w // TILE, -1)


def _onsets(signal: np.ndarray, floor: float) -> list[int]:
    """Indices where a change signal rises into a peak that stands above its own quiet level: a new thing happening,
    not the continuation of one."""
    if len(signal) < 3:
        return []
    quiet = float(np.percentile(signal, 30))
    level = max(floor, quiet * 2.5 + floor * 0.5)
    hits = []
    for i in range(1, len(signal) - 1):
        if signal[i] >= level and signal[i] >= signal[i - 1] and signal[i] >= signal[i + 1] and signal[i] > signal[i - 1] * 1.25:
            hits.append(i)
    return hits


def measure(path: str | Path, seconds: float | None = None) -> dict:
    f = frames(path, seconds)
    if len(f) < SAMPLE_FPS:
        raise ValueError(f'{path}: under a second of picture decoded')
    duration = len(f) / SAMPLE_FPS
    d = np.abs(np.diff(f, axis=0))                       # [n-1, H, W]
    whole = d.mean(axis=(1, 2))                          # change over the frame
    tile_d = _tiles(d).mean(axis=3)                      # [n-1, 16, 9]
    # events: onsets on the whole frame, and in each tile (an element arriving somewhere small)
    times = [i for i in _onsets(whole, 1.2)]
    rows, cols = tile_d.shape[1:]
    for r in range(rows):
        for c in range(cols):
            times += _onsets(tile_d[:, r, c], 10.0)
    times.sort()
    events: list[float] = []
    for i in times:
        t = (i + 1) / SAMPLE_FPS
        if not events or t - events[-1] > MERGE_S:
            events.append(t)
    gaps = [b - a for a, b in zip([0.0] + events, events + [duration])]
    # coverage
    spread = _tiles(f).std(axis=3)                       # [n, 16, 9]
    used = (spread > FLAT_STD).mean(axis=(1, 2))
    secs = int(len(tile_d) // SAMPLE_FPS)
    active = [float((tile_d[s * SAMPLE_FPS:(s + 1) * SAMPLE_FPS].max(axis=0) > ACTIVE_DIFF).mean()) for s in range(secs)]
    return {
        'file': str(path), 'note': NOTE, 'duration_s': round(duration, 2),
        'events': len(events), 'events_per_s': round(len(events) / duration, 2),
        'median_gap_s': round(statistics.median(gaps), 2) if gaps else None,
        'longest_gap_s': round(max(gaps), 2) if gaps else None,
        'gaps_over_2s': sum(1 for g in gaps if g > 2.0),
        'energy_median': round(float(np.median(whole)), 2),
        'energy_p75': round(float(np.percentile(whole, 75)), 2),
        'used_frame': round(float(np.median(used)), 2),
        'active_frame': round(float(np.median(active)), 2) if active else 0.0,
        'event_times_s': [round(t, 2) for t in events],
    }


TABLE = ROOT / 'config' / 've' / 'pace-references.json'
SHORT = {'events_per_s': 'events/s', 'longest_gap_s': 'longest gap s', 'energy_median': 'energy',
         'used_frame': 'frame used', 'active_frame': 'frame active'}

SUMMARY = ('events_per_s', 'longest_gap_s', 'energy_median', 'used_frame', 'active_frame')
HIGHER_IS_FASTER = {'events_per_s': True, 'longest_gap_s': False, 'energy_median': True, 'used_frame': True,
                    'active_frame': True}


def compare(card: dict, refs: list[dict]) -> dict:
    """Where the cut falls among the references, measure by measure: below every one (or above, for dead air) is
    flagged as `below_all`."""
    rows = {}
    for key in SUMMARY:
        values = sorted(r[key] for r in refs if r.get(key) is not None)
        if not values:
            continue
        v = card[key]
        better = HIGHER_IS_FASTER[key]
        below_all = (v < values[0]) if better else (v > values[-1])
        rows[key] = {'cut': v, 'ref_min': values[0], 'ref_median': round(statistics.median(values), 2),
                     'ref_max': values[-1], 'below_all': below_all,
                     'x_of_median': round((v / statistics.median(values)) if better else
                                          (statistics.median(values) / v), 2) if v and statistics.median(values) else None}
    return {'cut': card['file'], 'note': NOTE, 'references': len(refs), 'rows': rows,
            'below_all': [k for k, r in rows.items() if r['below_all']]}


def write(card: dict, out: str | Path) -> Path:
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(card, indent=2) + '\n', encoding='utf-8')
    return out


def beside_references(video: str | Path, table: str | Path = TABLE, measure_fn=None) -> str:
    """One line for what ve styles, ve lab and ve packet print (audit ve-10, 14 Nov 2026): the cut's pace beside the
    references he keeps, each measure as cut (references min .. median .. max), the ones below every reference named.
    A measurement only: it never holds a cut back, and a cut it cannot measure says why instead of failing the command."""
    try:
        card = (measure_fn or measure)(video)
        card['file'] = Path(video).name
        loaded = json.loads(Path(table).read_text(encoding='utf-8'))
        verdict = compare(card, loaded['references'] + loaded.get('house', []))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        return f'pace: not measured ({error})'
    parts = [f"{SHORT.get(key, key)} {row['cut']} ({row['ref_min']} .. {row['ref_median']} .. {row['ref_max']})"
             for key, row in verdict['rows'].items()]
    low = [SHORT.get(k, k) for k in verdict['below_all']]
    tail = f"; below every reference on {', '.join(low)}" if low else ''
    return f"pace: {'; '.join(parts)}{tail} (against {verdict['references']} reference cuts; a measurement, never a gate)"
