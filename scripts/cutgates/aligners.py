"""The aligners the gates hear a cut with: faster-whisper always, Scribe only when settings.second_aligner() allows.

    passes(video, heard={'faster-whisper': words}) -> {'aligners': {name: words}, 'agreement': ..., 'second': ...}

A pass already made (make.py's <cut>.heard.json) is reused, never made again. With Scribe off the result names
one aligner and says "single aligner"; nothing claims two aligners agreed.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from . import scribe, settings


def faster_whisper(path, model='small.en') -> dict:
    """faster-whisper on a finished file, as make.py hears it (beam 5, VAD, word timings)."""
    from faster_whisper import WhisperModel  # installed on the home computers, never in CI
    segs, info = WhisperModel(model, device='cpu', compute_type='int8', cpu_threads=4).transcribe(
        str(path), word_timestamps=True, vad_filter=True, beam_size=5)
    words = [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for seg in segs for w in seg.words]
    return {'aligner': settings.FIRST, 'model': model, 'duration': info.duration, 'words': words}


def audio_for_upload(video, out_dir) -> Path:
    """The cut's sound alone, mono 16 kHz FLAC: what Scribe needs, a fraction of the video's size."""
    out = Path(out_dir) / (Path(video).stem + '.scribe.flac')
    subprocess.run([shutil.which('ffmpeg') or 'ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(video), '-vn', '-ac', '1',
                    '-ar', '16000', '-c:a', 'flac', str(out)], check=True)
    return out


def passes(video, *, heard=None, model='small.en', environ=None, post=None, scribe_words=None) -> dict:
    """Every aligner's words for one finished file. heard: passes already made, by aligner name. Scribe runs only
    when allowed; scribe_words (tests, or a pass made earlier) stands in for the call."""
    found = dict(heard or {})
    if settings.FIRST not in found:
        found[settings.FIRST] = faster_whisper(video, model)['words']
    second = settings.second_aligner(environ)
    if scribe_words is not None:
        found[settings.SECOND] = scribe_words
    elif second['enabled'] and settings.SECOND not in found:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                found[settings.SECOND] = scribe.transcribe(audio_for_upload(video, tmp), environ=environ, post=post)['words']
        except Exception as error:  # noqa: BLE001 a failed call leaves one aligner, said so; it never stops the cut
            second = {**second, 'reasons': [f'the Scribe call failed: {type(error).__name__}: {error}'[:300]]}
    names = [n for n in (settings.FIRST, settings.SECOND) if n in found]
    return {'aligners': {n: found[n] for n in names}, 'agreement': settings.mode(names),
            'second': {'enabled': second['enabled'], 'provider': second['provider'], 'ran': settings.SECOND in found,
                       'reasons': second['reasons']}}


def independent_of(drew: str, aligners: dict):
    """The aligner that did not draw the captions, and whether it is truly independent. With one aligner the
    finished audio is heard again by the same aligner: a new pass on new audio, said plainly as not independent."""
    others = [n for n in aligners if n != drew]
    if others:
        return others[0], True
    return next(iter(aligners)), False
