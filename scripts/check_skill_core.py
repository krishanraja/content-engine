#!/usr/bin/env python3
"""A skill's core still names every house rule its references carry.

Cost guard (docs/COST_GUARDS.md, "Skills split"): make-piece and produce-video keep their steps and gates in
SKILL.md and move long reference sections to references/*.md, so a production session starts lean and reads a
reference only at the step that names it. The risk is a gate that silently leaves the core with its section.
So this refuses:

- a house rule ID (the `id:` values in apps/control-plane/api/_houseRules.ts) named in a skill's references
  but not in its SKILL.md;
- a reference file the core does not name by its repository path (a reference nobody is told to read);
- with --against REV: a house rule ID named in that revision's SKILL.md and no longer named in the core.

    python3 scripts/check_skill_core.py                  # make-piece and produce-video
    python3 scripts/check_skill_core.py --against REV    # and nothing named at REV has left the core
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / '.agents' / 'skills'
# The skills split into a core plus references (their .claude/skills copies hold SKILL.md only, so each
# reference is named by its repository path).
SPLIT = ('make-piece', 'produce-video')
RULES = ROOT / 'apps' / 'control-plane' / 'api' / '_houseRules.ts'


def rule_ids() -> list[str]:
    return sorted(set(re.findall(r"^\s+id: '([A-Z0-9_]+)'", RULES.read_text(encoding='utf-8'), re.M)), key=len, reverse=True)


def named(text: str, ids: list[str]) -> set[str]:
    return {i for i in ids if re.search(rf'(?<![A-Za-z0-9_]){re.escape(i)}(?![A-Za-z0-9_])', text)}


def problems(against: str | None = None) -> list[str]:
    ids = rule_ids()
    out: list[str] = []
    for skill in (SKILLS / name for name in SPLIT):
        core_text = (skill / 'SKILL.md').read_text(encoding='utf-8')
        core = named(core_text, ids)
        refs = sorted((skill / 'references').glob('*.md')) if (skill / 'references').is_dir() else []
        for ref in refs:
            rel = ref.relative_to(ROOT).as_posix()
            if rel not in core_text:
                out.append(f'{skill.name}: SKILL.md never names {rel}, so no step tells a session to read it')
            missing = named(ref.read_text(encoding='utf-8'), ids) - core
            if missing:
                out.append(f'{skill.name}: {rel} carries house rule {", ".join(sorted(missing))}, which SKILL.md no longer names')
        if against:
            path = (skill / 'SKILL.md').relative_to(ROOT).as_posix()
            old = subprocess.run(['git', 'show', f'{against}:{path}'], cwd=ROOT, capture_output=True, text=True)
            if old.returncode == 0:
                gone = named(old.stdout, ids) - core
                if gone:
                    out.append(f'{skill.name}: house rule {", ".join(sorted(gone))} was named in SKILL.md at {against} and is not now')
    return out


def main() -> int:
    args = sys.argv[1:]
    against = args[1] if len(args) == 2 and args[0] == '--against' else None
    if args and not against:
        print(__doc__)
        return 2
    found = problems(against)
    for p in found:
        print(p, file=sys.stderr)
    if found:
        return 1
    print('skill cores: every house rule a reference carries is named in its SKILL.md' + (f', and nothing named at {against} has left' if against else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
