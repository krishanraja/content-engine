"""ve sprint: the weekly device sprint (Wave 3, W3.8; docs/ve/SPRINT.md).

Each week 1 to 2 Production Inspo references become new library devices: each is briefed through `ve brief` (one brief
per plate), Claude writes a Codex device card for it, Codex builds it from the card, and Krish's Gate 2 yes proves it
before any spec may use it. This module keeps the mechanics and the record; the judgment (the device's contract, the aim
it serves, the meaning it adds beyond the words) is Claude's, written into the card fields.

    ve sprint start <week> --ref <reference> [--ref <reference>]   brief each reference, write card-field skeletons
    ve sprint cards <week>                                       check the filled fields, write the cards, add the moves
    ve sprint gate2 <device> --words "<his exact words>" --where "<where he typed them>" --at YYYY-MM-DD
    ve sprint status                                             the device count and each Gate 2 yes
    ve sprint feed --archive <archive.json> --out <archive.fed.json>  add them to the Archive feed for week_board.py

Nothing here dispatches Codex, spends, publishes or approves: `ve dispatch` stays the one way a card goes to Codex, and a
Gate 2 yes is recorded only from words Krish typed (AGENTS.md: `manual` means his words; never write it for him).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

from .common import ROOT, card_worktree, load_json, write_json

SPRINTS = ROOT / 'docs' / 've' / 'sprints'
LEDGER = SPRINTS / 'ledger.json'
MOVES = ROOT / 'config' / 've' / 'moves.json'
DEVICES = ROOT / 'config' / 've' / 'devices.json'
AIMS = ('good motion', 'good animation', 'good visuals')
TODO = 'TODO'
MAX_REFS = 2


# ---------------------------------------------------------------- ve brief (W2.7), through a thin adapter
def has_ve_brief() -> bool:
    """True once `ve brief` is on this checkout (W2.7 builds it)."""
    return "add_parser('brief'" in (ROOT / 'scripts' / 've.py').read_text(encoding='utf-8')


def brief(reference: str, out: Path) -> dict:
    """One brief per plate, from `ve brief <reference> --out <file>` (W2.7's interface). Until that command is on main,
    an explicit pending brief is written: it names the reference and says the brief is still to come, and
    `ve sprint cards` refuses to card from it. This adapter is the one meeting point with W2.7."""
    if has_ve_brief():
        result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 've.py'), 'brief', reference, '--out', str(out)],
                                cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if result.returncode != 0:
            raise RuntimeError(f've brief {reference} failed ({result.returncode}): {(result.stdout + result.stderr).strip()[-400:]}')
        data = load_json(out)
        plates = data.get('plates') if isinstance(data, dict) else None
        if not isinstance(plates, list) or not plates:
            raise RuntimeError(f've brief {reference}: the brief names no plate (one brief per plate)')
        return data
    data = {'reference': reference, 'status': 'pending', 'plates': [],
            'note': 've brief is not on this checkout yet (W2.7); run ve sprint start again once it is'}
    write_json(out, data)
    return data


# ---------------------------------------------------------------- the record
def ledger() -> dict:
    return load_json(LEDGER) if LEDGER.exists() else {'devices': []}


def save_ledger(data: dict) -> None:
    data['devices'].sort(key=lambda d: (d.get('week', ''), d['device']))
    write_json(LEDGER, data)


def week_dir(week: str) -> Path:
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', week) or date.fromisoformat(week).weekday() != 0:
        sys.exit(f've sprint: week {week} is the Monday, YYYY-MM-DD')
    return SPRINTS / week


def skeleton(week: str, n: int, reference: str, brief_path: Path) -> dict:
    return {
        'path': str((week_dir(week) / f've-s-{week}-{n}.md').relative_to(ROOT)).replace('\\', '/'),
        'card_id': f've-s-{week}-{n}', 'kind': 'device', 'format': 'hand-held-screen',
        'reference': reference, 'brief': str(brief_path.relative_to(ROOT)).replace('\\', '/'),
        'device': TODO, 'aim': f'{TODO}: one of {", ".join(AIMS)}',
        'meaning': f'{TODO}: what this device makes land beyond the words',
        'move': {'id': TODO, 'name': TODO, 'verbs': [TODO], 'signatures': [TODO], 'example': TODO},
        'title': TODO, 'goal': TODO, 'contract': TODO, 'tests': [TODO],
        'write_allow': TODO, 'read': TODO, 'max_minutes': 45, 'max_calls': 45,
    }


def start(week: str, references: list[str]) -> list[Path]:
    if not 1 <= len(references) <= MAX_REFS:
        sys.exit(f've sprint: a week takes 1 to {MAX_REFS} Production Inspo references, not {len(references)}')
    folder = week_dir(week)
    folder.mkdir(parents=True, exist_ok=True)
    written = []
    for n, reference in enumerate(references, 1):
        fields = folder / f'card-{n}.fields.json'
        if fields.exists():
            sys.exit(f've sprint: {fields.relative_to(ROOT)} exists; a week is started once')
        brief_path = folder / f'brief-{n}.json'
        brief(reference, brief_path)
        write_json(fields, skeleton(week, n, reference, brief_path))
        written.append(fields)
    write_json(folder / 'sprint.json', {'week': week, 'references': references, 'started': date.today().isoformat(),
                                        've_brief': 'built' if has_ve_brief() else 'pending (W2.7)'})
    return written


def problems_of(fields: dict) -> list[str]:
    """What stops a filled skeleton from becoming a card: anything left TODO, an aim outside the three, no meaning, a
    move whose example its own signatures miss, a device id already registered, or a brief still pending."""
    out = []
    text = json.dumps(fields)
    if TODO in text:
        out.append('fields still say TODO')
    if fields.get('aim') not in AIMS:
        out.append(f'aim is one of {", ".join(AIMS)}')
    if len(str(fields.get('meaning', '')).split()) < 5:
        out.append('meaning says, in a sentence, what the device makes land beyond the words')
    device = str(fields.get('device', ''))
    if not re.fullmatch(r'[a-z][a-z0-9_]{2,40}', device):
        out.append('device is a lower_snake id')
    elif device in load_json(DEVICES)['devices']:
        out.append(f'device {device} is already in the library')
    move = fields.get('move') or {}
    try:
        if not any(re.search(s, str(move.get('example', '')), re.I) for s in move.get('signatures') or []):
            out.append("the move's example matches none of its signatures")
    except re.error as error:
        out.append(f'a move signature is not a regex: {error}')
    brief_path = ROOT / str(fields.get('brief', ''))
    if not brief_path.is_file() or load_json(brief_path).get('status') == 'pending':
        out.append('the brief is still pending: run ve brief first (W2.7)')
    return out


def cards(week: str) -> list[Path]:
    from .cards import write_card
    folder = week_dir(week)
    every = sorted(folder.glob('card-*.fields.json'))
    if not every:
        sys.exit(f've sprint: no card fields in {folder.relative_to(ROOT)}; run ve sprint start first')
    bad = {p.name: problems_of(load_json(p)) for p in every}
    bad = {k: v for k, v in bad.items() if v}
    if bad:
        sys.exit('ve sprint: not ready to card:\n' + '\n'.join(f'  {k}: {"; ".join(v)}' for k, v in bad.items()))
    moves = load_json(MOVES)
    record = ledger()
    written = []
    for path in every:
        f = load_json(path)
        contract = f['contract'] + '\n\n## Tests\n' + '\n'.join(f'- {t}' for t in f['tests'])
        acceptance = '\n'.join([f'npx vitest run apps/renderer/src/engine/devices/{f["device"]}',
                                'npx vitest run apps/renderer/src/engine/devices/verbs.test.ts',
                                f'python tests/ve_port_acceptance_test.py {f["device"]}',
                                'python scripts/ve/check_route.py'])
        goal = f'{f["goal"]}\n\nAim: {f["aim"]}. Meaning beyond the words: {f["meaning"]}. Reference: {f["reference"]}; brief: {f["brief"]}.'
        card = write_card(ROOT / f['path'], card_id=f['card_id'], kind='device', format=f['format'], title=f['title'],
                          goal=goal, contract=contract, acceptance=acceptance, write_allow=f['write_allow'], read=f['read'],
                          cwd=f.get('cwd') or card_worktree(f['card_id']), max_minutes=f['max_minutes'], max_calls=f['max_calls'])
        rel = str(card.relative_to(ROOT)).replace('\\', '/')
        if not any(m['device'] == f['device'] for m in moves['moves']):
            moves['moves'].append({**f['move'], 'device': f['device'], 'card': rel,
                                   'source': f'Production Inspo: {f["reference"]}'})
        record['devices'] = [d for d in record['devices'] if d['device'] != f['device']]
        record['devices'].append({'device': f['device'], 'week': week, 'card': rel, 'aim': f['aim'], 'meaning': f['meaning'],
                                  'reference': f['reference'], 'gate2': None})
        written.append(card)
    write_json(MOVES, moves)
    save_ledger(record)
    return written


def gate2(device: str, words: str, where: str, at: str) -> dict:
    """Record Krish's Gate 2 yes for a device: his exact typed words, where and when he typed them. Never his words
    paraphrased, and never for him."""
    words = words.strip()
    if len(words) < 2 or not where.strip():
        sys.exit('ve sprint gate2: give his exact words (--words) and where he typed them (--where)')
    try:
        date.fromisoformat(at)
    except ValueError:
        sys.exit('ve sprint gate2: --at is YYYY-MM-DD')
    record = ledger()
    entry = next((d for d in record['devices'] if d['device'] == device), None)
    if entry is None:
        sys.exit(f've sprint gate2: {device} is not a sprint device (ve sprint status lists them)')
    if device not in load_json(DEVICES)['devices']:
        sys.exit(f've sprint gate2: {device} is not built yet (not in config/ve/devices.json); Gate 2 proves a built device')
    entry['gate2'] = {'yes': True, 'words': words, 'where': where.strip(), 'at': at}
    save_ledger(record)
    return entry


def status() -> dict:
    """The device count and each Gate 2 yes, as the Archive shows them."""
    registered = load_json(DEVICES)['devices']
    entries = ledger()['devices']
    for e in entries:
        e['built'] = e['device'] in registered
    return {'count': len(registered), 'sprint_devices': len(entries),
            'proven': sum(1 for e in entries if e.get('gate2')), 'entries': entries}


def feed(archive_in: Path | None, out: Path) -> dict:
    """The Archive feed (GET /api/board/<Monday>/archive, board_feed.py archive) with the devices block added under
    `devices`. week_board.py reads `rows` from the same file through its existing --archive input and leaves other keys
    to the board's owner, so the rows are never touched here."""
    data = load_json(archive_in) if archive_in else {'rows': []}
    if not isinstance(data, dict) or not isinstance(data.get('rows'), list):
        sys.exit('ve sprint feed: --archive is {"rows": [...]} from GET /api/board/<Monday>/archive')
    data['devices'] = status()
    write_json(out, data)
    return data
