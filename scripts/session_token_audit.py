#!/usr/bin/env python3
"""Token use of one Claude Code session, from its transcript (docs/COST_AUDIT_2026-10-18.md, docs/COST_GUARDS.md).

    python3 scripts/session_token_audit.py                 # the newest session of this project
    python3 scripts/session_token_audit.py PATH.jsonl      # one transcript
    python3 scripts/session_token_audit.py --line          # one line, for a handover

Prints calls, tokens read (input + cache reads + cache writes), output, the first and last call's context, and the
same for the session's subagents and workflows. Write the --line output into the handover so the next audit is
measured, not estimated."""
import collections
import glob
import json
import os
import sys
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


def main():
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
