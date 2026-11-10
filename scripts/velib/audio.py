"""ve audio: the premixed stem every render carries (dialogue + bed), mastered to the spec's targets.
One clock: the stem starts at frame 0 of the render, so picture, captions and events all read the same time. That is
the cut's own frame 0, or, on a cut that opens on the intro sting (props.sting), the sting's first frame: the dialogue is
then laid from sample sting.frames x 48000 / 30 (89600 for 56 frames), counted in samples, silent under the sting, and
the bed runs from sample 0 under it (Krish, 2026-11-05: "I think it should go at the start of the longer wide videos
100%,"; the sting has no sound of its own).
Two-pass loudnorm on the sum, true peak limited after it, then measured again; nothing is assumed.

Bed modes (spec audio.bed.mode):
- continuous: one flat gain, under_vo_lu below the voice's integrated loudness, short fades.
- ducked: refused. A bed keyed by the voice pumps on every phrase (Krish, 2026-11-04: "the volume of the backing
  music goes up and down about 30 or 40 times in 90 seconds"); nothing here keys music to the voice.
- episode_bed: the long-cut bed (config/learnings.json deep-cut-music-always-under). One continuous low bed at the
  ledger's bed_lufs (-31, approved by ear) in the finished master, never keyed by the voice, in the one bed shape
  (config/music-bed.json, scripts/bed_shape.py): intro_lufs for the open, eased down to the bed, held under his
  voice, up to outro_lufs from his last word, faded over the last second, lifting only at chapter cards (to
  chapter_lufs). The bed stem is checked against the shape before the mix and the premix stops when it misses. It plays around the track's own stops (a break where the music falls silent) and
  restarts the track when the cut outlasts it (from where its body begins, never its quiet intro), each join under a 2 s equal-power crossfade, and a
  slow gain ride keyed by the music itself (1.5 s, at most 8 dB either way) holds the track's own loud and quiet
  passages to one level. Krish, Gate 2, 2026-10-30, of the ducked bed on Friday 23's long cut: "Sometimes it just
  turns off randomly. Sometimes it's quiet. Sometimes it gets louder. It's not professional at all."
All modes measure the bed against the voice from the stems and write `<stem>.bed.json` beside the stem, which
`ve qc` reads (qc_audio.bed)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import numpy as np

from .common import ROOT, ffmpeg

if str(ROOT / 'scripts') not in __import__('sys').path:
    __import__('sys').path.append(str(ROOT / 'scripts'))
import bed_shape  # noqa: E402  the one bed shape, shared with quick-edit

SR = 48000
WINDOW_S = 0.5
# The episode bed (mode episode_bed).
CROSSFADE_S = 2.0
LIFT_RISE_S, LIFT_FALL_S = bed_shape.shape()['chapter_rise_s'], bed_shape.shape()['chapter_fall_s']
# The ride follows the track's own passages over 1.5 s (3 s left a swell at each passage change that the one bed
# shape counts as the bed going up and down, config/music-bed.json).
LEVEL_WINDOW_S, LEVEL_SMOOTH_S, LEVEL_MAX_DB = 0.5, 1.5, 8.0
GAP_WINDOW_S, GAP_MEDIAN_S, GAP_BELOW_DB, GAP_MIN_S = 0.05, 3.0, 15.0, 0.25
STOP_PAD_S, TAIL_BELOW_DB = 0.15, 12.0
INTRO_SPAN_S, INTRO_STEP_S, INTRO_SPARSE_SHARE = 4.0, 0.25, 0.1
EPISODE_LEVELS = ('bed_lufs', 'intro_lufs', 'outro_lufs')


def _measure(path: str) -> dict:
    text = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
                          capture_output=True, text=True, errors='replace').stderr
    return json.loads(text[text.rfind('{'):text.rfind('}') + 1])


def _decode(path: str) -> np.ndarray:
    """Mono float samples at 48 kHz."""
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', 'pipe:1'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def _window_db(samples: np.ndarray) -> np.ndarray:
    """RMS in dBFS per 0.5 s window (the last partial window is dropped)."""
    size = int(SR * WINDOW_S)
    count = len(samples) // size
    if count == 0:
        return np.array([])
    blocks = samples[:count * size].astype(np.float64).reshape(count, size)
    return 10 * np.log10(np.maximum((blocks ** 2).mean(axis=1), 1e-12))


def analyse(voice: np.ndarray, bed: np.ndarray, *, last_word_end_s: float | None = None, from_s: float = 1.5) -> dict:
    """Bed level under speech and in pauses, in dB relative to the voice's speech-window RMS, from the two stems.
    Speech windows are within 10 dB of the active voice level; pause windows are 30 dB or more below it. The first
    from_s (1.5 s of fade in, or the sting when it is longer) and everything after the last word are left out, so only
    the music under a talking voice and in its real pauses is measured."""
    n = min(len(voice), len(bed))
    voice, bed = voice[:n], bed[:n]
    v, b = _window_db(voice), _window_db(bed)
    m = min(len(v), len(b))
    v, b = v[:m], b[:m]
    times = (np.arange(m) + 0.5) * WINDOW_S
    end = last_word_end_s if last_word_end_s is not None else times[-1] + 1
    inside = (times > from_s) & (times < end)
    active = v > np.percentile(v[inside], 95) - 14 if inside.any() else v > -200
    ref = 10 * np.log10(np.mean(10 ** (v[active & inside] / 10))) if (active & inside).any() else float(v.max())
    speech = inside & (v >= ref - 10)
    pause = inside & (v <= ref - 30)

    def level(mask):
        return float(10 * np.log10(np.mean(10 ** (b[mask] / 10))) - ref) if mask.any() else None

    speech_rel, pause_rel = level(speech), level(pause)
    # the same two levels per 60 s of the cut, so a bed that drifts or drops out in one stretch shows
    segments = []
    for first in np.arange(0, times[-1] + 1, 60.0):
        part = (times >= first) & (times < first + 60.0)
        sp, pa = level(speech & part), level(pause & part)
        segments.append({'from_s': float(first), 'under_speech_db': None if sp is None else round(sp, 1),
                         'in_pauses_db': None if pa is None else round(pa, 1)})
    return {'voice_ref_dbfs': round(float(ref), 2), 'speech_windows': int(speech.sum()), 'pause_windows': int(pause.sum()),
            'bed_under_speech_db': None if speech_rel is None else round(speech_rel, 2),
            'bed_in_pauses_db': None if pause_rel is None else round(pause_rel, 2),
            'duck_depth_db': None if speech_rel is None or pause_rel is None else round(pause_rel - speech_rel, 2),
            'by_minute': segments,
            'bed_peak_dbfs': round(float(20 * np.log10(max(float(np.abs(bed).max()), 1e-9))), 2),
            'bed_loud_windows_pct': round(float(100 * (b > -60).mean()), 1)}


def _decode_stereo(path: str) -> np.ndarray:
    """(n, 2) float samples at 48 kHz."""
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', path, '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', 'pipe:1'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def _write_stereo(samples: np.ndarray, out: str) -> None:
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0', out],
                   input=np.ascontiguousarray(samples, dtype=np.float32).tobytes(), check=True)


def _short_db(samples: np.ndarray, window_s: float = GAP_WINDOW_S) -> np.ndarray:
    """RMS in dBFS per 50 ms window of mono samples: short enough to see a 0.3 s stop, which a 400 ms loudness
    meter averages away."""
    size = int(SR * window_s)
    count = len(samples) // size
    if count == 0:
        return np.array([])
    blocks = samples[:count * size].astype(np.float64).reshape(count, size)
    return 10 * np.log10(np.maximum((blocks ** 2).mean(axis=1), 1e-12))


def _runs(mask: np.ndarray, min_s: float, window_s: float = GAP_WINDOW_S) -> list[tuple[float, float]]:
    """Runs of True at least min_s long: [(from_s, length_s)]."""
    out, i, n = [], 0, len(mask)
    need = int(round(min_s / window_s))
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            if j - i >= need:
                out.append((round(i * window_s, 2), round((j - i) * window_s, 2)))
            i = j
        else:
            i += 1
    return out


def gaps(samples: np.ndarray, *, start_s: float = 0.0, end_s: float | None = None,
         floor_dbfs: float | None = None) -> list[tuple[float, float]]:
    """Drop-outs in mono samples between start_s and end_s, on 50 ms RMS windows: GAP_MIN_S or longer either
    GAP_BELOW_DB under the music's own running median (3 s), or, given floor_dbfs, under that fixed floor (for a
    mix, where speech would raise the median). [(from_s, length_s)] on the samples' clock."""
    db = _short_db(samples)
    if not len(db):
        return []
    if floor_dbfs is None:
        taps = int(GAP_MEDIAN_S / GAP_WINDOW_S)
        padded = np.pad(db, (taps // 2, taps - 1 - taps // 2), mode='edge')
        reference = np.median(np.lib.stride_tricks.sliding_window_view(padded, taps), axis=1) - GAP_BELOW_DB
    else:
        reference = np.full_like(db, floor_dbfs)
    times = np.arange(len(db)) * GAP_WINDOW_S
    inside = (times >= start_s) & (times < (end_s if end_s is not None else times[-1] + 1))
    return _runs(inside & (db < reference), GAP_MIN_S)


def track_stops(path: str) -> list[tuple[float, float]]:
    """Where the track itself goes quiet, on its own clock: each drop-out (gaps()) padded by STOP_PAD_S, and its fade
    at the end (where its 3 s running level falls TAIL_BELOW_DB under the track's median and stays there). On
    Friday 23's track ("NO CURVES") the music stops for about 0.45 s at 72.95 s: under a low bed that is the music
    switching off."""
    mono = _decode(path)
    stops = [(round(max(0.0, a - STOP_PAD_S), 2), round(a + n + STOP_PAD_S, 2)) for a, n in gaps(mono)]
    db = _short_db(mono)
    taps = int(GAP_MEDIAN_S / GAP_WINDOW_S)
    if len(db) > taps:
        level = np.convolve(db, np.ones(taps) / taps, mode='same')
        loud = np.nonzero(level >= np.median(db) - TAIL_BELOW_DB)[0]
        if len(loud) and loud[-1] < len(db) - 1:
            stops.append((round(float(loud[-1]) * GAP_WINDOW_S, 2), round(len(mono) / SR + 1, 2)))
    return stops


def track_intro(path: str) -> float:
    """Where the track's body begins, on its own clock: the first point from which, over the next INTRO_SPAN_S, at
    most INTRO_SPARSE_SHARE of its 0.25 s windows fall TAIL_BELOW_DB under the track's median (a sparse intro of
    single hits leaves most of them there). A restart starts here, never in the intro: on Friday 23's long cut the
    restart at 172 s played NO CURVES' sparse opening (its first 18 s, a third of it in gaps against a twentieth in
    the body), and under a pause in the voice the bed sagged (the independent review's block at 172.5 s, 30 Oct 2026)."""
    db = _short_db(_decode(path))
    per = int(INTRO_STEP_S / GAP_WINDOW_S)
    q = np.array([db[i:i + per].mean() for i in range(0, len(db) - per + 1, per)])
    span = int(INTRO_SPAN_S / INTRO_STEP_S)
    if len(q) <= span:
        return 0.0
    gap = q < np.median(q) - TAIL_BELOW_DB
    share = np.convolve(gap.astype(float), np.ones(span) / span, mode='valid')
    found = np.nonzero(share <= INTRO_SPARSE_SHARE)[0]
    return round(float(found[0]) * INTRO_STEP_S, 2) if len(found) else 0.0


def tile(track: np.ndarray, total: int, crossfade_s: float = CROSSFADE_S,
         stops: list[tuple[float, float]] = (), restart_from_s: float = 0.0) -> tuple[np.ndarray, list[float]]:
    """The track's playable stretches (everything outside `stops`, in seconds on the track's clock) laid end to end,
    the track starting again after its last one, until `total` samples are covered. Every join, over a stop or a
    restart, is an equal-power crossfade. The first play keeps the track's intro; every restart begins at
    restart_from_s (track_intro), so a restart never drops the bed into the quiet intro. Returns the samples and the
    crossfade centres in seconds."""
    xf = int(SR * crossfade_s)
    edges, at = [], 0
    for a, b in sorted(stops):
        edges.append((at, int(a * SR)))
        at = max(at, int(b * SR))
    edges.append((at, len(track)))
    pieces = [(a, b) for a, b in edges if b - a >= 3 * xf]  # a shorter stretch would be all crossfade
    if not pieces:
        raise ValueError('the bed track has no stretch long enough to play under a crossfade')
    if len(pieces) == 1 and pieces[0][1] - pieces[0][0] >= total:
        return track[pieces[0][0]:pieces[0][0] + total].copy(), []
    out = np.zeros((total + len(track), 2))
    ramp = np.linspace(0, np.pi / 2, xf)[:, None]
    fade_in, fade_out = np.sin(ramp), np.cos(ramp)
    centres, at, k = [], 0, 0
    while True:
        a, b = pieces[k % len(pieces)]
        if k >= len(pieces) and b - max(a, int(restart_from_s * SR)) >= 3 * xf:
            a = max(a, int(restart_from_s * SR))
        run = track[a:b].copy()
        if k:
            run[:xf] *= fade_in
            centres.append(round((at + xf / 2) / SR, 3))
        if at + len(run) >= total:
            out[at:at + len(run)] += run
            return out[:total], centres
        run[-xf:] *= fade_out
        out[at:at + len(run)] += run
        at += len(run) - xf
        k += 1


def level_ride(samples: np.ndarray, max_db: float = LEVEL_MAX_DB) -> np.ndarray:
    """Per-sample gain (linear) that holds the music's own short-term level near its median: RMS per 0.5 s, smoothed
    over 1.5 s, the difference clamped to max_db either way. Keyed by the music, never by the voice."""
    size = int(SR * LEVEL_WINDOW_S)
    count = max(1, len(samples) // size)
    mono = samples[:count * size].mean(axis=1).reshape(count, size)
    db = 10 * np.log10(np.maximum((mono ** 2).mean(axis=1), 1e-12))
    loud = db > db.max() - 40
    ref = float(np.median(db[loud])) if loud.any() else 0.0
    taps = max(1, int(LEVEL_SMOOTH_S / LEVEL_WINDOW_S))
    padded = np.pad(np.where(loud, db, ref), (taps // 2, taps - 1 - taps // 2), mode='edge')
    smooth = np.convolve(padded, np.ones(taps) / taps, mode='valid')
    gain_db = np.clip(ref - smooth, -max_db, max_db)
    centres = (np.arange(count) + 0.5) * size
    return 10 ** (np.interp(np.arange(len(samples)), centres, gain_db) / 20)


def episode_envelope(n: int, levels: dict, *, voice_start_s: float, last_word_end_s: float,
                     lifts: list[tuple[float, float]], duration_s: float) -> np.ndarray:
    """Per-sample offset in dB from bed_lufs: the one bed shape (scripts/bed_shape.py) with its chapter lifts and
    edge fades. Breakpoints every 10 ms, linear between."""
    bed = float(levels['bed_lufs'])
    points = bed_shape.target_points(levels, voice_start_s, last_word_end_s, duration_s, [tuple(w) for w in lifts])
    t = np.arange(0, duration_s + 0.01, 0.01)
    off = np.interp(t, [p[0] for p in points], [p[1] - bed for p in points])
    off = off + np.array([bed_shape.fade_db(x, duration_s) for x in t])
    return np.interp(np.arange(n) / SR, t, off)


# Outside clips heard with their own sound (spec cuts.<cut>.music): each level point names an approved ledger level.
CLIP_LEVELS = {'open': 'intro_lufs', 'under': 'bed_lufs'}
CLIP_END_FADE_S = 0.015
SWEEP_FROM_HZ, SWEEP_TO_HZ = 18000.0, 300.0


def entry_ramp_db(n: int, enter_s: float, fade_s: float) -> np.ndarray:
    """Per-sample dB for a bed that is silent before enter_s and rises over fade_s on a squared curve (slow at first,
    so it comes in under the voice rather than on top of it)."""
    t = np.arange(n) / SR
    k = np.clip((t - enter_s) / fade_s, 0.0, 1.0) if fade_s > 0 else (t >= enter_s).astype(float)
    return 20 * np.log10(np.maximum(k ** 2, 1e-6))


def check_clips(clips: list, duration_s: float, handovers: list) -> list[dict]:
    """The clips, checked and in order: each inside the cut, its points on known levels, and no two sounding together
    outside a declared handover (two songs at different tempos clash; Krish, 2026-11-09: "The fade out of the cat video
    is glitchy")."""
    out = []
    for i, clip in enumerate(clips):
        at, end = float(clip['at_s']), float(clip['end_s'])
        if not 0 <= at < end <= duration_s + 1e-6:
            raise ValueError(f'clip {i} ({clip.get("asset", "?")}) must sound inside the cut (0 to {duration_s:.2f} s): {at} to {end}')
        points = sorted((float(p['t']), str(p['level'])) for p in clip['points'])
        bad = [level for _, level in points if level not in (*CLIP_LEVELS, 'off')]
        if bad:
            raise ValueError(f'clip {i}: a level point is open, under or off, not {bad[0]}')
        if points[0][0] > at:
            points.insert(0, (at, points[0][1]))
        sweep = float(clip.get('sweep_s') or 0)
        if not 0 <= sweep < end - at:
            raise ValueError(f'clip {i}: the sweep ({sweep} s) must fit inside the clip')
        out.append({'asset': clip.get('asset'), 'src': str(clip['src']), 'src_from_s': float(clip.get('src_from_s') or 0),
                    'at_s': at, 'end_s': end, 'points': points, 'sweep_s': sweep})
    out.sort(key=lambda c: c['at_s'])
    for a, b in zip(out, out[1:]):
        lo, hi = b['at_s'], min(a['end_s'], b['end_s'])
        if hi - lo > 0.05 and not any(x <= lo and hi <= y for x, y in handovers):
            raise ValueError(f'clips {a["asset"]} and {b["asset"]} sound together from {lo:.2f} to {hi:.2f} s outside a '
                             'declared handover: two songs never overlap')
    return out


def _decode_span(src: str, from_s: float, seconds: float) -> np.ndarray:
    """(n, 2) float samples of src from from_s for seconds, at 48 kHz."""
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-ss', f'{from_s:.3f}', '-t', f'{seconds:.3f}', '-i', src, '-vn', '-ac', '2',
                          '-ar', str(SR), '-f', 'f32le', 'pipe:1'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def lowpass_sweep(x: np.ndarray, start: int) -> np.ndarray:
    """A one-pole low-pass whose cutoff falls from 18 kHz to 300 Hz, exponentially, from sample `start` to the end of x:
    the DJ's sweep that ends a song on its beat. Samples before `start` are untouched."""
    n = len(x) - start
    if n <= 0:
        return x
    out = x.copy()
    cut = SWEEP_FROM_HZ * (SWEEP_TO_HZ / SWEEP_FROM_HZ) ** (np.arange(n) / max(1, n - 1))
    alpha = 1 - np.exp(-2 * np.pi * cut / SR)
    y = out[start - 1].copy() if start > 0 else np.zeros(x.shape[1])
    for i in range(n):
        y = y + alpha[i] * (x[start + i] - y)
        out[start + i] = y
    return out


def clip_stem(clips: list[dict], n: int, levels: dict, master_gain_db: float) -> tuple[np.ndarray, list[dict]]:
    """Every clip's own sound laid on the stem's clock at the master's levels: an `open` point lands at intro_lufs and
    an `under` point at bed_lufs in the finished master (given the master gain), linear in dB between points, held after
    the last; `off` is silence. The clip ends on its end_s after its low-pass sweep and a 15 ms fade."""
    stem = np.zeros((n, 2))
    report = []
    for clip in clips:
        seconds = clip['end_s'] - clip['at_s']
        raw = ebur128(clip['src'], clip['src_from_s'], clip['src_from_s'] + seconds)['I']
        x = _decode_span(clip['src'], clip['src_from_s'], seconds)
        if len(x) < int(seconds * SR) - SR // 10:
            raise ValueError(f'clip {clip["asset"]} runs out {seconds - len(x) / SR:.2f} s before its end_s')
        t = clip['at_s'] + np.arange(len(x)) / SR
        gains = [(-120.0 if level == 'off' else float(levels[CLIP_LEVELS[level]]) - master_gain_db - raw)
                 for _, level in clip['points']]
        x = x * (10 ** (np.interp(t, [p[0] for p in clip['points']], gains) / 20))[:, None]
        if clip['sweep_s']:
            x = lowpass_sweep(x, len(x) - int(round(clip['sweep_s'] * SR)))
        tail = min(len(x), int(CLIP_END_FADE_S * SR))
        x[len(x) - tail:] *= np.linspace(1.0, 0.0, tail)[:, None]
        i0 = int(round(clip['at_s'] * SR))
        span = min(len(x), n - i0)
        stem[i0:i0 + span] += x[:span]
        report.append({'asset': clip['asset'], 'at_s': clip['at_s'], 'end_s': clip['end_s'], 'src_from_s': clip['src_from_s'],
                       'source_lufs': round(raw, 2), 'points': [list(p) for p in clip['points']], 'sweep_s': clip['sweep_s']})
    return stem, report


def _episode_bed(tmp_bed: str, out: str, *, duration_s: float, gain_db: float, envelope_db: np.ndarray,
                 stops: list[tuple[float, float]], restart_from_s: float = 0.0) -> list[float]:
    """The episode bed alone at its final relative level, played around the track's stops; returns the crossfade
    centres."""
    track = _decode_stereo(tmp_bed)
    n = int(round(duration_s * SR))
    bed, centres = tile(track, n, stops=stops, restart_from_s=restart_from_s)
    bed *= level_ride(bed)[:, None]
    bed *= (10 ** ((gain_db + envelope_db[:n]) / 20))[:, None]
    _write_stereo(bed, out)
    return centres


def _run(args: list[str]) -> None:
    subprocess.run([ffmpeg(), '-v', 'error', '-y', *args], check=True)


def _sum(inputs: list[str], graph: str, out: str, label: str) -> None:
    ins: list[str] = []
    for item in inputs:
        ins += ['-i', item]
    _run([*ins, '-filter_complex', graph, '-map', label, out])


def _master(summed: str, out: str, lufs: float, tp: float) -> dict:
    """Gain to target, then a true-peak-safe limiter (4x oversampled, sample ceiling 0.7 dB under tp); measure and
    correct once more, because limiting speech peaks pulls integrated loudness down."""
    limit = 10 ** ((tp - 0.7) / 20)
    gain = lufs - float(_measure(summed)['input_i'])
    final: dict = {}
    for _ in range(3):
        chain = (f"volume={gain:.2f}dB,aresample=192000,alimiter=limit={limit:.4f}:attack=2:release=60:level=disabled,"
                 f"aresample=48000")
        _run(['-i', summed, '-af', chain, '-ar', '48000', out])
        final = _measure(out)
        miss = lufs - float(final['input_i'])
        if abs(miss) <= 0.3 and float(final['input_tp']) <= tp:
            break
        gain += miss
    final['gain_db'] = gain  # the gain applied ahead of the limiter: what a low bed under the voice receives
    return final


def body_window(voice_start_s: float, last_word_end_s: float, duration_s: float) -> tuple[float, float]:
    """The stretch where the bed sits at bed_lufs: from where the open has eased down to his last word."""
    turns = bed_shape.timings(voice_start_s, last_word_end_s, duration_s)
    start = turns['bed_from']
    return start, max(start, min(last_word_end_s, duration_s - 1.5))


def ebur128(path: str, start: float | None = None, end: float | None = None, gain_db: float = 0.0) -> dict:
    """EBU R128 loudness of a file or of [start, end): {'I': integrated LUFS, 'M': [(t, momentary)], 'S': [(t,
    short-term)]}, 100 ms steps, on the file's own clock. ffmpeg's meter, not this module's RMS windows."""
    trim = f'atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS,' if start is not None else ''
    text = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-v', 'verbose', '-i', path, '-vn', '-af',
                           f'{trim}volume={gain_db:.3f}dB,ebur128=framelog=verbose', '-f', 'null', '-'],
                          capture_output=True, text=True, errors='replace').stderr
    offset = start or 0.0
    frames = re.findall(r't:\s*([\d.]+)\s+TARGET:\S+ LUFS\s+M:\s*(-?[\d.]+|-inf|nan)\s+S:\s*(-?[\d.]+|-inf|nan)', text)
    summary = re.search(r'Integrated loudness:\s+I:\s+(-?[\d.]+|-inf|nan) LUFS', text)

    def num(v: str) -> float:
        return -120.0 if v in ('-inf', 'nan') else float(v)
    return {'I': num(summary.group(1)) if summary else -120.0,
            'M': [(round(float(t) + offset, 2), num(m)) for t, m, _ in frames],
            'S': [(round(float(t) + offset, 2), num(x)) for t, _, x in frames]}


def premix(dialogue: str, bed: str | None, out: str, start_s: float, duration_s: float, bed_start_s: float = 0.0,
           under_vo_lu: float = -20.0, lufs: float = -14.0, tp: float = -1.0, mode: str = 'continuous',
           last_word_end_s: float | None = None, levels: dict | None = None, voice_start_s: float = 0.0,
           lifts: list | None = None, lead_frames: int = 0, fps: int = 30, clips: list | None = None,
           bed_enter_s: float = 0.0, bed_fade_in_s: float = 0.0, handovers: list | None = None) -> dict:
    """Cut [start_s, start_s + duration_s) from the dialogue master, lay the bed under it (see the module docstring
    for the modes), and master the sum to lufs / tp. Returns the measured result and writes `<out>.bed.json`.
    Mode episode_bed needs `levels` (the music ledger's approved levels), the first word's start and the last word's end
    on the stem's clock, and the chapter-card windows to lift in (`lifts`, seconds, [] for none); it keeps the bed
    alone at the master's gain beside the stem (`<out>.music.wav`) so QC can meter it.

    lead_frames is the intro sting in front of the cut (props.sting.frames, 0 for none). The dialogue is then laid from
    sample lead_frames x 48000 / fps, counted in samples (never in rounded seconds), and proved silent under the sting;
    the bed runs from sample 0 under it. duration_s, voice_start_s, last_word_end_s and lifts are all on the stem's
    clock, the sting included, so the bed shape eases relative to his first word wherever it lands.

    clips, bed_enter_s, bed_fade_in_s and handovers are the cut's own music plan (spec cuts.<cut>.music, check_clips),
    episode_bed only, all on the stem's clock: the clips' own sound is a third stem beside the voice and the bed, the bed
    is silent before bed_enter_s and rises over bed_fade_in_s, and the one bed shape is checked on the music as heard
    (clips and bed together) with the handovers and the bed's rise left out like chapter lifts."""
    clips, handovers = list(clips or []), [tuple(map(float, w)) for w in (handovers or [])]
    if (clips or bed_enter_s or handovers) and mode != 'episode_bed':
        raise ValueError('a cut\'s own music plan (clips, a late bed, handovers) needs the episode_bed mode')
    if bed_enter_s and not 0 < bed_enter_s < duration_s:
        raise ValueError(f'the bed must enter inside the cut (0 to {duration_s:.2f} s), not at {bed_enter_s}')
    if bed_enter_s:
        handovers.append((float(bed_enter_s) - 0.5, float(bed_enter_s) + float(bed_fade_in_s)))
    bad = [w for w in handovers if not 0 <= w[0] < w[1] <= duration_s + 0.5]
    if bad:
        raise ValueError(f'a handover window must lie inside the cut: {bad}')
    clips = check_clips(clips, duration_s, handovers)
    if mode == 'ducked':
        raise ValueError('a ducked bed is refused: it keys the music to the voice and pumps on every phrase; '
                         'use episode_bed, the one bed shape (config/music-bed.json)')
    if mode not in ('continuous', 'episode_bed'):
        raise ValueError('bed mode must be continuous or episode_bed')
    if mode == 'episode_bed':
        missing = [k for k in EPISODE_LEVELS if not isinstance((levels or {}).get(k), (int, float))]
        if missing or lifts is None:
            raise ValueError('an episode_bed needs the ledger levels (' + ', '.join(missing or ['lifts']) + ')')
        bad = [w for w in lifts if not (0 <= float(w[0]) < float(w[1]) <= duration_s)]
        if bad:
            raise ValueError(f'a lift window must lie inside the cut (0 to {duration_s:.2f} s): {bad}')
    lead_samples, total_samples = lead_frames * SR // fps, int(round(duration_s * SR))
    if lead_frames:
        if isinstance(lead_frames, bool) or not isinstance(lead_frames, int) or lead_frames < 0 or lead_frames * SR % fps:
            raise ValueError(f'the sting lead is a whole number of frames that is a whole number of samples at {fps} fps')
        if not lead_frames / fps <= voice_start_s < duration_s:
            raise ValueError(f'his first word ({voice_start_s:.3f} s) must come after the sting ({lead_frames} frames, '
                             f'{lead_frames / fps:.4f} s) and inside the cut ({duration_s:.3f} s)')
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    tmp_dialogue = str(Path(out).with_suffix('.dialogue.wav'))
    lead_report: dict = {}
    laid = None  # the laid dialogue, mono, when it was decoded to prove the lead
    if not lead_frames:
        # padded to the cut's length: the dialogue ends at the last word, the cut runs on through its ending card
        _run(['-ss', f'{start_s:.3f}', '-t', f'{duration_s:.3f}', '-i', dialogue, '-af', f'apad=whole_dur={duration_s:.3f}',
              '-ac', '2', '-ar', '48000', tmp_dialogue])
    else:
        # The sting's frames of silence, then his voice from its first sample, padded to the whole stem: all in samples.
        _run(['-ss', f'{start_s:.3f}', '-i', dialogue, '-af',
              f'aresample={SR},aformat=channel_layouts=stereo,atrim=end_sample={total_samples - lead_samples},'
              f'adelay=delays={lead_samples}S:all=1,apad=whole_len={total_samples},atrim=end_sample={total_samples}',
              '-ac', '2', '-ar', '48000', tmp_dialogue])
        # Both channels of the sting's samples only (a long cut decoded whole in stereo would cost hundreds of MB).
        head = np.frombuffer(subprocess.run([ffmpeg(), '-v', 'error', '-i', tmp_dialogue, '-af', f'atrim=end_sample={lead_samples}',
                                             '-ac', '2', '-ar', str(SR), '-f', 'f32le', 'pipe:1'], capture_output=True, check=True).stdout,
                             dtype=np.float32)
        laid = _decode(tmp_dialogue)
        if len(laid) != total_samples or len(head) != 2 * lead_samples:
            raise ValueError(f'the dialogue behind the sting is {len(laid)} samples, not the stem\'s {total_samples}')
        under_db = round(20 * float(np.log10(max(float(np.abs(head).max()), 1e-12))), 1)
        if under_db > -90.0:
            raise ValueError(f'the dialogue is not silent under the sting ({under_db} dBFS over its first {lead_samples} '
                             'samples): his voice would play over it')
        lead_report = {'lead_frames': lead_frames, 'lead_s': round(lead_frames / fps, 4), 'dialogue_from_sample': lead_samples,
                       'dialogue_under_lead_dbfs': under_db}
    voice = float(_measure(tmp_dialogue)['input_i'])
    summed = str(Path(out).with_suffix('.sum.wav'))
    tmp_bed = str(Path(out).with_suffix('.bed.wav'))
    bed_stem = str(Path(out).with_suffix('.bedonly.wav'))
    report: dict = {'mode': mode, 'bed_present': bed is not None}
    last_end = last_word_end_s if last_word_end_s is not None else max(0.0, duration_s - 3.5)
    music = str(Path(out).with_suffix('.music.wav'))
    heard = bed_stem  # the music as heard; the bed alone unless a cut's own clips sound with it
    if bed:
        trim = [] if mode == 'episode_bed' else ['-t', f'{duration_s:.3f}']
        _run(['-ss', f'{bed_start_s:.3f}', *trim, '-i', bed, '-ac', '2', '-ar', '48000', tmp_bed])
        voice_samples = laid if laid is not None else _decode(tmp_dialogue)
        if mode != 'episode_bed' and len(_decode(tmp_bed)) < int(SR * duration_s) - SR // 10:
            # a bed that runs out before the cut ends leaves the rest of it bare (the 30 Oct drop-out)
            raise ValueError(f'the bed runs out before the cut ends ({duration_s:.1f} s): use mode episode_bed, which restarts it')
        if mode == 'episode_bed':
            # bed_lufs is the bed's level in the finished master; the master gain is about lufs - voice, so aim the
            # bed there, master, then correct once from the measured master gain
            n_samples = int(round(duration_s * SR))
            envelope = episode_envelope(n_samples, levels, voice_start_s=voice_start_s,
                                        last_word_end_s=last_end, lifts=[tuple(w) for w in lifts], duration_s=duration_s)
            if bed_enter_s:
                envelope = envelope + entry_ramp_db(n_samples, float(bed_enter_s), float(bed_fade_in_s))
            stops = track_stops(tmp_bed)
            intro = track_intro(tmp_bed)
            probe = str(Path(out).with_suffix('.probe.wav'))
            _episode_bed(tmp_bed, probe, duration_s=duration_s, gain_db=0.0, envelope_db=np.zeros_like(envelope), stops=stops,
                         restart_from_s=intro)
            body = body_window(voice_start_s, last_end, duration_s)
            if bed_enter_s:  # a late bed is measured only once it has fully arrived
                body = (max(body[0], float(bed_enter_s) + float(bed_fade_in_s)), body[1])
                if body[1] - body[0] < 3.0:
                    raise ValueError(f'the bed enters at {bed_enter_s} s and rises for {bed_fade_in_s} s, leaving under 3 s '
                                     'of it under his voice to measure')
            raw = ebur128(probe, *body)['I']
            Path(probe).unlink(missing_ok=True)
            gain = float(levels['bed_lufs']) - lufs + voice - raw
            clip_file = str(Path(out).with_suffix('.clips.wav'))
            master_gain = lufs - voice  # the first guess; the loop corrects it from the master it makes
            clip_report: list = []
            for _ in range(4):
                rendered = gain
                centres = _episode_bed(tmp_bed, bed_stem, duration_s=duration_s, gain_db=gain, envelope_db=envelope, stops=stops,
                                       restart_from_s=intro)
                guess = master_gain
                inputs = [tmp_dialogue, bed_stem]
                if clips:
                    samples, clip_report = clip_stem(clips, n_samples, levels, guess)
                    _write_stereo(samples, clip_file)
                    inputs.append(clip_file)
                fmt = ''.join(f'[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo[s{i}];' for i in range(len(inputs)))
                graph = fmt + ''.join(f'[s{i}]' for i in range(len(inputs))) + f'amix=inputs={len(inputs)}:normalize=0:duration=first[m]'
                _sum(inputs, graph, summed, '[m]')
                final = _master(summed, out, lufs, tp)
                master_gain = float(final['gain_db'])
                got = ebur128(bed_stem, *body, gain_db=master_gain)['I']
                miss = float(levels['bed_lufs']) - got
                if abs(miss) <= 0.3 and (not clips or abs(master_gain - guess) <= 0.3):
                    break
                gain += miss
            heard = bed_stem
            if clips:  # the music as heard: the bed and the clips' own sound together
                heard = str(Path(out).with_suffix('.heard.wav'))
                _sum([bed_stem, clip_file], '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[b];[1:a]aformat=sample_rates=48000:'
                     'channel_layouts=stereo[c];[b][c]amix=inputs=2:normalize=0:duration=first[m]', heard, '[m]')
            _run(['-i', heard, '-af', f'volume={master_gain:.2f}dB', music])
            # The one bed shape, on the music alone, before it is called mixed: stop loudly when it misses. A cut's own
            # handovers (and a late bed's rise) are left out the way chapter lifts are.
            meter = ebur128(music)
            m_by_t = dict(meter['M'])
            shape = bed_shape.qc([(t, m_by_t.get(t, -120.0), v) for t, v in meter['S']], voice_start_s, last_end,
                                 duration_s, [tuple(w) for w in lifts], accents=handovers)
            report['shape'] = shape
            if clips or bed_enter_s:
                report.update(clips=clip_report, bed_enter_s=float(bed_enter_s), bed_fade_in_s=float(bed_fade_in_s),
                              handovers=[list(w) for w in handovers])
            bed_shape.require(shape, 've premix')
            report.update(gain_db=round(rendered, 2), level_miss_db=round(miss, 2), master_gain_db=round(master_gain, 2), bed_lufs_in_master=round(got, 2),
                          levels={k: levels[k] for k in (*EPISODE_LEVELS, 'chapter_lufs') if k in levels},
                          lifts=[list(w) for w in lifts], track_stops_s=[list(w) for w in stops], track_intro_s=intro, crossfades_s=centres, crossfade_s=CROSSFADE_S,
                          voice_start_s=voice_start_s, last_word_end_s=last_end, body_s=list(body),
                          music_stem=Path(music).name)
        elif mode == 'continuous':
            bed_gain = (voice + under_vo_lu) - float(_measure(tmp_bed)['input_i'])
            graph = (f'[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v];[1:a]aformat=sample_rates=48000:channel_layouts=stereo,'
                     f'volume={bed_gain:.2f}dB,afade=t=in:d=0.4,afade=t=out:st={max(0.0, duration_s - 0.6):.3f}:d=0.6[b];'
                     f'[v][b]amix=inputs=2:normalize=0:duration=first[m]')
            _sum([tmp_dialogue, tmp_bed], graph, summed, '[m]')
            _sum([tmp_dialogue, tmp_bed], f'[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={bed_gain:.2f}dB,'
                 f'afade=t=in:d=0.4,afade=t=out:st={max(0.0, duration_s - 0.6):.3f}:d=0.6[b]', bed_stem, '[b]')
            report['gain_db'] = round(bed_gain, 2)
        report.update(analyse(voice_samples, _decode(heard), last_word_end_s=last_end, from_s=max(1.5, lead_frames / fps)))
    else:
        _sum([tmp_dialogue], '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v]', summed, '[v]')
    if not (bed and mode == 'episode_bed'):
        final = _master(summed, out, lufs, tp)
    result = {'stem': out, 'dialogue_lufs': voice, 'integrated_lufs': float(final['input_i']), 'true_peak_dbtp': float(final['input_tp']),
              'start_s': start_s, 'duration_s': duration_s, 'under_vo_lu': under_vo_lu, 'bed': report,
              'lead_frames': lead_frames, **lead_report}
    # The levels are relative, so the master gain (applied equally to voice and bed) does not change them.
    Path(out).with_suffix('.bed.json').write_text(json.dumps(result, indent=1), encoding='utf-8')
    for tmp in (tmp_dialogue, summed, tmp_bed, bed_stem, str(Path(out).with_suffix('.clips.wav')), str(Path(out).with_suffix('.heard.wav'))):
        Path(tmp).unlink(missing_ok=True)
    return result
