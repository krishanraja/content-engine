"""ve qc: measure a rendered cut and write qc.json bound to the file's sha256. Nothing here is a judgment;
each check is a number against a threshold. Checks without their optional inputs report not_run,
and `ve status` treats not_run as not ready. Promoted from the 27 Oct independent review's scripts."""
from __future__ import annotations

import re
import subprocess

import numpy as np

from .common import CONFIG, ROOT, ffmpeg, load_json, sha256_file

CHANGE_THRESHOLD = 1.0  # mean abs grey difference on 64x64 frames at 5 fps; above ambient drift (calibrated on the reference)
GRID = 64
SAMPLE_FPS = 5


def _ff(args: list[str]) -> str:
    result = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', *args], capture_output=True, text=True, errors='replace')
    return result.stderr


def duration_s(path: str) -> float:
    match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', _ff(['-i', path]))
    if not match:
        return 0.0
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def loudness(path: str) -> dict:
    text = _ff(['-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    summary = text[text.rfind('Summary:'):]
    integrated = re.search(r'I:\s+(-?[\d.]+) LUFS', summary)
    peak = re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary)
    return {'integrated_lufs': float(integrated.group(1)) if integrated else None,
            'true_peak_dbtp': float(peak.group(1)) if peak else None}


def long_silences(path: str, floor_db: int = -50, min_s: float = 0.7) -> list[list[float]]:
    text = _ff(['-i', path, '-vn', '-af', f'silencedetect=noise={floor_db}dB:d={min_s}', '-f', 'null', '-'])
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', text)]
    ends = [float(x) for x in re.findall(r'silence_end: (-?[\d.]+)', text)]
    return [[round(a, 2), round(b, 2)] for a, b in zip(starts, ends)]


def frame_diffs(path: str) -> np.ndarray:
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', path, '-vf', f'fps={SAMPLE_FPS},scale={GRID}:{GRID},format=gray',
                          '-f', 'rawvideo', '-'], capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, GRID, GRID).astype(np.float32)
    if len(frames) < 2:
        return np.zeros(0, np.float32)
    return np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))


def motion(diffs: np.ndarray) -> dict:
    seconds = len(diffs) // SAMPLE_FPS
    if seconds == 0:
        return {'change_density': 0.0, 'longest_still_s': 0, 'still_runs': [], 'loop_period_s': None}
    per_second = diffs[: seconds * SAMPLE_FPS].reshape(seconds, SAMPLE_FPS).max(axis=1)
    changing = per_second > CHANGE_THRESHOLD
    runs, current = [], 0
    for index, moving in enumerate(changing):
        if not moving:
            current += 1
        else:
            if current:
                runs.append((index - current, current))
            current = 0
    if current:
        runs.append((seconds - current, current))
    runs.sort(key=lambda r: -r[1])
    return {'change_density': round(float(changing.mean()), 3), 'longest_still_s': int(runs[0][1]) if runs else 0,
            'still_runs': [list(r) for r in runs[:6]], 'loop_period_s': loop_period(diffs)}


def loop_period(diffs: np.ndarray, min_s: float = 2.0, max_s: float = 10.0, strength: float = 0.8) -> float | None:
    """A repeating motion signature (the f % 180 redraw loop): a strong autocorrelation peak between 2 and 10 s."""
    signal = diffs - diffs.mean()
    if len(signal) < int(max_s * SAMPLE_FPS) * 2 or not signal.any():
        return None
    corr = np.correlate(signal, signal, mode='full')[len(signal) - 1:]
    corr = corr / (len(signal) - np.arange(len(signal)))  # unbiased: fewer overlapping samples at longer lags
    corr = corr / corr[0]
    lo, hi = int(min_s * SAMPLE_FPS), int(max_s * SAMPLE_FPS)
    lag = lo + int(np.argmax(corr[lo:hi]))
    return round(lag / SAMPLE_FPS, 2) if corr[lag] >= strength else None


def audio_samples(path: str, rate: int = 48000) -> np.ndarray:
    """Decode mono PCM; decoder errors are failures, never empty successful measurements."""
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(path), '-vn',
                             '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'], capture_output=True, check=True)
    samples = np.frombuffer(result.stdout, '<f4').astype(np.float64)
    if not len(samples) or not np.isfinite(samples).all():
        raise ValueError('No finite audio samples decoded')
    return samples


