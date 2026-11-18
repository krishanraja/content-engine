#!/usr/bin/env python3
"""The weekly standards check-in: the week's data for the one pinned claude.ai artifact Krish answers (Ruling, Krish,
2026-11-15: the weekly standards check-in is one pinned claude.ai artifact refreshed weekly, an exception to "No Claude
artifact, ever"). docs/STANDARDS-CHECKIN.md says how the page, this builder and his answers fit together.

    python3 scripts/standards_checkin.py                 # dry run: read the live floor, print counts only, write nothing
    python3 scripts/standards_checkin.py --apply         # apply his answers, seed the week's groups, store the payload
    python3 scripts/standards_checkin.py --self-test     # the pure parts, on synthetic rows

Code only, deterministic, no model. Each run, in order:

1. His answers. Every standards_checkin_decisions row not yet applied goes through the one decision write the 23
   groups went through on 15 Nov (apps/control-plane/api/_learningDecision.ts: status changes only while 'proposed',
   decided_by 'Krish', decision_note only for a correction). 'amend' on a decided group adds a
   taste_floor_group_amendments row (supabase/migrations/20261204090000_floor_group_amendments.sql), never an overwrite.
2. New floor standards. Every standard on config/rejection-floor.json that config/floor-groups.json does not place is
   proposed into a group: beside the decided group whose members share its theme most (at least two), as that group's
   evolution (a new key, "<parent>_e<yymmdd>", titled as adding to it, so the 4 Nov decision is never rewritten); else
   into a new group by theme. --apply seeds those groups as proposals (scripts/floor_group.py's seed, the week's
   batch) and writes config/floor-groups.json for the workflow's pull request.
3. Evolutions. His amendments, and standards that supersede an older version, since the last check-in.
4. Why. For every item: his quotes (taste_rejection_quotes: text, said_at, said_where), the piece and item they were
   about (taste_rejections), and up to two stills (taste_rejection_media) as JPEGs of 60 KB or less.

This repository and its Actions logs are public, so it prints counts and keys only, never his words or a still; the
payload goes only to the database (standards_checkins). Database access is the Supabase management API, as
scripts/floor_group.py --seed (SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF), never a key in this file.
"""
import argparse
import base64
import datetime as dt
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import floor_group  # noqa: E402

VENTURE = 'publication'
MAX_STILLS = 2
STILL_BYTES = 60 * 1024
MAX_QUOTES = 5
DECIDED = ('approved', 'corrected')
CHOICE_STATUS = {'approve': 'approved', 'corrected': 'corrected', 'reject': 'rejected'}
ITEM = re.compile(r'^(group|evolution|standard):([A-Za-z0-9_]{1,80})$')


# ---------------------------------------------------------------- pure parts

def sid(fingerprint):
    return 's' + str(fingerprint)[:10]


def placed(groups):
    out = {}
    for g in groups.get('groups') or []:
        for m in g.get('members') or []:
            out[m] = g['key']
    for m in (groups.get('operating') or {}).get('members') or []:
        out[m] = 'operating'
    return out


def decided_words(group, db_group):
    """The words he decided for a group: his latest amendment, else his correction, else the group's own words."""
    if db_group:
        if db_group.get('amendment'):
            return db_group['amendment']
        if db_group.get('status') == 'corrected' and db_group.get('decision_note'):
            return db_group['decision_note']
    return group.get('never_beneath')


def prune(floor, groups):
    """Take out of the grouping every standard the floor no longer holds, in place, and return them as
    {id: where}. The Rejections engine retires a standard when a newer one supersedes it: on 18 Nov the floor dropped
    61 operating holds, the grouping still named them, and the check-in stopped with "not a standard on the floor".
    A retired standard's successor is on the floor as a new id, so it is grouped as new below; a group is never
    emptied silently (the check still refuses a group with no members)."""
    ids = set(floor.get('standards') or {})
    retired = {}
    for g in groups.get('groups') or []:
        gone = [m for m in g.get('members') or [] if m not in ids]
        for m in gone:
            retired[m] = g.get('key', '')
        g['members'] = [m for m in g.get('members') or [] if m in ids]
    op = groups.get('operating') or {}
    gone = [m for m in op.get('members') or [] if m not in ids]
    for m in gone:
        retired[m] = 'operating'
    if op:
        op['members'] = [m for m in op.get('members') or [] if m in ids]
    return dict(sorted(retired.items()))


