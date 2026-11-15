"""Where the beat is in a music bed: onset strength, tempo, bars, drops, and how sure the reading is.

It only measures. Nothing in ve snaps a picture to a beat: his words and his pauses are the clock, and tempo is never
the bar (docs/production/THE_BAR.md, "What is not the bar"). The reading is for the session and the Critic to know the
bed under a cut, and for the ledger to hold each track's grid once, measured on the machine that has the music.

  onset strength  how much new sound starts in each 11.6 ms step (the rise of a log spectrum, summed over frequency),
                  and the onsets a second it peaks at;
  tempo           beats a minute, from the onset strength's strongest repeat between 60 and 180 a minute;
  confidence      that repeat's height over the average repeat across the whole range: 1.0 means no steady pulse at
                  all. Below CONFIDENT (1.5) no grid is given, because a bed with no steady pulse has no bars to name;
  grid            the beats (a steady tempo, from the phase that lands most beats on onsets) and the bars, four beats
                  a bar, starting on the beat with the most low-frequency attack (the kick);
  drops           where the bed gets at least DROP_DB louder over the next two bars than over the two before, on a bar
                  line when there is a grid, else on the second.

    python scripts/ve.py beats FILE [--out beats.json]       read one file
    python scripts/ve.py beats --grid TRACK_ID [--write]      a ledger track, on the machine with MINDMAKE_MUSIC_ROOT
    python scripts/ve.py beats --grid --all [--write]         every track in config/music-library.json

`--write` puts the compact grid into that track's row of config/music-library.json (`beats`); only a home computer
holding the music can run it, so the data is never typed in by hand. `qc_row` is ve qc's advisory `music.beats` row:
measured, shown to the Critic, never counted.
"""
from __future__ import annotations

import datetime as dt
import subprocess
from pathlib import Path

import numpy as np

from .common import ffmpeg, sha256_file

SR = 22050
HOP = 256
N_FFT = 1024
RATE = SR / HOP                    # onset-strength steps a second
BPM_LO, BPM_HI = 60.0, 180.0
PRIOR_BPM, PRIOR_OCTAVES = 120.0, 1.0   # a soft lean toward the usual tempo when two octaves repeat equally
CONFIDENT = 1.5
BEATS_PER_BAR = 4
LOW_HZ = 200.0
DROP_DB = 6.0
DROP_BARS = 2
DROP_GAP_BARS = 4
ON_A_BEAT_S = 2 / 30               # two frames at 30 fps
NOTE = 'Measured; nothing snaps to it. His words and pauses are the clock (THE_BAR: tempo is not the bar).'


def decode(path, sr: int = SR) -> np.ndarray:
    """The file as mono samples at sr."""
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def onset_strength(samples: np.ndarray, sr: int = SR) -> tuple[np.ndarray, np.ndarray]:
    """(full band, low band) onset strength, one value a HOP: the positive rise of a log-magnitude spectrum, summed over
    frequency, less its own half-second average, never below zero. Read in blocks so a long track stays small."""
    x = np.asarray(samples, dtype=np.float64)
    if len(x) < N_FFT:
        x = np.pad(x, (0, N_FFT - len(x)))
    view = np.lib.stride_tricks.sliding_window_view(x, N_FFT)[::HOP]
    window = np.hanning(N_FFT)
    low = np.fft.rfftfreq(N_FFT, 1 / sr) < LOW_HZ
    full, bass, previous = [], [], None
    for start in range(0, len(view), 2048):
        spectrum = np.log1p(100 * np.abs(np.fft.rfft(view[start:start + 2048] * window, axis=1)))
        stacked = spectrum if previous is None else np.vstack([previous[None, :], spectrum])
        rise = np.maximum(0.0, np.diff(stacked, axis=0))
        if previous is None:
            rise = np.vstack([np.zeros((1, spectrum.shape[1])), rise])
        full.append(rise.sum(axis=1))
        bass.append(rise[:, low].sum(axis=1))
        previous = spectrum[-1]
    return tuple(_less_local_mean(np.concatenate(band)) for band in (full, bass))


def _less_local_mean(env: np.ndarray, seconds: float = 0.5) -> np.ndarray:
    width = max(1, int(round(seconds * RATE)))
    local = np.convolve(env, np.ones(width) / width, mode='same')
    return np.maximum(0.0, env - local)


