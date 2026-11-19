#!/usr/bin/env python3
"""Red first: a video-production Ruling is linked to the failure or learning that will stop it coming back.

Krish, 2026-11-19: the same faults reached him piece after piece because a correction lived in a chat or a commit line and
no check enforced it. A commit body (or a closeout now-note) on this branch that carries `Ruling (Krish, YYYY-MM-DD): ...`
about video production must also name, on a line of its own, the register entry that records it:

    Failure: F58-some-id        (config/failures.json)      or      Learning: some-id        (config/learnings.json)

The id must exist there, and a failure marked guarded must name at least one guard. Narrow on purpose: a Ruling that does not
mention video production (the words in VIDEO below) is never asked for a link, and a body that genuinely needs none says so:

    Red-first: not needed, <the reason in a sentence>

    python3 scripts/check_ruling_linked.py             # the commits and now-notes since the merge base with origin/main
    python3 scripts/check_ruling_linked.py --self-test
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULING = re.compile(r'^\s*Ruling \(Krish, \d{4}-\d{2}-\d{2}\):\s*(.+)$', re.M)
VIDEO = re.compile(r'\b(videos?|cuts?|proofs?|render(?:s|ed|ing)?|captions?|subtitles?|thumbnails?|covers?|ve|motion|hook|title card|music|bed|loudness|qc|critic|plates?|shorts?|wordmark|logos?|footage|take|storyboard)\b', re.I)
LINK = re.compile(r'^\s*(Failure|Learning):\s*([A-Za-z0-9][A-Za-z0-9._-]+)\s*$', re.M)
ESCAPE = re.compile(r'^\s*Red-first: not needed,\s*(.{12,})$', re.M)


def ids() -> tuple[dict, dict]:
    f = json.loads((ROOT / 'config' / 'failures.json').read_text(encoding='utf-8'))['failures']
    l = json.loads((ROOT / 'config' / 'learnings.json').read_text(encoding='utf-8'))['learnings']
    return ({x['id']: x for x in (f if isinstance(f, list) else f.values())}, {x['id']: x for x in (l if isinstance(l, list) else l.values())})


def problems(body: str, where: str, failures: dict, learnings: dict) -> list[str]:
    rulings = [m.group(1) for m in RULING.finditer(body) if VIDEO.search(m.group(1))]
    if not rulings or ESCAPE.search(body):
        return []
    links = LINK.findall(body)
    if not links:
        return [f'{where}: a video-production Ruling ("{rulings[0][:70]}...") names no `Failure: <id>` or `Learning: <id>` line; '
                'record the correction in config/failures.json or config/learnings.json with its guard, or write `Red-first: not needed, <reason>`']
    out = []
    for kind, ident in links:
        entry = (failures if kind == 'Failure' else learnings).get(ident)
        if not entry:
            out.append(f'{where}: {kind}: {ident} is not in config/{"failures" if kind == "Failure" else "learnings"}.json')
        elif kind == 'Failure' and entry.get('status') == 'guarded' and not entry.get('guards'):
            out.append(f'{where}: Failure {ident} is marked guarded but names no guard')
    return out


def branch_bodies() -> list[tuple[str, str]]:
    ref = os.environ.get('VERIFY_BASE') or 'origin/main'
    try:
        base = subprocess.run(['git', 'merge-base', 'HEAD', ref], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        log = subprocess.run(['git', 'log', '--format=%H%x00%B%x01', f'{base}..HEAD'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        changed = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=AM', f'{base}...HEAD', '--', 'now-notes'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    except (OSError, subprocess.CalledProcessError):
        return []
    out = [(f'commit {c.split(chr(0))[0][:8]}', c.split('\x00', 1)[1]) for c in log.split('\x01') if '\x00' in c]
    out += [(path, (ROOT / path).read_text(encoding='utf-8')) for path in changed if (ROOT / path).is_file()]
    return out


def self_test() -> int:
    failures, learnings = {'F9-x': {'id': 'F9-x', 'status': 'guarded', 'guards': [{'file': 'a'}]}, 'F8-y': {'id': 'F8-y', 'status': 'guarded', 'guards': []}}, {'l-1': {'id': 'l-1'}}
    r = 'Ruling (Krish, 2026-11-19): captions never sit over his face'
    checks = [
        (problems(r, 'c', failures, learnings), True),                                   # video ruling, no link: refused
        (problems(r + '\nFailure: F9-x', 'c', failures, learnings), False),               # linked: ok
        (problems(r + '\nFailure: F404-none', 'c', failures, learnings), True),           # unknown id: refused
        (problems(r + '\nFailure: F8-y', 'c', failures, learnings), True),                # guarded with no guard: refused
        (problems(r + '\nLearning: l-1', 'c', failures, learnings), False),
        (problems(r + '\nRed-first: not needed, a wording fix with no behaviour', 'c', failures, learnings), False),
        (problems('Ruling (Krish, 2026-11-19): invoices go to the accountant', 'c', failures, learnings), False),  # not video: never asked
    ]
    bad = [i for i, (got, want) in enumerate(checks) if bool(got) != want]
    print('check_ruling_linked self-test:', 'ok' if not bad else f'FAILED cases {bad}')
    return 1 if bad else 0


def main() -> int:
    if '--self-test' in sys.argv:
        return self_test()
    failures, learnings = ids()
    out = [p for where, body in branch_bodies() for p in problems(body, where, failures, learnings)]
    for line in out:
        print(line)
    print('check_ruling_linked:', 'every video Ruling is linked' if not out else f'{len(out)} problem(s)')
    return 1 if out else 0


if __name__ == '__main__':
    raise SystemExit(main())
