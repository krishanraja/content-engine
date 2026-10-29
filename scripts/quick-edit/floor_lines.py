#!/usr/bin/env python3
"""The published standard's measured lines in a cut's report (Wave 2, W2.5).

Each item is held where it belongs. Krish, 29 Oct 2026: "I would much rather
the engine know what kind of thing doesn't fly with me, rather than implement
incredibly specific rules everywhere". So only a floor never blocks (lip sync,
floor never 3, in lipsync_gate.py; logos, floor never 6, in
scripts/post-pack/logo_gate.py). Everything here is a measurement written to
the report, never a refusal by itself:

  loudness   -14 LUFS integrated, true peak at most -1 dBTP, read from the
             finished file AFTER the encode (make.py measure_cut);
  share      the share copy's measured size against the 29 MiB cap;
  chapters   on the 16:9 long cut, how far the music bed lifts in each chapter
             window over the bed just before it, measured on the bed stem;
             the levels themselves wait on his ear ("levels: awaiting by-ear
             approval") until he signs them;
  stability  how much the camera shakes in his footage (an aim, measured from
             frame-to-frame brightness profiles; never blocking);
  sfx        whether the cut used a sound on the big moment (sfx.py).

    python floor_lines.py stability VIDEO [--region x0 y0 x1 y1]
    python floor_lines.py lifts BED.wav --windows a b [a b ...]
"""
import argparse
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

LOUDNESS_TARGET_LUFS = -14.0
LOUDNESS_TOLERANCE_LU = 1.0
MAX_TRUE_PEAK_DBTP = -1.0
SHARE_CAP_MIB = 29.0
LEVELS_SIGN_OFF = 'levels: awaiting by-ear approval'
LIFT_BEFORE_S = 8.0   # the bed is read over this stretch before each chapter window
LIFT_GAP_S = 1.0      # and stops this far short of it, clear of the ramp up
MIN_LIFT_LU = 1.0     # a lift under this reads as no lift (reported, never refused)
STABILITY_WIDTH = 160  # analysis width; shake is reported back in source pixels
STABILITY_CHUNKS, STABILITY_CHUNK_S = 6, 10.0  # long footage: six ten-second stretches spread through it
SMOOTH_S = 1.0        # the intended camera path is the path averaged over this window


def _fmt(value, unit=''):
    return 'unmeasured' if value is None else f'{value:g}{unit}'


def loudness_line(loudness, levels=None, file=None):
    """The finished file's loudness, measured after the encode. Never blocks here: the receipt's loudness check
    (make.py loudness_warnings) is what holds delivery, as before."""
    levels = levels or {}
    target = levels.get('final_integrated_lufs', LOUDNESS_TARGET_LUFS)
    tol = levels.get('tolerance_lu', LOUDNESS_TOLERANCE_LU)
    ceiling = levels.get('max_true_peak_dbtp', MAX_TRUE_PEAK_DBTP)
    i, tp = (loudness or {}).get('integrated'), (loudness or {}).get('true_peak')
    ok = i is not None and tp is not None and abs(i - target) <= tol and tp <= ceiling
    where = f' on {Path(file).name}' if file else ''
    return {'item': 'loudness', 'status': 'pass' if ok else 'fail', 'measured_after_encode': True,
            'integrated_lufs': i, 'true_peak_dbtp': tp, 'target_lufs': target, 'tolerance_lu': tol, 'max_true_peak_dbtp': ceiling,
            'line': f'loudness: {_fmt(i, " LUFS")} integrated (target {target:g} +-{tol:g}), true peak {_fmt(tp, " dBTP")} '
                    f'(at most {ceiling:g}), measured after the encode{where}: {"pass" if ok else "fail"}'}


def share_line(share, cap_mib=SHARE_CAP_MIB):
    """The share copy's size, measured from the file on disk, not from the encoder's own figure."""
    if not share or not share.get('file') or not Path(share['file']).is_file():
        return {'item': 'share', 'status': 'not_made', 'cap_mib': cap_mib,
                'line': f'share copy: not made (make.py --share-mib {cap_mib:g})'}
    mib = round(os.path.getsize(share['file']) / 1024 / 1024, 2)
    ok = mib < cap_mib
    return {'item': 'share', 'status': 'pass' if ok else 'fail', 'mib': mib, 'cap_mib': cap_mib, 'file': str(share['file']),
            'video_kbps': share.get('video_kbps'),
            'line': f'share copy: {mib:g} MiB measured on disk, under {cap_mib:g} MiB: {"pass" if ok else "fail"}'}


