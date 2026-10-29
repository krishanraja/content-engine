#!/usr/bin/env python3
"""ElevenLabs Scribe as the second aligner, behind a flag that is off by default.

Nothing here runs unless settings.second_aligner() says it may: config/gates.json enables it with Krish's words
(his yes on the key and the spend), MINDMAKE_SECOND_ALIGNER=scribe is set, and ELEVENLABS_API_KEY is in the
environment. Tests never call the service: they pass their own `post`.

The one-file word-timestamp check, for the day he says yes (one paid call, one file):

    python3 scripts/cutgates/scribe.py check FILE.wav [--faster-whisper FILE.words.json] [--out report.json]
    python3 scripts/cutgates/scribe.py compare A.words.json B.words.json   (no call: two word files already made)

It reports how far Scribe's word starts and ends sit from faster-whisper's on the same words (median and 95th
percentile, in ms) and how many words both heard, so the joins rule's 80 ms and 30 ms can be judged against it.
"""
from __future__ import annotations

import argparse
import difflib
import json
import mimetypes
import os
import re
import statistics
import sys
import urllib.request
import uuid
from pathlib import Path

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from cutgates import settings  # noqa: E402
else:
    from . import settings

ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'


class ScribeOff(RuntimeError):
    """The second aligner is not allowed to run here; the reasons say why."""


def _multipart(fields: dict, file_field: str, path: Path):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    kind = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{path.name}"\r\n'
                 f'Content-Type: {kind}\r\n\r\n'.encode() + path.read_bytes() + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return b''.join(parts), f'multipart/form-data; boundary={boundary}'


def _post(url, body, headers):  # pragma: no cover - the paid call; tests pass their own post
    request = urllib.request.Request(url, data=body, headers=headers, method='POST')
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(response.read().decode('utf-8'))


def words_of(answer: dict) -> list[dict]:
    """Scribe's answer as {w, s, e} words: only items of type word, in order."""
    out = []
    for item in answer.get('words') or []:
        if item.get('type', 'word') != 'word' or not str(item.get('text', '')).strip():
            continue
        out.append({'w': ' ' + str(item['text']).strip(), 's': round(float(item['start']), 3), 'e': round(float(item['end']), 3)})
    return out


def transcribe(path, *, environ=None, post=None) -> dict:
    """Scribe's words for one audio or video file. Refuses (ScribeOff) unless the flag, the config and the key allow it."""
    allowed = settings.second_aligner(environ)
    if not allowed['enabled']:
        raise ScribeOff('; '.join(allowed['reasons']))
    environ = os.environ if environ is None else environ
    body, kind = _multipart({'model_id': allowed['model_id'], 'timestamps_granularity': 'word', 'tag_audio_events': 'false'},
                            'file', Path(path))
    answer = (post or _post)(ENDPOINT, body, {'xi-api-key': environ[allowed['key_env']], 'Content-Type': kind})
    return {'aligner': settings.SECOND, 'provider': allowed['provider'], 'model_id': allowed['model_id'],
            'language_code': answer.get('language_code'), 'words': words_of(answer)}


def _tokens(words):
    return [re.sub(r'[^a-z0-9]', '', str(w['w']).lower()) for w in words]


def compare(first: list, second: list) -> dict:
    """Word timing agreement between two aligners on the same audio: the words both heard, matched in order."""
    a, b = _tokens(first), _tokens(second)
    pairs = []
    for block in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            x, y = first[block.a + k], second[block.b + k]
            if a[block.a + k]:
                pairs.append((x, y))
    starts = sorted(abs(x['s'] - y['s']) * 1000 for x, y in pairs)
    ends = sorted(abs(x['e'] - y['e']) * 1000 for x, y in pairs)

    def p95(values):
        return round(values[min(len(values) - 1, int(round(0.95 * (len(values) - 1))))], 1) if values else None

    return {'words_first': len(first), 'words_second': len(second), 'matched': len(pairs),
            'matched_fraction': round(len(pairs) / max(len(first), len(second), 1), 3),
            'start_ms': {'median': round(statistics.median(starts), 1) if starts else None, 'p95': p95(starts)},
            'end_ms': {'median': round(statistics.median(ends), 1) if ends else None, 'p95': p95(ends)},
            'joins_rule': settings.rule('joins')}


def _read_words(path):
    doc = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    return doc.get('words') if isinstance(doc, dict) else doc


def main(argv=None, *, post=None, environ=None):
    ap = argparse.ArgumentParser(description='ElevenLabs Scribe, the second aligner (off by default).')
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('check', help='one paid call on one file, compared with faster-whisper')
    c.add_argument('file')
    c.add_argument('--faster-whisper', help="faster-whisper's words for the same file (made here when faster-whisper is installed)")
    c.add_argument('--model', default='small.en')
    c.add_argument('--out')
    m = sub.add_parser('compare', help='two word files already made; no call')
    m.add_argument('first')
    m.add_argument('second')
    a = ap.parse_args(argv)
    if a.cmd == 'compare':
        print(json.dumps(compare(_read_words(a.first), _read_words(a.second)), indent=1))
        return 0
    try:
        heard = transcribe(a.file, environ=environ, post=post)
    except ScribeOff as off:
        print(json.dumps({'status': 'not_allowed', 'reason': str(off)}, indent=1))
        return 2
    if a.faster_whisper:
        first = _read_words(a.faster_whisper)
    else:
        from cutgates import aligners
        first = aligners.faster_whisper(a.file, a.model)['words']
    report = {'file': a.file, 'scribe': {k: heard[k] for k in ('provider', 'model_id', 'language_code')},
              'comparison': compare(first, heard['words'])}
    if a.out:
        Path(a.out).write_text(json.dumps({**report, 'scribe_words': heard['words']}, indent=1), encoding='utf-8')
    print(json.dumps(report, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
