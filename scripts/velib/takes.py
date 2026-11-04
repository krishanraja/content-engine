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

# The same rule quick-edit has used since 16 October (scripts/quick-edit/make.py conform_filter): a teleprompter.com
# take is 24 fps on average (24.0005) but its frames are stamped unevenly, 30 to 60 ms apart, so resampling it by its
# stamps dropped one frame and showed the next twice about 40 times in 30 s. Its camera captured evenly, so a take
# whose average rate is a house rate to within CONFORM_TOLERANCE is laid evenly at that average before anything else.
HOUSE_RATES = (24, 25, 30, 50, 60)
CONFORM_TOLERANCE = 0.001
HDR_TRANSFERS = {'smpte2084': 'pq', 'arib-std-b67': 'hlg'}   # PQ, and HLG (an iPhone's Dolby Vision 8.4 base layer)


def _ffprobe() -> str | None:
    import shutil  # noqa: PLC0415
    from .common import ffmpeg  # noqa: PLC0415
    beside = shutil.which('ffprobe', path=str(Path(ffmpeg()).parent))
    return beside or shutil.which('ffprobe')


def _rate(text) -> float | None:
    num, _, den = str(text or '').partition('/')
    try:
        value = float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        return None
    return value if math.isfinite(value) and value > 0 else None


def video_probe(media: str | Path) -> dict | None:
    """What the picture of a take is, measured once at ingest: its average rate and nearest house rate, whether conform
    lays it evenly, how unevenly its first frames are stamped, its rotation, colour transfer (HDR or not) and bit depth.
    None when the media has no video stream (a stub take, or a voice-only recording)."""
    import json  # noqa: PLC0415
    import subprocess  # noqa: PLC0415
    exe = _ffprobe()
    if not exe:
        return None
    info = subprocess.run([exe, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                           'stream=avg_frame_rate,r_frame_rate,pix_fmt,color_transfer,color_primaries,bits_per_raw_sample:'
                           'stream_tags=rotate:stream_side_data=rotation', '-of', 'json', str(media)],
                          capture_output=True, text=True, errors='replace')
    streams = (json.loads(info.stdout or '{}').get('streams') or []) if info.returncode == 0 else []
    if not streams:
        return None
    stream = streams[0]
    stamps = subprocess.run([exe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time',
                             '-of', 'csv=p=0', str(media)], capture_output=True, text=True, errors='replace')
    times = sorted(float(t) for t in re.findall(r'^-?[\d.]+', stamps.stdout, re.M)) if stamps.returncode == 0 else []
    rate, offset, jitter = _rate(stream.get('avg_frame_rate')) or _rate(stream.get('r_frame_rate')), 0.0, None
    if len(times) > 2:
        # Every frame's stamp against its index, fitted by least squares: the rate the camera ran at, and where an even
        # grid at that rate sits, so laying frames on it moves each one as little as its own jitter.
        n = len(times)
        mean_i, mean_t = (n - 1) / 2, sum(times) / n
        slope = sum((i - mean_i) * (t - mean_t) for i, t in enumerate(times)) / sum((i - mean_i) ** 2 for i in range(n))
        if slope > 0:
            rate, base = 1 / slope, mean_t - slope * mean_i
            offset = base - times[0]
            off = sorted(abs(t - (base + i * slope)) * 1000 for i, t in enumerate(times))
            jitter = round(off[min(n - 1, int(0.95 * n))], 2)
    house = min(HOUSE_RATES, key=lambda r: abs(r - rate)) if rate else None
    even = bool(rate and abs(rate / house - 1) <= CONFORM_TOLERANCE)
    rotation = 0
    for side in stream.get('side_data_list') or []:
        if isinstance(side.get('rotation'), (int, float)):
            rotation = int(side['rotation'])
    if not rotation and str((stream.get('tags') or {}).get('rotate', '')).lstrip('-').isdigit():
        rotation = int(stream['tags']['rotate'])
    depth = stream.get('bits_per_raw_sample')
    pix = stream.get('pix_fmt') or ''
    if not str(depth or '').isdigit():
        depth = 10 if re.search(r'p10|p12', pix) else (8 if pix else None)
    transfer = stream.get('color_transfer') or None
    return {'avg_rate': round(rate, 6) if rate else None, 'house_rate': house, 'laid': 'even' if even else 'resampled',
            'lay_offset_s': round(offset, 6), 'jitter_p95_ms': jitter, 'rotation': rotation, 'transfer': transfer, 'hdr': HDR_TRANSFERS.get(transfer or ''),
            'primaries': stream.get('color_primaries') or None, 'pix_fmt': pix or None,
            'bit_depth': int(depth) if str(depth or '').isdigit() else None}


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
    picture = video_probe(media)
    record = {
        'schema': SCHEMA, 'piece': piece, 'take': take,
        'media': {'path': str(media.resolve()), 'sha256': sha256_file(media), 'duration_s': round(float(duration_s), 4),
                  **({'video': picture} if picture else {})},
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
