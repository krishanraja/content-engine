#!/usr/bin/env python3
"""The rejection floor, grouped for Krish's approval (Krish, 2026-11-04: "group the 215 floor standards for my
approval").

    python3 scripts/floor_group.py --check     # every floor standard sits in exactly one group or operating (exit 1 if not)
    python3 scripts/floor_group.py --seed      # put each group to him once: a taste_floor_groups row and its proposal
    python3 scripts/floor_group.py --self-test # the check, on synthetic files

config/floor-groups.json sorts the standards of config/rejection-floor.json (ids are `s` and the first 10 characters of
taste_floor_standards.fingerprint) into about 20 groups he decides at /standards, and `operating`, the standards about
how sessions work with him, which are reconciled against AGENTS.md and the failure loop and never put to him as taste.

--check holds the two files together, so a floor that gains a standard fails CI until the standard is grouped. It is
standard library only and offline.

--seed writes through the Supabase management API (SUPABASE_ACCESS_TOKEN, project SUPABASE_PROJECT_REF), skips a key
already seeded, and never decides anything: each group goes in as a proposal (status proposed) for his press. A member
takes its group's decision in the view public.taste_floor (supabase/migrations/20261124090000_floor_groups.sql).
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOOR = ROOT / 'config' / 'rejection-floor.json'
GROUPS = ROOT / 'config' / 'floor-groups.json'
BATCH = 'floor-groups-2026-11-04'
VENTURE = 'publication'
DEFAULT_PROJECT = 'gojpffsrxybbpbdzzrvs'
KEY = re.compile(r'^[a-z][a-z0-9_]{1,63}$')
DASHES = ('—', '–')
MAX_QUOTES = 5


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def check(floor, groups):
    """The problems with the grouping, as plain lines; none means whole."""
    out = []
    ids = set((floor.get('standards') or {}).keys())
    where = {}
    for g in groups.get('groups') or []:
        key = g.get('key', '')
        if not KEY.match(str(key)):
            out.append(f'group {key!r}: a key is lower case letters, digits and underscores')
        for field in ('title', 'never_beneath', 'check'):
            text = str(g.get(field) or '').strip()
            if len(text) < 3:
                out.append(f'group {key}: no {field}')
            if any(d in text for d in DASHES):
                out.append(f'group {key}: its {field} has a long dash')
        if not g.get('members'):
            out.append(f'group {key}: no members')
        for m in g.get('members') or []:
            where.setdefault(m, []).append(key)
    op = groups.get('operating') or {}
    if any(d in str(op.get('title') or '') for d in DASHES):
        out.append('operating: its title has a long dash')
    for m in op.get('members') or []:
        where.setdefault(m, []).append('operating')
    keys = [g.get('key') for g in groups.get('groups') or []]
    for k in sorted({k for k in keys if keys.count(k) > 1}):
        out.append(f'group {k}: the key is used twice')
    for m, at in sorted(where.items()):
        if len(at) > 1:
            out.append(f'{m}: in {len(at)} places ({", ".join(at)}); a standard sits in exactly one')
        if m not in ids:
            out.append(f'{m}: not a standard on the floor (config/rejection-floor.json)')
    for m in sorted(ids - set(where)):
        out.append(f'{m}: on the floor but in no group and not operating; group it in config/floor-groups.json')
    return out


def card(floor, g):
    """What the page shows beside the decision: the counts, his best words verbatim, and the member standards."""
    standards = floor['standards']
    members = [(m, standards[m]) for m in g['members']]
    members.sort(key=lambda x: (-(x[1].get('productions') or 0), x[0]))
    records = set()
    for _, s in members:
        records.update(s.get('records') or [])
    quotes, seen = [], set()
    for pick_first in (True, False):
        for _, s in members:
            said = []
            if pick_first and s.get('in_his_words'):
                said = [{'said': s['in_his_words'], 'on': next((w.get('on') for w in s.get('his_words') or []
                                                                if w.get('said') == s['in_his_words']), None)}]
            elif not pick_first:
                said = [{'said': w.get('said'), 'on': w.get('on')} for w in s.get('his_words') or [] if w.get('is') == 'his words']
            for q in said:
                text = str(q.get('said') or '').strip()
                norm = re.sub(r'\s+', ' ', text).lower()
                if not text or norm in seen or len(text) > 500:
                    continue
                seen.add(norm)
                quotes.append({'said': text, 'on': q.get('on')})
                if len(quotes) >= MAX_QUOTES:
                    break
            if len(quotes) >= MAX_QUOTES:
                break
    return {
        'standards': len(members),
        'productions': len(records),
        'quotes': quotes[:MAX_QUOTES],
        'members': [{'id': m, 'never_beneath': s.get('never_beneath'), 'check': s.get('check_before_delivery'),
                     'weight': s.get('weight'), 'productions': s.get('productions')} for m, s in members],
    }


def sql_api(query):
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        raise SystemExit('floor_group: --seed needs SUPABASE_ACCESS_TOKEN (the Supabase management key) in the environment')
    project = os.environ.get('SUPABASE_PROJECT_REF') or DEFAULT_PROJECT
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{project}/database/query',
                                 data=json.dumps({'query': query}).encode('utf-8'), method='POST',
                                 headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8') or '[]')


def literal(value):
    """A JSON document as a dollar-quoted SQL literal, with a tag its text cannot contain."""
    text = json.dumps(value, ensure_ascii=False)
    tag = 'j'
    while f'${tag}$' in text:
        tag += 'j'
    return f'${tag}${text}${tag}$::jsonb'


def plan(floor, groups, rows):
    """The groups to seed, each with its members' full fingerprints, evidence and checks from the database rows."""
    by_id = {}
    for r in rows:
        sid = 's' + r['fingerprint'][:10]
        if sid in by_id:
            raise SystemExit(f'floor_group: two open standards share the id {sid}; the floor ids are no longer unique')
        by_id[sid] = r
    out = []
    for g in groups['groups']:
        missing = [m for m in g['members'] if m not in by_id]
        if missing:
            raise SystemExit(f'floor_group: group {g["key"]} names standards that are not open on the floor: {missing}')
        members = [by_id[m] for m in g['members']]
        evidence, seen = [], set()
        for r in members:
            for q in r['quote_ids'] or []:
                if q not in seen:
                    seen.add(q)
                    evidence.append(q)
        c = card(floor, g)
        assertion = f'{g["title"]}. Never beneath: {g["never_beneath"]} Check before delivery: {g["check"]}'
        out.append({
            'key': g['key'], 'title': g['title'], 'never_beneath': g['never_beneath'], 'check': g['check'],
            'fingerprints': [r['fingerprint'] for r in members],
            'card': c,
            'assertion': assertion[:1600],
            'scope': {'source': 'rejections_group', 'key': g['key'], 'venture': VENTURE, 'members': len(members),
                      'productions': c['productions']},
            'evidence': evidence[:100],
            'sessions': max(1, c['productions']),
            'regression_cases': [{'standard': m, 'how_to_check': by_id[m]['how_to_check']} for m in g['members']],
            'proposed_change': {'key': g['key'], 'never_beneath': g['never_beneath'], 'check': g['check'],
                                'member_ids': g['members']},
        })
    return out


