"""The weekly generation-credit budget Krish signs (config/ve/credit-budget.json), and how it is checked.

Plan Wave 2, W2.6: "A weekly generation-credit budget as a signed record, covering Codex, Runway, Higgsfield and
ElevenLabs. cards.dispatch and the ve ledger reserve against it before each dispatch and refuse anything over it. It
replaces the per-run --spend-approved flag. The design lock's per-generation consent becomes that weekly cap through
ve lock, with his words."

It is signed the way the engine's other signed records are: signed.by is "Krish", signed.said is his own words (at
least two), signed.on a date (scripts/post-pack/creative_direction.py, krish_said), and the signature is bound to the
exact record by its sha256 (signed.record_sha256, the drift rule of the narrative lock in scripts/post-pack/making.py):
a record changed after he signed it no longer stands. The template (credit-budget.template.json) is never signed by a
session; the amounts are his.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import sys
from pathlib import Path

from .common import CONFIG, ROOT

RECORD = CONFIG / 'credit-budget.json'
TEMPLATE = CONFIG / 'credit-budget.template.json'
PROVIDERS = ('codex_allowance_points', 'codex_paid_credits', 'runway_credits', 'higgsfield_credits', 'elevenlabs_credits')


def _krish_said(signed) -> bool:
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    from creative_direction import krish_said  # the one check of his words on a signed record
    return bool(krish_said(signed))


def record_hash(record: dict) -> str:
    """The sha256 his signature binds: the whole record but its signature, keys sorted."""
    body = {k: v for k, v in record.items() if k != 'signed'}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()


def _monday(text) -> dt.date | None:
    try:
        day = dt.date.fromisoformat(str(text))
    except ValueError:
        return None
    return day if day.weekday() == 0 and day.isoformat() == text else None


def verify(record) -> list[str]:
    """Why this budget does not stand, [] when it does."""
    if not isinstance(record, dict) or record.get('schema') != 've-credit-budget/1':
        return ['the budget must be a ve-credit-budget/1 record']
    out = []
    if not _monday(record.get('from_week')):
        out.append('from_week must be the Monday it first covers, YYYY-MM-DD')
    caps = record.get('caps')
    if not isinstance(caps, dict) or set(caps) != set(PROVIDERS):
        out.append(f'caps must name exactly {", ".join(PROVIDERS)}')
    else:
        for key, value in caps.items():
            if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                out.append(f'caps.{key} must be his number, 0 or more')
    signed = record.get('signed') or {}
    if not _krish_said(signed):
        out.append('not signed: signed.by "Krish", signed.said his own words, signed.on the date (no session signs it for him)')
    elif signed.get('record_sha256') != record_hash(record):
        out.append('the budget changed after Krish signed it: his signature carries a different record_sha256')
    return out


def load(path=None) -> dict:
    return json.loads(Path(path or RECORD).read_text(encoding='utf-8'))


def standing(path=None, today: dt.date | None = None) -> dict:
    """The signed budget that covers this week, or SystemExit naming why there is none."""
    try:
        record = load(path)
    except FileNotFoundError:
        raise SystemExit('ve: no weekly credit budget: Krish signs config/ve/credit-budget.json (from its template) before '
                         'anything spends') from None
    except (OSError, ValueError) as error:
        raise SystemExit(f've: the weekly credit budget cannot be read: {error}') from None
    problems = verify(record)
    if problems:
        raise SystemExit('ve: the weekly credit budget does not stand: ' + '; '.join(problems))
    week = week_of(today)
    if week < record['from_week']:
        raise SystemExit(f've: the signed weekly credit budget starts on {record["from_week"]}, after this week ({week})')
    return record


def week_of(today: dt.date | None = None) -> str:
    today = today or dt.datetime.now(dt.timezone.utc).date()
    return (today - dt.timedelta(days=today.weekday())).isoformat()
