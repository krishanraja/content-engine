#!/usr/bin/env python3
"""Picture against sound on a finished cut, measured from the source take (Krish, 2026-11-12).

Krish, 12 Nov 2026, on Wednesday 11 Nov's 5-minute cut: "the 5-minute video had audio and video out of sync with one
another. We need to ensure that never happens in the future." (config/failures.json, av-sync-drift).

How it measures, so the measurement does not share the fault it measures (config/failures.json, lip-sync-drift and
cause-claimed-unproven): nothing here seeks by a timestamp or reads the cut's own timestamps. The take and the cut are
each decoded once, in order, and every frame's time is its count divided by the file's constant frame rate.

For every span of the cut's edit list (where in the cut, where in the take, how long):
  - sound: the cut's speech envelope (10 ms RMS) is matched against the take's over the span; the best lag says how far
    the cut's sound sits from where the edit list puts it;
  - picture: the cut's motion signal (how much his picture changes frame to frame, inside the rectangle where the take
    is shown) is matched against the take's motion over the same span; the best lag says how far the cut's picture sits.
The drift is sound lag minus picture lag (positive: the sound is late). A span passes only when both matches are
reliable (correlation >= MIN_CORR) and |drift| <= TOLERANCE_MS. A span that cannot be measured is never a pass: the cut
passes only when no span fails and the measured spans cover at least COVERAGE of the cut's spoken spans.

    python scripts/av_sync.py measure CUT --take TAKE --edl EDL.json [--receipt]   exit 0 pass, 1 fail, 2 inconclusive
    python scripts/av_sync.py check CUT                                           the receipt beside CUT, for these bytes

The edit list (schema av-sync-edl/1): {"spans": [{"out_s": 0.0, "src_s": 1.8, "dur_s": 18.65}, ...],
"picture": {"cut": [x, y, w, h], "take": [x, y, w, h]}} where picture names the rectangle of the cut that shows the take
and the rectangle of the take it shows (default: the whole frame of each). A span may carry its own "picture", or
"picture": null when the take is not on screen (then only its sound is checked against the take, and its drift is not
judged). Receipt: <cut>.av-sync.json, bound to the cut's sha256, written only on a pass.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np

SCHEMA_EDL = 'av-sync-edl/1'
SCHEMA_RECEIPT = 'av-sync/1'
SUFFIX = '.av-sync.json'
TOLERANCE_MS = 45.0      # about one frame and a third at 30 fps; viewers notice sound early by about 45 ms
MIN_CORR = 0.5
SEARCH_S = 1.5           # the furthest either stream is looked for from where the edit list puts it
COVERAGE = 0.8
MIN_SPAN_S = 2.0         # shorter spans are listed, unmeasured, and count against coverage
HZ = 100                 # both signals are compared on a 10 ms grid
GUARD_S = 0.25           # each span is matched inside this margin: a join's own picture change is not the take's
SIDE = 48                # the picture rectangle is read as SIDE x SIDE grey


class AvSyncError(Exception):
    pass


def sha256(path) -> str:
    with open(path, 'rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def probe_video(path) -> dict:
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height,r_frame_rate,avg_frame_rate', '-of', 'json', str(path)],
                         capture_output=True, text=True, check=True).stdout
    streams = json.loads(out).get('streams') or []
    if not streams:
        raise AvSyncError(f'{path}: no video stream')
    s = streams[0]
    if s['r_frame_rate'] != s.get('avg_frame_rate'):
        raise AvSyncError(f'{path}: variable frame rate ({s["r_frame_rate"]} against {s.get("avg_frame_rate")}): '
                          'a frame count is not a clock on it; make a constant-rate copy first')
    return {'w': int(s['width']), 'h': int(s['height']), 'rate': float(Fraction(s['r_frame_rate']))}


def motion(path, rect=None) -> tuple[np.ndarray, float]:
    """(motion per frame, frame rate): the mean absolute change of the grey rectangle from the frame before, frame by
    frame in decode order. Element i belongs to frame i, at time i / rate."""
    info = probe_video(path)
    x, y, w, h = rect or (0, 0, info['w'], info['h'])
    x, y = max(0, int(x)), max(0, int(y))
    w, h = min(int(w), info['w'] - x), min(int(h), info['h'] - y)
    if w < 8 or h < 8:
        raise AvSyncError(f'{path}: the picture rectangle {rect} is outside the frame')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0', '-vf',
                          f'crop={w}:{h}:{x}:{y},scale={SIDE}:{SIDE}:flags=area', '-fps_mode', 'passthrough',
                          '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, SIDE * SIDE).astype(np.float32)
    change = np.zeros(len(frames), np.float32)
    if len(frames) > 1:
        change[1:] = np.abs(np.diff(frames, axis=0)).mean(axis=1)
    return change, info['rate']


def envelope(path) -> np.ndarray:
    """The sound's 10 ms RMS envelope, decoded in order from the first audio stream (mono, 16 kHz)."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-ac', '1', '-ar', '16000',
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    samples = np.frombuffer(raw, np.float32)
    n = len(samples) // 160
    return np.sqrt(np.mean(samples[:n * 160].reshape(n, 160) ** 2, axis=1)) if n else np.zeros(0, np.float32)