def seed_sql(item):
    """One group and its proposal, written together, and only while the key is unseeded."""
    return f"""
with g as (select {literal(item)} as j),
fresh as (select j from g where not exists (select 1 from public.taste_floor_groups t where t.key = j->>'key')),
p as (
  insert into public.mindmake_studio_learning_proposals
    (weekly_batch_id, proposal_class, assertion, scope, evidence_event_ids, independent_session_count,
     independent_job_count, counterexamples, regression_cases, proposed_change)
  select '{BATCH}', 'taste', j->>'assertion', j->'scope',
         array(select jsonb_array_elements_text(j->'evidence'))::uuid[], (j->>'sessions')::int, 0, '[]'::jsonb,
         j->'regression_cases', j->'proposed_change'
  from fresh
  returning id)
insert into public.taste_floor_groups (venture, key, title, never_beneath, check_text, member_fingerprints, card, proposal_id)
select '{VENTURE}', j->>'key', j->>'title', j->>'never_beneath', j->>'check',
       array(select jsonb_array_elements_text(j->'fingerprints')), j->'card', (select id from p)
from fresh
returning key;"""


def seed(floor, groups):
    problems = check(floor, groups)
    if problems:
        raise SystemExit('floor_group: the grouping is not whole; fix it before seeding:\n  ' + '\n  '.join(problems))
    rows = sql_api(f"select fingerprint, quote_ids, how_to_check from public.taste_floor_standards "
                   f"where venture = '{VENTURE}' and status in ('candidate', 'proposed')")
    done = {r['key'] for r in sql_api('select key from public.taste_floor_groups')}
    made = []
    for item in plan(floor, groups, rows):
        if item['key'] in done:
            continue
        made += [r['key'] for r in sql_api(seed_sql(item))]
    back = sql_api(f"select g.key, cardinality(g.member_fingerprints) as members, p.status from public.taste_floor_groups g "
                   f"join public.mindmake_studio_learning_proposals p on p.id = g.proposal_id "
                   f"where p.weekly_batch_id = '{BATCH}' order by g.key")
    print(f'seeded {len(made)} group(s); {len(back)} on batch {BATCH}:')
    for r in back:
        print(f'  {r["key"]}: {r["members"]} standards, {r["status"]}')
    return back