def propose(floor, groups, db_groups, week_of):
    """Every standard the grouping does not place, proposed into a group. Returns (new_groups, evolutions_of):
    new_groups are floor-groups.json entries (an evolution carries 'evolves'); evolutions_of maps a new key to its
    parent's key. Deterministic: sorted by standard id, ties broken by group key."""
    standards = floor.get('standards') or {}
    where = placed(groups)
    loose = sorted(ref for ref in standards if ref not in where)
    if not loose:
        return [], {}
    stamp = dt.date.fromisoformat(week_of).strftime('%y%m%d')
    by_key = {g['key']: g for g in groups.get('groups') or []}
    theme_count = {}
    for g in groups.get('groups') or []:
        theme_count[g['key']] = Counter(standards.get(m, {}).get('theme') for m in g.get('members') or [])
    buckets = {}
    for ref in loose:
        theme = standards[ref].get('theme')
        best, best_n = None, 1
        for key in sorted(theme_count):
            n = theme_count[key].get(theme, 0)
            if n > best_n:
                best, best_n = key, n
        decided = best is not None and (db_groups.get(best) or {}).get('status') in DECIDED
        if decided:
            new_key = f'{best}_e{stamp}'[:63]
            buckets.setdefault(new_key, {'parent': best, 'members': []})['members'].append(ref)
        else:
            slug = re.sub(r'[^a-z0-9]+', '_', str(theme or 'other').lower()).strip('_') or 'other'
            new_key = f'new_{slug}_{stamp}'[:63]
            if best is not None:  # a parent he has not decided yet: the members join a new group, said beside it
                buckets.setdefault(new_key, {'parent': None, 'near': best, 'members': []})['members'].append(ref)
            else:
                buckets.setdefault(new_key, {'parent': None, 'members': []})['members'].append(ref)
    new_groups, evolves = [], {}
    for key in sorted(buckets):
        b = buckets[key]
        members = b['members']
        first = standards[members[0]]
        if b['parent']:
            parent = by_key[b['parent']]
            evolves[key] = b['parent']
            entry = {'key': key, 'title': f'{parent["title"]} (evolution, week of {week_of})'[:120],
                     'never_beneath': decided_words(parent, db_groups.get(b['parent'])),
                     'check': parent['check'], 'members': members, 'evolves': b['parent']}
        else:
            theme = str(first.get('theme') or 'other').replace('_', ' ')
            entry = {'key': key, 'title': f'New: {theme} (week of {week_of})'[:120],
                     'never_beneath': str(first.get('never_beneath') or '').strip(),
                     'check': str(first.get('check_before_delivery') or '').strip(), 'members': members}
            if b.get('near'):
                entry['near'] = b['near']
        new_groups.append(entry)
    return new_groups, evolves


def apply_choice(decision, group_row):
    """What one of his answers does, as a plan: ('status', status, note), ('amend', words), or ('skip', reason)."""
    m = ITEM.match(str(decision.get('item_key') or ''))
    if not m:
        return ('skip', 'unknown item')
    kind, _ = m.groups()
    choice = decision.get('choice')
    if decision.get('decided_by') != 'Krish':
        return ('skip', 'not decided by Krish')
    if kind == 'standard':
        return ('skip', 'a standard is decided through its group')
    if group_row is None:
        return ('skip', 'no such group')
    if choice == 'amend':
        if group_row.get('status') not in DECIDED:
            return ('skip', 'only a decided group is amended')
        return ('amend', decision['words'])
    if choice not in CHOICE_STATUS:
        return ('skip', 'unknown choice')
    if group_row.get('status') != 'proposed':
        return ('skip', 'already decided')
    note = decision.get('words') if choice == 'corrected' else None
    return ('status', CHOICE_STATUS[choice], note)


def still(b64, max_bytes=STILL_BYTES):
    """A stored still as a JPEG of max_bytes or less, base64; None when it cannot be made that small."""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(base64.b64decode(b64)))
        im = im.convert('RGB')
    except Exception:  # noqa: BLE001 - a frame that is not an image is left out, never fatal
        return None
    width = min(im.width, 720)
    while width >= 160:
        frame = im.resize((width, max(1, round(im.height * width / im.width))))
        for quality in (80, 68, 56, 44):
            buf = io.BytesIO()
            frame.save(buf, 'JPEG', quality=quality, optimize=True)
            if buf.tell() <= max_bytes:
                return base64.b64encode(buf.getvalue()).decode('ascii')
        width = int(width * 0.75)
    return None


