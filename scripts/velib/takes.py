"""ve ingest: bring a recorded take and its two word clocks into a piece.

A take record lives at <piece>/ve/takes/<take>.json and holds the media's path, SHA-256 and duration, and the words
each aligner heard, unchanged apart from normalising field names. The media itself never enters the repository.

Word clocks come in as JSON files (a list of words, or {"words": [...]}) in any of these shapes:
  {"word"|"text", "onset_s", "end_s"}  ve and quick-edit
  {"word"|"text", "start", "end"}      faster-whisper word timestamps
An aligner may also be run here, but only a local, free one: faster-whisper (`faster-whisper:<model>`). There is no
paid aligner (Krish, 2026-10-29: "do not use eleven labs for this"): an ElevenLabs clock is refused. Two passes of different local models count as two aligners; the
same name twice does not.
"""
from __future__ import annotations

import math
import re
from datetime import date
from pathlib import Path

from .common import load_json, sha256_file, write_json

SCHEMA = 've-take/1'
TAKE_ID = re.compile(r'^[a-z0-9][a-z0-9_-]{0,63}$')


def normalise(raw) -> list[dict]:
    """Words as [{i, text, onset_s, end_s}] in time order; refuses anything it cannot read as a clock."""
    words = raw.get('words') if isinstance(raw, dict) else raw
    if not isinstance(words, list):
        raise ValueError('a word clock is a list of words or {"words": [...]}')
    out = []
    for item in words:
        if not isinstance(item, dict):
            raise ValueError(f'a word must be an object: {item!r}')
        text = item.get('word', item.get('text'))
        onset = item.get('onset_s', item.get('start'))
        end = item.get('end_s', item.get('end'))
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f'a word needs its text: {item!r}')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (onset, end)):
            raise ValueError(f'word "{text.strip()}" needs finite start and end times')
        if end < onset:
            raise ValueError(f'word "{text.strip()}" ends before it starts')
        out.append({'text': text.strip(), 'onset_s': round(float(onset), 4), 'end_s': round(float(end), 4)})
    out.sort(key=lambda w: (w['onset_s'], w['end_s']))
    if not out:
        raise ValueError('the word clock holds no words')
    for index, word in enumerate(out):
        word['i'] = index
    return [{'i': w['i'], 'text': w['text'], 'onset_s': w['onset_s'], 'end_s': w['end_s']} for w in out]


def align_local(media: str | Path, aligner: str) -> list[dict]:
    """Run a free local aligner. Only faster-whisper:<model> is known; anything else arrives as a file."""
    name, _, model = aligner.partition(':')
    if name != 'faster-whisper' or not model:
        raise ValueError(f'{aligner}: ingest runs only faster-whisper:<model> itself; give other aligners as a clock file')
    try:
        from faster_whisper import WhisperModel  # noqa: PLC0415
    except ImportError as error:
        raise ValueError('faster-whisper is not installed on this machine (ve doctor); give the clock as a file') from error
    segments, _info = WhisperModel(model).transcribe(str(media), word_timestamps=True, language='en')
    return normalise([{'word': w.word, 'start': w.start, 'end': w.end} for s in segments for w in (s.words or [])])


SILENCE_BELOW_DB = 25    # quieter than the take's loud speech (90th percentile) by this much is a pause
SILENCE_MIN_S = 0.2      # a pause shorter than this is a breath inside speech, not a gap
_SILENCES: dict = {}


