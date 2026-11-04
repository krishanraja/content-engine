#!/usr/bin/env python3
"""The failure register (config/failures.json): each failure Krish raised and
the machine that now stops it. Fails when a guarded failure's guard is gone,
so a guard cannot be removed quietly; lists the open ones, never as fixed.

And the learnings register (config/learnings.json), "say nothing twice": all
else he says, why he said it, what it means from now on and where it is now
enforced. The same check: a place it is enforced must still hold its marker.

    python3 scripts/check_failures.py          # every guard still in place
    python3 scripts/check_failures.py --run    # and run each guard's behavioural test (CI)
    python3 scripts/check_failures.py --piece <plan folder or uuid>   # and record the read (preflight.py)

The failure loop (Krish, 2026-11-04): with --piece (or PREFLIGHT_PIECE) the read is recorded as the piece's
preflight receipt (scripts/preflight.py), and with --run a guard test that fails files one engine_incidents row
(kind guard_fired; scripts/incidents.py). An entry may carry the loop's fields: mode (its failure mode key),
recurrences (each time it came back after its guard), causes (why, traced) and guard_level (prose, checklist,
lint_warn, lint_refuse, gate); scripts/learning/ writes them and this checks their shape.

A marker in a file proves the guard is still there, never that it works (failure report, 2026-10-24: "Marker present"
must never be reported as "failure prevented"). A guard that names a `test` is proved by running it: the command must
refuse the failure's bad case and pass the good one. Guards with no test are counted as configuration coverage.
"""
import subprocess
import json
import os
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


GUARD_LEVELS = ('prose', 'checklist', 'lint_warn', 'lint_refuse', 'gate')
CAUSES = ('standard_not_read', 'check_missing', 'brief_gap', 'standard_missing', 'handoff_loss', 'tool_limit', 'taste_new',
          'unresolved')


def check_loop_fields(register):
    """The failure loop's optional fields on an entry (scripts/learning/): right shape when present."""
    broken = []
    for f in register['failures']:
        fid = f.get('id', '?')
        if 'mode' in f and not (isinstance(f['mode'], str) and f['mode'].strip()):
            broken.append(f'{fid}: mode is the failure mode key, a non-empty string')
        if 'guard_level' in f and f['guard_level'] not in GUARD_LEVELS:
            broken.append(f'{fid}: guard_level is one of {", ".join(GUARD_LEVELS)}')
        for i, r in enumerate(f.get('recurrences') or []):
            if not isinstance(r, dict) or not str(r.get('on') or '').strip() or not str(r.get('what') or '').strip():
                broken.append(f'{fid}: recurrences.{i} needs on and what')
        for i, c in enumerate(f.get('causes') or []):
            if not isinstance(c, dict) or c.get('cause') not in CAUSES or not str(c.get('evidence') or '').strip():
                broken.append(f'{fid}: causes.{i} needs cause (one of {", ".join(CAUSES)}) and evidence')
        for key in ('recurrences', 'causes'):
            if key in f and not isinstance(f[key], list):
                broken.append(f'{fid}: {key} is a list')
    return broken


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
                    guard_fired(f, cmd)
    return proved, marker_only, failed


def guard_fired(failure, cmd):
    """A guard's test failing is one engine_incidents row (the failure loop); never stops the check."""
    try:
        sys.path.insert(0, str(ROOT / 'scripts'))
        import incidents  # noqa: PLC0415
        result = incidents.record({'stage': 'session', 'kind': 'guard_fired', 'failure_ids': [failure['id']],
                                   'artifact_ref': f'test:{cmd}'[:500], 'session_ref': os.environ.get('GITHUB_RUN_ID') and
                                   f'actions:{os.environ.get("GITHUB_RUN_ID")}', 'meta': {'test': cmd},
                                   'client_ref': incidents.client_ref('guard', failure['id'], cmd, os.environ.get('GITHUB_SHA', ''))})
        print(f'  incident for {failure["id"]}: {result}')
    except Exception as error:  # noqa: BLE001
        print(f'  incident for {failure["id"]}: not filed ({error})')


def record_read(piece):
    """The read as the piece's preflight receipt (scripts/preflight.py), when a piece is named; never fails the check."""
    try:
        sys.path.insert(0, str(ROOT / 'scripts'))
        import preflight  # noqa: PLC0415
        for line in preflight.write(piece, [preflight.receipt('failures', preflight.failures_version())]):
            print(line)
    except Exception as error:  # noqa: BLE001
        print(f'preflight: NOT RECORDED: {error}')


def surfaced(register):
    """The lines every session reads before it works: entries with a `surface` rule, in register order."""
    return [f'  EVERY SESSION ({f["id"]}): {f["surface"]}' for f in register['failures'] if f.get('surface')]


def main():
    argv = sys.argv[1:]
    run = '--run' in argv
    piece = argv[argv.index('--piece') + 1] if '--piece' in argv and argv.index('--piece') + 1 < len(argv) else None
    register = json.loads((ROOT / 'config' / 'failures.json').read_text(encoding='utf-8'))
    broken, open_ = check(register)
    broken += check_loop_fields(register)
    declined = [f for f in register['failures'] if f['status'] == 'declined']
    guarded = len(register['failures']) - len(open_) - len(declined)
    proved, marker_only, failed = behaviour(register, run)
    broken += failed
    print(f'failure register: {guarded} guarded ({len(proved)} with a behavioural test{", run" if run else ""}; '
          f'{len(marker_only)} marker only, configuration coverage, not proof), {len(open_)} open, {len(declined)} declined by Krish')
    for f in open_:
        print(f'  OPEN {f["id"]}: {f["what"]}')
    # Guarded or not, a failure of session behaviour is said at every session start: its `surface` line.
    for line in surfaced(register):
        print(line)
    learnings = json.loads((ROOT / 'config' / 'learnings.json').read_text(encoding='utf-8'))
    lb, lo = check_learnings(learnings)
    broken += lb
    print(f'learnings register (say nothing twice): {len(learnings["learnings"]) - len(lo)} encoded, {len(lo)} open')
    for item in lo:
        print(f'  OPEN {item["id"]}: {item["means"]}')
    record_read(piece)
    if broken:
        print('a guard is missing:\n  ' + '\n  '.join(broken))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