def self_test():
    floor = {'standards': {'s0000000001': {'productions': 2, 'records': ['r1', 'r2'], 'in_his_words': 'Too dull.',
                                           'his_words': [{'said': 'Too dull.', 'on': '2026-10-01', 'is': 'his words'}],
                                           'never_beneath': 'Never dull.', 'check_before_delivery': 'Look again.'},
                           's0000000002': {'productions': 1, 'records': ['r2'], 'his_words': [], 'never_beneath': 'n', 'check_before_delivery': 'c'},
                           's0000000003': {'productions': 1, 'records': ['r3'], 'his_words': []}}}
    good = {'groups': [{'key': 'dull', 'title': 'Never dull', 'never_beneath': 'Nothing dull ships.', 'check': 'Look once more.',
                        'members': ['s0000000001', 's0000000002']}],
            'operating': {'title': 'How sessions work', 'members': ['s0000000003']}}
    ok = check(floor, good) == []
    bad = json.loads(json.dumps(good))
    bad['groups'][0]['members'].append('s0000000003')
    bad['groups'][0]['title'] = 'Never — dull'
    bad['operating']['members'] = []
    bad['groups'].append({'key': 'empty', 'title': 'Empty', 'never_beneath': 'Nothing here.', 'check': 'Nothing here.', 'members': []})
    found = '\n'.join(check(floor, bad))
    ok = ok and 'long dash' in found and 'no members' in found
    missing = json.loads(json.dumps(good))
    missing['operating']['members'] = []
    ok = ok and any('in no group' in p for p in check(floor, missing))
    twice = json.loads(json.dumps(good))
    twice['operating']['members'].append('s0000000001')
    ok = ok and any('in 2 places' in p for p in check(floor, twice))
    c = card(floor, good['groups'][0])
    ok = ok and c['productions'] == 2 and c['standards'] == 2 and c['quotes'] == [{'said': 'Too dull.', 'on': '2026-10-01'}]
    ok = ok and '$jj$' in literal({'x': 'a $j$ b'})
    print('floor_group self-test: ' + ('ok' if ok else 'FAILED'))
    return 0 if ok else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--check', action='store_true', help='every floor standard sits in exactly one group or operating')
    ap.add_argument('--seed', action='store_true', help='write each unseeded group and its proposal (never decides)')
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--floor', default=str(FLOOR))
    ap.add_argument('--groups', default=str(GROUPS))
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    floor, groups = load(a.floor), load(a.groups)
    if a.seed:
        seed(floor, groups)
        return 0
    problems = check(floor, groups)
    if problems:
        print('floor_group: the grouping is not whole:\n  ' + '\n  '.join(problems))
        return 1
    n = sum(len(g['members']) for g in groups['groups'])
    print(f'floor_group: {len(groups["groups"])} groups hold {n} standards and operating holds '
          f'{len(groups["operating"]["members"])}; all {len(floor["standards"])} on the floor sit in exactly one')
    return 0


if __name__ == '__main__':
    sys.exit(main())