def on_grid(signal: np.ndarray, rate: float) -> np.ndarray:
    """A per-frame signal on the 10 ms grid, by frame count / rate."""
    if len(signal) < 2:
        return np.zeros(0, np.float32)
    t = np.arange(len(signal)) / rate
    grid = np.arange(0, t[-1], 1 / HZ)
    return np.interp(grid, t, signal).astype(np.float32)


def best_lag(cut: np.ndarray, ref: np.ndarray, start: int, n: int, search: int) -> tuple[float | None, float]:
    """(lag in grid steps, correlation): where `ref` (n steps) best matches `cut` near `start`, refined to a fraction
    of a step on the peak. Positive lag: the cut's copy is later than `start`."""
    ref = ref - ref.mean()
    rn = float(np.linalg.norm(ref))
    if rn < 1e-9:
        return None, 0.0
    scores = {}
    for lag in range(-search, search + 1):
        a = start + lag
        if a < 0 or a + n > len(cut):
            continue
        seg = cut[a:a + n] - cut[a:a + n].mean()
        norm = float(np.linalg.norm(seg)) * rn
        if norm > 1e-9:
            scores[lag] = float(np.dot(seg, ref) / norm)
    if not scores:
        return None, 0.0
    lag = max(scores, key=lambda k: (scores[k], -abs(k)))
    left, right = scores.get(lag - 1), scores.get(lag + 1)
    shift = 0.0
    if left is not None and right is not None:
        bend = left - 2 * scores[lag] + right
        if bend < 0:
            shift = max(-0.5, min(0.5, 0.5 * (left - right) / bend))
    return lag + shift, scores[lag]


def load_edl(edl) -> dict:
    doc = json.loads(Path(edl).read_text(encoding='utf-8')) if not isinstance(edl, dict) else edl
    if doc.get('schema', SCHEMA_EDL) != SCHEMA_EDL:
        raise AvSyncError(f'the edit list is not {SCHEMA_EDL}')
    spans = doc.get('spans')
    if not isinstance(spans, list) or not spans:
        raise AvSyncError('the edit list has no spans')
    for s in spans:
        if not all(isinstance(s.get(k), (int, float)) for k in ('out_s', 'src_s', 'dur_s')) or s['dur_s'] <= 0:
            raise AvSyncError(f'a span needs out_s, src_s and a positive dur_s: {s}')
    return doc


def measure(cut, take, edl, *, tolerance_ms: float = TOLERANCE_MS) -> dict:
    doc = load_edl(edl)
    default_pic = doc.get('picture') or {}
    cut_env, take_env = envelope(cut), envelope(take)
    cache: dict = {}

    def pic(path, rect):
        key = (str(path), tuple(rect) if rect else None)
        if key not in cache:
            m, rate = motion(path, rect)
            cache[key] = on_grid(m, rate)
        return cache[key]

    search = int(SEARCH_S * HZ)
    rows, spoken, covered = [], 0.0, 0.0
    for i, span in enumerate(doc['spans']):
        out_s, src_s, dur = float(span['out_s']), float(span['src_s']), float(span['dur_s'])
        row = {'span': i, 'out_s': round(out_s, 3), 'src_s': round(src_s, 3), 'dur_s': round(dur, 3), 'status': 'unmeasured'}
        rows.append(row)
        spoken += dur
        if dur < MIN_SPAN_S:
            row['reason'] = f'shorter than {MIN_SPAN_S} s'
            continue
        guard = int(GUARD_S * HZ)
        n = int(dur * HZ) - 2 * guard
        start, src = int(round(out_s * HZ)) + guard, int(round(src_s * HZ)) + guard
        if src + n > len(take_env):
            row['reason'] = 'the span runs past the take'
            continue
        a_lag, a_corr = best_lag(cut_env, take_env[src:src + n], start, n, search)
        row['sound_lag_ms'] = None if a_lag is None else round(a_lag * 1000 / HZ, 1)
        row['sound_corr'] = round(a_corr, 3)
        picture = span['picture'] if 'picture' in span else default_pic
        if picture is None:
            row['picture'] = 'off screen'
            row['status'] = 'pass' if a_lag is not None and a_corr >= MIN_CORR and abs(a_lag * 1000 / HZ) <= tolerance_ms else 'fail'
            if row['status'] == 'pass':
                covered += dur
            continue
        cut_m, take_m = pic(cut, picture.get('cut')), pic(take, picture.get('take'))
        if src + n > len(take_m):
            row['reason'] = 'the span runs past the take\'s picture'
            continue
        v_lag, v_corr = best_lag(cut_m, take_m[src:src + n], start, n, search)
        row['picture_lag_ms'] = None if v_lag is None else round(v_lag * 1000 / HZ, 1)
        row['picture_corr'] = round(v_corr, 3)
        if a_lag is None or v_lag is None or a_corr < MIN_CORR or v_corr < MIN_CORR:
            row['reason'] = 'no reliable match (correlation under %.1f)' % MIN_CORR
            continue
        drift = (a_lag - v_lag) * 1000 / HZ
        row['drift_ms'] = round(drift, 1)
        row['status'] = 'pass' if abs(drift) <= tolerance_ms else 'fail'
        covered += dur
    if any(r['status'] == 'fail' for r in rows):
        status = 'fail'
    elif spoken and covered / spoken >= COVERAGE:
        status = 'pass'
    else:
        status = 'inconclusive'
    drifts = [abs(r['drift_ms']) for r in rows if 'drift_ms' in r]
    return {'schema': SCHEMA_RECEIPT, 'status': status, 'pass': status == 'pass', 'tolerance_ms': tolerance_ms,
            'coverage': round(covered / spoken, 3) if spoken else 0.0, 'worst_drift_ms': max(drifts) if drifts else None,
            'rule': f'every measured span |sound lag - picture lag| <= {tolerance_ms:g} ms, both matched at r >= {MIN_CORR}; '
                    f'measured spans cover >= {COVERAGE:.0%} of the cut; frames timed by count, never by seeking',
            'spans': rows}


