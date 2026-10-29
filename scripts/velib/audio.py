"""ve audio: the premixed stem every render carries (dialogue + bed), mastered to the spec's targets.
One clock: the stem starts at frame 0 of the cut, so picture, captions and events all read the same time.
Two-pass loudnorm on the sum, true peak limited after it, then measured again; nothing is assumed.

Bed modes (spec audio.bed.mode):
- continuous: one flat gain, under_vo_lu below the voice's integrated loudness, short fades.
- ducked: the music breathes. In pauses it sits about 10 dB under the voice; under speech a sidechain
  compressor keyed by the voice pulls it to about 18 dB under, with a slow release so it never pumps.
  Fade in 1 s, a gentle lift after the last word, fade out over the last 1.5 s.
Both modes measure the bed against the voice from the stems and write `<stem>.bed.json` beside the stem, which
`ve qc` reads (qc_audio.bed)."""
from __future__ import annotations

import json
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


def premix(dialogue: str, bed: str | None, out: str, start_s: float, duration_s: float, bed_start_s: float = 0.0,
           under_vo_lu: float = -20.0, lufs: float = -14.0, tp: float = -1.0, mode: str = 'continuous',
           last_word_end_s: float | None = None) -> dict:
    """Cut [start_s, start_s + duration_s) from the dialogue master, lay the bed under it (see the module docstring
    for the two modes), and master the sum to lufs / tp. Returns the measured result and writes `<out>.bed.json`."""
    if mode not in ('continuous', 'ducked'):
        raise ValueError('bed mode must be continuous or ducked')
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    tmp_dialogue = str(Path(out).with_suffix('.dialogue.wav'))
    _run(['-ss', f'{start_s:.3f}', '-t', f'{duration_s:.3f}', '-i', dialogue, '-ac', '2', '-ar', '48000', tmp_dialogue])
    voice = float(_measure(tmp_dialogue)['input_i'])
    summed = str(Path(out).with_suffix('.sum.wav'))
    tmp_bed = str(Path(out).with_suffix('.bed.wav'))
    bed_stem = str(Path(out).with_suffix('.bedonly.wav'))
    report: dict = {'mode': mode, 'bed_present': bed is not None}
    last_end = last_word_end_s if last_word_end_s is not None else max(0.0, duration_s - 3.5)
    if bed:
        _run(['-ss', f'{bed_start_s:.3f}', '-t', f'{duration_s:.3f}', '-i', bed, '-ac', '2', '-ar', '48000', tmp_bed])
        voice_samples = _decode(tmp_dialogue)
        if mode == 'continuous':
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
    final = _master(summed, out, lufs, tp)
    result = {'stem': out, 'dialogue_lufs': voice, 'integrated_lufs': float(final['input_i']), 'true_peak_dbtp': float(final['input_tp']),
              'start_s': start_s, 'duration_s': duration_s, 'under_vo_lu': under_vo_lu, 'bed': report}
    # The levels are relative, so the master gain (applied equally to voice and bed) does not change them.
    Path(out).with_suffix('.bed.json').write_text(json.dumps(result, indent=1), encoding='utf-8')
    for tmp in (tmp_dialogue, summed, tmp_bed, bed_stem):
        Path(tmp).unlink(missing_ok=True)
    return result