def _time(step: float) -> float:
    """An onset-strength step's time: the centre of its analysis window."""
    return (step * HOP + N_FFT / 2) / SR


def _autocorr(env: np.ndarray, max_lag: int) -> np.ndarray:
    n = len(env)
    f = np.fft.rfft(env, 2 * n)
    ac = np.fft.irfft(f * np.conj(f))[:max_lag + 1]
    return ac / np.maximum(1, n - np.arange(max_lag + 1))


def tempo(env: np.ndarray) -> tuple[float | None, float]:
    """(beats a minute, confidence) from the onset strength's repeats between BPM_LO and BPM_HI."""
    lo, hi = int(np.floor(RATE * 60 / BPM_HI)), int(np.ceil(RATE * 60 / BPM_LO))
    if len(env) < 2 * hi or not np.any(env > 0):
        return None, 0.0
    ac = _autocorr(env, hi + 1)
    lags = np.arange(lo, hi + 1)
    span = ac[lo:hi + 1]
    mean = float(span.mean())
    if mean <= 0:
        return None, 0.0
    prior = np.exp(-0.5 * (np.log2((RATE * 60 / lags) / PRIOR_BPM) / PRIOR_OCTAVES) ** 2)
    best = int(lags[np.argmax(span * prior)])
    # Between steps: the top of the parabola through the peak and its neighbours.
    a, b, c = ac[best - 1], ac[best], ac[best + 1]
    bend = a - 2 * b + c
    exact = best + (0.5 * (a - c) / bend if bend < 0 else 0.0)
    return RATE * 60 / exact, float(b) / mean


def _sample(env: np.ndarray, steps: np.ndarray, reach: int = 2) -> np.ndarray:
    """The strongest onset within reach steps of each step."""
    out = []
    for step in np.round(steps).astype(int):
        a, b = max(0, step - reach), min(len(env), step + reach + 1)
        out.append(env[a:b].max() if b > a else 0.0)
    return np.asarray(out)


def grid(env: np.ndarray, low: np.ndarray, bpm: float) -> dict:
    """A steady grid at this tempo: the phase that lands most beats on onsets, and four beats a bar from the beat with
    the most low-frequency attack."""
    period = RATE * 60 / bpm
    phases = np.arange(0, period, 0.5)
    scores = [float(_sample(env, np.arange(phase, len(env), period), 1).sum()) for phase in phases]
    phase = float(phases[int(np.argmax(scores))])
    steps = np.arange(phase, len(env), period)
    kicks = _sample(low, steps)
    starts = [float(kicks[k::BEATS_PER_BAR].mean()) if len(kicks[k::BEATS_PER_BAR]) else 0.0 for k in range(BEATS_PER_BAR)]
    offset = int(np.argmax(starts))
    beats = [round(float(_time(s)), 3) for s in steps]
    return {'period_s': round(60 / bpm, 4), 'first_beat_s': beats[0] if beats else None, 'beats_per_bar': BEATS_PER_BAR,
            'bar_offset': offset, 'beats_s': beats, 'bars_s': beats[offset::BEATS_PER_BAR]}


def _db(samples: np.ndarray) -> float:
    return float(10 * np.log10(np.mean(samples ** 2) + 1e-12)) if len(samples) else -120.0


def drops(samples: np.ndarray, sr: int, marks: list[float], span: int = DROP_BARS, gap: int = DROP_GAP_BARS) -> list[dict]:
    """Where the next `span` sections are at least DROP_DB louder than the `span` before; each section runs from one
    mark to the next (bar lines, or seconds). The strongest rise wins within `gap` sections."""
    edges = [int(round(t * sr)) for t in marks] + [len(samples)]
    level = [_db(samples[a:b]) for a, b in zip(edges[:-1], edges[1:])]
    power = 10 ** (np.asarray(level) / 10)
    found = []
    for i in range(span, len(level) - span + 1):
        before = 10 * np.log10(power[i - span:i].mean() + 1e-12)
        after = 10 * np.log10(power[i:i + span].mean() + 1e-12)
        if after - before >= DROP_DB:
            found.append((after - before, i))
    kept: list[tuple[float, int]] = []
    for rise, i in sorted(found, reverse=True):
        if all(abs(i - j) >= gap for _, j in kept):
            kept.append((rise, i))
    return [{'at_s': round(float(marks[i]), 3), 'rise_db': round(float(rise), 1)} for rise, i in sorted(kept, key=lambda r: r[1])]


