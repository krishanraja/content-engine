"""The live Publish Board's link (Ruling, Krish, 2026-11-11: Control Centre's Publish Board is where everything wires
in, live). The engine's old board pages are retired for good and their addresses redirect to it (Ruling, Krish,
2026-11-13).

One constant, config/boards.json `live_board.url`; apps/control-plane/api/board/_liveBoard.ts holds the same text.
Every link a session, a run or a message gives Krish to the week's board is this:

    python3 scripts/post-pack/live_board.py 2026-11-16          the week
    python3 scripts/post-pack/live_board.py 2026-11-16 wed      the week at a day
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat')


def base():
    return json.loads((ROOT / 'config' / 'boards.json').read_text(encoding='utf-8'))['live_board']['url']


def live_board_url(week=None, day=None):
    """The live board at a week (a Monday, YYYY-MM-DD) and, when given, a day (mon to sat, or its full name)."""
    q = []
    if week and re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(week)):
        q.append(f'week={week}')
    d = str(day or '').lower()[:3]
    if d in DAYS:
        q.append(f'day={d}')
    return base() + ('?' + '&'.join(q) if q else '')


if __name__ == '__main__':
    args = sys.argv[1:]
    print(live_board_url(args[0] if args else None, args[1] if len(args) > 1 else None))
