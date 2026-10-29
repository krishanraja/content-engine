"""Append-only piece usage and a separate, single running engine clock."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from numbers import Real

from .common import CONFIG, load_json, piece_dir

KINDS = ('claude_tokens', 'codex_tokens', 'allowance_points', 'credits',
         'engine_seconds', 'krish_wait_seconds')
MEASURES = (
    ('claude_tokens', 'claude tokens', 'claude_tokens_cap'),
    ('codex_tokens', 'codex tokens', 'codex_tokens_cap'),
    ('total_tokens', 'total tokens', 'total_tokens_cap'),
    ('engine_minutes', 'engine minutes', 'engine_minutes_cap'),
    ('allowance_points', 'allowance points', 'allowance_points_cap'),
)


def _now():
    return datetime.now(timezone.utc)


def _validate(kind, amount):
    if kind not in KINDS:
        raise ValueError(f'unknown ledger kind {kind!r}; expected one of {", ".join(KINDS)}')
    if isinstance(amount, bool) or not isinstance(amount, Real) or not math.isfinite(amount) or amount < 0:
        raise ValueError('ledger amount must be a finite non-negative number')


def add(piece, kind, amount, note=""):
    _validate(kind, amount)
    if not isinstance(note, str):
        raise ValueError('ledger note must be text')
    path = piece_dir(piece) / 've' / 'ledger.jsonl'
    row = {'ts': _now().isoformat(), 'kind': kind, 'amount': amount, 'note': note}
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8', newline='\n') as handle:
        handle.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + '\n')


def totals(piece) -> dict:
    result = dict.fromkeys(KINDS, 0)
    path = piece_dir(piece) / 've' / 'ledger.jsonl'
    if path.exists():
        with path.open(encoding='utf-8') as handle:
            for line in handle:
                row = json.loads(line)
                _validate(row['kind'], row['amount'])
                result[row['kind']] += row['amount']
    result['total_tokens'] = result['claude_tokens'] + result['codex_tokens']
    return result


def budget():
    return load_json(CONFIG / 'budget.json')


def measures(usage):
    return {**usage, 'engine_minutes': usage['engine_seconds'] / 60}


def _check(usage, limits):
    lines = []
    ok = True
    for key, label, cap_key in MEASURES:
        amount, cap = measures(usage)[key], limits[cap_key]
        state = 'OVER' if amount > cap else 'WARN' if amount >= limits['warn_fraction'] * cap else 'OK'
        ok = ok and state != 'OVER'
        lines.append(f'{state} {label}: {amount:g} / {cap:g}')
    return ok, lines


def check(piece) -> tuple[bool, list[str]]:
    return _check(totals(piece), budget())


def require_within(piece):
    ok, lines = check(piece)
    if not ok:
        raise SystemExit('\n'.join(line for line in lines if line.startswith('OVER')))


def clock_status(piece):
    path = piece_dir(piece) / 've' / 'clock.json'
    return load_json(path) if path.exists() else None


def start_clock(piece, phase):
    if not isinstance(phase, str) or not phase.strip():
        raise ValueError('clock phase must be non-empty text')
    running = clock_status(piece)
    if running:
        raise ValueError(f'clock already running for phase {running["phase"]!r}')
    used, cap = totals(piece)['engine_seconds'] / 60, budget()['engine_minutes_cap']
    if used > cap:
        raise ValueError(f'OVER engine minutes: {used:g} / {cap:g}; cannot start phase {phase!r}')
    path = piece_dir(piece) / 've' / 'clock.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also prevents two starts from silently replacing a clock.
    try:
        with path.open('x', encoding='utf-8') as handle:
            json.dump({'phase': phase, 'started': _now().isoformat()}, handle)
            handle.write('\n')
    except FileExistsError:
        running = clock_status(piece)
        raise ValueError(f'clock already running for phase {running["phase"]!r}') from None


def elapsed_seconds(clock):
    started = datetime.fromisoformat(clock['started'])
    if started.tzinfo is None:
        raise ValueError(f'clock for phase {clock["phase"]!r} has no UTC offset')
    return max(0, (_now() - started).total_seconds())


def stop_clock(piece):
    running = clock_status(piece)
    if running is None:
        raise ValueError('cannot stop clock: no running phase')
    seconds = round(elapsed_seconds(running))
    add(piece, 'engine_seconds', seconds, note=running['phase'])
    (piece_dir(piece) / 've' / 'clock.json').unlink()
    return seconds


# ---- the weekly credit budget -----------------------------------------------------------------------------------
# Every dispatch and generation reserves against the budget Krish signed (velib/credits.py) before it runs, and is
# refused when the week's reservations and settled use would pass his cap. One file a week, append-only, on this
# machine (VE_CREDIT_LEDGER names a folder both computers share, when there is one). A reservation is settled with
# what the provider actually charged, so `ve budget status` can be read against the providers' own transactions.

def credit_ledger_path(week):
    import os
    from pathlib import Path
    from .common import WORK
    root = os.environ.get('VE_CREDIT_LEDGER')
    return (Path(root) if root else WORK / 'credits') / f'{week}.jsonl'


def _credit_rows(week):
    path = credit_ledger_path(week)
    if not path.exists():
        return []
    with path.open(encoding='utf-8') as handle:
        return [json.loads(line) for line in handle if line.strip()]


def weekly(week, record=None):
    """{provider: {cap, open, settled, used}} for the week: used is settled use plus open reservations."""
    from .credits import PROVIDERS
    rows = _credit_rows(week)
    settled = {r['id']: r['amount'] for r in rows if r['kind'] == 'settle'}
    out = {p: {'cap': (record or {}).get('caps', {}).get(p), 'open': 0, 'settled': 0, 'used': 0} for p in PROVIDERS}
    for r in rows:
        if r['kind'] != 'reserve':
            continue
        entry = out[r['provider']]
        if r['id'] in settled:
            entry['settled'] += settled[r['id']]
        else:
            entry['open'] += r['amount']
    for entry in out.values():
        entry['used'] = entry['settled'] + entry['open']
    return out


def reserve(provider, amount, piece='', note='', today=None, budget_path=None):
    """Reserve credits against the signed weekly budget, or SystemExit naming the cap it would pass. Returns its id."""
    import uuid
    from .credits import PROVIDERS, standing, week_of
    if provider not in PROVIDERS:
        raise ValueError(f'unknown provider {provider!r}; expected one of {", ".join(PROVIDERS)}')
    _validate('credits', amount)
    record = standing(budget_path, today)
    week = week_of(today)
    entry = weekly(week, record)[provider]
    if entry['used'] + amount > record['caps'][provider]:
        raise SystemExit(f've: over the signed weekly credit budget: {provider} {entry["used"]:g} used or reserved + {amount:g} '
                         f'> {record["caps"][provider]:g} for the week of {week}; nothing was dispatched')
    rid = uuid.uuid4().hex[:12]
    path = credit_ledger_path(week)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8', newline='\n') as handle:
        handle.write(json.dumps({'id': rid, 'ts': _now().isoformat(), 'kind': 'reserve', 'provider': provider,
                                 'amount': amount, 'piece': str(piece), 'note': str(note)}) + '\n')
    return rid


def settle(rid, actual, today=None):
    """Record what a reservation really cost (0 for a dispatch that never ran)."""
    from .credits import week_of
    _validate('credits', actual)
    week = week_of(today)
    if not any(r['kind'] == 'reserve' and r['id'] == rid for r in _credit_rows(week)):
        raise ValueError(f'no reservation {rid} in the week of {week}')
    with credit_ledger_path(week).open('a', encoding='utf-8', newline='\n') as handle:
        handle.write(json.dumps({'id': rid, 'ts': _now().isoformat(), 'kind': 'settle', 'amount': actual}) + '\n')
