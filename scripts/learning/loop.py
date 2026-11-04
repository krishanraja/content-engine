#!/usr/bin/env python3
"""The failure loop, end to end (docs/learning/README.md). Krish, 2026-11-04: "all of this stuff should feed an
intelligent system that automatically gets more intelligent every week, not just pile up loads of individual feedback
for me to sift through".

    python3 scripts/learning/loop.py backfill [--groups PATH] [--out docs/learning/DATE-backfill.md]
        the registers' whole history at once (73 failures, the learnings, the floor's rejections and its operating
        standards): which failures already recur, why, and the three strongest fixes. Proposes nothing to his list.

    python3 scripts/learning/loop.py weekly deterministic [--since ISO] [--incidents FILE]
        gather the week's incidents (GET /api/learning/incidents, or a file, and .cache/incidents.jsonl), cluster them
        with the registers, trace the causes the fields prove and plan the ladder. Writes .cache/learning/: state.json,
        unresolved.json (only what no field explains, for the model) and work-orders.md (for the Claude step).

    python3 scripts/learning/loop.py weekly finish [--apply] [--model-causes FILE] [--date YYYY-MM-DD]
        merge the model's causes (kept only when they quote an incident field), write the ladder's register changes
        into config/failures.json, docs/learning/<date>.md, docs/learning/metrics.json and the NOW.md line; with
        --apply, post at most three proposals through POST /api/learning/incidents. Without it (the dry run) nothing
        leaves the machine.

    python3 scripts/learning/loop.py --self-test
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from learning import causes, cluster, common, ladder, operating, report  # noqa: E402

STATE = common.ROOT / '.cache' / 'learning'


def _engine(method, path, body=None):
    sys.path.insert(0, str(common.ROOT / 'scripts'))
    import engine  # noqa: PLC0415
    status, text = engine.call(method, path, body, engine.operator_key(), timeout=60)
    if status != 200:
        raise RuntimeError(f'{method} {path}: HTTP {status}: {text[:200]}')
    return json.loads(text)


def register_numbers(regs) -> dict:
    fs = regs['failures']['failures']
    guarded = [f for f in fs if f.get('status') == 'guarded']
    return {'guarded': len(guarded), 'tested': sum(1 for f in guarded if any(g.get('test') for g in f.get('guards') or [])),
            'open': sum(1 for f in fs if f.get('status') == 'open')}


def trace(modes, regs) -> dict:
    return {m['key']: found for m in modes if (found := causes.deterministic(m, regs))}


def backfill(groups=None, out=None, today=None) -> dict:
    regs = common.registers(groups)
    items = common.backfill_items(regs)
    modes = cluster.modes(items, regs)
    traced = trace(modes, regs)
    steps = ladder.plan(modes, traced, regs)
    window = {it['id'] for it in items}
    numbers = {'metrics': report.metrics(modes, window), 'register': register_numbers(regs)}
    # The backfill has no incident ids to cite, so its proposals are shown in the report and never posted.
    props = report.proposals(modes, traced, steps, window, period='in the registers\' history')
    ops = operating.classify(regs) if regs['groups'] else None
    today = today or date.today().isoformat()
    text = report.markdown('The failure loop: the first backfill', today, numbers, modes, traced, steps, props, ops,
                           note=('Over the registers\' whole history: config/failures.json, config/learnings.json, the '
                                 'rejection floor\'s records and its operating standards. A repeat here is a later entry, '
                                 'learning or rejection on a mode a guard already covered. Modes are matched by shared words '
                                 '(scripts/learning/cluster.py), so read each before relying on it. No preflight receipts existed '
                                 'before today, so the history cannot show a standard that was not read; only incidents from now '
                                 'on can. Nothing below was inserted as a proposal; it is for review.'))
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(text, encoding='utf-8')
    return {'modes': modes, 'traced': traced, 'steps': steps, 'numbers': numbers, 'proposals': props, 'operating': ops, 'text': text}


def gather(since: str, incidents_file=None) -> tuple[list[dict], list[dict]]:
    """(incident rows, rounds rows): from a file when given, else the engine; plus what waits offline."""
    sys.path.insert(0, str(common.ROOT / 'scripts'))
    import incidents as queue  # noqa: PLC0415
    if incidents_file:
        doc = common.load_json(incidents_file)
        rows, rounds = doc.get('incidents') or [], doc.get('rounds') or []
    else:
        answer = _engine('GET', f'/api/learning/incidents?since={since}&rounds=1')
        rows, rounds = answer.get('incidents') or [], answer.get('rounds') or []
    held = {r.get('client_ref') for r in rows if r.get('client_ref')}
    rows += [dict(r, id=r.get('id') or f'offline-{i}') for i, r in enumerate(queue.waiting())
             if r.get('client_ref') not in held and str(r.get('at') or '') >= since]
    return rows, rounds


def weekly_deterministic(since=None, incidents_file=None, groups=None, state=STATE) -> dict:
    since = since or (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    regs = common.registers(groups)
    rows, rounds = gather(since, incidents_file)
    incident_items = common.incident_items(rows, regs)
    modes = cluster.modes(common.backfill_items(regs) + incident_items, regs)
    traced = trace(modes, regs)
    steps = ladder.plan([m for m in modes if any(it['source'] == 'incident' for it in m['repeats'])], traced, regs)
    window = [it['id'] for it in incident_items]
    asked = causes.unresolved([m for m in modes if any(it['source'] == 'incident' for it in m['items'])], traced)
    state.mkdir(parents=True, exist_ok=True)
    (state / 'state.json').write_text(json.dumps({'since': since, 'rows': rows, 'rounds': rounds, 'window': window},
                                                 ensure_ascii=False, default=str), encoding='utf-8')
    (state / 'unresolved.json').write_text(json.dumps(asked, indent=1, ensure_ascii=False, default=str), encoding='utf-8')
    (state / 'work-orders.md').write_text(ladder.work_orders(steps), encoding='utf-8')
    print(f'learning: {len(rows)} incident(s) since {since[:10]}; {len(modes)} modes; {len(steps)} to climb; '
          f'{len(asked)} unresolved for the model')
    return {'modes': modes, 'traced': traced, 'steps': steps, 'asked': asked}


def weekly_finish(apply=False, model_causes=None, groups=None, today=None, state=STATE, post=None) -> dict:
    saved = common.load_json(state / 'state.json')
    regs = common.registers(groups)
    incident_items = common.incident_items(saved['rows'], regs)
    modes = cluster.modes(common.backfill_items(regs) + incident_items, regs)
    traced = trace(modes, regs)
    asked = common.load_json(state / 'unresolved.json') if (state / 'unresolved.json').is_file() else []
    if model_causes and Path(model_causes).is_file():
        for key, found in causes.merge_model(common.load_json(model_causes), asked).items():
            traced.setdefault(key, []).extend(found)
    steps = ladder.plan([m for m in modes if any(it['source'] == 'incident' for it in m['repeats'])], traced, regs)
    window = set(saved['window'])
    numbers = {'metrics': report.metrics(modes, window), 'rounds': report.rounds(saved['rounds']), 'register': register_numbers(regs)}
    props = report.proposals(modes, traced, steps, window)
    today = today or date.today().isoformat()
    before = report.previous()
    text = report.markdown(f'The failure loop: week to {today}', today, numbers, modes, traced, steps, props, before=before,
                           note=f"Incidents since {saved['since'][:10]}." + ('' if apply else ' Dry run: no proposal was posted.'),
                           window=window)
    out = common.ROOT / 'docs' / 'learning' / f'{today}.md'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding='utf-8')
    changed = ladder.apply(steps) if steps else 0
    report.keep(today, numbers)
    posted = None
    usable = [p for p in props if p['evidence_ids']]
    if apply and usable:
        posted = (post or _engine)('POST', '/api/learning/incidents', {'proposals': usable, 'batch': f'learning-{today}'})
    report.write_now(report.now_line(today, numbers, len(usable) if apply else 0))
    print(f'learning: {out.relative_to(common.ROOT)}; {changed} failure entr(y/ies) climbed; '
          f"{len(usable)} proposal(s) {'posted' if posted else 'held (dry run)' if not apply else 'none to post'}")
    return {'steps': steps, 'proposals': props, 'numbers': numbers, 'posted': posted}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description='The failure loop.')
    p.add_argument('mode', nargs='?', choices=['backfill', 'weekly'])
    p.add_argument('stage', nargs='?', choices=['deterministic', 'finish'])
    p.add_argument('--groups', help='config/floor-groups.json, when it lives elsewhere')
    p.add_argument('--out', help='backfill: where the report goes')
    p.add_argument('--since', help='weekly: incidents from this ISO time (default a week ago)')
    p.add_argument('--incidents', help='weekly: read incidents from this file instead of the engine')
    p.add_argument('--model-causes', help='weekly finish: the Claude step\'s causes file')
    p.add_argument('--apply', action='store_true', help='weekly finish: post the proposals (the scheduled run)')
    p.add_argument('--date', help='the report\'s date (default today)')
    p.add_argument('--self-test', action='store_true')
    a = p.parse_args(argv)
    if a.self_test:
        import subprocess  # noqa: PLC0415
        return subprocess.run([sys.executable, str(common.ROOT / 'tests' / 'learning_loop_test.py')]).returncode
    if a.mode == 'backfill':
        result = backfill(a.groups, a.out, a.date)
        m = result['numbers']['metrics']
        print(f"learning backfill: {m['items']} items, {m['modes']} modes, {m['repeats']} repeats ({report.pct(m['repeat_rate'])}); "
              f"{len(result['proposals'])} proposals in the report{'; ' + a.out if a.out else ''}")
        return 0
    if a.mode == 'weekly' and a.stage == 'deterministic':
        weekly_deterministic(a.since, a.incidents, a.groups)
        return 0
    if a.mode == 'weekly' and a.stage == 'finish':
        weekly_finish(a.apply, a.model_causes, a.groups, a.date)
        return 0
    p.error('give backfill, or weekly deterministic|finish')
    return 2


if __name__ == '__main__':
    sys.exit(main())
