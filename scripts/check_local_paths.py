#!/usr/bin/env python3
"""check:local-paths: code reads the home computers' layout from config, never a typed path (Wave 2, W2.11).

The one local layout lives in config/studio.json `local_roots` (repos, worktrees, runtime, toolchain, and the
environment override for each). Code that needs one of those folders reads it there: scripts/velib/common.py
`local_root()` in Python, `python scripts/velib/common.py local-root <kind> --shell` in Bash. This check fails CI on a
hard-coded path into his dev folder (drive C, Users, krish, dev) in any tracked or new code file, in any spelling
(forward or back slashes, escaped backslashes in JSON or a string, Git Bash's /c/ drive form), so the layout can move
with one edit to the config.

Allowed, because they describe the layout or are history rather than code that should read it:
- Markdown anywhere (AGENTS.md, the docs and the skills describe the layout in words);
- `config/studio.json`, the layout's one home;
- `docs/**` (plan records, receipts and the reference tools kept with them are history);
- `vendor/**` (pinned copies of other repositories' code).

    python3 scripts/check_local_paths.py          # the check (npm run check:local-paths, in npm run verify)
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# His dev folder with forward slashes, single or escaped backslashes, or the /c/ drive form, in any case.
PATTERN = re.compile(r'(?:\b[cC]:|(?<![\w.])/c)(?:/|\\{1,2})users(?:/|\\{1,2})krish(?:/|\\{1,2})dev(?![\w])', re.I)
CODE_SUFFIXES = {'.py', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.sh', '.bash', '.ps1', '.psm1',
                 '.cmd', '.bat', '.yml', '.yaml', '.json', '.jsonc', '.toml', '.ini', '.cfg', '.html', '.css', '.sql'}
ALLOW_FILES = {'config/studio.json'}
ALLOW_PREFIXES = ('docs/', 'vendor/', 'node_modules/')


def in_scope(rel: str) -> bool:
    rel = rel.replace('\\', '/')
    if rel in ALLOW_FILES or rel.startswith(ALLOW_PREFIXES) or '/node_modules/' in rel:
        return False
    return Path(rel).suffix.lower() in CODE_SUFFIXES


def tracked(root: Path) -> list[str]:
    result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root, capture_output=True)
    if result.returncode == 0:
        return [name for name in result.stdout.decode('utf-8', 'replace').split('\0') if name]
    return [str(p.relative_to(root)).replace('\\', '/') for p in root.rglob('*') if p.is_file() and '.git' not in p.parts]


def scan(root: Path, files: list[str] | None = None) -> list[str]:
    """Every hard-coded local path in code under root, as 'file:line: text'."""
    findings: list[str] = []
    for rel in files if files is not None else tracked(root):
        if not in_scope(rel):
            continue
        path = root / rel
        try:
            text = path.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
        for number, line in enumerate(text.splitlines(), 1):
            if PATTERN.search(line):
                findings.append(f'{rel}:{number}: {line.strip()[:160]}')
    return findings


def main() -> int:
    findings = scan(ROOT)
    if findings:
        print('check:local-paths: hard-coded home-computer paths in code. Read the folder from config/studio.json '
              'local_roots instead (scripts/velib/common.py local_root(), or `python scripts/velib/common.py local-root '
              '<kind> --shell` in Bash):')
        for finding in findings:
            print('  ' + finding)
        return 1
    print('check:local-paths: no hard-coded home-computer paths in code; the layout is config/studio.json local_roots')
    return 0


if __name__ == '__main__':
    sys.exit(main())