def receipt_path(video) -> Path:
    return Path(str(video) + SUFFIX)


def write_receipt(video, take, result: dict) -> Path:
    if not result.get('pass'):
        raise AvSyncError(f'{Path(video).name}: picture and sound are not in sync ({result.get("status")}); no receipt')
    out = receipt_path(video)
    out.write_text(json.dumps({**result, 'video': Path(video).name, 'video_sha256': sha256(video),
                               'take': Path(take).name, 'take_sha256': sha256(take)}, indent=2), encoding='utf-8')
    return out


def receipt_problems(video) -> list[str]:
    """[] when the cut beside its receipt was measured in sync, for these exact bytes; else why not."""
    path = receipt_path(video)
    if not path.is_file():
        return [f'no picture-against-sound receipt beside {Path(video).name}: run python scripts/av_sync.py measure '
                f'{Path(video).name} --take <take> --edl <edit list> --receipt (Krish, 2026-11-12: "We need to ensure '
                f'that never happens in the future")']
    try:
        doc = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return [f'{path.name} cannot be read']
    problems = []
    if doc.get('schema') != SCHEMA_RECEIPT:
        problems.append(f'{path.name} is not a picture-against-sound receipt')
    if doc.get('video_sha256') != sha256(video):
        problems.append(f'{path.name} belongs to different bytes: the cut changed after it was measured')
    if doc.get('pass') is not True or doc.get('status') != 'pass':
        problems.append(f'{path.name} records a cut out of sync')
    return problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    m = sub.add_parser('measure')
    m.add_argument('cut')
    m.add_argument('--take', required=True)
    m.add_argument('--edl', required=True)
    m.add_argument('--receipt', action='store_true', help='write <cut>.av-sync.json when it passes')
    m.add_argument('--json', action='store_true')
    c = sub.add_parser('check')
    c.add_argument('cut')
    a = ap.parse_args(argv)
    if a.cmd == 'check':
        problems = receipt_problems(a.cut)
        for p in problems:
            print(f'av_sync: {p}')
        if not problems:
            print(f'av_sync: {Path(a.cut).name} was measured in sync')
        return 1 if problems else 0
    result = measure(a.cut, a.take, a.edl)
    if a.json:
        print(json.dumps(result, indent=2))
    else:
        for r in result['spans']:
            print('  span {span:>2}  out {out_s:>7.2f}s  take {src_s:>7.2f}s  {dur_s:>6.2f}s  '.format(**r)
                  + f"sound {r.get('sound_lag_ms', '-')} ms  picture {r.get('picture_lag_ms', '-')} ms  "
                  + f"drift {r.get('drift_ms', '-')} ms  {r['status']}" + (f"  ({r['reason']})" if r.get('reason') else ''))
        print(f"av_sync: {result['status']} (worst drift {result['worst_drift_ms']} ms, coverage {result['coverage']:.0%}, "
              f"tolerance {result['tolerance_ms']:g} ms)")
    if a.receipt and result['pass']:
        print(f'av_sync: receipt {write_receipt(a.cut, a.take, result)}')
    return {'pass': 0, 'fail': 1}.get(result['status'], 2)


if __name__ == '__main__':
    sys.exit(main())
