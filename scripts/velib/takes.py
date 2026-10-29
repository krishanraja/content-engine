"""ve ingest: bring a recorded take and its two word clocks into a piece.

A take record lives at <piece>/ve/takes/<take>.json and holds the media's path, SHA-256 and duration, and the words
each aligner heard, unchanged apart from normalising field names. The media itself never enters the repository.

Word clocks come in as JSON files (a list of words, or {"words": [...]}) in any of these shapes:
  {"word"|"text", "onset_s", "end_s"}  ve and quick-edit
  {"word"|"text", "start", "end"}      faster-whisper word timestamps
  {"text", "start", "end", "type"}     ElevenLabs Scribe (only type "word" is kept)
An aligner may also be run here, but only a local, free one: faster-whisper (`faster-whisper:<model>`). The second
aligner's paid route (ElevenLabs Scribe) needs Krish's yes on its key and spend, so ingest never calls it; its output
arrives as a file. Two passes of different local models count as two aligners; the same name twice does not.
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
        if item.get('type') not in (None, 'word'):
            continue  # Scribe spacing and audio events are not words
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
        raise ValueError('a take needs two different aligners (for example faster-whisper:small.en and elevenlabs:scribe_v1)')
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