def silent_spans(levels_db, fps: int = 30) -> list[list[float]]:
    """[[start_s, end_s], ...] where a take's level (dB per 1/fps s) stays below its pause line for SILENCE_MIN_S."""
    import numpy as np  # noqa: PLC0415
    levels = np.asarray(levels_db, dtype=float)
    if not len(levels):
        return []
    line = max(-60.0, float(np.percentile(levels, 90)) - SILENCE_BELOW_DB)
    quiet = levels < line
    spans, start = [], None
    for i, q in enumerate(list(quiet) + [False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if (i - start) / fps >= SILENCE_MIN_S:
                spans.append([round(start / fps, 4), round(i / fps, 4)])
            start = None
    return spans


def silences(record: dict, fps: int = 30) -> list[list[float]]:
    """The take's pauses, measured from its own audio (read only; cached per media hash). Aligners make words
    run edge to edge, so a pause is folded into the next word's start; this is where the voice actually is."""
    if 'silences' in record:
        return record['silences']
    media = record['media']
    key = media.get('sha256') or media['path']
    if key not in _SILENCES and not Path(media['path']).is_file():
        return []  # check_media names a missing take; with no audio there is nothing to move a word by
    if key not in _SILENCES:
        import subprocess  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415
        from .common import ffmpeg  # noqa: PLC0415
        rate = 16000
        decoded = subprocess.run([ffmpeg(), '-v', 'error', '-i', media['path'], '-map', '0:a:0', '-ac', '1', '-ar', str(rate),
                                  '-f', 'f32le', '-'], capture_output=True)
        if decoded.returncode:
            return []  # no audio stream to measure (a stub take); render refuses a take it cannot decode
        raw = decoded.stdout
        audio = np.frombuffer(raw, np.float32)
        n = rate // fps
        frames = audio[:len(audio) // n * n].reshape(-1, n)
        _SILENCES[key] = silent_spans(20 * np.log10(np.sqrt((frames ** 2).mean(1)) + 1e-9), fps)
    return _SILENCES[key]


def voiced_onset(onset: float, end: float, spans) -> float:
    """A word's onset moved past a pause that opens its span: a caption page then starts when he speaks."""
    for start, stop in spans:
        if start < onset + (end - onset) / 2 and stop > onset and stop < end:
            onset = stop
    return onset


def take_path(ve_dir: Path, take: str) -> Path:
    if not TAKE_ID.fullmatch(take or ''):
        raise ValueError('a take id is a slug: lower-case letters, digits, - and _')
    return Path(ve_dir) / 'takes' / f'{take}.json'


def ingest(ve_dir: Path, piece: str, take: str, media: str | Path, *, clock_a=None, clock_b=None,
           aligner_a: str, aligner_b: str, duration_s=None, today: str | None = None) -> Path:
    """Write the take record. Media is hashed, never copied. Refuses one aligner, or the same aligner twice."""
    media = Path(media)
    if not media.is_file():
        raise ValueError(f'{media} is not a file')
    if not aligner_a or not aligner_b or aligner_a == aligner_b:
        raise ValueError('a take needs two different aligners (for example faster-whisper:small.en and faster-whisper:medium.en)')
    if any(str(n).lower().startswith('elevenlabs') for n in (aligner_a, aligner_b)):
        raise ValueError('no paid aligner (Krish, 2026-10-29: "do not use eleven labs for this"): use two local faster-whisper models')
    clocks = {}
    for key, given, name in (('a', clock_a, aligner_a), ('b', clock_b, aligner_b)):
        words = normalise(load_json(given)) if given else align_local(media, name)
        clocks[key] = {'name': name, 'words': words, **({'file_sha256': sha256_file(given)} if given else {})}
    if duration_s is None:
        from .qc import duration_s as probe  # noqa: PLC0415
        duration_s = probe(str(media))
    if not isinstance(duration_s, (int, float)) or not math.isfinite(duration_s) or duration_s <= 0:
        raise ValueError(f'{media} has no measurable duration')
    for key, clock in clocks.items():
        if clock['words'][-1]['end_s'] > duration_s + 0.05:
            raise ValueError(f'aligner {key} ({clock["name"]}) hears words after the end of the media')
    record = {
        'schema': SCHEMA, 'piece': piece, 'take': take,
        'media': {'path': str(media.resolve()), 'sha256': sha256_file(media), 'duration_s': round(float(duration_s), 4)},
        'aligners': clocks,
        'ingested_on': today or date.today().isoformat(),
    }
    return write_json(take_path(ve_dir, take), record)


def load_take(ve_dir: Path, take: str) -> dict:
    record = load_json(take_path(ve_dir, take))
    if record.get('schema') != SCHEMA:
        raise ValueError(f'take {take}: not a {SCHEMA} record')
    if set(record.get('aligners', {})) != {'a', 'b'}:
        raise ValueError(f'take {take}: needs both aligners')
    return record


def list_takes(ve_dir: Path) -> list[str]:
    folder = Path(ve_dir) / 'takes'
    return sorted(p.stem for p in folder.glob('*.json')) if folder.is_dir() else []


def check_media(record: dict) -> str | None:
    """None when the media on disk is still the file that was ingested."""
    path = Path(record['media']['path'])
    if not path.is_file():
        return f'take {record["take"]}: media {path} is missing on this machine'
    if sha256_file(path) != record['media']['sha256']:
        return f'take {record["take"]}: media {path} changed since ingest (sha256)'
    return None
