"""ve audio: the premixed stem every render carries (dialogue + bed), mastered to the spec's targets.
One clock: the stem starts at frame 0 of the cut, so picture, captions and events all read the same time.
Two-pass loudnorm on the sum, true peak limited after it, then measured again; nothing is assumed.

Bed modes (spec audio.bed.mode):
- continuous: one flat gain, under_vo_lu below the voice's integrated loudness, short fades.
- ducked: the music breathes. In pauses it sits about 10 dB under the voice; under speech a sidechain
  compressor keyed by the voice pulls it to about 18 dB under, with a slow release so it never pumps.
  Fade in 1 s, a gentle lift after the last word, fade out over the last 1.5 s.
- episode_bed: the long-cut bed (config/learnings.json deep-cut-music-always-under). One continuous low bed at the
  ledger's bed_lufs (-31, approved by ear) in the finished master, never keyed by the voice. It lifts only in the
  windows it is given (chapter cards, to chapter_lufs, 0.5 s rise and 0.8 s fall), before the first word (intro_lufs)
  and after the last (outro_lufs). It plays around the track's own stops (a break where the music falls silent) and
  restarts the track when the cut outlasts it (from where its body begins, never its quiet intro), each join under a 2 s equal-power crossfade, and a
  slow gain ride keyed by the music itself (3 s, at most 8 dB either way) holds the track's own loud and quiet
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

from .common import ffmpeg

SR = 48000
WINDOW_S = 0.5
# Where the ducked bed is aimed, in dB relative to the voice's speech-window RMS.
PAUSE_TARGET_DB = -8.5
SPEECH_TARGET_DB = -18.5
THRESHOLDS = (0.05, 0.035, 0.025, 0.018, 0.013, 0.009, 0.0065, 0.0045, 0.003)
RATIO, ATTACK_MS, RELEASE_MS = 8, 30, 450
# The episode bed (mode episode_bed).
CROSSFADE_S = 2.0
LIFT_RISE_S, LIFT_FALL_S = 0.5, 0.8
LEVEL_WINDOW_S, LEVEL_SMOOTH_S, LEVEL_MAX_DB = 0.5, 3.0, 8.0
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


def analyse(voice: np.ndarray, bed: np.ndarray, *, last_word_end_s: float | None = None) -> dict:
    """Bed level under speech and in pauses, in dB relative to the voice's speech-window RMS, from the two stems.
    Speech windows are within 10 dB of the active voice level; pause windows are 30 dB or more below it. The first
    1.5 s (fade in) and everything after the last word are left out, so only the music under a talking voice and in
    its real pauses is measured."""
    n = min(len(voice), len(bed))
    voice, bed = voice[:n], bed[:n]
    v, b = _window_db(voice), _window_db(bed)
    m = min(len(v), len(b))
    v, b = v[:m], b[:m]
    times = (np.arange(m) + 0.5) * WINDOW_S
    end = last_word_end_s if last_word_end_s is not None else times[-1] + 1
    inside = (times > 1.5) & (times < end)
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
    over 3 s, the difference clamped to max_db either way. Keyed by the music, never by the voice."""
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
    """Per-sample offset in dB from bed_lufs: 0 under speech, up to chapter_lufs in each lift window (0.5 s rise
    before it, 0.8 s fall after it), intro_lufs before the first word, outro_lufs after the last, a 1 s fade in and
    a 1.5 s fade out at the cut's edges. Breakpoints every 10 ms, linear between."""
    bed = float(levels['bed_lufs'])
    chapter = float(levels.get('chapter_lufs', -22))
    t = np.arange(0, duration_s + 0.01, 0.01)
    off = np.zeros_like(t)
    if voice_start_s > 0:
        intro = float(levels['intro_lufs']) - bed
        off = np.maximum(off, intro * np.clip((voice_start_s - t) / LIFT_RISE_S, 0, 1))
    outro = float(levels['outro_lufs']) - bed
    off = np.maximum(off, outro * np.clip((t - last_word_end_s) / LIFT_FALL_S, 0, 1))
    for a, b in lifts:
        rise = np.clip((t - (a - LIFT_RISE_S)) / LIFT_RISE_S, 0, 1)
        fall = np.clip(((b + LIFT_FALL_S) - t) / LIFT_FALL_S, 0, 1)
        off = np.maximum(off, (chapter - bed) * np.minimum(rise, fall))
    fade = np.minimum(np.clip(t / 1.0, 1e-6, 1), np.clip((duration_s - t) / 1.5, 1e-6, 1))
    off = off + 20 * np.log10(fade)
    return np.interp(np.arange(n) / SR, t, off)


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


