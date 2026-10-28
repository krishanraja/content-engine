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
