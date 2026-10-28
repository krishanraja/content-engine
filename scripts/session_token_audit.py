#!/usr/bin/env python3
"""Token use of one Claude Code session, from its transcript (docs/COST_AUDIT_2026-10-18.md, docs/COST_GUARDS.md).

    python3 scripts/session_token_audit.py                 # the newest session of this project
    python3 scripts/session_token_audit.py PATH.jsonl      # one transcript
    python3 scripts/session_token_audit.py --line          # one line, for a handover

Prints calls, tokens read (input + cache reads + cache writes), output, the first and last call's context, and the
same for the session's subagents and workflows. Write the --line output into the handover so the next audit is
measured, not estimated.

Codex threads (~/.codex/sessions, or $CODEX_HOME/sessions), the ledger `ve ledger` wraps:

    python3 scripts/session_token_audit.py --codex                          # every thread of the last 7 days
    python3 scripts/session_token_audit.py --codex --session ID --children  # one thread and its child agents
    python3 scripts/session_token_audit.py --codex --since 2026-10-24 --until 2026-10-26 --cwd-contains friday
    python3 scripts/session_token_audit.py --codex ... --json               # {sessions: [...], totals: {...}}
    python3 scripts/session_token_audit.py --codex ... --line               # one line, for a handover

--since and --until clip every thread to the window (a bare date is local midnight; --until's day is included).
Codex's input tokens include the cached ones and its output tokens include the reasoning ones. Aggregates only:
no message, instruction or tool argument is ever printed, and ~/.codex/auth.json is never opened."""
import argparse
import collections
import contextlib
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

