#!/usr/bin/env python3
"""The capability register: what every video capability is for and which production stage it serves.

    python3 scripts/capabilities.py                    # the register, grouped by stage
    python3 scripts/capabilities.py --stage motion     # one stage
    python3 scripts/capabilities.py --check            # well formed, every local path exists, the doc is current (exit 1 if not)
    python3 scripts/capabilities.py --render           # rewrite docs/CAPABILITIES.md from config/capabilities.json

The register lives in config/capabilities.json. Its keep, merge and retire proposals are Krish's to decide; this
script only reads and renders them. Paths prefixed control-center: or inspirationhouse: point into those repositories
and are checked only when a sibling clone exists.
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTER = os.path.join(ROOT, 'config', 'capabilities.json')
DOC = os.path.join(ROOT, 'docs', 'CAPABILITIES.md')
SIBLINGS = {
    'control-center': [os.path.join(os.path.dirname(ROOT), 'control-center')],
    'inspirationhouse': [os.path.join(os.path.dirname(ROOT), 'inspirationhouse'),
                         os.path.join(os.path.dirname(ROOT), 'krishanraja', 'inspirationhouse')],
}
FIELDS = ('id', 'name', 'purpose', 'stage', 'decided', 'location', 'status', 'proposal', 'overlaps')


def load(path=REGISTER):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def resolve(location):
    """(repo, absolute path or None when that repository is not cloned beside this one)."""
    if ':' in location:
        repo, rel = location.split(':', 1)
        for base in SIBLINGS.get(repo, []):
            if os.path.isdir(base):
                return repo, os.path.join(base, rel)
        return repo, None
    return 'content-engine', os.path.join(ROOT, location)


def problems(doc):
    out = []
    ids = set()
    for key in ('stages', 'decided', 'status', 'proposal'):
        if not isinstance(doc.get(key), list) or not doc[key]:
            out.append(f'missing vocabulary: {key}')
    caps = doc.get('capabilities') or []
    if not caps:
        out.append('no capabilities')
    for c in caps:
        cid = c.get('id', '?')
        for f in FIELDS:
            if f not in c:
                out.append(f'{cid}: missing {f}')
        if cid in ids:
            out.append(f'{cid}: duplicate id')
        ids.add(cid)
        for key, field in (('stages', 'stage'), ('decided', 'decided'), ('status', 'status'), ('proposal', 'proposal')):
            if c.get(field) not in (doc.get(key) or []):
                out.append(f'{cid}: {field} {c.get(field)!r} is not in {key}')
        repo, path = resolve(c.get('location', ''))
        if repo != 'content-engine' and repo not in doc.get('repos', {}):
            out.append(f'{cid}: unknown repository {repo}')
        elif path is not None and not os.path.exists(path):
            out.append(f'{cid}: location does not exist: {c.get("location")}')
    return out


def render(doc):
    lines = [
        '# Capabilities',
        '',
        'Rendered from `config/capabilities.json` by `python3 scripts/capabilities.py --render`; edit the JSON, never this',
        'file. Reference, not a state document: `NOW.md` and `docs/STATE.md` stay the only current-state documents.',
        '',
        'Each capability says what it is for, the production stage it serves, when its choice is made today, its status,',
        "and a keep, merge or retire proposal that is Krish's to decide.",
        '',
    ]
    caps = doc['capabilities']
    for stage in doc['stages']:
        rows = [c for c in caps if c['stage'] == stage]
        if not rows:
            continue
        lines += [f'## {stage}', '', '| Capability | For | Decided | Status | Proposal | Where | Overlaps |',
                  '|---|---|---|---|---|---|---|']
        for c in rows:
            lines.append('| {name} (`{id}`) | {purpose} | {decided} | {status} | {proposal} | `{location}` | {ov} |'.format(
                ov=', '.join(c['overlaps']) or '', **c))
        lines.append('')
    counts = {}
    for c in caps:
        counts[c['proposal']] = counts.get(c['proposal'], 0) + 1
    lines += ['## Totals', '', f'{len(caps)} capabilities. Proposals: ' +
              ', '.join(f'{k} {counts.get(k, 0)}' for k in doc['proposal']) + '.', '']
    return '\n'.join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--stage')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--render', action='store_true')
    a = ap.parse_args(argv)
    doc = load()
    if a.check:
        out = problems(doc)
        current = os.path.exists(DOC) and open(DOC, encoding='utf-8').read() == render(doc)
        if not current:
            out.append('docs/CAPABILITIES.md is not current: run python3 scripts/capabilities.py --render')
        for p in out:
            print('capabilities:', p, file=sys.stderr)
        print(f'capabilities: {len(doc.get("capabilities", []))} entries, {len(out)} problems')
        return 1 if out else 0
    if a.render:
        out = problems(doc)
        if out:
            for p in out:
                print('capabilities:', p, file=sys.stderr)
            return 1
        with open(DOC, 'w', encoding='utf-8') as f:
            f.write(render(doc))
        print(f'wrote {os.path.relpath(DOC, ROOT)}')
        return 0
    for c in doc['capabilities']:
        if a.stage and c['stage'] != a.stage:
            continue
        print(f"{c['stage']:<11} {c['decided']:<12} {c['status']:<16} {c['proposal']:<7} {c['id']}: {c['purpose']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
