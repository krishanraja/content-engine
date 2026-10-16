#!/usr/bin/env python3
"""The failure register (config/failures.json): each failure Krish raised and
the machine that now stops it. Fails when a guarded failure's guard is gone,
so a guard cannot be removed quietly; lists the open ones, never as fixed.

    python3 scripts/check_failures.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check(register):
    broken, open_ = [], []
    for f in register['failures']:
        if f['status'] == 'open':
            open_.append(f)
            continue
        if not f.get('guards'):
            broken.append(f'{f["id"]}: marked guarded with no guard')
        for g in f.get('guards') or []:
            path = ROOT / g['file']
            if not path.exists():
                broken.append(f'{f["id"]}: {g["file"]} is gone')
            elif g['contains'] not in path.read_text(encoding='utf-8', errors='replace'):
                broken.append(f'{f["id"]}: {g["file"]} no longer holds "{g["contains"]}" ({g["how"]})')
    return broken, open_


def main():
    register = json.loads((ROOT / 'config' / 'failures.json').read_text(encoding='utf-8'))
    broken, open_ = check(register)
    guarded = len(register['failures']) - len(open_)
    print(f'failure register: {guarded} guarded, {len(open_)} open')
    for f in open_:
        print(f'  OPEN {f["id"]}: {f["what"]}')
    if broken:
        print('a guard is missing:\n  ' + '\n  '.join(broken))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
