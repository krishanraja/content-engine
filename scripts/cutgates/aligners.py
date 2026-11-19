"""The aligners the gates hear a cut with: faster-whisper, plus any pass already made that is handed in by name.

    passes(video, heard={'faster-whisper': words}) -> {'aligners': {name: words}, 'agreement': ..., 'second': ...}

A pass already made (make.py's <cut>.heard.json) is reused, never made again. No paid aligner runs (Krish,
2026-10-29: "do not use eleven labs for this"): with one pass the result says "single aligner", and nothing
claims two aligners agreed.
"""
from __future__ import annotations


from . import settings


def _audio(path):
    """The file's sound as 16 kHz mono float32 samples, decoded by ffmpeg. faster-whisper's own decoder calls av.open with
    an argument older PyAV builds refuse ("unexpected keyword argument 'metadata_errors'", the cloud machines, 19 Nov
    2026), so it is handed samples, which every version takes and which hear the same audio."""
    import subprocess

    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def faster_whisper(path, model='small.en') -> dict:
    """faster-whisper on a finished file, as make.py hears it (beam 5, VAD, word timings)."""
    from faster_whisper import WhisperModel  # installed on the home computers, never in CI
    segs, info = WhisperModel(model, device='cpu', compute_type='int8', cpu_threads=4).transcribe(
        _audio(path), word_timestamps=True, vad_filter=True, beam_size=5)
    words = [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for seg in segs for w in seg.words]
    return {'aligner': settings.FIRST, 'model': model, 'duration': info.duration, 'words': words}


def passes(video, *, heard=None, model='small.en', environ=None) -> dict:
    """Every aligner's words for one finished file. heard: passes already made, by aligner name; faster-whisper
    is run when its pass is not among them. environ is accepted for older callers and ignored."""
    found = dict(heard or {})
    if settings.FIRST not in found:
        found[settings.FIRST] = faster_whisper(video, model)['words']
    second = settings.second_aligner()
    names = [settings.FIRST] + sorted(n for n in found if n != settings.FIRST)
    return {'aligners': {n: found[n] for n in names}, 'agreement': settings.mode(names),
            'second': {'enabled': False, 'provider': None, 'ran': False, 'reasons': second['reasons']}}


def independent_of(drew: str, aligners: dict):
    """The aligner that did not draw the captions, and whether it is truly independent. With one aligner the
    finished audio is heard again by the same aligner: a new pass on new audio, said plainly as not independent."""
    others = [n for n in aligners if n != drew]
    if others:
        return others[0], True
    return next(iter(aligners)), False