def onsets_per_s(env: np.ndarray, duration_s: float) -> float:
    """Peaks of the onset strength above its mean plus one spread, at least 0.1 s apart, a second."""
    if duration_s <= 0 or not len(env):
        return 0.0
    floor = env.mean() + env.std()
    reach = max(1, int(0.1 * RATE))
    peaks, last = 0, -reach
    for i in range(1, len(env) - 1):
        if env[i] > floor and env[i] >= env[i - 1] and env[i] >= env[i + 1] and i - last >= reach:
            peaks, last = peaks + 1, i
    return round(peaks / duration_s, 2)


def analyse(samples: np.ndarray, sr: int = SR) -> dict:
    """The whole reading of one bed."""
    duration = len(samples) / sr
    env, low = onset_strength(samples, sr)
    bpm, confidence = tempo(env)
    out = {'duration_s': round(duration, 3), 'onsets_per_s': onsets_per_s(env, duration),
           'tempo_bpm': round(float(bpm), 1) if bpm else None, 'confidence': round(float(confidence), 2), 'confident_from': CONFIDENT,
           'grid': None, 'note': NOTE}
    if bpm and confidence >= CONFIDENT:
        out['grid'] = grid(env, low, bpm)
        out['drops'] = drops(samples, sr, out['grid']['bars_s'])
    else:
        out['no_grid'] = (f'confidence {out["confidence"]} is under {CONFIDENT}: no steady pulse to put a grid on'
                          if bpm else 'too short, or silent, to read a tempo')
        out['drops'] = drops(samples, sr, [float(t) for t in np.arange(0, duration, 1.0)])
    return out


def read(path) -> dict:
    """The reading of one audio file, with its bytes named."""
    return {'file': Path(path).name, 'sha256': sha256_file(Path(path)), **analyse(decode(path))}


def ledger_entry(reading: dict, on: str | None = None) -> dict:
    """What a ledger track keeps: the grid as numbers a session can rebuild every beat from, never the beat list."""
    g = reading.get('grid') or {}
    return {'tempo_bpm': reading.get('tempo_bpm'), 'confidence': reading.get('confidence'),
            'period_s': g.get('period_s'), 'first_beat_s': g.get('first_beat_s'), 'beats_per_bar': g.get('beats_per_bar'),
            'bar_offset': g.get('bar_offset'), 'drops_s': [d['at_s'] for d in reading.get('drops') or []],
            'grid': bool(g), 'of_sha256': reading.get('sha256'), 'measured_on': on or dt.date.today().isoformat(),
            'by': 'python scripts/ve.py beats --grid', 'note': NOTE}


def track_reading(track: dict, root) -> dict:
    """A ledger track's reading, from its file under the music root; refused when the bytes are not the ledger's."""
    path = Path(root) / Path(track['file']).name
    if not path.is_file():
        raise FileNotFoundError(f'{track["id"]}: {path.name} is not in the music folder ({root})')
    reading = read(path)
    if track.get('sha256') and reading['sha256'] != track['sha256']:
        raise ValueError(f'{track["id"]}: {path.name} does not match the ledger sha256')
    return reading


def qc_row(music_wav, beats: list[dict] | None, fps: float = 30) -> dict:
    """ve qc's `music.beats`: the bed under this cut as heard (the premix's music stem), and where the cut's handovers
    fall against its beats. Advisory and shadow: measured, shown to the Critic, never counted, never a target."""
    reading = analyse(decode(music_wav))
    handovers = [int(b['fromFrame']) / fps for b in (beats or [])[1:]]
    beats_s = np.asarray((reading.get('grid') or {}).get('beats_s') or [])
    on_beat = None
    if len(beats_s):
        on_beat = int(sum(1 for t in handovers if np.min(np.abs(beats_s - t)) <= ON_A_BEAT_S + 1e-9))
    value = {'tempo_bpm': reading['tempo_bpm'], 'confidence': reading['confidence'], 'grid': reading['grid'] is not None,
             'bars': len((reading.get('grid') or {}).get('bars_s') or []), 'drops_s': [d['at_s'] for d in reading['drops']],
             'onsets_per_s': reading['onsets_per_s'], 'handovers': len(handovers), 'handovers_on_a_beat': on_beat}
    return {'value': value, 'target': 'measured only: nothing snaps to the beat; his words are the clock',
            'pass': None, 'status': 'advisory', 'shadow': True}
