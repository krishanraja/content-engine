"""The guard ladder: a failure that comes back after its guard climbs one rung (Krish, 2026-11-04: "start to strengthen
recurring failures").

    prose -> checklist -> lint_warn -> lint_refuse -> gate

  prose        written down (a doc, a learning) and nothing else
  checklist    a step a skill or a standard tells the maker to do and check
  lint_warn    code that finds it and says so, without stopping the work
  lint_refuse  code that refuses it, proved by a behavioural test
  gate         the work cannot move on (a render, a send, a merge) until it is put right or Krish signs it

A failure entry's rung is its `guard_level` when set, else read from its guards: none is prose, markers in docs or
skills a checklist, code with no test a lint_warn, a guard with a test a lint_refuse. A repeat climbs it one rung, and
the loop emits two things: the register change (config/failures.json: mode, recurrences, causes, guard_level), applied
by `apply`, and a work order naming the concrete code or doc change the new rung needs, which the weekly workflow's
Claude step makes on its branch and the pull request carries. A mode already at the gate is put to Krish instead.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import common

LEVELS = ('prose', 'checklist', 'lint_warn', 'lint_refuse', 'gate')
CODE = ('.py', '.ts', '.mts', '.mjs', '.js', '.cjs')
WHAT_EACH_RUNG_NEEDS = {
    'checklist': 'a line in the maker\'s skill (.agents/skills/<skill>/SKILL.md, under its byte cap) or the standard it '
                 'reads, saying what to check before delivery, and the entry\'s guard pointing at it',
    'lint_warn': 'a check in the code that makes this kind of work (the lint, qc or story check nearest it) that finds the '
                 'failure and prints it, plus a guard marker on the entry',
    'lint_refuse': 'the same check refusing (non-zero exit), a behavioural test that feeds it the bad case and the good '
                   'one, and the test named in the entry\'s guard `test`',
    'gate': 'the refusal wired in front of the step that moves the work on (ve brief, ve render, the pack or the board '
            'press), dated like the other ve gates, with its test',
}


def level_of(failure: dict) -> str:
    if failure.get('guard_level') in LEVELS:
        return failure['guard_level']
    guards = failure.get('guards') or []
    if failure.get('status') == 'open' or not guards:
        return 'prose'
    if any(g.get('test') for g in guards):
        return 'lint_refuse'
    if any(str(g.get('file', '')).endswith(CODE) for g in guards):
        return 'lint_warn'
    return 'checklist'


def climb(level: str) -> str:
    i = LEVELS.index(level)
    return LEVELS[min(i + 1, len(LEVELS) - 1)]


def plan(modes: list[dict], traced: dict[str, list[dict]], regs: dict) -> list[dict]:
    """One step per repeating mode with a failure entry: from what rung to what, why, and the register change."""
    failures = {f['id']: f for f in regs['failures']['failures']}
    steps = []
    for m in modes:
        if not m['repeats'] or not m['failure_ids']:
            continue
        # The entry the mode hangs on: the one guarded first (its guard is the one that did not hold).
        fid = sorted(m['failure_ids'], key=lambda i: (failures[i].get('on') or '', i))[0]
        f = failures[fid]
        now = level_of(f)
        to = climb(now)
        # The entry never recurs on itself: its own date is when it was raised.
        recurrences = [{'on': it['on'], 'what': (it['what'] or it['his_words'])[:300], 'source': f"{it['source']}:{it['id']}"}
                       for it in m['repeats'] if it['id'] != fid]
        steps.append({
            'mode': m['key'], 'failure_id': fid, 'from': now, 'to': to, 'at_top': now == 'gate',
            'repeats': len(m['repeats']), 'causes': traced.get(m['key'], []),
            'register': {'mode': m['key'], 'guard_level': to, 'recurrences': recurrences, 'causes': [
                {'cause': c['cause'], 'evidence': c['evidence']} for c in traced.get(m['key'], [])] or
                [{'cause': 'unresolved', 'evidence': f'{len(m["repeats"])} repeat(s); no field explains them yet'}]},
            'work_order': None if now == 'gate' else WHAT_EACH_RUNG_NEEDS[to],
        })
    return steps


def apply(steps: list[dict], path: Path = common.FAILURES) -> int:
    """Writes each step's register change into config/failures.json, keeping every other byte of each entry; the
    recurrences already there are kept and new ones added once. Returns how many entries changed."""
    doc = common.load_json(path)
    by_id = {f['id']: f for f in doc['failures']}
    changed = 0
    for step in steps:
        f = by_id.get(step['failure_id'])
        if f is None:
            continue
        reg = step['register']
        before = json.dumps(f, sort_keys=True)
        f['mode'] = reg['mode']
        if LEVELS.index(reg['guard_level']) > LEVELS.index(level_of(f)) or 'guard_level' not in f:
            f['guard_level'] = reg['guard_level']
        held = {(r.get('on'), r.get('source')) for r in f.get('recurrences') or []}
        f['recurrences'] = (f.get('recurrences') or []) + [r for r in reg['recurrences'] if (r['on'], r['source']) not in held]
        seen = {(c.get('cause'), c.get('evidence')) for c in f.get('causes') or []}
        f['causes'] = (f.get('causes') or []) + [c for c in reg['causes'] if (c['cause'], c['evidence']) not in seen]
        changed += json.dumps(f, sort_keys=True) != before
    Path(path).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return changed


def work_orders(steps: list[dict]) -> str:
    """The Markdown the weekly workflow's Claude step works from: one concrete change per climbing mode."""
    lines = ['# Ladder work orders', '',
             'Each failure below came back after its guard. Make the change its new rung needs, in this branch, with its test,',
             'then add a guard to its entry in config/failures.json naming the file and a marker (and the test when the rung is',
             'lint_refuse or gate). Keep every skill under its byte cap. Change nothing else. A mode already at the gate is',
             'listed for Krish, never changed here.', '']
    for s in steps:
        lines.append(f"## {s['failure_id']} ({s['mode']})")
        lines.append(f"- came back {s['repeats']} time(s) after its guard; rung {s['from']} -> {s['to']}")
        for c in s['causes']:
            lines.append(f"- cause {c['cause']}: {c['evidence']}")
        lines.append(f"- needs: {s['work_order']}" if s['work_order'] else '- at the top rung: put to Krish, change nothing')
        lines.append('')
    return '\n'.join(lines)