def why(quote_ids, quotes, rejections, media, limit_quotes=MAX_QUOTES):
    """His words, the content they were about, and up to two stills, for one item."""
    out, used_stills = [], 0
    for qid in quote_ids:
        q = quotes.get(qid)
        if not q or q.get('attribution') != 'krish_words':
            continue
        about = [r for r in rejections if qid in (r.get('quote_ids') or [])]
        stills = []
        for r in about:
            for sha in r.get('media_sha256') or []:
                if used_stills >= MAX_STILLS or sha not in media:
                    continue
                jpeg = still(media[sha])
                if jpeg:
                    stills.append({'sha256': sha, 'mime': 'image/jpeg', 'b64': jpeg})
                    used_stills += 1
        out.append({'quote': q['text'], 'said_at': q.get('said_at'), 'said_where': q.get('said_where'),
                    'content': [{'piece': r.get('piece'), 'item': r.get('item')} for r in about][:3], 'stills': stills})
        if len(out) >= limit_quotes:
            break
    return out


# ---------------------------------------------------------------- the database

def sql(query):
    return floor_group.sql_api(query)


def text_array(values):
    return floor_group.literal(sorted(set(values)))


def read_live(since):
    groups = sql("""select g.key, g.title, g.never_beneath, g.check_text, g.member_fingerprints, p.id as proposal_id,
        p.status, p.decided_at, p.decision_note,
        (select a.statement from public.taste_floor_group_amendments a where a.group_key = g.key and a.decided_by = 'Krish'
          order by a.decided_at desc limit 1) as amendment
        from public.taste_floor_groups g left join public.mindmake_studio_learning_proposals p on p.id = g.proposal_id""")
    fresh = sql(f"""select id, fingerprint, statement, theme, quote_ids, supersedes, status, created_at
        from public.taste_floor_standards where venture = '{VENTURE}' and status in ('candidate', 'proposed')
        and created_at > '{since}'::timestamptz""")
    amendments = sql(f"""select group_key, statement, decided_at, source from public.taste_floor_group_amendments
        where created_at > '{since}'::timestamptz order by decided_at""")
    return {r['key']: r for r in groups}, fresh, amendments


def read_why(quote_ids):
    if not quote_ids:
        return {}, [], {}
    ids = floor_group.literal(sorted(set(quote_ids)))
    quotes = sql(f"""select id, text, said_at, said_where, attribution from public.taste_rejection_quotes
        where id::text in (select jsonb_array_elements_text({ids}))""")
    rejections = sql(f"""select id, piece, item, quote_ids, media_sha256 from public.taste_rejections
        where withdrawn_at is null and venture = '{VENTURE}'
        and quote_ids && array(select jsonb_array_elements_text({ids}))::uuid[]""")
    shas = sorted({sha for r in rejections for sha in r.get('media_sha256') or []})
    media = {}
    if shas:
        rows = sql(f"""select distinct on (sha256) sha256, encode(bytes, 'base64') as b64 from public.taste_rejection_media
            where sha256 in (select jsonb_array_elements_text({floor_group.literal(shas)}))
            and mime like 'image/%' order by sha256, created_at""")
        media = {r['sha256']: r['b64'].replace('\n', '') for r in rows}
    return {r['id']: r for r in quotes}, rejections, media


def apply_decisions():
    rows = sql("""select d.id, d.item_key, d.choice, d.words, d.decided_by, c.week_of from public.standards_checkin_decisions d
        join public.standards_checkins c on c.id = d.checkin_id where d.applied_at is null order by d.decided_at""")
    done = Counter()
    for d in rows:
        key = d['item_key'].split(':', 1)[1]
        found = sql(f"""select g.key, p.id as proposal_id, p.status from public.taste_floor_groups g
            join public.mindmake_studio_learning_proposals p on p.id = g.proposal_id
            where g.key = {floor_group.literal([key])}->>0""")
        plan = apply_choice(d, found[0] if found else None)
        if plan[0] == 'status':
            note = 'null' if plan[2] is None else f'{floor_group.literal([plan[2]])}->>0'
            back = sql(f"""update public.mindmake_studio_learning_proposals set status = '{plan[1]}', decided_at = now(),
                decided_by = 'Krish', decision_note = coalesce({note}, decision_note)
                where id = '{found[0]['proposal_id']}' and status = 'proposed' returning status""")
            result = plan[1] if back else 'already decided'
        elif plan[0] == 'amend':
            sql(f"""insert into public.taste_floor_group_amendments (venture, group_key, statement, decided_by, source)
                values ('{VENTURE}', {floor_group.literal([key])}->>0, {floor_group.literal([plan[1]])}->>0, 'Krish',
                'standards check-in {d['week_of']}')""")
            result = 'amended'
        else:
            result = f'skipped: {plan[1]}'
        sql(f"""update public.standards_checkin_decisions set applied_at = now(), applied_result = {floor_group.literal([result])}->>0
            where id = '{d['id']}'""")
        done[result.split(':')[0]] += 1
    return dict(done)


