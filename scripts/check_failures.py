#!/usr/bin/env python3
"""The failure register (config/failures.json): each failure Krish raised and
the machine that now stops it. Fails when a guarded failure's guard is gone,
so a guard cannot be removed quietly; lists the open ones, never as fixed.

And the learnings register (config/learnings.json), "say nothing twice": all
else he says, why he said it, what it means from now on and where it is now
enforced. The same check: a place it is enforced must still hold its marker.

    python3 scripts/check_failures.py          # every guard still in place
    python3 scripts/check_failures.py --run    # and run each guard's behavioural test (CI)

A marker in a file proves the guard is still there, never that it works (failure report, 2026-10-24: "Marker present"
must never be reported as "failure prevented"). A guard that names a `test` is proved by running it: the command must
refuse the failure's bad case and pass the good one. Guards with no test are counted as configuration coverage.
"""
import subprocess
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
        if f['status'] == 'declined':
            # Krish chose not to guard it; his words are on the entry, and it is never reported as fixed.
            if (f.get('decided') or {}).get('by') != 'Krish' or not (f.get('decided') or {}).get('said'):
                broken.append(f'{f["id"]}: declined without Krish\'s words in decided')
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


def check_learnings(register):
    broken, open_ = [], []
    for item in register['learnings']:
        for field in ('id', 'on', 'krish', 'why', 'means', 'status'):
            if not str(item.get(field) or '').strip():
                broken.append(f'learning {item.get("id", "?")}: no {field}')
        if item['status'] == 'open':
            open_.append(item)
        elif not item.get('encoded'):
            broken.append(f'learning {item["id"]}: marked encoded with nowhere it is enforced')
        for g in item.get('encoded') or []:
            path = ROOT / g['file']
            if not path.exists():
                broken.append(f'learning {item["id"]}: {g["file"]} is gone')
            elif g['contains'] not in path.read_text(encoding='utf-8', errors='replace'):
                broken.append(f'learning {item["id"]}: {g["file"]} no longer holds "{g["contains"]}" ({g["how"]})')
    return broken, open_


def behaviour(register, run=False):
    """(proved by a test, marker only, failed tests). With run, each distinct test command is run once."""
    proved, marker_only, failed, ran = [], [], [], {}
    for f in register['failures']:
        if f['status'] in ('open', 'declined'):
            continue
        tests = [g['test'] for g in f.get('guards') or [] if g.get('test')]
        if not tests:
            marker_only.append(f['id'])
            continue
        proved.append(f['id'])
        if run:
            for cmd in tests:
                if cmd not in ran:
                    r = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, timeout=900)
                    ran[cmd] = r.returncode == 0
                if not ran[cmd]:
                    failed.append(f'{f["id"]}: its test failed: {cmd}')
    return proved, marker_only, failed


def main():
    run = '--run' in sys.argv[1:]
    register = json.loads((ROOT / 'config' / 'failures.json').read_text(encoding='utf-8'))
    broken, open_ = check(register)
    declined = [f for f in register['failures'] if f['status'] == 'declined']
    guarded = len(register['failures']) - len(open_) - len(declined)
    proved, marker_only, failed = behaviour(register, run)
    broken += failed
    print(f'failure register: {guarded} guarded ({len(proved)} with a behavioural test{", run" if run else ""}; '
          f'{len(marker_only)} marker only, configuration coverage, not proof), {len(open_)} open, {len(declined)} declined by Krish')
    for f in open_:
        print(f'  OPEN {f["id"]}: {f["what"]}')
    learnings = json.loads((ROOT / 'config' / 'learnings.json').read_text(encoding='utf-8'))
    lb, lo = check_learnings(learnings)
    broken += lb
    print(f'learnings register (say nothing twice): {len(learnings["learnings"]) - len(lo)} encoded, {len(lo)} open')
    for item in lo:
        print(f'  OPEN {item["id"]}: {item["means"]}')
    if broken:
        print('a guard is missing:\n  ' + '\n  '.join(broken))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
