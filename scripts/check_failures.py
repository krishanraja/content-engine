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
    python3 scripts/check_failures.py --watch short_video,long_video  # the technical watch-outs for those makers

The watch-outs (Krish, 2026-11-17: "i need to turn this in to surgical, precise, technical watch outs for my next
batch of productions"): an entry may carry `watch` {formats, line}, the one technical thing a maker of those formats
(the makers of config/rejection-floor.json, or "all") must not do again. --watch prints them for the makers named,
each with what stops it now (its guards' files, and whether a test proves them) or that nothing does, so a session
reads them before it storyboards rather than meeting them at lint or QC.

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
import re
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
        if 'watch' in f:
            broken += watch_problems(fid, f['watch'])
        # A guard's test is a command that runs as written: F24's named `ve.py lint <spec>` until 17 Nov, so --run
        # could never prove it.
        for g in f.get('guards') or []:
            if re.search(r'<[^>]*>', str(g.get('test') or '')):
                broken.append(f'{fid}: its test "{g["test"]}" has a placeholder; name a command that runs as written')
            # CI installs requirements-ci.txt only, which has no pytest: a guard run through it fails there every time
            # (Full verify, issue #758). The tests are unittest files; run them as scripts (python3 tests/x_test.py -k Name).
            if re.search(r'-m\s+pytest\b', str(g.get('test') or '')):
                broken.append(f'{fid}: its test "{g["test"]}" needs pytest, which CI does not install; run the file itself')
    return broken


def makers() -> set[str]:
    """The makers a watch-out may name: the rejection floor's formats (scripts/floor.py --formats)."""
    return set(json.loads((ROOT / 'config' / 'rejection-floor.json').read_text(encoding='utf-8'))['formats'])


def watch_problems(fid, watch) -> list[str]:
    if not isinstance(watch, dict):
        return [f'{fid}: watch is {{formats, line}}']
    problems = []
    formats = watch.get('formats')
    if not isinstance(formats, list) or not formats:
        problems.append(f'{fid}: watch.formats lists the makers it is for')
    else:
        unknown = sorted(set(formats) - makers())
        if unknown:
            problems.append(f'{fid}: watch.formats names no maker {", ".join(unknown)} (scripts/floor.py --formats)')
    line = watch.get('line')
    if not isinstance(line, str) or not line.strip() or len(line) > 320:
        problems.append(f'{fid}: watch.line is one plain line of at most 320 characters')
    return problems


def stopped_by(f) -> str:
    """What stops a failure now, in one line: its guards' files and whether a test proves them, or nothing."""
    if f['status'] == 'open':
        return 'OPEN: nothing stops it; watch for it by hand'
    if f['status'] == 'declined':
        return 'declined by Krish: watch for it by hand'
    files = list(dict.fromkeys(g['file'] for g in f.get('guards') or []))
    proof = 'a test proves it' if any(g.get('test') for g in f.get('guards') or []) else 'marker only, no test'
    level = f" ({f['guard_level']})" if f.get('guard_level') else ''
    return f'stopped by {", ".join(files[:3])}{" and more" if len(files) > 3 else ""}{level}; {proof}'


def watch_outs(register, wanted) -> list[str]:
    """The watch-outs for the makers wanted, in register order, open ones first."""
    wanted = set(wanted)
    rows = [f for f in register['failures'] if (f.get('watch') or {}).get('formats')
            and (wanted & set(f['watch']['formats']) or 'all' in f['watch']['formats'])]
    rows.sort(key=lambda f: f['status'] != 'open')
    lines = [f'technical watch-outs for {", ".join(sorted(wanted))}: {len(rows)} '
             f'({sum(f["status"] == "open" for f in rows)} open, nothing stops them)']
    for i, f in enumerate(rows, 1):
        lines.append(f'  {i:>2}. {f["watch"]["line"]}')
        lines.append(f'      [{f["id"]}, {f["on"]}] {stopped_by(f)}')
    return lines


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
    watch = argv[argv.index('--watch') + 1] if '--watch' in argv and argv.index('--watch') + 1 < len(argv) else None
    register = json.loads((ROOT / 'config' / 'failures.json').read_text(encoding='utf-8'))
    broken, open_ = check(register)
    broken += check_loop_fields(register)
    if watch is not None:
        wanted = [w.strip() for w in watch.split(',') if w.strip()]
        unknown = sorted(set(wanted) - makers())
        if unknown or not wanted:
            print(f'--watch names no maker {", ".join(unknown) or "(none)"}: one of {", ".join(sorted(makers()))}')
            return 2
        for line in watch_outs(register, wanted):
            print(line)
        record_read(piece)
        if broken:
            print('a guard is missing:\n  ' + '\n  '.join(broken))
            return 1
        return 0
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
