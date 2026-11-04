"""Failure modes: items that are the same failure, grouped, and whether each came back after a guard existed.

A mode's key is its stage, its floor group (or the floor theme, or 'ungrouped') and its normalised what: the three
words its items share most. Items are taken oldest first; each joins the mode of its group whose words it is closest to
(cosine with the mode's word counts, at least LINK) or starts one. Comparing with the whole mode, never one member,
stops a chain of near neighbours swallowing everything. A mode is linked to the config/failures.json entries among its items, the entries whose
`related` names one of its learnings, and an entry whose own words match the mode closely (MATCH).

A repeat is an item dated after the mode was first guarded: the earliest date a linked failure entry was guarded, or a
linked learning encoded. That is the measure the loop drives down ("a repeated failure", in Krish's words).
"""
from __future__ import annotations

from collections import Counter

from . import common

LINK = 0.22
MATCH = 0.3


def _words(it: dict) -> set:
    return common.tokens(it['what']) | common.tokens(it['his_words'])


def _components(items: list[dict]) -> list[list[int]]:
    order = sorted(range(len(items)), key=lambda i: (items[i]['on'] or '', str(items[i]['id'])))
    clusters: list[dict] = []
    for i in order:
        words = Counter(common.tokens(items[i]['what']) or _words(items[i]))
        best, score = None, 0.0
        for c in clusters:
            if c['group'] != items[i]['group']:
                continue
            s = common.cosine(words, c['words'])
            if s > score:
                best, score = c, s
        if best is not None and score >= LINK:
            best['members'].append(i)
            best['words'].update(words)
        else:
            clusters.append({'group': items[i]['group'], 'members': [i], 'words': Counter(words)})
    return [c['members'] for c in clusters]


def signature(members: list[dict]) -> str:
    counts = Counter(w for it in members for w in common.tokens(it['what']))
    top = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    return '-'.join(w for w, _ in top) or 'unnamed'


def guarded_on(failure: dict | None) -> str | None:
    """The day a failure entry's guard stood: its date, when it is guarded (the register adds the guard with the entry)."""
    if failure and failure.get('status') == 'guarded' and failure.get('guards'):
        return failure.get('on')
    return None


def modes(items: list[dict], regs: dict) -> list[dict]:
    """The failure modes over these items, most items first."""
    failures = {f['id']: f for f in regs['failures']['failures']}
    learnings = {lr['id']: lr for lr in regs['learnings']['learnings']}
    out = []
    for comp in _components(items):
        members = sorted((items[i] for i in comp), key=lambda it: (it['on'] or '', str(it['id'])))
        stage = Counter(it['stage'] for it in members).most_common(1)[0][0]
        group = members[0]['group']
        failure_ids = {fid for it in members for fid in it['failure_ids'] if fid in failures}
        learning_ids = {lid for it in members for lid in it['learning_ids'] if lid in learnings}
        failure_ids |= {fid for fid, f in failures.items() if set(f.get('related') or []) & learning_ids}
        words = set().union(*(_words(it) for it in members))
        for fid, f in failures.items():
            if fid not in failure_ids and common.cosine(common.tokens(f.get('what', '') + ' ' + (f.get('symptom') or '')), words) >= MATCH:
                failure_ids.add(fid)
        guard_dates = [d for d in (guarded_on(failures[fid]) for fid in failure_ids) if d]
        guard_dates += [learnings[lid]['on'] for lid in learning_ids if learnings[lid].get('status') != 'open' and learnings[lid].get('encoded')]
        since = min(guard_dates) if guard_dates else None
        defining = {fid for fid in failure_ids if guarded_on(failures[fid]) == since} | \
                   {lid for lid in learning_ids if learnings[lid]['on'] == since}
        repeats = [it for it in members if since and (it['on'] or '') > since and it['id'] not in defining]
        key = f'{stage}/{group}/{signature(members)}'
        out.append({
            'key': key, 'stage': stage, 'group': group, 'items': members, 'failure_ids': sorted(failure_ids),
            'learning_ids': sorted(learning_ids), 'guarded_since': since, 'repeats': repeats,
            'dates': sorted({it['on'] for it in members if it['on']}),
        })
    out.sort(key=lambda m: (-len(m['repeats']), -len(m['items']), m['key']))
    return out


def is_repeat(item: dict, mode: dict) -> bool:
    return any(r is item or (r['id'] is not None and r['id'] == item['id']) for r in mode['repeats'])
