#!/usr/bin/env python3
"""A stretched picture on a finished cut: one line of pixels smeared into stripes (config/failures.json,
plate-smeared-into-stripes).

On 8 Nov the proactive-AI connected opening resized its breakfast plate from a one-row crop, so the whole picture
became vertical stripes. The session coordinating the work caught it by eye on one frame; nothing in the engine would
have. A smear has a signature no designed frame has: along the stripe the picture does not change at all, while across
the stripes it carries a photograph's detail. A flat card, a gradient or a blurred wall has no detail across, so it
is never a smear; a real picture changes in both directions.

How it measures: the cut is decoded once, in order, at SAMPLE_FPS, scaled to WIDTH pixels wide in grey. In each frame,
for each line (a row, then a column), `across` is the mean change between neighbouring pixels in that line and `along`
is the mean change from that line to the next. A line is smeared when across >= MIN_DETAIL and along <= MAX_RATIO x
across. A band of smeared lines covering at least MIN_BAND of the frame is a smeared frame. A cut fails when smeared
frames run on for at least PERSIST_S (a whip pan's motion blur lasts a few frames; a stretched plate stays). Nothing
here reads timestamps: a sample's time is its count over SAMPLE_FPS.

    python scripts/frame_smear.py measure CUT [--receipt] [--json]   exit 0 pass, 1 fail
    python scripts/frame_smear.py check CUT                           the receipt beside CUT, for these bytes

Receipt: <cut>.frame-smear.json, bound to the cut's sha256, written only on a pass. A hand-built cut is filed only with
it (scripts/post-pack/making.py), and ve qc reports the same measure as row picture.smeared (scripts/velib/qc.py).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SCHEMA_RECEIPT = 'frame-smear/1'
SUFFIX = '.frame-smear.json'
WIDTH = 270          # a quarter of 1080: detail survives, encoder noise averages out
SAMPLE_FPS = 4
MIN_DETAIL = 2.0     # mean grey-level change between neighbouring pixels across the stripes
MAX_RATIO = 0.12     # along the stripe the picture changes at most this share of its change across
MIN_BAND = 0.12      # of the frame's height (or width) before a band of smeared lines counts
PERSIST_S = 1.0      # smeared frames must run on this long before the cut fails

RULE = (f'no band of {MIN_BAND:.0%} or more of the frame whose lines repeat one line of picture (change along under '
        f'{MAX_RATIO:g} x change across, detail across at least {MIN_DETAIL:g}) for {PERSIST_S:g} s or more')


class FrameSmearError(Exception):
    pass


def sha256(path) -> str:
    with open(path, 'rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def bands(grey: np.ndarray) -> list[dict]:
    """The smeared bands of one grey frame: [{stripes: vertical|horizontal, from, to}] as shares of the frame."""
    grey = np.asarray(grey, np.float32)
    out = []
    for name, lines in (('vertical', grey), ('horizontal', grey.T)):
        if lines.shape[0] < 3 or lines.shape[1] < 3:
            continue
        along = np.abs(np.diff(lines, axis=0)).mean(axis=1)
        across = np.abs(np.diff(lines, axis=1)).mean(axis=1)[:-1]
        smeared = (across >= MIN_DETAIL) & (along <= MAX_RATIO * across)
        n, i = len(smeared), 0
        while i < n:
            if not smeared[i]:
                i += 1
                continue
            j = i
            while j < n and smeared[j]:
                j += 1
            if (j - i) / lines.shape[0] >= MIN_BAND:
                out.append({'stripes': name, 'from': round(i / lines.shape[0], 3), 'to': round(j / lines.shape[0], 3)})
            i = j
    return out


def frames(path) -> np.ndarray:
    """The cut's samples, grey, WIDTH wide, in decode order at SAMPLE_FPS: shape (n, h, WIDTH)."""
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                            '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout
    streams = json.loads(probe).get('streams') or []
    if not streams:
        raise FrameSmearError(f'{path}: no video stream')
    w, h = int(streams[0]['width']), int(streams[0]['height'])
    height = max(2, round(h * WIDTH / w / 2) * 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0', '-vf',
                          f'fps={SAMPLE_FPS},scale={WIDTH}:{height}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray',
                          '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, height, WIDTH)


def judge(samples) -> dict:
    """The verdict on a run of grey samples taken at SAMPLE_FPS."""
    flagged = [bands(s) for s in samples]
    runs, start = [], None
    for i, b in enumerate(flagged + [[]]):
        if b and start is None:
            start = i
        elif not b and start is not None:
            if (i - start) / SAMPLE_FPS >= PERSIST_S:
                runs.append({'from_s': round(start / SAMPLE_FPS, 2), 'to_s': round(i / SAMPLE_FPS, 2),
                             'bands': flagged[start]})
            start = None
    status = 'fail' if runs else 'pass'
    if not len(flagged):
        status = 'inconclusive'
    return {'schema': SCHEMA_RECEIPT, 'status': status, 'pass': status == 'pass', 'samples': len(flagged),
            'sample_fps': SAMPLE_FPS, 'rule': RULE, 'smears': runs}


def measure(path) -> dict:
    return judge(frames(path))


def receipt_path(video) -> Path:
    return Path(str(video) + SUFFIX)


def write_receipt(video, result: dict) -> Path:
    if not result.get('pass'):
        raise FrameSmearError(f'{Path(video).name}: a picture is smeared into stripes ({result.get("status")}); no receipt')
    out = receipt_path(video)
    out.write_text(json.dumps({**result, 'video': Path(video).name, 'video_sha256': sha256(video)}, indent=2),
                   encoding='utf-8')
    return out


def receipt_problems(video) -> list[str]:
    """[] when the cut beside its receipt was measured free of smeared pictures, for these exact bytes; else why not."""
    path = receipt_path(video)
    if not path.is_file():
        return [f'no smeared-picture receipt beside {Path(video).name}: run python scripts/frame_smear.py measure '
                f'{Path(video).name} --receipt (config/failures.json, plate-smeared-into-stripes)']
    try:
        doc = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return [f'{path.name} cannot be read']
    problems = []
    if doc.get('schema') != SCHEMA_RECEIPT:
        problems.append(f'{path.name} is not a smeared-picture receipt')
    if doc.get('video_sha256') != sha256(video):
        problems.append(f'{path.name} belongs to different bytes: the cut changed after it was measured')
    if doc.get('pass') is not True or doc.get('status') != 'pass':
        problems.append(f'{path.name} records a smeared picture')
    return problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    m = sub.add_parser('measure')
    m.add_argument('cut')
    m.add_argument('--receipt', action='store_true', help='write <cut>.frame-smear.json when it passes')
    m.add_argument('--json', action='store_true')
    c = sub.add_parser('check')
    c.add_argument('cut')
    a = ap.parse_args(argv)
    if a.cmd == 'check':
        problems = receipt_problems(a.cut)
        for p in problems:
            print(f'frame_smear: {p}')
        if not problems:
            print(f'frame_smear: {Path(a.cut).name} was measured free of smeared pictures')
        return 1 if problems else 0
    result = measure(a.cut)
    if a.json:
        print(json.dumps(result, indent=2))
    else:
        for r in result['smears']:
            print(f"  smeared {r['from_s']:.2f}s to {r['to_s']:.2f}s: " +
                  ', '.join(f"{b['stripes']} stripes over {b['from']:.0%} to {b['to']:.0%}" for b in r['bands']))
        print(f"frame_smear: {result['status']} ({result['samples']} samples at {SAMPLE_FPS} a second)")
    if a.receipt and result['pass']:
        print(f'frame_smear: receipt {write_receipt(a.cut, result)}')
    return 0 if result['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
