"""ve audio: the premixed stem every render carries (dialogue + bed), mastered to the spec's targets.
One clock: the stem starts at frame 0 of the cut, so picture, captions and events all read the same time.
Two-pass loudnorm on the sum, true peak limited after it, then measured again; nothing is assumed."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from .common import ffmpeg


def _measure(path: str) -> dict:
    text = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
                          capture_output=True, text=True, errors='replace').stderr
    return json.loads(text[text.rfind('{'):text.rfind('}') + 1])


def premix(dialogue: str, bed: str | None, out: str, start_s: float, duration_s: float, bed_start_s: float = 0.0,
           under_vo_lu: float = -20.0, lufs: float = -14.0, tp: float = -1.0) -> dict:
    """Cut [start_s, start_s + duration_s) from the dialogue master, lay the bed under it at under_vo_lu relative
    to the dialogue's integrated loudness, and master the sum to lufs / tp. Returns the measured result."""
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    tmp_dialogue = str(Path(out).with_suffix('.dialogue.wav'))
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-ss', f'{start_s:.3f}', '-t', f'{duration_s:.3f}', '-i', dialogue,
                    '-ac', '2', '-ar', '48000', tmp_dialogue], check=True)
    voice = float(_measure(tmp_dialogue)['input_i'])
    inputs = ['-i', tmp_dialogue]
    graph = '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v]'
    mix = '[v]'
    if bed:
        tmp_bed = str(Path(out).with_suffix('.bed.wav'))
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-ss', f'{bed_start_s:.3f}', '-t', f'{duration_s:.3f}', '-i', bed,
                        '-ac', '2', '-ar', '48000', tmp_bed], check=True)
        bed_gain = (voice + under_vo_lu) - float(_measure(tmp_bed)['input_i'])
        inputs += ['-i', tmp_bed]
        graph += f';[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={bed_gain:.2f}dB,afade=t=in:d=0.4,afade=t=out:st={max(0.0, duration_s - 0.6):.3f}:d=0.6[b]'
        graph += ';[v][b]amix=inputs=2:normalize=0:duration=first[m]'
        mix = '[m]'
    summed = str(Path(out).with_suffix('.sum.wav'))
    subprocess.run([ffmpeg(), '-v', 'error', '-y', *inputs, '-filter_complex', graph, '-map', mix, summed], check=True)
    # Gain to target, then a true-peak-safe limiter (4x oversampled, sample ceiling 0.7 dB under tp); measure and
    # correct once more, because limiting speech peaks pulls integrated loudness down.
    limit = 10 ** ((tp - 0.7) / 20)
    gain = lufs - float(_measure(summed)['input_i'])
    final = {}
    for _ in range(3):
        chain = (f"volume={gain:.2f}dB,aresample=192000,alimiter=limit={limit:.4f}:attack=2:release=60:level=disabled,"
                 f"aresample=48000")
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', summed, '-af', chain, '-ar', '48000', out], check=True)
        final = _measure(out)
        miss = lufs - float(final['input_i'])
        if abs(miss) <= 0.3 and float(final['input_tp']) <= tp:
            break
        gain += miss
    for tmp in (tmp_dialogue, summed, str(Path(out).with_suffix('.bed.wav'))):
        Path(tmp).unlink(missing_ok=True)
    return {'stem': out, 'dialogue_lufs': voice, 'integrated_lufs': float(final['input_i']), 'true_peak_dbtp': float(final['input_tp']),
            'start_s': start_s, 'duration_s': duration_s, 'under_vo_lu': under_vo_lu}
