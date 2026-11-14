"""The ideas gate for a week, read-only (docs/PUBLISH_BOARDS.md, "The ideas gate").

Krish, 2026-11-11: "I shouldn't end up seeing random ideas in the publish board that I never wanted there and that I
didn't approve to move to the publish board." Only his Approve on the ideas board puts an idea on a publish board; the
database refuses any other placement. A session proposes ideas and never places one: before it says a piece is on its
day, it reads this.

    python3 scripts/post-pack/board_gate.py 2026-11-16          every piece and its approval, every held line
    python3 scripts/post-pack/board_gate.py 2026-11-16 --json   the same, as the route answers it

It reads GET /api/board/<Monday>/gate on the engine key (scripts/engine.py) and prints, per day, each piece on the board
with "Approved by you, <when>", and each held piece or option with why. It exits 1 when anything is held, so a session
or a workflow can stop on it, and 2 when the gate cannot be read.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import engine  # noqa: E402  the one engine key and caller


def lines(answer: dict) -> tuple[list[str], int]:
    """What to print for one week's gate, and how many things are held."""
    out: list[str] = []
    held = 0
    if answer.get('approvals_read') is not True:
        out.append('His approvals could not be read, so every piece below is held.')
    for d in answer.get('days') or []:
        pieces, holds = d.get('pieces') or [], d.get('held') or []
        if not pieces and not holds:
            continue
        out.append(f"{d.get('day')} {d.get('date')}:")
        for p in pieces:
            label = (p.get('approval') or {}).get('label') or 'approved'
            out.append(f"  on the board: {p.get('title')} ({p.get('id')}). {label}")
        for h in holds:
            held += 1
            what = h.get('piece_id') or h.get('option') or ''
            out.append(f"  {h.get('title')}: {h.get('text')} ({what})")
    if not out:
        out.append('Nothing is on the publish board for this week yet, and nothing is held.')
    return out, held


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith('--')]
    if not args or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args[0]):
        print('usage: python3 scripts/post-pack/board_gate.py <Monday> [--json]', file=sys.stderr)
        return 2
    try:
        status, text = engine.call('GET', f'/api/board/{args[0]}/gate', token=engine.operator_key(), timeout=120)
        answer = json.loads(text)
    except Exception as error:  # noqa: BLE001  an unreadable gate is said, never read as clear
        print(f'board gate: could not read the gate for {args[0]}: {error}', file=sys.stderr)
        return 2
    if status != 200 or not answer.get('ok'):
        print(f'board gate: the engine answered {status}: {answer.get("error") or text[:200]}', file=sys.stderr)
        return 2
    if '--json' in argv:
        print(json.dumps(answer, indent=1))
        return 1 if any(d.get('held') for d in answer.get('days') or []) else 0
    out, held = lines(answer)
    print('\n'.join(out))
    return 1 if held else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