KEYS = ('input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'output_tokens')


def scan(path):
    tot = collections.Counter(); byday = collections.defaultdict(collections.Counter)
    models = collections.Counter(); seen = set(); contexts = []
    for line in open(path, errors='ignore'):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'assistant':
            continue
        m = e.get('message') or {}; u = m.get('usage') or {}; mid = m.get('id')
        if not u or mid in seen:
            continue
        seen.add(mid); models[m.get('model')] += 1
        day = (e.get('timestamp') or '')[:10]
        for k in KEYS:
            tot[k] += u.get(k, 0) or 0; byday[day][k] += u.get(k, 0) or 0
        contexts.append(sum(u.get(k, 0) or 0 for k in KEYS[:3]))
    return tot, byday, contexts, models


def read_total(t):
    return sum(t[k] for k in KEYS[:3])


# Codex keeps one rollout per thread under sessions/YYYY/MM/DD/, older ones zstd-compressed. A line is read past its
# head only when it carries numbers: session_meta, turn_context, token_usage_record and the token_count event.
CODEX_TOKENS = {'input': 'input_tokens', 'cached': 'cached_input_tokens', 'output': 'output_tokens',
                'reasoning': 'reasoning_output_tokens'}
META = ('id', 'session_id', 'parent_thread_id', 'cwd', 'timestamp', 'agent_nickname', 'agent_path')
IDLE = 600  # seconds: a longer pause is idle time, not active time
WEEK = 10080  # minutes in the weekly rate-limit window
HEAD = re.compile(r'\{"timestamp":"([^"]*)"(?:,"ordinal":\d+)?,"type":"(\w+)"(?:,"payload":\{"type":"(\w+)")?')
ROLLOUT = re.compile(r'rollout-(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d)-([0-9a-f-]{36})\.jsonl(?:\.zst)?$')


def stamp(s):
    """Epoch seconds; a stamp without a zone, or a bare date, is local time."""
    d = datetime.fromisoformat(s.replace('Z', '+00:00'))
    return (d if d.tzinfo else d.astimezone()).timestamp()


def iso(t):
    return None if t is None else datetime.fromtimestamp(t, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def number(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def codex_home(home=None):
    return Path(home or os.environ.get('CODEX_HOME') or Path.home() / '.codex').expanduser().resolve()


def codex_files(home):
    """Every rollout, one per thread (a plain copy beats a compressed one), oldest first."""
    found = {}
    for f in sorted((home / 'sessions').glob('*/*/*/rollout-*.jsonl*')):
        m = ROLLOUT.search(f.name)
        if m and (m.group(2) not in found or f.suffix == '.jsonl'):
            found[m.group(2)] = f
    return sorted(found.values(), key=lambda f: f.name)


def codex_lines(path):
    path = Path(path)
    if not path.name.endswith('.zst'):
        with open(path, encoding='utf-8', errors='ignore') as f:
            yield from f
        return
    try:
        from compression import zstd  # Python 3.14
    except ImportError:
        zstd = None
    if zstd:
        with zstd.open(path, 'rt', encoding='utf-8', errors='ignore') as f:
            yield from f
    elif shutil.which('zstd'):
        with subprocess.Popen([shutil.which('zstd'), '-dcq', str(path)], stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, encoding='utf-8', errors='ignore') as p:
            yield from p.stdout
    else:
        raise OSError('compressed: needs Python 3.14 or the zstd command')


def codex_head(path):
    """A thread's session_meta, without its instructions."""
    with contextlib.closing(codex_lines(path)) as lines:
        for line in lines:
            try:
                e = json.loads(line)
            except ValueError:
                break
            if e.get('type') == 'session_meta':
                return {k: (e.get('payload') or {}).get(k) for k in META}
            break
    return {}


def codex_titles(home):
    """Thread names from session_index.jsonl, the newest rename winning."""
    names = {}
    try:
        f = open(home / 'session_index.jsonl', encoding='utf-8', errors='ignore')
    except OSError:
        return {}
    with f:
        for line in f:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            at = e.get('updated_at') or ''
            if e.get('id') and e.get('thread_name') and at >= names.get(e['id'], ('',))[0]:
                names[e['id']] = (at, e['thread_name'])
    return {k: v[1] for k, v in names.items()}


def codex_thread(path, since=None, until=None):
    """One thread's numbers, clipped to [since, until); None when nothing of it falls inside."""
    meta = {}; model = effort = plan = resets = last_total = None; started = recorded = False
    spans = []; weekly = []; credits = []
    # Before the first task_started a fork replays its parent's history: copies, kept apart and dropped unless the
    # log has no task_started at all.
    live, early = ({'calls': 0, 'tools': 0, 'tokens': collections.Counter(), 'models': {}} for _ in range(2))

    def call(into, usage):
        into['calls'] += 1
        into['tokens'].update({k: usage.get(v) or 0 for k, v in CODEX_TOKENS.items()})
        m = into['models'].setdefault(model or 'unknown', {'calls': 0, 'effort': collections.Counter()})
        m['calls'] += 1; m['effort'][effort or 'unknown'] += 1

    for line in codex_lines(path):
        h = HEAD.match(line); e = None
        if h:
            ts, kind, sub = h.groups()
        else:  # keys in another order: read it whole
            try:
                e = json.loads(line)
            except ValueError:
                continue
            ts, kind, p = e.get('timestamp') or '', e.get('type'), e.get('payload')
            sub = p.get('type') if isinstance(p, dict) else None
        tc = kind == 'event_msg' and sub == 'token_count'
        if e is None and (tc or kind in ('session_meta', 'turn_context', 'token_usage_record')):
            try:
                e = json.loads(line)
            except ValueError:
                continue
        p = (e or {}).get('payload')
        p = p if isinstance(p, dict) else {}
        fresh = False
        if kind == 'session_meta' and not meta:
            meta = {k: p.get(k) for k in META}
        elif kind == 'turn_context':
            model, effort = p.get('model') or model, p.get('effort') or effort
        elif kind == 'event_msg' and sub == 'task_started':
            started = True
        elif kind == 'token_usage_record':
            recorded = True
        elif tc:
            total = (p.get('info') or {}).get('total_token_usage')
            fresh, last_total = bool(total) and total != last_total, total or last_total
        try:
            t = stamp(ts)
        except ValueError:
            continue
        if (since is not None and t < since) or (until is not None and t >= until):
            continue
        if not spans or t - spans[-1][1] >= IDLE:
            spans.append([t, t])
        elif t > spans[-1][1]:
            spans[-1][1] = t
        into = live if started else early
        if kind == 'response_item' and sub and sub.endswith('_call'):
            into['tools'] += 1
        elif kind == 'token_usage_record' and (not meta.get('id') or p.get('thread_id') in (None, meta['id'])):
            call(live, p.get('usage') or {})
        elif tc:
            # Logs from before token_usage_record: each new cumulative total is one call
            if fresh and not recorded and (p.get('info') or {}).get('last_token_usage'):
                call(into, p['info']['last_token_usage'])
            rl = p.get('rate_limits') or {}
            w = next((rl[k] for k in ('primary', 'secondary') if (rl.get(k) or {}).get('window_minutes') == WEEK), {})
            if number(w.get('used_percent')) is not None:
                weekly.append((t, number(w['used_percent']))); resets = w.get('resets_at') or resets
            if number((rl.get('credits') or {}).get('balance')) is not None:
                credits.append((t, number(rl['credits']['balance'])))
            if rl.get('plan_type'):
                plan = (t, rl['plan_type'])
    if not spans:
        return None
    if not started:
        live['calls'] += early['calls']; live['tools'] += early['tools']; live['tokens'].update(early['tokens'])
        for name, m in early['models'].items():
            into = live['models'].setdefault(name, {'calls': 0, 'effort': collections.Counter()})
            into['calls'] += m['calls']; into['effort'].update(m['effort'])
    start, end = spans[0][0], max(b for _, b in spans)
    ends = lambda xs: {'start': xs[0][1] if xs else None, 'end': xs[-1][1] if xs else None}
    title = ' '.join(x for x in (meta.get('agent_nickname'), meta.get('agent_path')) if x) or None
    return {'file': str(path), 'title': title, 'cwd': meta.get('cwd'), 'start': iso(start), 'end': iso(end),
            'wall_h': round((end - start) / 3600, 2), 'active_h': round(sum(b - a for a, b in spans) / 3600, 2),
            'model_calls': live['calls'], 'tool_calls': live['tools'],
            'models': {k: {'calls': v['calls'], 'effort': dict(v['effort'])} for k, v in sorted(live['models'].items())},
            'tokens': {k: live['tokens'][k] for k in CODEX_TOKENS},
            'weekly_used_pct': ends(weekly), 'credits': ends(credits),
            '_meta': meta, '_spans': spans, '_weekly': weekly[:1] + weekly[-1:], '_credits': credits[:1] + credits[-1:],
            '_plan': plan, '_resets': resets}


def codex_select(home, session=None, children=False, since=None, until=None):
    """The rollouts to read: --session (and its descendants), else every thread that can reach the window."""
    files = codex_files(home)
    started = lambda f: datetime.strptime(ROLLOUT.search(f.name).group(1), '%Y-%m-%dT%H-%M-%S').timestamp()
    if session:
        chosen = [Path(session).resolve()] if Path(session).is_file() else [
            f for f in files if ROLLOUT.search(f.name).group(2).startswith(session.lower())]
        if len(chosen) != 1:
            raise SystemExit(f'{len(chosen)} Codex threads under {home / "sessions"} match {session}: give one rollout '
                             'file or enough of one thread id')
        if children:  # a child starts after its parent, and names its parent and its root
            ids = {codex_head(f).get('id') for f in chosen} - {None}
            first = min((f.name for f in chosen if ROLLOUT.search(f.name)), default='')
            heads = {f: codex_head(f) for f in files if f.name >= first and f not in chosen}
            grew = True
            while grew:
                grew = False
                for f, h in heads.items():
                    if f not in chosen and ids & {h.get('parent_thread_id'), h.get('session_id')}:
                        chosen.append(f); ids.add(h.get('id')); grew = True
        files = chosen
    # Nothing in a file last written before --since; nothing in a thread begun after --until (a day's slack for the
    # local clock its name is written in)
    return [f for f in files if (since is None or os.path.getmtime(f) >= since)
            and (until is None or not ROLLOUT.search(f.name) or started(f) < until + 86400)]


def union_h(spans):
    total = 0; end = None
    for a, b in sorted(spans):
        if end is None or a > end:
            total += b - a; end = b
        elif b > end:
            total += b - end; end = b
    return round(total / 3600, 2)


def codex_report(home=None, session=None, children=False, since=None, until=None, cwd=None):
    """{sessions: [...], totals: {...}}: one row per thread, each root followed by its child agents."""
    home = codex_home(home); titles = codex_titles(home); rows = []; skipped = []
    for f in codex_select(home, session, children, since, until):
        try:
            if cwd and cwd.lower() not in (codex_head(f).get('cwd') or '').lower():
                continue
            r = codex_thread(f, since, until)
        except Exception as err:  # one unreadable rollout must not hide the rest
            skipped.append(f.name); print(f'skipped {f.name}: {type(err).__name__}', file=sys.stderr)
            continue
        if r:
            r['title'] = titles.get(r['_meta'].get('id')) or r['title']; rows.append(r)
    groups = {}
    for r in sorted(rows, key=lambda r: r['start']):
        groups.setdefault(r['_meta'].get('session_id') or r['_meta'].get('id') or r['file'], []).append(r)
    ordered = []; summary = []
    for root, rs in groups.items():
        rs.sort(key=lambda r: r['_meta'].get('id') != root)  # the root's own row first, then by start
        ordered += rs
        tok = collections.Counter()
        for r in rs:
            tok.update(r['tokens'])
        own = rs[0] if rs[0]['_meta'].get('id') == root else None
        summary.append({'root': root, 'file': own and own['file'], 'title': titles.get(root) or (own and own['title']),
                        'threads': len(rs), 'files': [r['file'] for r in rs],
                        'model_calls': sum(r['model_calls'] for r in rs), 'tool_calls': sum(r['tool_calls'] for r in rs),
                        'tokens': {k: tok[k] for k in CODEX_TOKENS}})
    tok = collections.Counter()
    for r in rows:
        tok.update(r['tokens'])
    snap = lambda key: sorted(x for r in rows for x in r[key])
    weekly, credits = snap('_weekly'), snap('_credits')
    plans = sorted(r['_plan'] for r in rows if r['_plan'])
    resets = max((r['_resets'] for r in rows if r['_resets']), default=None)
    t0 = min((stamp(r['start']) for r in rows), default=None); t1 = max((stamp(r['end']) for r in rows), default=None)
    totals = {'threads': len(rows), 'model_calls': sum(r['model_calls'] for r in rows),
              'tool_calls': sum(r['tool_calls'] for r in rows),
              'wall_h': round((t1 - t0) / 3600, 2) if rows else 0, 'active_h': union_h(s for r in rows for s in r['_spans']),
              'tokens': {k: tok[k] for k in CODEX_TOKENS},
              'weekly_used_pct': {'start': weekly[0][1] if weekly else None, 'end': weekly[-1][1] if weekly else None},
              'credits': {'start': credits[0][1] if credits else None, 'end': credits[-1][1] if credits else None},
              'plan_type': plans[-1][1] if plans else None, 'weekly_resets_at': iso(number(resets)),
              'since': iso(since), 'until': iso(until), 'groups': summary, 'skipped': skipped}
    return {'sessions': [{k: v for k, v in r.items() if not k.startswith('_')} for r in ordered], 'totals': totals}


def codex_print(rep, line=False):
    tot = rep['totals']; m = lambda n: f'{n / 1e6:.1f}M'
    pct = lambda t: f"{t['cached'] / t['input']:.1%}" if t['input'] else '-'
    pair = lambda d, f='{:g}': '-' if d['start'] is None else f"{f.format(d['start'])}->{f.format(d['end'])}"
    local = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone().strftime('%Y-%m-%d %H:%M')
    window = ' '.join(x for x in (tot['since'] and f"since {local(tot['since'])}",
                                  tot['until'] and f"until {local(tot['until'])}") if x) or 'whole threads'
    t = tot['tokens']
    if line:
        print(f"Codex tokens ({window}, {tot['threads']} threads): {tot['model_calls']} calls, input {m(t['input'])} "
              f"({pct(t)} cached), output {m(t['output'])}; active {tot['active_h']}h; weekly "
              f"{pair(tot['weekly_used_pct'])}%; credits {pair(tot['credits'], '{:.0f}')}.")
        return
    print(f"Codex threads, {window}; plan {tot['plan_type'] or '-'}, weekly window resets {tot['weekly_resets_at'] or '-'}")
    print(f"{'start (local)':<16} {'wall_h':>6} {'act_h':>6} {'calls':>6} {'tools':>6} {'input':>8} {'cached':>6} "
          f"{'output':>7} {'week %':>11} {'credits':>13}  title")
    rows = {r['file']: r for r in rep['sessions']}
    for g in tot['groups']:
        for r in (rows[f] for f in g['files']):
            child = r['file'] != g['file']
            print(f"{'  + ' + local(r['start'])[5:] if child else local(r['start']):<16} {r['wall_h']:>6} {r['active_h']:>6} "
                  f"{r['model_calls']:>6} {r['tool_calls']:>6} {m(r['tokens']['input']):>8} {pct(r['tokens']):>6} "
                  f"{m(r['tokens']['output']):>7} {pair(r['weekly_used_pct']):>11} {pair(r['credits'], '{:.0f}'):>13}  "
                  f"{(r['title'] or Path(r['file']).name)[:60]}")
        if g['threads'] > 1:
            print(f"{'':<16} {'':>6} {'':>6} {g['model_calls']:>6} {g['tool_calls']:>6} {m(g['tokens']['input']):>8} "
                  f"{pct(g['tokens']):>6} {m(g['tokens']['output']):>7}  = {g['threads']} threads: {g['title'] or g['root']}")
    print(f"{'total':<16} {tot['wall_h']:>6} {tot['active_h']:>6} {tot['model_calls']:>6} {tot['tool_calls']:>6} "
          f"{m(t['input']):>8} {pct(t):>6} {m(t['output']):>7} {pair(tot['weekly_used_pct']):>11} "
          f"{pair(tot['credits'], '{:.0f}'):>13}  {tot['threads']} threads, reasoning {m(t['reasoning'])}")
    if tot['skipped']:
        print(f"skipped {len(tot['skipped'])} unreadable rollouts")


def codex_main(argv):
    ap = argparse.ArgumentParser(prog='session_token_audit.py --codex', description='Token use of Codex threads.')
    ap.add_argument('--session', help='a rollout file, or a thread id or the start of one')
    ap.add_argument('--children', action='store_true', help="with --session: add the thread's child agents")
    ap.add_argument('--since', help='a date (local) or an ISO time')
    ap.add_argument('--until', help="a date (local; that day included) or an ISO time")
    ap.add_argument('--cwd-contains', help="only threads whose working folder holds this text")
    ap.add_argument('--codex-home', help='default $CODEX_HOME, else ~/.codex')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--line', action='store_true', help='one line, for a handover')
    a = ap.parse_args(argv)
    bound = lambda s, day: None if not s else stamp(s) if len(s) > 10 else (
        (datetime.fromisoformat(s) + timedelta(days=day)).astimezone().timestamp())
    since, until = bound(a.since, 0), bound(a.until, 1)
    if since is None and until is None and not a.session:
        since = time.time() - 7 * 86400
    rep = codex_report(a.codex_home, a.session, a.children, since, until, a.cwd_contains)
    if a.json:
        print(json.dumps(rep, indent=1))
    else:
        codex_print(rep, a.line)
    return 0


def main():
    if '--codex' in sys.argv[1:]:
        return codex_main([a for a in sys.argv[1:] if a != '--codex'])
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if args:
        path = Path(args[0])
    else:
        project = Path.home() / '.claude' / 'projects' / str(Path.cwd()).replace('/', '-').replace('\\', '-').replace(':', '-')
        files = sorted(project.glob('*.jsonl'), key=os.path.getmtime)
        if not files:
            sys.exit(f'no transcripts under {project}')
        path = files[-1]
    tot, byday, ctx, models = scan(path)
    base = path.with_suffix('')
    subs = glob.glob(f'{base}/subagents/**/*.jsonl', recursive=True) + glob.glob(f'{base}/workflows/**/*.jsonl', recursive=True)
    st = collections.Counter(); sn = 0
    for f in subs:
        t, _, c, _ = scan(f); st.update(t); sn += len(c)
    m = lambda n: f'{n / 1e6:.1f}M'
    if '--line' in sys.argv:
        print(f'Session tokens ({path.stem[:8]}): {len(ctx)} calls, read {m(read_total(tot))}, wrote {m(tot["output_tokens"])}; '
              f'context first {ctx[0] // 1000 if ctx else 0}k, last {ctx[-1] // 1000 if ctx else 0}k; '
              f'agents and workflows {sn} calls, read {m(read_total(st))}.')
        return 0
    print(path.name, 'calls', len(ctx), dict(models))
    print(' read', m(read_total(tot)), {k: m(v) for k, v in tot.items()})
    if ctx:
        print(f' context: first {ctx[0]:,}, median {sorted(ctx)[len(ctx) // 2]:,}, last {ctx[-1]:,}')
    for d in sorted(byday):
        print(' ', d, {k: m(v) for k, v in byday[d].items()})
    print('agents and workflows: files', len(subs), 'calls', sn, 'read', m(read_total(st)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