def chapter_lifts(bed, windows, meter=None):
    """How far the bed lifts in each chapter window over the bed just before it, on the bed stem alone.
    meter(path, start, end) -> integrated LUFS or None (music.ebur128's 'I' by default)."""
    if meter is None:
        import music
        meter = lambda path, a, b: music.ebur128(path, a, b)['I']
    rows = []
    for a, b in sorted((float(a), float(b)) for a, b in windows or () if b > a):
        before = (max(0.0, a - LIFT_GAP_S - LIFT_BEFORE_S), a - LIFT_GAP_S)
        lifted, under = meter(bed, a, b), meter(bed, *before) if before[1] - before[0] >= 2 else None
        lift = None if lifted is None or under is None else round(lifted - under, 1)
        rows.append({'window_s': [round(a, 3), round(b, 3)], 'chapter_lufs': lifted, 'bed_before_lufs': under, 'lift_lu': lift,
                     'lifts': lift is not None and lift >= MIN_LIFT_LU})
    return rows


def chapters_line(shape, bed, windows, meter=None):
    """The 16:9 cut's chapter lifts, measured; the levels' sign-off stays his by ear."""
    if shape != '16x9':
        return None
    if not bed:
        return {'item': 'chapters', 'status': 'no_bed', 'sign_off': LEVELS_SIGN_OFF,
                'line': f'chapter lifts: no music bed under this cut; {LEVELS_SIGN_OFF}'}
    if not windows:
        return {'item': 'chapters', 'status': 'no_chapters', 'sign_off': LEVELS_SIGN_OFF,
                'line': f'chapter lifts: no chapter windows in this cut; {LEVELS_SIGN_OFF}'}
    rows = chapter_lifts(bed, windows, meter)
    lifted = [r for r in rows if r['lifts']]
    measured = [r['lift_lu'] for r in rows if r['lift_lu'] is not None]
    span = f', +{min(measured):g} to +{max(measured):g} LU' if measured else ''
    return {'item': 'chapters', 'status': 'measured' if len(lifted) == len(rows) else 'short', 'windows': rows,
            'sign_off': LEVELS_SIGN_OFF,
            'line': f'chapter lifts: the bed lifts in {len(lifted)} of {len(rows)} chapter windows{span}; {LEVELS_SIGN_OFF}'}


def _profiles(raw, w, h):
    """A grey frame's column and row brightness profiles, each with its mean taken out."""
    cols = [0] * w
    rows = []
    for y in range(h):
        line = raw[y * w:(y + 1) * w]
        rows.append(sum(line))
        for x in range(w):
            cols[x] += line[x]
    mc, mr = sum(cols) / w, sum(rows) / h
    return [c - mc for c in cols], [r - mr for r in rows]


def _shift(a, b, most):
    """The shift of profile b against a (in profile samples), sub-sample by a parabola through the best match."""
    n = len(a)
    scores = []
    for d in range(-most, most + 1):
        lo, hi = max(0, d), min(n, n + d)
        if hi - lo < n // 2:
            scores.append(float('inf'))
            continue
        scores.append(sum(abs(a[i - d] - b[i]) for i in range(lo, hi)) / (hi - lo))
    k = min(range(len(scores)), key=scores.__getitem__)
    offset = 0.0
    if 0 < k < len(scores) - 1 and all(math.isfinite(s) for s in scores[k - 1:k + 2]):
        l, c, r = scores[k - 1], scores[k], scores[k + 1]
        den = l - 2 * c + r
        offset = 0.5 * (l - r) / den if den > 0 else 0.0
    return k - most + offset


def shake(steps, fps, scale=1.0):
    """RMS and 95th percentile of the camera path's distance from its own one-second average, in source pixels.
    steps: per frame (dx, dy) in analysis pixels, or None where the frame could not be read."""
    path, x, y, used = [], 0.0, 0.0, 0
    for step in steps:
        if step is not None:
            x, y, used = x + step[0], y + step[1], used + 1
        path.append((x, y))
    if len(path) < 3:
        return None
    half = max(1, round(fps * SMOOTH_S / 2))
    residual = []
    for i, (px, py) in enumerate(path):
        reach = min(half, i, len(path) - 1 - i)  # symmetric at the ends, so a steady pan reads as no shake
        near = path[i - reach:i + reach + 1]
        mx, my = sum(p[0] for p in near) / len(near), sum(p[1] for p in near) / len(near)
        residual.append(math.hypot(px - mx, py - my) * scale)
    ordered = sorted(residual)
    return {'rms_px': round(math.sqrt(sum(r * r for r in residual) / len(residual)), 2),
            'p95_px': round(ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))], 2),
            'frames': len(path), 'frames_with_motion': used}


