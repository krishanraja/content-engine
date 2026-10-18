#!/usr/bin/env python3
"""G11, the lean start (docs/COST_GUARDS.md): WORKBENCH.md is the live state, read first by every session in
every tool, so it stays small. Fails when it passes 64 KB or when "Latest handoff" holds more than its newest
entry (older ones go to docs/history/2026-10-18-WORKBENCH-handoffs.md). Krish, 2026-10-18: "They should all
become standing rules." Run by `npm run verify`."""
import re
import sys
from pathlib import Path

LIMIT = 64_000
ROOT = Path(__file__).resolve().parents[1]


def problems(text):
    out = []
    size = len(text.encode('utf-8'))
    if size > LIMIT:
        out.append(f'WORKBENCH.md is {size:,} bytes, over {LIMIT:,}: move finished work to docs/history/ (G11).')
    m = re.search(r'^## Latest handoff\n(.*?)(?=^## )', text, re.S | re.M)
    if m:
        entries = re.findall(r'^- 20\d\d-', m.group(1), re.M)
        if len(entries) > 1:
            out.append(f'"Latest handoff" holds {len(entries)} entries: keep the newest, move the rest to '
                       'docs/history/2026-10-18-WORKBENCH-handoffs.md (G11).')
    return out


def main():
    why = problems((ROOT / 'WORKBENCH.md').read_text(encoding='utf-8'))
    for w in why:
        print(w)
    if not why:
        print('workbench: lean')
    return 1 if why else 0


if __name__ == '__main__':
    sys.exit(main())
