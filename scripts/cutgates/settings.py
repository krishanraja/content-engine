"""config/gates.json, read once, and whether the second aligner may run."""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config' / 'gates.json'
FIRST = 'faster-whisper'
SECOND = 'scribe'


@lru_cache(maxsize=1)
def load() -> dict:
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def rule(section: str) -> dict:
    return dict(load()[section])


def second_aligner(environ=None) -> dict:
    """Whether ElevenLabs Scribe may run here, and why not. All three must hold: config/gates.json enables it
    (his yes on the key and the spend, in his words), the environment flag asks for it, and the key is set.
    Off is the default; off means the gates run on faster-whisper alone and say so."""
    environ = os.environ if environ is None else environ
    cfg = rule('second_aligner')
    why = []
    if cfg.get('enabled') is not True:
        why.append('config/gates.json second_aligner.enabled is false (it needs Krish\'s yes on the ElevenLabs key and spend)')
    elif not str(cfg.get('approved_by_krish') or '').strip().lower().startswith('krish'):
        why.append('config/gates.json second_aligner.approved_by_krish does not carry his words')
    if environ.get(cfg['env_flag'], '').strip().lower() != cfg['env_value']:
        why.append(f'{cfg["env_flag"]} is not set to {cfg["env_value"]}')
    if not environ.get(cfg['key_env']):
        why.append(f'{cfg["key_env"]} is not set')
    return {'enabled': not why, 'provider': cfg['provider'], 'model_id': cfg['model_id'],
            'key_env': cfg['key_env'], 'reasons': why}


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
