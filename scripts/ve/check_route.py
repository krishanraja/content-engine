#!/usr/bin/env python3
"""check:ve-route: the CI route check at parity (Wave 3, W3.1).

ve's rule is one signed spec and no per-piece compositions or render scripts (docs/ve/ENGINE.md). Until ve has a
library device for a move, quick-edit's per-piece code for that move is still the fallback, so this check bans
per-piece code ONLY for moves that already have a device:

- config/ve/moves.json lists each move, the device that replaces it, and regex signatures that recognise code drawing
  it;
- the device registry config/ve/devices.json says which devices exist (a Codex device card registers its device
  there when it lands, so the ban switches on by itself with the device);
- per-piece code is any code file under moves.json `per_piece` (docs/plans/**, apps/renderer/src/pieces/**, the
  quick-edit per-piece render scripts);
- config/ve/route-baseline.json holds the per-piece files that existed when the check began, by content hash. They are
  history and pass while unchanged; an edited one is checked like a new one.

A per-piece file that matches a move whose device is registered fails, naming the move, the device and the card.

    python3 scripts/ve/check_route.py                 # the check (npm run check:ve-route, in npm run verify)
    python3 scripts/ve/check_route.py --init-baseline # write the baseline once, only when there is none
"""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEVICES = Path('config/ve/devices.json')
MOVES = Path('config/ve/moves.json')
BASELINE = Path('config/ve/route-baseline.json')


def load(root: Path, rel: Path) -> dict:
    return json.loads((root / rel).read_text(encoding='utf-8'))


def registered(root: Path) -> set[str]:
    return set((load(root, DEVICES).get('devices') or {}).keys())


def files_of(root: Path) -> list[str]:
    result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root,
                            capture_output=True)
    if result.returncode == 0 and result.stdout:
        return [name for name in result.stdout.decode('utf-8', 'replace').split('\0') if name]
    return [p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and '.git' not in p.parts]


def per_piece(rel: str, moves: dict) -> bool:
    rel = rel.replace('\\', '/')
    return (Path(rel).suffix.lower() in set(moves.get('code_suffixes', []))
            and any(fnmatch.fnmatch(rel, pattern) for pattern in moves.get('per_piece', [])))


def sha(path: Path) -> str:
    """The content hash with line endings folded, so a Windows checkout (CRLF) matches the baseline."""
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def check(root: Path = ROOT, files: list[str] | None = None) -> list[str]:
    """Every per-piece file drawing a move that has a device, as 'file: move -> device (card)'."""
    moves = load(root, MOVES)
    devices = registered(root)
    baseline = load(root, BASELINE).get('files', {}) if (root / BASELINE).exists() else {}
    banned = [(m, [re.compile(s, re.I) for s in m['signatures']]) for m in moves['moves'] if m['device'] in devices]
    findings: list[str] = []
    for rel in sorted(files if files is not None else files_of(root)):
        if not per_piece(rel, moves) or not (root / rel).is_file():
            continue
        if baseline.get(rel) == sha(root / rel):
            continue
        text = (root / rel).read_text(encoding='utf-8', errors='replace')
        for move, patterns in banned:
            if any(p.search(text) for p in patterns):
                findings.append(f"{rel}: per-piece code for the move '{move['id']}', which the library device "
                                f"'{move['device']}' draws; put it in the spec instead ({move.get('card', 'its device card')})")
    return findings


def init_baseline(root: Path = ROOT) -> Path:
    path = root / BASELINE
    if path.exists():
        sys.exit(f'{BASELINE} exists; the baseline is history and is never rewritten')
    moves = load(root, MOVES)
    files = {rel: sha(root / rel) for rel in sorted(files_of(root)) if per_piece(rel, moves) and (root / rel).is_file()}
    path.write_text(json.dumps({'_note': 'Per-piece code that existed when the ve route check began (W3.1), by sha256. '
                                         'History: it passes while unchanged. Never rewritten (scripts/ve/check_route.py).',
                                'files': files}, indent=2) + '\n', encoding='utf-8')
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--init-baseline', action='store_true')
    args = parser.parse_args()
    if args.init_baseline:
        print(f'check:ve-route: wrote {init_baseline()}')
        return 0
    findings = check()
    moves = load(ROOT, MOVES)['moves']
    live = [m['id'] for m in moves if m['device'] in registered(ROOT)]
    if findings:
        print('check:ve-route: per-piece code for a move that has a library device (docs/ve/ENGINE.md, no per-piece '
              'compositions or render scripts):')
        for finding in findings:
            print('  ' + finding)
        return 1
    print(f'check:ve-route: no per-piece code for a move with a device ({len(live)} of {len(moves)} moves have one: '
          f'{", ".join(live) or "none"})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