def _ducked_bed(tmp_dialogue: str, tmp_bed: str, out: str, *, gain_db: float, threshold: float, duration_s: float,
                last_word_end_s: float) -> None:
    """The bed alone at its final relative level: flat gain, voice-keyed sidechain compression, fade in, a lift of
    about 2 dB over the 3 s after the last word, fade out over the last 1.5 s."""
    lift_from = last_word_end_s
    lift = f"volume='1+0.26*min(1,max(0,(t-{lift_from:.3f})/3))':eval=frame"
    fade_out = max(0.0, duration_s - 1.5)
    graph = (f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo[key];"
             f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={gain_db:.2f}dB[b];"
             f"[b][key]sidechaincompress=threshold={threshold}:ratio={RATIO}:attack={ATTACK_MS}:release={RELEASE_MS}:makeup=1[d];"
             f"[d]{lift},afade=t=in:d=1.0,afade=t=out:st={fade_out:.3f}:d=1.5[bed]")
    _sum([tmp_dialogue, tmp_bed], graph, out, '[bed]')


def body_window(voice_start_s: float, last_word_end_s: float, duration_s: float) -> tuple[float, float]:
    """The stretch where the bed sits at bed_lufs: from the intro's ramp down to the outro's ramp up."""
    start = max(1.5, voice_start_s + LIFT_RISE_S)
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
           lifts: list | None = None) -> dict:
    """Cut [start_s, start_s + duration_s) from the dialogue master, lay the bed under it (see the module docstring
    for the modes), and master the sum to lufs / tp. Returns the measured result and writes `<out>.bed.json`.
    Mode episode_bed needs `levels` (the music ledger's approved levels), the first word's start and the last word's end
    on the cut's clock, and the chapter-card windows to lift in (`lifts`, seconds, [] for none); it keeps the bed
    alone at the master's gain beside the stem (`<out>.music.wav`) so QC can meter it."""
    if mode not in ('continuous', 'ducked', 'episode_bed'):
        raise ValueError('bed mode must be continuous, ducked or episode_bed')
    if mode == 'episode_bed':
        missing = [k for k in EPISODE_LEVELS if not isinstance((levels or {}).get(k), (int, float))]
        if missing or lifts is None:
            raise ValueError('an episode_bed needs the ledger levels (' + ', '.join(missing or ['lifts']) + ')')
        bad = [w for w in lifts if not (0 <= float(w[0]) < float(w[1]) <= duration_s)]
        if bad:
            raise ValueError(f'a lift window must lie inside the cut (0 to {duration_s:.2f} s): {bad}')
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    tmp_dialogue = str(Path(out).with_suffix('.dialogue.wav'))
    # padded to the cut's length: the dialogue ends at the last word, the cut runs on through its ending card
    _run(['-ss', f'{start_s:.3f}', '-t', f'{duration_s:.3f}', '-i', dialogue, '-af', f'apad=whole_dur={duration_s:.3f}',
          '-ac', '2', '-ar', '48000', tmp_dialogue])
    voice = float(_measure(tmp_dialogue)['input_i'])
    summed = str(Path(out).with_suffix('.sum.wav'))
    tmp_bed = str(Path(out).with_suffix('.bed.wav'))
    bed_stem = str(Path(out).with_suffix('.bedonly.wav'))
    report: dict = {'mode': mode, 'bed_present': bed is not None}
    last_end = last_word_end_s if last_word_end_s is not None else max(0.0, duration_s - 3.5)
    music = str(Path(out).with_suffix('.music.wav'))
    if bed:
        trim = [] if mode == 'episode_bed' else ['-t', f'{duration_s:.3f}']
        _run(['-ss', f'{bed_start_s:.3f}', *trim, '-i', bed, '-ac', '2', '-ar', '48000', tmp_bed])
        voice_samples = _decode(tmp_dialogue)
        if mode != 'episode_bed' and len(_decode(tmp_bed)) < int(SR * duration_s) - SR // 10:
            # a bed that runs out before the cut ends leaves the rest of it bare (the 30 Oct drop-out)
            raise ValueError(f'the bed runs out before the cut ends ({duration_s:.1f} s): use mode episode_bed, which restarts it')
        if mode == 'episode_bed':
            # bed_lufs is the bed's level in the finished master; the master gain is about lufs - voice, so aim the
            # bed there, master, then correct once from the measured master gain
            envelope = episode_envelope(int(round(duration_s * SR)), levels, voice_start_s=voice_start_s,
                                        last_word_end_s=last_end, lifts=[tuple(w) for w in lifts], duration_s=duration_s)
            stops = track_stops(tmp_bed)
            intro = track_intro(tmp_bed)
            probe = str(Path(out).with_suffix('.probe.wav'))
            _episode_bed(tmp_bed, probe, duration_s=duration_s, gain_db=0.0, envelope_db=np.zeros_like(envelope), stops=stops,
                         restart_from_s=intro)
            body = body_window(voice_start_s, last_end, duration_s)
            raw = ebur128(probe, *body)['I']
            Path(probe).unlink(missing_ok=True)
            gain = float(levels['bed_lufs']) - lufs + voice - raw
            for _ in range(3):
                rendered = gain
                centres = _episode_bed(tmp_bed, bed_stem, duration_s=duration_s, gain_db=gain, envelope_db=envelope, stops=stops,
                                       restart_from_s=intro)
                graph = ('[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[b];'
                         '[v][b]amix=inputs=2:normalize=0:duration=first[m]')
                _sum([tmp_dialogue, bed_stem], graph, summed, '[m]')
                final = _master(summed, out, lufs, tp)
                master_gain = float(final['gain_db'])
                got = ebur128(bed_stem, *body, gain_db=master_gain)['I']
                miss = float(levels['bed_lufs']) - got
                if abs(miss) <= 0.3:
                    break
                gain += miss
            _run(['-i', bed_stem, '-af', f'volume={master_gain:.2f}dB', music])
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
        else:
            # 1. flat gain that puts the bed in the pauses at PAUSE_TARGET_DB re the voice, measured not assumed
            flat = str(Path(out).with_suffix('.flat.wav'))
            _run(['-i', tmp_bed, '-af', 'aformat=sample_rates=48000:channel_layouts=stereo,volume=0dB', flat])
            raw_bed = _decode(flat)
            n = min(len(voice_samples), len(raw_bed))
            pause_db = analyse(voice_samples[:n], raw_bed[:n], last_word_end_s=last_end)['bed_in_pauses_db']
            if pause_db is None:  # no real pause to key on: fall back to the integrated loudness
                gain = (voice + PAUSE_TARGET_DB) - float(_measure(tmp_bed)['input_i'])
            else:
                gain = PAUSE_TARGET_DB - pause_db
            Path(flat).unlink(missing_ok=True)
            # 2. the first threshold whose speech level lands at or under SPEECH_TARGET_DB + 1
            chosen = THRESHOLDS[-1]
            for threshold in THRESHOLDS:
                _ducked_bed(tmp_dialogue, tmp_bed, bed_stem, gain_db=gain, threshold=threshold, duration_s=duration_s,
                            last_word_end_s=last_end)
                got = analyse(voice_samples, _decode(bed_stem), last_word_end_s=last_end)['bed_under_speech_db']
                if got is not None and got <= SPEECH_TARGET_DB + 1:
                    chosen = threshold
                    break
            report.update(gain_db=round(gain, 2), threshold=chosen, ratio=RATIO, attack_ms=ATTACK_MS, release_ms=RELEASE_MS)
            graph = ('[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[b];'
                     '[v][b]amix=inputs=2:normalize=0:duration=first[m]')
            _sum([tmp_dialogue, bed_stem], graph, summed, '[m]')
        report.update(analyse(voice_samples, _decode(bed_stem), last_word_end_s=last_end))
    else:
        _sum([tmp_dialogue], '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v]', summed, '[v]')
    if not (bed and mode == 'episode_bed'):
        final = _master(summed, out, lufs, tp)
    result = {'stem': out, 'dialogue_lufs': voice, 'integrated_lufs': float(final['input_i']), 'true_peak_dbtp': float(final['input_tp']),
              'start_s': start_s, 'duration_s': duration_s, 'under_vo_lu': under_vo_lu, 'bed': report}
    # The levels are relative, so the master gain (applied equally to voice and bed) does not change them.
    Path(out).with_suffix('.bed.json').write_text(json.dumps(result, indent=1), encoding='utf-8')
    for tmp in (tmp_dialogue, summed, tmp_bed, bed_stem):
        Path(tmp).unlink(missing_ok=True)
    return result