# ---------------------------------------------------------------- the run

def build(week_of, apply):
    floor = floor_group.load(floor_group.FLOOR)
    groups = floor_group.load(floor_group.GROUPS)
    retired = prune(floor, groups)
    last = sql('select max(built_at) as at from public.standards_checkins')
    since = (last[0]['at'] if last and last[0].get('at') else
             (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).isoformat())
    applied = apply_decisions() if apply else {}
    db_groups, fresh, amendments = read_live(since)
    new_groups, evolves = propose(floor, groups, db_groups, week_of)
    in_file = set(floor.get('standards') or {})
    waiting = sorted({sid(r['fingerprint']) for r in fresh} - in_file)
    revised = [r for r in fresh if r.get('supersedes')]

    by_sid = {}
    for r in fresh:
        by_sid[sid(r['fingerprint'])] = r
    quote_ids = []
    for g in new_groups:
        for m in g['members']:
            quote_ids += (by_sid.get(m) or {}).get('quote_ids') or []
    for r in revised:
        quote_ids += r.get('quote_ids') or []
    quotes, rejections, media = read_why(quote_ids)

    items = []
    for g in new_groups:
        qids = [q for m in g['members'] for q in (by_sid.get(m) or {}).get('quote_ids') or []]
        items.append({
            'key': f'{"evolution" if g.get("evolves") else "group"}:{g["key"]}',
            'kind': f'evolution of {g["evolves"]}' if g.get('evolves') else 'new group',
            'group': {k: g.get(k) for k in ('key', 'title', 'never_beneath', 'check', 'evolves', 'near')},
            'members': [{'id': m, 'never_beneath': floor['standards'][m].get('never_beneath'),
                         'check': floor['standards'][m].get('check_before_delivery'),
                         'theme': floor['standards'][m].get('theme')} for m in g['members']],
            'choices': ['approve', 'corrected', 'reject'],
            'why': why(qids, quotes, rejections, media)})
    for a in amendments:
        items.append({'key': f'group:{a["group_key"]}', 'kind': 'amended', 'group': {'key': a['group_key']},
                      'statement': a['statement'], 'decided_at': a['decided_at'], 'source': a['source'],
                      'choices': ['amend'], 'why': []})
    for r in revised:
        items.append({'key': f'standard:{sid(r["fingerprint"])}', 'kind': 'standard revised',
                      'statement': r['statement'], 'supersedes': r['supersedes'], 'choices': [],
                      'why': why(r.get('quote_ids') or [], quotes, rejections, media)})
    payload = {'week_of': week_of, 'since': since, 'built_by': 'scripts/standards_checkin.py',
               'counts': {'new_groups': sum(1 for g in new_groups if not g.get('evolves')),
                          'evolutions': sum(1 for g in new_groups if g.get('evolves')),
                          'new_standards_grouped': sum(len(g['members']) for g in new_groups),
                          'new_standards_in_database': len(fresh), 'waiting_for_floor_file': len(waiting),
                          'amendments': len(amendments), 'standards_revised': len(revised),
                          'quotes': sum(len(i['why']) for i in items),
                          'stills': sum(len(w['stills']) for i in items for w in i['why'])},
               'applied': applied, 'items': items}

    payload['counts']['retired_from_grouping'] = len(retired)
    payload['retired'] = retired
    if apply:
        if new_groups or retired:
            groups['groups'] = (groups.get('groups') or []) + new_groups
            problems = floor_group.check(floor, groups)
            if problems:
                raise SystemExit('standards_checkin: the proposed grouping is not whole: ' + '; '.join(problems[:5]))
            floor_group.GROUPS.write_text(json.dumps(groups, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            rows = sql(f"select fingerprint, quote_ids, how_to_check from public.taste_floor_standards "
                       f"where venture = '{VENTURE}' and status in ('candidate', 'proposed')")
            seeded = []
            for item in floor_group.plan(floor, {'groups': new_groups}, rows):
                if item['key'] not in db_groups:
                    seeded += [r['key'] for r in sql(floor_group.seed_sql(item, batch=f'standards-checkin-{week_of}'))]
            payload['seeded'] = seeded
        sql(f"""insert into public.standards_checkins (week_of, payload) values ('{week_of}', {floor_group.literal(payload)})
            on conflict (week_of) do update set payload = excluded.payload, built_at = now()""")
    return payload


def self_test():
    floor = {'standards': {
        's0000000001': {'theme': 'cover', 'never_beneath': 'A cover stops the scroll.', 'check_before_delivery': 'Look.'},
        's0000000002': {'theme': 'cover', 'never_beneath': 'A cover names who.', 'check_before_delivery': 'Look.'},
        's0000000003': {'theme': 'cover', 'never_beneath': 'A cover looks like a cover.', 'check_before_delivery': 'Side by side.'},
        's0000000004': {'theme': 'pace', 'never_beneath': 'Never slow.', 'check_before_delivery': 'Watch.'}}}
    groups = {'groups': [{'key': 'covers', 'title': 'Covers', 'never_beneath': 'Covers stop the scroll.', 'check': 'Look.',
                          'members': ['s0000000001', 's0000000002']}], 'operating': {'title': 'Ops', 'members': []}}
    db = {'covers': {'status': 'approved', 'amendment': 'His amended words.'}}
    new, evolves = propose(floor, groups, db, '2026-11-22')
    keys = [g['key'] for g in new]
    ok = keys == ['covers_e261122', 'new_pace_261122'] and evolves == {'covers_e261122': 'covers'}
    ok = ok and new[0]['never_beneath'] == 'His amended words.' and new[0]['members'] == ['s0000000003']
    ok = ok and floor_group.check(floor, {'groups': groups['groups'] + new, 'operating': groups['operating']}) == []
    stale = {'groups': [{'key': 'covers', 'members': ['s0000000001', 's00000000ff']}],
             'operating': {'title': 'Ops', 'members': ['s00000000fe', 's0000000004']}}
    ok = ok and prune(floor, stale) == {'s00000000fe': 'operating', 's00000000ff': 'covers'}
    ok = ok and stale['groups'][0]['members'] == ['s0000000001'] and stale['operating']['members'] == ['s0000000004']
    undecided, _ = propose(floor, groups, {'covers': {'status': 'proposed'}}, '2026-11-22')
    ok = ok and [g['key'] for g in undecided] == ['new_cover_261122', 'new_pace_261122'] and undecided[0]['near'] == 'covers'
    ok = ok and apply_choice({'item_key': 'group:x', 'choice': 'approve', 'decided_by': 'Krish'},
                             {'status': 'proposed'}) == ('status', 'approved', None)
    ok = ok and apply_choice({'item_key': 'group:x', 'choice': 'corrected', 'words': 'His words here.', 'decided_by': 'Krish'},
                             {'status': 'proposed'}) == ('status', 'corrected', 'His words here.')
    ok = ok and apply_choice({'item_key': 'group:x', 'choice': 'approve', 'decided_by': 'Krish'},
                             {'status': 'approved'}) == ('skip', 'already decided')
    ok = ok and apply_choice({'item_key': 'group:x', 'choice': 'amend', 'words': 'New words now.', 'decided_by': 'Krish'},
                             {'status': 'approved'}) == ('amend', 'New words now.')
    ok = ok and apply_choice({'item_key': 'group:x', 'choice': 'approve', 'decided_by': 'session'},
                             {'status': 'proposed'})[0] == 'skip'
    from PIL import Image
    buf = io.BytesIO()
    Image.effect_noise((1600, 900), 90).convert('RGB').save(buf, 'PNG')
    small = still(base64.b64encode(buf.getvalue()).decode())
    ok = ok and small is not None and len(base64.b64decode(small)) <= STILL_BYTES
    w = why(['q1', 'q2'], {'q1': {'text': 'Too plain.', 'attribution': 'krish_words', 'said_where': 'chat'},
                           'q2': {'text': 'engine note', 'attribution': 'observation'}},
            [{'piece': 'p', 'item': 'card 2', 'quote_ids': ['q1'], 'media_sha256': []}], {})
    ok = ok and len(w) == 1 and w[0]['content'] == [{'piece': 'p', 'item': 'card 2'}]
    print('standards_checkin self-test: ' + ('ok' if ok else 'FAILED'))
    return 0 if ok else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--apply', action='store_true', help='apply his answers, seed the groups, write the payload')
    ap.add_argument('--week-of', default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    payload = build(a.week_of, a.apply)
    print(f'standards check-in, week of {payload["week_of"]} ({"applied" if a.apply else "dry run, nothing written"}):')
    for k, v in payload['counts'].items():
        print(f'  {k}: {v}')
    if payload['applied']:
        print(f'  answers applied: {payload["applied"]}')
    if payload.get('seeded') is not None:
        print(f'  groups seeded: {len(payload["seeded"])}')
    print(f'  payload: {len(json.dumps(payload)) // 1024} KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