def pixel_box(region) -> tuple[int, int, int, int]:
    """A box is [x, y, width, height] or a mapping with those pixel coordinates."""
    if isinstance(region, dict):
        region = [region[k] for k in ('x', 'y', 'width', 'height')]
    x, y, w, h = map(int, region)
    if x < 0 or y < 0 or w <= 0 or h <= 0:
        raise ValueError('Invalid pixel box')
    return x, y, w, h


def gray_frames(path: str, first: int, last: int, region) -> np.ndarray:
    """Decode inclusive original frame indexes, without resampling the media clock."""
    x, y, w, h = pixel_box(region)
    if first < 0 or last < first:
        raise ValueError('Invalid frame range')
    filt = f'select=between(n\\,{first}\\,{last}),crop={w}:{h}:{x}:{y}:exact=1,format=gray'
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(path), '-an',
                             '-vf', filt, '-fps_mode', 'passthrough', '-frames:v', str(last - first + 1),
                             '-f', 'rawvideo', '-'],
                            capture_output=True, check=True)
    frames = np.frombuffer(result.stdout, np.uint8).reshape(-1, h, w).astype(np.float32)
    if len(frames) != last - first + 1:
        raise ValueError('Missing requested video frames')
    return frames


def frame_span(item: dict, fps: float = 30) -> tuple[int, int]:
    """Engine intervals are half-open fromFrame/toFrame (or durationFrames)."""
    if 'fromFrame' in item:
        first = int(item['fromFrame'])
        last = int(item['toFrame']) if 'toFrame' in item else first + int(item['durationFrames'])
    else:
        first = round(float(item['start_s']) * fps)
        last = round(float(item['end_s']) * fps)
    if first < 0 or last <= first:
        raise ValueError('Invalid time span')
    return first, last


def measurement(rows: list, target: str) -> dict:
    return {'value': rows, 'target': target, 'pass': bool(rows) and all(r['pass'] for r in rows),
            'status': 'measured'}


def _renderer_layouts() -> dict:
    """Slot boxes parsed from the renderer's own table (apps/renderer/src/engine/layouts/index.ts),
    so QC can never measure a stale copy. Boxes are x, y, width, height in beat.uses order."""
    source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'index.ts').read_text(encoding='utf-8')
    result = {}
    for aspect, name in (('9:16', 'TALL'), ('16:9', 'WIDE')):
        block = re.search(r'const ' + name + r': Record<Layout, readonly Box\[\]> = \{(.*?)\n\}\n', source, re.S).group(1)
        result[aspect] = {layout: [tuple(int(n) for n in re.findall(r'-?\d+', box)) for box in re.findall(r'\{ left:[^}]*\}', body)]
                          for layout, body in re.findall(r'\n  (\w+): \[(.*?)\n  \],', block, re.S)}
    return result


def inputs_from_props(props: dict) -> dict:
    """Resolve QC inputs on the renderer's global 30 fps clock."""
    # Mirrors apps/renderer/src/engine/layouts/index.ts, slotsFor():
    # boxes are x, y, width, height in beat.uses order, authored per aspect.
    layouts = _renderer_layouts()
    aspect, beats, events = props['aspect'], props['beats'], props['events']
    slots = {}
    for event in events:
        at = event['atFrame']
        active = [b for b in beats if b['fromFrame'] <= at < b['toFrame'] and event['obj'] in b['uses']]
        # An exit on a beat's exclusive end measures the departing object's box.
        if not active and event.get('verb') == 'exit':
            active = [b for b in beats if b['toFrame'] == at and event['obj'] in b['uses']]
        if len(active) != 1:
            raise ValueError(f"Cue {event.get('id', event['obj'])} has no unique beat slot")
        beat = active[0]
        box = layouts[aspect][beat['layout']][beat['uses'].index(event['obj'])]
        slots[event.get('id', event['obj'])] = box
        slots.setdefault(event['obj'], box)
    # boxFor('caption') in apps/renderer/src/engine/geometry.ts, using
    # HOUSE.caption in apps/renderer/src/house/geometry.ts; round outwards.
    region = (72, 1180, 900, 217) if aspect == '9:16' else (260, 773, 1400, 187)
    stem = props['audio']['stem']
    # The stem is already assembled. Source-take trims in props.segments must
    # never be applied to it; compare each beat at its position in this master.
    edl = [{'fromFrame': b['fromFrame'], 'toFrame': b['toFrame'],
            'trimBeforeFrames': b['fromFrame'] + stem.get('trimBeforeFrames', 0)} for b in beats]
    joins = sorted({s['fromFrame'] / props.get('fps', 30) for s in props.get('segments', []) if s['fromFrame'] > 0})
    return dict(pages=props['captions'], beats=beats, aspect=aspect, events=events, slots=slots,
                region=region, mark_png=props['brand']['mark']['src'], dialogue_master=stem['src'],
                edl=edl, joins=joins)


