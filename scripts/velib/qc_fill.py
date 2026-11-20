"""panel.fill: the panel's object fills its region, measured on the rendered frames (shot grammar step 5).

The grammar holds "a device fills at least 0.85 of its region" before render by the device list (grammar.region,
fills_region); the 20 Nov recipe samples still drew a small number in a large dark field and checklists filling about
half the panel, and nothing measured the render. This reads the cut: on every body beat of a band or stage cut (his
panel staging; anchor has no panel, a plate is its own frame), sampled at sample_fps, the extent of what is drawn in the
devices' region (the columns where anything differs from the panel's ink), as a share of the region's width. A run of
samples under the share for longer than max_under_s fails. The title, the end card, chapter marks (him beside his own
mark, the panel resting) and the frames of each beat's entrance are left out.

The region is kit/staging.ts's own (velib/keepout.py STAGED and CUTOUT), cut clear of the captions as the renderer cuts
it (clear_of_captions, kit/staging.ts clearOfCaptions). Numbers: config/ve/shot-grammar.json depth.panel_fill.
"""
from __future__ import annotations

import subprocess

import numpy as np

from . import keepout
from .common import CONFIG, load_json

GAP = 24
ENTRANCE_S = 0.4         # a device's entrance: not yet its full width
SKIP_SHOTS = ('title', 'end', 'chapter', 'plate')


def settings() -> dict:
    return load_json(CONFIG / 'shot-grammar.json')['depth']['panel_fill']


def clear_of_captions(region: tuple, aspect: str, placement: str | None, themed: bool) -> tuple:
    """kit/staging.ts clearOfCaptions: cut a region clear of the caption band, keeping the larger free side."""
    band = keepout.theme_bands()[aspect][placement or 'lower'] if themed else (
        (70, 1090, 800, 230) if aspect == '9:16' else (192, 790, 1536, 236))
    x, top, w, h = region
    bottom = top + h
    b_top, b_bottom = band[1] - GAP, band[1] + band[3] + GAP
    if b_bottom <= top or b_top >= bottom:
        return region
    above, below = b_top - top, bottom - b_bottom
    return (x, top, w, max(0, above)) if above >= below else (x, b_bottom, w, max(0, below))


def region_for(props: dict) -> tuple | None:
    """The devices' region of a band or stage cut, as the renderer draws it; None for any other staging."""
    mode = (props.get('layout') or {}).get('mode')
    aspect = props.get('aspect')
    if mode not in ('band', 'stage', 'pillar') or (mode, aspect) not in keepout.STAGED:
        return None
    region = keepout.STAGED[(mode, aspect)][1]
    if props.get('matte') and (mode, aspect) in keepout.CUTOUT:
        region = keepout.CUTOUT[(mode, aspect)]
    return clear_of_captions(region, aspect, props.get('captionPlacement'), bool(props.get('captionTheme')))


def fill_share(rgb: np.ndarray, ink: tuple, threshold: int = 70, column_share: float = 0.015) -> float:
    """How wide what is drawn is, as a share of the crop's width: from the first to the last column where at least
    column_share of the rows differ from the ink by more than threshold in any channel."""
    diff = np.abs(rgb.astype(np.int16) - np.array(ink, dtype=np.int16)).max(axis=2) > threshold
    cols = np.flatnonzero(diff.mean(axis=0) >= column_share)
    if cols.size == 0:
        return 0.0
    return float(cols[-1] - cols[0] + 1) / rgb.shape[1]


def hex_rgb(value: str) -> tuple:
    v = value.lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def body_frames(props: dict) -> list[tuple[int, int]]:
    """The cut frames the panel must be full on: band and stage beats past their entrance, minus the title's frames."""
    out = []
    moment = props.get('titleMoment') or {}
    for beat in props.get('beats') or []:
        if beat.get('shot') in SKIP_SHOTS:
            continue
        start = beat['fromFrame'] + round(ENTRANCE_S * 30)
        end = beat['toFrame']
        if moment and moment['fromFrame'] < end and moment['toFrame'] > start:
            if moment['fromFrame'] > start:
                out.append((start, moment['fromFrame']))
            start = max(start, moment['toFrame'])
        if props.get('ending') and end > props['ending']['fromFrame']:
            end = props['ending']['fromFrame']
        if end > start:
            out.append((start, end))
    return out


def runs_under(samples: list[tuple[int, float]], share: float, fps_sample: float, max_s: float) -> list[dict]:
    """Runs of consecutive samples under `share` longer than max_s: [{from_frame, seconds, least}]."""
    out, run = [], []
    step = 30 / fps_sample

    def close():
        if run and len(run) / fps_sample > max_s + 1e-9:
            out.append({'from_frame': run[0][0], 'seconds': round(len(run) / fps_sample, 2),
                        'least': round(min(v for _f, v in run), 3)})
    prev = None
    for frame, value in samples:
        if value < share and (not run or prev is None or frame - prev <= step + 1):
            run.append((frame, value))
        else:
            close()
            run = [(frame, value)] if value < share else []
        prev = frame
    close()
    return out


def measure(path: str, props: dict, *, to_file=lambda f: f, read=None) -> dict:
    """{'region', 'samples', 'runs'} for a rendered cut; `read` (tests) returns the region's crop for a file frame."""
    cfg = settings()
    region = region_for(props)
    if region is None:
        return {'region': None, 'samples': 0, 'runs': []}
    x, y, w, h = region
    ink = hex_rgb(props['tokens']['ink'])
    windows = body_frames(props)
    wanted = sorted({f for a, b in windows for f in range(a, b, round(30 / cfg['sample_fps']))})
    samples = []
    if read is None:
        frames = _decode(path, region, wanted, to_file)
    else:
        frames = ((f, read(to_file(f))) for f in wanted)
    for f, crop in frames:
        if crop is not None:
            samples.append((f, fill_share(crop, ink)))
    return {'region': region, 'samples': len(samples), 'runs': runs_under(samples, cfg['share'], cfg['sample_fps'], cfg['max_under_s']),
            'median': round(float(np.median([v for _f, v in samples])), 3) if samples else None}


def _decode(path: str, region: tuple, wanted: list[int], to_file):
    """Every file frame of the region, half size, once; yields (cut frame, crop) for the wanted ones."""
    x, y, w, h = region
    hw, hh = w // 2, h // 2
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'crop={w}:{h}:{x}:{y},scale={hw}:{hh}',
                             '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    want = {to_file(f): f for f in wanted}
    size = hw * hh * 3
    index = 0
    try:
        while True:
            data = proc.stdout.read(size)
            if len(data) < size:
                break
            if index in want:
                yield want[index], np.frombuffer(data, np.uint8).reshape(hh, hw, 3)
            index += 1
    finally:
        proc.stdout.close()
        proc.wait()


def row(path: str | None, props: dict, *, to_file=lambda f: f, read=None) -> dict:
    cfg = settings()
    target = f"the panel's object fills at least {cfg['share']} of its region's width, never under it past {cfg['max_under_s']} s"
    if region_for(props) is None:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not applicable',
                'reason': 'a band or stage cut only (anchor has no panel)'}
    if not path and read is None:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': 'no rendered file'}
    try:
        found = measure(path or '', props, to_file=to_file, read=read)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': str(error)[:300]}
    return {'value': {'region': found['region'], 'samples': found['samples'], 'median': found['median'], 'under': found['runs'][:20]},
            'target': target, 'pass': not found['runs']}
