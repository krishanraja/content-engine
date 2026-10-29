"""config/gates.json, read once; the paid second aligner stays off."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config' / 'gates.json'
FIRST = 'faster-whisper'


@lru_cache(maxsize=1)
def load() -> dict:
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def rule(section: str) -> dict:
    return dict(load()[section])


def second_aligner(environ=None) -> dict:
    """The paid second aligner is permanently off (config/gates.json second_aligner.ruling): ElevenLabs Scribe was
    removed on Krish's ruling, so the gates run on faster-whisper and say "single aligner". environ is ignored."""
    cfg = rule('second_aligner')
    return {'enabled': False, 'provider': None, 'reasons': [f'removed: {cfg["ruling"]}']}


def mode(names) -> str:
    """How many aligners a result rests on, said plainly."""
    names = list(names)
    return 'single aligner' if len(names) == 1 else f'{len(names)} aligners'


def post_date(target) -> str | None:
    """The date of the post a library path files into (3 Posts/YYYY-MM-DD Day ...)."""
    parts = str(target or '').replace('\\', '/').split('/')
    if len(parts) < 2 or parts[0] != '3 Posts':
        return None
    dated = re.match(r'(\d{4}-\d{2}-\d{2}) ', parts[1])
    return dated.group(1) if dated else None


def required_on(date) -> bool:
    """Whether a cut for a post on this date (YYYY-MM-DD, or a library path) must carry the joins and captions checks."""
    date = post_date(date) if '/' in str(date or '') or '\\' in str(date or '') else str(date or '')[:10]
    return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', date or '')) and date >= load()['required_from']
