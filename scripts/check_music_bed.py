#!/usr/bin/env python3
"""check:music-bed: nothing keys the music to the voice (config/music-bed.json, npm run verify).

Krish, 2026-11-04: "Even in today's publish, the volume of the backing music goes up and down about 30 or 40 times in
90 seconds." The cause was a per-day compositor (docs/plans/2026-11-04-wednesday/rebuild/compose.py) that ran voice-keyed
sidechain compression on the bed. The one bed shape lives in config/music-bed.json and scripts/bed_shape.py; this check
fails on any code under scripts/, apps/, packages/ or docs/plans/ that names one of the forbidden filters
(forbidden_filters: voice-keyed ducking, companders, gates and level chasers), wherever it appears in the file.

A per-day compositor under docs/plans that already holds one is retired history: it passes only while its first lines
carry the retired marker and stop it before it runs anything (raise SystemExit). Nothing is allow-listed by path.

    python3 scripts/check_music_bed.py            the check
    python3 scripts/check_music_bed.py --text T   check one piece of text (an ffmpeg graph), as a code line would be
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = Path('config/music-bed.json')
HEAD_LINES = 12


def rules(root: Path = ROOT) -> dict:
    return json.loads((root / CONFIG).read_text(encoding='utf-8'))


def pattern(config: dict) -> re.Pattern:
    names = sorted(config['forbidden_filters'], key=len, reverse=True)
    return re.compile(r'(?<![A-Za-z0-9_])(' + '|'.join(map(re.escape, names)) + r')(?![A-Za-z0-9_])')


def found(text: str, config: dict) -> list[tuple[int, str]]:
    """[(line number, filter name)] for every forbidden filter named in the text."""
    rx = pattern(config)
    return [(n, m.group(1)) for n, line in enumerate(text.splitlines(), 1) for m in rx.finditer(line)]


def retired(text: str, config: dict) -> bool:
    """The retired marker, and a SystemExit that stops the file, in its first lines."""
    marker = config['forbidden_scope']['retired_marker']
    head = text.splitlines()[:HEAD_LINES]
    return any(marker in line for line in head) and any(
        line.startswith('raise SystemExit(') and marker in '\n'.join(head) for line in head)


def files_of(root: Path) -> list[str]:
    result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root,
                            capture_output=True)
    if result.returncode == 0 and result.stdout:
        return [name for name in result.stdout.decode('utf-8', 'replace').split('\0') if name]
    return [p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and '.git' not in p.parts]


def problems(root: Path = ROOT) -> list[str]:
    config = rules(root)
    scope = config['forbidden_scope']
    suffixes = set(scope['code_suffixes'])
    out = []
    for rel in files_of(root):
        rel = rel.replace('\\', '/')
        if Path(rel).suffix.lower() not in suffixes or 'node_modules/' in rel:
            continue
        if not any(rel == r or rel.startswith(r + '/') for r in scope['roots']):
            continue
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8', errors='replace')
        hits = found(text, config)
        if not hits:
            continue
        if rel.startswith('docs/plans/') and retired(text, config):
            continue
        where = ', '.join(f'line {n} ({name})' for n, name in hits[:5])
        out.append(f'{rel}: {where}: music is never keyed to the voice or level-chased; the bed is the one shape '
                   f'(config/music-bed.json, scripts/bed_shape.py)'
                   + ('. A retired per-day compositor starts with the retired marker and a raise SystemExit'
                      if rel.startswith('docs/plans/') else ''))
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--text')
    args = parser.parse_args(argv)
    if args.text is not None:
        hits = found(args.text, rules())
        for n, name in hits:
            print(f'refused: {name} (line {n}) keys or chases the music level')
        return 1 if hits else 0
    bad = problems()
    if bad:
        print('check:music-bed FAILED')
        print('\n'.join(f'  {line}' for line in bad))
        return 1
    print('check:music-bed: no code keys the music to the voice; retired compositors stop before they run')
    return 0


if __name__ == '__main__':
    sys.exit(main())
