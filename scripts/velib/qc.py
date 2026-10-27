"""ve qc: measure a rendered cut and write qc.json bound to the file's sha256. Nothing here is a judgment;
each check is a number against a threshold from the format card. Checks not built yet report not_run,
and `ve status` treats not_run as not ready. Promoted from the 27 Oct independent review's scripts."""
from __future__ import annotations

import re
import subprocess

import numpy as np

from .common import CONFIG, ffmpeg, load_json, sha256_file

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


def run_qc(path: str, format_id: str, targets: dict | None = None) -> dict:
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
    built = [c['pass'] for c in checks.values() if c['pass'] is not None]
    return {'file': path, 'sha256': sha256_file(path), 'duration_s': round(duration_s(path), 3), 'format': format_id,
            'checks': checks, 'measured_pass': all(built), 'complete': all(c['pass'] is not None for c in checks.values())}
