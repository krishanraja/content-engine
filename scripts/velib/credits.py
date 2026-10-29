"""The weekly generation-credit budget: its caps are Control Center's credit state, never a number typed here.

Plan Wave 2, W2.6: "cards.dispatch and the ve ledger reserve against it before each dispatch and refuse anything over
it. It replaces the per-run --spend-approved flag." Ruling (Krish, 2026-10-29), on who sets the numbers: "this is now
handled by ai-harness and control-center, they manage expectations on how to use tools where i have credits that need
to be used by before the subscription renews".

So the record is Control Center's credits block for the publication, as its get_engine_credits read (protocol 1.16.0,
the same source growth-makeyourmindup's engine/credits.py reads) returns it: for each prepaid pool placed on the
publication, remaining_for_you, use_by and the balance's as_of. `ve budget pull FILE` saves that read, bound to its
sha256, at config/ve/credit-budget.json's place on this machine (VE_CREDIT_BUDGET names another); a session with the
Control Center connector, or Growth's runner, writes FILE. Nothing here invents a cap: a missing read, a held engine,
unknown credits, a read older than MAX_AGE_DAYS or a provider with no pool placed all hold with that reason.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path

from .common import CONFIG, WORK

SCHEMA = 've-credit-budget/2'
SOURCE = 'control-center get_engine_credits (protocol 1.16.0)'
ENGINE = 'growth-makeyourmindup'
RECORD = Path(os.environ['VE_CREDIT_BUDGET']) if os.environ.get('VE_CREDIT_BUDGET') else WORK / 'credits' / 'credit-budget.json'
MAX_AGE_DAYS = 8
PROVIDERS = ('codex_allowance_points', 'codex_paid_credits', 'runway_credits', 'higgsfield_credits', 'elevenlabs_credits')
# Each provider is reserved against one Control Center pool of the publication, by pool key.
POOLS = {'codex_allowance_points': 'codex', 'codex_paid_credits': 'codex-credits', 'runway_credits': 'runway',
         'higgsfield_credits': 'higgsfield', 'elevenlabs_credits': 'elevenlabs'}


def record_hash(record: dict) -> str:
    """The sha256 the saved read is bound to: the whole record but its own hash, keys sorted."""
    body = {k: v for k, v in record.items() if k != 'record_sha256'}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()


def from_read(read: dict, today: dt.date | None = None) -> dict:
    """The budget record from one get_engine_credits answer, caps from each pool's remaining_for_you."""
    if not isinstance(read, dict) or read.get('ok') is not True:
        raise ValueError('not a get_engine_credits answer with ok: true')
    credits = read.get('credits')
    pools = {p['pool']: p for p in (credits or {}).get('pools', []) if isinstance(p, dict) and isinstance(p.get('pool'), str)}
    caps = {}
    for provider, pool in POOLS.items():
        left = (pools.get(pool) or {}).get('remaining_for_you')
        caps[provider] = left if type(left) in (int, float) and math.isfinite(left) and left >= 0 else None
    record = {'schema': SCHEMA, 'source': SOURCE, 'engine_id': read.get('engine_id'), 'held': bool(read.get('held')),
              'credits_known': credits is not None, 'pulled_on': (today or _today()).isoformat(),
              'as_of': max((str(p.get('balance_as_of') or '') for p in pools.values()), default='') or None,
              'caps': caps, 'pools': {k: {f: v for f, v in p.items() if f in ('tool', 'unit', 'remaining_for_you', 'use_by',
                                                                               'resets_on', 'balance_as_of')}
                                       for k, p in pools.items()}}
    record['record_sha256'] = record_hash(record)
    return record


def verify(record) -> list[str]:
    """Why this budget does not stand, [] when it does (a provider with no pool is refused at reserve, by name)."""
    if not isinstance(record, dict) or record.get('schema') != SCHEMA:
        return [f'the budget must be a {SCHEMA} record saved by ve budget pull from Control Center\'s credit state']
    out = []
    if record.get('record_sha256') != record_hash(record):
        out.append('the saved credit read was edited after it was pulled: its record_sha256 no longer matches')
    if record.get('engine_id') != ENGINE:
        out.append(f'the credit read is for {record.get("engine_id")!r}, not the publication\'s engine {ENGINE}')
    if record.get('held'):
        out.append('Control Center holds the publication\'s engine (held: true): nothing spends')
    if not record.get('credits_known'):
        out.append('Control Center\'s credit state is unknown (credits null): nothing spends')
    if not isinstance(record.get('caps'), dict) or set(record['caps']) != set(PROVIDERS):
        out.append(f'caps must name exactly {", ".join(PROVIDERS)}')
    return out


def load(path=None) -> dict:
    return json.loads(Path(path or RECORD).read_text(encoding='utf-8'))


def save(record, path=None) -> Path:
    path = Path(path or RECORD)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return path


def standing(path=None, today: dt.date | None = None) -> dict:
    """The credit read that covers today, or SystemExit naming why nothing may spend."""
    try:
        record = load(path)
    except FileNotFoundError:
        raise SystemExit('ve: no credit read from Control Center: run ve budget pull with its get_engine_credits '
                         f'answer for {ENGINE}; nothing spends until then') from None
    except (OSError, ValueError) as error:
        raise SystemExit(f've: the saved credit read cannot be read: {error}') from None
    problems = verify(record)
    if problems:
        raise SystemExit('ve: the credit budget does not stand: ' + '; '.join(problems))
    pulled = dt.date.fromisoformat(record['pulled_on'])
    if ((today or _today()) - pulled).days > MAX_AGE_DAYS:
        raise SystemExit(f've: the credit read was pulled on {pulled}, more than {MAX_AGE_DAYS} days ago: pull it again')
    return record


def cap(record, provider) -> float:
    """The provider's cap, or SystemExit when Control Center has placed no pool for it on the publication."""
    value = record['caps'].get(provider)
    if value is None:
        raise SystemExit(f've: Control Center places no {POOLS[provider]} pool on the publication, so {provider} has no '
                         'cap and nothing is dispatched against it')
    return float(value)


def _today() -> dt.date:
    return dt.datetime.now(dt.timezone.utc).date()


def week_of(today: dt.date | None = None) -> str:
    today = today or _today()
    return (today - dt.timedelta(days=today.weekday())).isoformat()