def run_qc(path: str, format_id: str, targets: dict | None = None, *,
           dialogue_master: str | None = None, edl=None, joins=None, pages=None, region=None,
           mark_png: str | None = None, beats=None, aspect=None, events=None, slots=None) -> dict:
    fmt = load_json(CONFIG / 'formats' / f'{format_id}.json')['qc']
    targets = targets or {'lufs': -14, 'tp': -1}
    loud = loudness(path)
    move = motion(frame_diffs(path))
    silences = long_silences(path)
    checks = {
        'loudness.integrated': {'value': loud['integrated_lufs'], 'target': f"{targets['lufs']} ±1",
                                'pass': loud['integrated_lufs'] is not None and abs(loud['integrated_lufs'] - targets['lufs']) <= 1},
        'loudness.true_peak': {'value': loud['true_peak_dbtp'], 'target': f"<= {targets['tp']}",
                               'pass': loud['true_peak_dbtp'] is not None and loud['true_peak_dbtp'] <= targets['tp']},
        'loudness.long_silence': {'value': silences, 'target': 'none over 0.7 s below -50 dB', 'pass': not silences},
        'motion.change_density': {'value': move['change_density'], 'target': f">= {fmt.get('change_density_min', 0)}",
                                  'pass': move['change_density'] >= fmt.get('change_density_min', 0)},
        'motion.longest_still': {'value': move['longest_still_s'], 'target': f"<= {fmt.get('longest_still_s', 99)} s",
                                 'pass': move['longest_still_s'] <= fmt.get('longest_still_s', 99), 'runs': move['still_runs']},
        'motion.periodicity': {'value': move['loop_period_s'], 'target': 'no repeating loop 2-10 s', 'pass': move['loop_period_s'] is None},
    }
    for name in ('sync.av_xcorr', 'joins.decoder', 'captions.ocr', 'brand.mark_tile', 'motion.cue_sync'):
        checks[name] = {'value': None, 'target': 'see config/ve/crew', 'pass': None, 'status': 'not_run'}
    from . import qc_sync, qc_joins, qc_captions, qc_brand, qc_cues
    optional = [
        ('sync.av_xcorr', dialogue_master is not None and edl is not None,
         lambda: qc_sync.av_xcorr(path, dialogue_master, edl)),
        ('joins.decoder', joins is not None, lambda: qc_joins.decoder(path, joins)),
        ('captions.ocr', pages is not None and region is not None, lambda: qc_captions.ocr(path, pages, region)),
        ('brand.mark_tile', mark_png is not None and beats is not None and aspect is not None,
         lambda: qc_brand.mark_tile(path, mark_png, beats, aspect)),
        ('motion.cue_sync', events is not None and slots is not None, lambda: qc_cues.cue_sync(path, events, slots)),
    ]
    for name, supplied, measure in optional:
        if supplied:
            try:
                checks[name] = measure()
            except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
                checks[name] = {'value': None, 'target': 'valid decodable measurement inputs',
                                'pass': False, 'status': 'error', 'reason': str(exc)}
    built = [c['pass'] for c in checks.values() if c['pass'] is not None]
    return {'file': path, 'sha256': sha256_file(path), 'duration_s': round(duration_s(path), 3), 'format': format_id,
            'checks': checks, 'measured_pass': all(built),
            'complete': all(c['pass'] is not None and c.get('status') != 'incomplete' for c in checks.values())}