def stability(video, region=None, start=None, seconds=None):
    """Measure the camera shake of a recording (an aim: measured and reported, never blocking)."""
    try:
        return _stability(video, region, start, seconds)
    except (OSError, ValueError, KeyError, IndexError, ZeroDivisionError, subprocess.CalledProcessError) as error:
        return {'item': 'stability', 'status': 'not_measured', 'aim': True, 'reason': str(error)[-300:],
                'line': 'stabilisation: not measured (the footage could not be read); an aim, never blocking'}


def _stability(video, region, start, seconds):
    """Global camera motion by integral projections: each frame's column and row brightness profiles, matched to the
    previous frame's. region (x0, y0, x1, y1, fractions of the frame) keeps the measure to the wall, so his own
    movement can be left out. Long footage is read in STABILITY_CHUNKS stretches of STABILITY_CHUNK_S spread through it."""
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                       'stream=width,height,avg_frame_rate:format=duration', '-of', 'json', str(video)],
                                      capture_output=True, text=True, check=True).stdout)
    stream = probe['streams'][0]
    a, b = (int(x) for x in stream['avg_frame_rate'].split('/'))
    fps = a / b if b else 24.0
    width, height = int(stream['width']), int(stream['height'])
    crop = ''
    if region:
        cw, ch = max(16, int((region[2] - region[0]) * width)), max(16, int((region[3] - region[1]) * height))
        crop = f'crop={cw}:{ch}:{int(region[0] * width)}:{int(region[1] * height)},'
        width, height = cw, ch
    w = STABILITY_WIDTH
    h = max(16, round(height * w / width / 2) * 2)
    scale = width / w
    begin = start or 0.0
    length = seconds if seconds is not None else float(probe.get('format', {}).get('duration') or 0) - begin
    if length <= STABILITY_CHUNKS * STABILITY_CHUNK_S:
        stretches = [(begin, length)]
    else:
        gap = (length - STABILITY_CHUNK_S) / (STABILITY_CHUNKS - 1)
        stretches = [(begin + k * gap, STABILITY_CHUNK_S) for k in range(STABILITY_CHUNKS)]
    most = max(2, round(w * 0.05))
    result, frames, moved = None, 0, 0
    sums = {'sq': 0.0, 'all': []}
    for at, span in stretches:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-ss', f'{at:.3f}', '-t', f'{span:.3f}', '-i', str(video),
                              '-an', '-vf', f'{crop}scale={w}:{h},format=gray', '-f', 'rawvideo', 'pipe:1'],
                             capture_output=True, check=True).stdout
        count = len(raw) // (w * h)
        steps, prior = [], None
        for k in range(count):
            cols, rows = _profiles(raw[k * w * h:(k + 1) * w * h], w, h)
            if prior is not None:
                steps.append((_shift(prior[0], cols, most), _shift(prior[1], rows, most)))
            prior = (cols, rows)
        got = shake(steps, fps, scale)
        if got:
            frames += got['frames']
            moved += got['frames_with_motion']
            sums['all'].append(got)
    if not sums['all']:
        return {'item': 'stability', 'status': 'not_measured', 'aim': True, 'reason': 'too few frames',
                'line': 'stabilisation: not measured (too few frames); an aim, never blocking'}
    rms = round(math.sqrt(sum(g['rms_px'] ** 2 * g['frames'] for g in sums['all']) / frames), 2)
    p95 = max(g['p95_px'] for g in sums['all'])
    return {'item': 'stability', 'status': 'measured', 'aim': True, 'blocking': False,
            'method': 'integral projections of grey frames matched frame to frame; camera path against its one-second average',
            'region': region, 'rms_px': rms, 'p95_px': p95, 'frames': frames, 'stretches': len(sums['all']),
            'line': f'stabilisation: camera shake {rms:g} px RMS, {p95:g} px at the 95th percentile, '
                    f'over {frames} frames (an aim: measured and reported, never blocking)'}


def lines(rows):
    return [r['line'] for r in rows if r]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('stability')
    s.add_argument('video')
    s.add_argument('--region', type=float, nargs=4)
    s.add_argument('--start', type=float)
    s.add_argument('--seconds', type=float)
    l = sub.add_parser('lifts')
    l.add_argument('bed')
    l.add_argument('--windows', type=float, nargs='+', required=True)
    a = ap.parse_args(argv)
    if a.cmd == 'stability':
        print(json.dumps(stability(a.video, a.region, a.start, a.seconds), indent=1))
    else:
        if len(a.windows) % 2:
            ap.error('--windows takes start and end pairs')
        print(json.dumps(chapters_line('16x9', a.bed, list(zip(a.windows[::2], a.windows[1::2]))), indent=1))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
