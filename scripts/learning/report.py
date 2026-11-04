"""The week's report: is the engine failing less, and what would make it fail less again.

  repeat rate     incidents on modes that were already guarded / all incidents in the window (the number the loop
                  drives down)
  rounds          full renders that went to Krish before he approved a cut, per piece (making.rounds)
  week on week    against the last report's numbers (docs/learning/metrics.json)
  proposals       at most MAX_PROPOSALS, the modes that came back most, each with its evidence count and traced cause,
                  as engine_quality (or taste, when the cause is taste_new) rows for his list; never decided here

It writes docs/learning/<date>.md and one line in NOW.md, and returns the proposals for loop.py to post.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from . import common, ladder

MAX_PROPOSALS = 3
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
METRICS = common.ROOT / 'docs' / 'learning' / 'metrics.json'
NOW = common.ROOT / 'NOW.md'
NOW_MARK = '- Failure loop ('


def metrics(modes: list[dict], window: set) -> dict:
    """Counts over the items whose id is in `window` (this week's incidents, or every item for the backfill)."""
    of_item = {}
    for m in modes:
        repeat_ids = {id(r) for r in m['repeats']}
        for it in m['items']:
            of_item[id(it)] = (m, id(it) in repeat_ids)
    in_window = [(it, m, rep) for m in modes for it in m['items'] if it['id'] in window for (_, rep) in [of_item[id(it)]]]
    total = len(in_window)
    repeats = sum(1 for _, _, rep in in_window if rep)
    by_stage: dict[str, list[int]] = {}
    for it, _m, rep in in_window:
        by_stage.setdefault(it['stage'], [0, 0])
        by_stage[it['stage']][0] += 1
        by_stage[it['stage']][1] += rep
    return {'items': total, 'repeats': repeats, 'repeat_rate': round(repeats / total, 3) if total else None,
            'by_stage': {k: {'items': v[0], 'repeats': v[1]} for k, v in sorted(by_stage.items())},
            'modes': len({m['key'] for _, m, _ in in_window}),
            'repeating_modes': len({m['key'] for _, m, rep in in_window if rep})}


def rounds(rows: list[dict]) -> dict:
    values = [int(r['rounds']) for r in rows or [] if isinstance(r.get('rounds'), (int, float))]
    return {'pieces': len(values), 'mean': round(sum(values) / len(values), 2) if values else None,
            'one_round': sum(1 for v in values if v <= 1)}


def proposals(modes: list[dict], traced: dict, steps: list[dict], window: set, cap: int = MAX_PROPOSALS,
              period: str = 'this week') -> list[dict]:
    """At most `cap` proposals: the modes with the most repeats in the window, each citing its incident ids."""
    step_of = {s['mode']: s for s in steps}
    ranked = sorted((m for m in modes if any(r['id'] in window for r in m['repeats'])),
                    key=lambda m: (-sum(1 for r in m['repeats'] if r['id'] in window), -len(m['items']), m['key']))
    out = []
    for m in ranked:
        evidence = [it['id'] for it in m['items'] if it['id'] in window and isinstance(it['id'], str) and UUID.match(it['id'])]
        causes = traced.get(m['key']) or [{'cause': 'unresolved', 'evidence': 'no field explains it yet'}]
        top = causes[0]
        step = step_of.get(m['key'])
        times = sum(1 for r in m['repeats'] if r['id'] in window)
        failure = step['failure_id'] if step else (m['failure_ids'][0] if m['failure_ids'] else None)
        change = (f"climb {failure} from {step['from']} to {step['to']}: {step['work_order']}" if step and step['work_order']
                  else f'{failure} is at the gate already: Krish decides what holds it' if step
                  else 'write the standard down as a failure entry with a guard (nothing covers it yet)')
        out.append({
            'proposal_class': 'taste' if top['cause'] == 'taste_new' else 'engine_quality',
            'assertion': (f"The same failure came back {times} time(s) {period} after a guard for it existed "
                          f"({m['stage']}, {m['group'].replace('_', ' ')}: {m['key'].split('/')[-1].replace('-', ' ')}). "
                          f"Traced cause: {top['cause'].replace('_', ' ')} ({top['evidence'][:300]}). Proposed: {change}.")[:1600],
            'scope': {'key': f"loop:{m['key']}"[:200], 'failure_id': failure, 'cause': top['cause'], 'stage': m['stage']},
            'evidence_ids': evidence[:100],
            'evidence_count': len(evidence) or sum(1 for it in m['items'] if it['id'] in window),
            'counterexamples': [],
            'regression_cases': [f"next week's loop finds no repeat of mode {m['key']}"] +
                                ([f'the guard test of {failure} refuses an incident like {evidence[0]}'] if failure and evidence else []),
            'proposed_change': {'failure_id': failure, 'from': step['from'] if step else None, 'to': step['to'] if step else None,
                                'work_order': step['work_order'] if step else None},
        })
        if len(out) == cap:
            break
    return out


def previous(path: Path = METRICS) -> dict | None:
    if not path.is_file():
        return None
    history = common.load_json(path).get('weeks') or []
    return history[-1] if history else None


def keep(date: str, numbers: dict, path: Path = METRICS):
    doc = common.load_json(path) if path.is_file() else {'_about': 'The failure loop\'s weekly numbers (scripts/learning/report.py).', 'weeks': []}
    doc['weeks'] = [w for w in doc['weeks'] if w.get('date') != date] + [{'date': date, **numbers}]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def pct(x) -> str:
    return 'n/a' if x is None else f'{round(100 * x)}%'


def now_line(date: str, numbers: dict, n_proposals: int) -> str:
    m = numbers['metrics']
    return (f"{NOW_MARK}{date}): {m['items']} incident(s), {m['repeats']} on modes already guarded (repeat rate "
            f"{pct(m['repeat_rate'])}); {n_proposals} proposal(s) on his list; docs/learning/{date}.md.")


def write_now(line: str, path: Path = NOW) -> bool:
    """Replaces the loop's one line under "What is next", or adds it above the North Star check. One line, never more."""
    if not path.is_file():
        return False
    lines = path.read_text(encoding='utf-8').split('\n')
    kept = [x for x in lines if not x.startswith(NOW_MARK)]
    at = next((i for i, x in enumerate(kept) if x.startswith('- North Star check (')), None)
    if at is None:
        return False
    kept.insert(at, line)
    path.write_text('\n'.join(kept), encoding='utf-8')
    return True


def markdown(title: str, date: str, numbers: dict, modes: list[dict], traced: dict, steps: list[dict], props: list[dict],
             operating: list[dict] | None = None, before: dict | None = None, note: str = '', window: set | None = None) -> str:
    """The report. With `window` (the week's incident ids), only modes that came back inside it are shown and tallied."""
    m = numbers['metrics']
    if window is not None:
        modes = [x for x in modes if any(r['id'] in window for r in x['repeats'])]
    out = [f'# {title}', '', f'Written by scripts/learning/report.py on {date}. {note}'.strip(), '',
           '## The numbers', '',
           f"- Items read: {m['items']}, in {m['modes']} failure modes.",
           f"- Repeats (an item on a mode that already had a guard): {m['repeats']}, a repeat rate of {pct(m['repeat_rate'])}, "
           f"across {m['repeating_modes']} modes."]
    if numbers.get('rounds', {}).get('pieces'):
        r = numbers['rounds']
        out.append(f"- Rounds before his approval: {r['mean']} a piece over {r['pieces']} piece(s); {r['one_round']} in one round.")
    if before:
        b = before.get('metrics') or {}
        out.append(f"- Week on week: repeat rate {pct(b.get('repeat_rate'))} on {before.get('date')} to {pct(m['repeat_rate'])} now.")
    out.append('')
    out.append('By stage: ' + '; '.join(f"{k} {v['items']} ({v['repeats']} repeat)" for k, v in m['by_stage'].items()) + '.')
    tally: dict[str, int] = {}
    for mode in modes:
        if mode['repeats']:
            for c in traced.get(mode['key']) or [{'cause': 'unresolved'}]:
                tally[c['cause']] = tally.get(c['cause'], 0) + 1
    if tally:
        out.append('')
        out.append('Causes across the repeating modes: ' + ', '.join(f"{k.replace('_', ' ')} {v}" for k, v in
                                                                      sorted(tally.items(), key=lambda kv: (-kv[1], kv[0]))) + '.')
    reg = numbers.get('register')
    if reg:
        out.append(f"The register: {reg['guarded']} failure entries guarded, {reg['tested']} of them by a behavioural test and "
                   f"{reg['guarded'] - reg['tested']} by markers alone (a marker proves a guard is there, never that it works); "
                   f"{reg['open']} open.")
    out += ['', '## Failures that already recur', '',
            'Each mode below came back after a guard for it existed: the date its first guard stood, then each return.', '']
    shown = [x for x in modes if x['repeats']]
    for mode in shown:
        out.append(f"### {mode['key']}")
        out.append(f"- Linked failure entries: {', '.join(mode['failure_ids']) or 'none'}; learnings: {', '.join(mode['learning_ids']) or 'none'}.")
        out.append(f"- Guarded since {mode['guarded_since']}; came back {len(mode['repeats'])} time(s): " +
                   '; '.join(f"{r['on']} {r['source']} {r['id']}" for r in mode['repeats']) + '.')
        for c in traced.get(mode['key']) or [{'cause': 'unresolved', 'evidence': 'no field explains it; the model step is asked'}]:
            out.append(f"- Cause, {c['cause'].replace('_', ' ')}: {c['evidence']}")
        step = next((s for s in steps if s['mode'] == mode['key']), None)
        if step:
            out.append(f"- Ladder: {step['failure_id']} {step['from']} -> {step['to']}" + ('' if step['work_order'] else ' (at the top: Krish decides)'))
        out.append('')
    if not shown:
        out += ['None this time.', '']
    out += ['## The strongest proposed fixes', '',
            'Proposals only: nothing below is decided or applied. Krish rules on each.', '']
    for i, p in enumerate(props, 1):
        out.append(f"{i}. **{p['scope']['key']}** ({p['proposal_class']}, evidence {p['evidence_count']}, cause "
                   f"{p['scope']['cause'].replace('_', ' ')}). {p['assertion']}")
    if not props:
        out.append('None: nothing repeated.')
    if operating is not None:
        counts = {s: sum(1 for o in operating if o['state'] == s) for s in ('live', 'covered', 'contradicted')}
        out += ['', '## The operating standards', '',
                f"The {len(operating)} standards about how sessions work with Krish (config/floor-groups.json `operating`), "
                f"reconciled against the rules held now: {counts['live']} live with no home yet, {counts['covered']} covered by "
                f"AGENTS.md or its reference, {counts['contradicted']} contradicted by a later ruling.", '']
        for state in ('contradicted', 'live', 'covered'):
            rows = [o for o in operating if o['state'] == state]
            if not rows:
                continue
            out.append(f'### {state.capitalize()}')
            for o in rows:
                tail = f" By: {o['by']}" + (f" ({o['where']})" if o.get('where') else '') if o.get('by') else ''
                out.append(f"- {o['id']} (last said {o['said_last'] or 'n/a'}): {o['rule']}{tail}")
            out.append('')
    # No dashes of the long kind in anything a person reads (AGENTS.md, Voice), even inside a drafted standard.
    return re.sub(r'\s*[\u2014\u2013]\s*', ', ', '\n'.join(out)).rstrip() + '\n'
