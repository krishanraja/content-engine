#!/usr/bin/env python3
"""The rejection floor: what Krish rejected in production work, with his words, and the standards no finished piece may
fall beneath. Read it for the format you are making before the brief, and check the finished file against it before
delivery.

    python3 scripts/floor.py                          # what each maker's floor holds, and every approved standard
    python3 scripts/floor.py --format short_video     # that maker's floor: standards, then what he rejected
    python3 scripts/floor.py --format cover --approved-only
    python3 scripts/floor.py --formats                # the makers, by name
    python3 scripts/floor.py --check                  # the file is whole and well formed (exit 1 if not)
    python3 scripts/floor.py --self-test              # the reader, on a synthetic floor (CI: tests/engine-gates.test.ts)

The file, config/rejection-floor.json, is written only by the Rejections engine (krishanraja/inspirationhouse,
src/rejection/) and changes only by a pull request Krish merges. Never edit it by hand. Krish, 2026-10-28: "It then
makes it really easy for a new session to understand what is a no-no and what kind of stuff cannot be produced."

A standard is approved or reworded by Krish, or a draft the engine read into his rejections. Reviewers and
pre-delivery checks test work against approved and reworded standards and his words, for craft and process only,
never what a piece is about (Ruling, Krish, 2026-10-28). Makers follow the drafts too.

Standard library only, offline: it runs in Codex's sandbox, which has no internet.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOOR = ROOT / 'config' / 'rejection-floor.json'


def load(path=FLOOR):
    if not path.exists():
        return None
    with path.open(encoding='utf-8') as f:
        return json.load(f)


def check(doc):
    """Problems with the file's shape, as plain sentences. Empty when it is whole."""
    problems = []
    for key in ('version', 'formats', 'standards', 'records'):
        if key not in doc:
            problems.append(f'missing {key}')
    if problems:
        return problems
    for fmt, entry in doc['formats'].items():
        for kind in ('approved', 'draft'):
            for ref in entry.get(kind, []):
                if ref not in doc['standards']:
                    problems.append(f'{fmt}: standard {ref} is listed but not in standards')
        for ref in entry.get('rejected', []):
            if ref not in doc['records']:
                problems.append(f'{fmt}: record {ref} is listed but not in records')
    for ref, s in doc['standards'].items():
        if s.get('standing') not in ('approved', 'reworded', 'draft'):
            problems.append(f'standard {ref} has no standing')
        for r in s.get('records', []):
            if r not in doc['records']:
                problems.append(f'standard {ref} cites a record that is not in records')
    return problems


def quote(words, limit=None):
    text = ' '.join(str(words).split())
    if limit and len(text) > limit:
        text = text[: limit - 3].rsplit(' ', 1)[0] + '...'
    return f'"{text}"'


def weight(s):
    """A pattern is a complaint he made about two or more productions, more critical to follow than a one-off about one
    (Krish, 2026-10-28). A floor rendered before the engine weighed standards says nothing, and is read as unweighed."""
    n = s.get('productions')
    if s.get('weight') == 'pattern':
        return f'PATTERN, raised about {n} productions'
    if s.get('weight') == 'one_off':
        return 'one-off, about one production'
    return None


def by_weight(refs, doc):
    """Patterns first, by how many productions; the file's order otherwise."""
    return sorted(refs, key=lambda ref: -(doc['standards'][ref].get('productions') or 0)
                  if doc['standards'][ref].get('weight') == 'pattern' else 0)


def standard_lines(ref, s):
    tag = {'approved': 'approved', 'reworded': 'his wording'}.get(s['standing'], 'draft, not yet approved')
    if weight(s):
        tag = f'{weight(s)}; {tag}'
    when = f' {s["decided_on"]}' if s.get('decided_on') else ''
    # The engine wrote every check; the file says whether he approved it with the statement or it is still a draft.
    by = s.get('check_by') or 'the engine, a draft'
    lines = [f'- [{tag}{when}] {s["never_beneath"]}', f'    Check before delivery ({by}): {s["check_before_delivery"]}']
    if s.get('in_his_words'):
        lines.append(f'    In his words: {quote(s["in_his_words"])}')
    elif s.get('his_words'):
        lines.append(f'    His words: {quote(s["his_words"][0]["said"], 240)} ({s["his_words"][0]["on"]})')
    for b in s.get('boundary', [])[:2]:
        lines.append(f'    But he liked: {quote(b["said"], 200)} ({b["on"]})')
    lines.append(f'    Rests on {s.get("support", 0)} thing(s) he said; records {", ".join(s.get("records", [])[:8])}  [{ref}]')
    return lines


def record_lines(ref, r):
    lines = [f'- {r["on"]} [{r["kind_label"]}] {r.get("piece") or ""}'.rstrip()]
    for w in r.get('his_words', [])[:3]:
        lines.append(f'    {w["is"].capitalize()}: {quote(w["said"], 400)}')
    if r.get('what'):
        lines.append(f'    What it was (a session\'s description): {r["what"]}')
    if r.get('wanted_instead'):
        lines.append(f'    He wanted instead: {r["wanted_instead"]}')
    for m in r.get('media', []):
        at = f' at {m["at_s"]} s' if m.get('at_s') is not None else ''
        lines.append(f'    Kept: {m["role"]}{at} (sha256 {m["sha256"][:12]}, in the floor database)')
    if r.get('liked_nearby'):
        lines.append(f'    He liked nearby: {quote(r["liked_nearby"][0]["said"], 200)}')
    lines.append(f'    [{ref}]')
    return lines


KEPT = {'still': 'still', 'moment': 'moment, clip kept', 'whole_cut': 'whole cut', 'words': 'words'}


def show_format(doc, fmt, approved_only, limit):
    entry = doc['formats'].get(fmt)
    if entry is None:
        print(f'No floor for "{fmt}" yet. Makers: {", ".join(sorted(doc["formats"]))}.')
        return 1
    print(f'The rejection floor for {fmt}: {entry["maker"]}')
    print(f'Floor version {doc["version"][:12]}, as of {doc["as_of"]}. Never ship beneath it.\n')
    approved = by_weight(entry.get('approved', []), doc)
    drafts = [] if approved_only else by_weight(entry.get('draft', []), doc)
    print(f'Approved standards ({len(approved)}): these bind every check.')
    for ref in approved:
        print('\n'.join(standard_lines(ref, doc['standards'][ref])))
    if not approved:
        print('- None approved yet. Until then, checks bind to his words below.')
    if not approved_only:
        patterns = sum(1 for ref in drafts if doc['standards'][ref].get('weight') == 'pattern')
        print(f'\nDraft standards ({len(drafts)}, {patterns} of them patterns): the engine\'s reading of his rejections. '
              'Follow them; only he approves them. A PATTERN he raised about two or more productions comes first and matters most.')
        for ref in drafts:
            print('\n'.join(standard_lines(ref, doc['standards'][ref])))
        recs = sorted(entry.get('rejected', []), key=lambda ref: doc['records'][ref]['on'], reverse=True)
        shown = recs if limit is None else recs[:limit]
        print(f'\nWhat he rejected ({len(recs)}, newest first{"" if limit is None or len(recs) <= limit else f", {limit} shown; --all for every one"}):')
        for ref in shown:
            r = dict(doc['records'][ref])
            r['kind_label'] = 'how a session worked' if r['kind'] == 'process' else KEPT.get(r.get('kept_as'), r.get('kept_as', ''))
            print('\n'.join(record_lines(ref, r)))
    return 0


def summary(doc):
    c = doc.get('counts', {})
    print(f'The rejection floor, version {doc["version"][:12]}, as of {doc["as_of"]}: {c.get("records", 0)} rejections, '
          f'{c.get("standards", 0)} standards ({c.get("approved", 0)} approved, {c.get("patterns", 0)} patterns he raised about two or more productions).')
    print('Read the one you are making: python3 scripts/floor.py --format <maker>\n')
    for fmt, entry in sorted(doc['formats'].items()):
        print(f'- {fmt}: {len(entry.get("approved", []))} approved, {len(entry.get("draft", []))} draft, '
              f'{len(entry.get("rejected", []))} rejected. {entry["maker"]}')
    approved = [(ref, s) for ref, s in doc['standards'].items() if s['standing'] != 'draft']
    if approved:
        print('\nEvery approved standard:')
        for ref, s in approved:
            print('\n'.join(standard_lines(ref, s)))
    return 0


def self_test():
    """The reader on a synthetic floor: a whole file checks clean, a broken one does not, and a maker's floor shows
    its approved standard before its drafts and the rejection with his words."""
    import contextlib
    import io
    doc = {
        'version': 'a' * 32, 'as_of': '2026-10-28', 'counts': {'records': 1, 'standards': 3, 'approved': 1, 'patterns': 1},
        'formats': {'short_video': {'maker': 'The 9:16 short cut', 'approved': ['s1'], 'draft': ['s2', 's3'], 'rejected': ['r1']}},
        'standards': {
            's1': {'standing': 'approved', 'decided_on': '2026-10-29', 'never_beneath': 'Never cut a word at a join.',
                   'check_before_delivery': 'Play every join with sound.', 'check_by': 'the engine, approved by him with the statement',
                   'formats': ['short_video'], 'support': 1,
                   'in_his_words': 'synthetic: my words chop out', 'records': ['r1'], 'boundary': [], 'his_words': []},
            's2': {'standing': 'draft', 'never_beneath': 'Never hold a still for long.', 'check_before_delivery': 'Scrub it.',
                   'formats': ['short_video'], 'support': 1, 'records': ['r1'], 'boundary': [], 'his_words': [],
                   'weight': 'one_off', 'productions': 1},
            's3': {'standing': 'draft', 'never_beneath': 'Never chop a word at a join.', 'check_before_delivery': 'Listen to every join.',
                   'formats': ['short_video'], 'support': 3, 'records': ['r1'], 'boundary': [], 'his_words': [],
                   'weight': 'pattern', 'productions': 3},
        },
        'records': {'r1': {'on': '2026-10-27', 'kind': 'rejected', 'kept_as': 'moment', 'piece': 'synthetic piece',
                           'his_words': [{'said': 'synthetic: my words chop out', 'on': '2026-10-27', 'is': 'his words'}],
                           'what': 'synthetic: a join', 'wanted_instead': None, 'media': [{'role': 'clip', 'sha256': 'b' * 64, 'at_s': 3.5}],
                           'liked_nearby': []}},
    }
    assert check(doc) == [], check(doc)
    broken = json.loads(json.dumps(doc))
    broken['formats']['short_video']['approved'].append('s9')
    assert check(broken), 'a standard listed but missing must be caught'
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        assert show_format(doc, 'short_video', False, 40) == 0
    text = out.getvalue()
    assert text.index('Never cut a word at a join.') < text.index('Never hold a still for long.'), text
    assert 'synthetic: my words chop out' in text and 'clip at 3.5 s' in text, text
    # Who wrote each check is printed with it: an approved one he saw, a draft one he has not.
    assert '(the engine, approved by him with the statement): Play every join with sound.' in text, text
    assert '(the engine, a draft): Scrub it.' in text, text
    # A pattern comes before a one-off and says how many productions he raised it about.
    assert text.index('Never chop a word at a join.') < text.index('Never hold a still for long.'), text
    assert '[PATTERN, raised about 3 productions; draft, not yet approved]' in text, text
    assert '[one-off, about one production; draft, not yet approved]' in text, text
    assert '(2, 1 of them patterns)' in text, text
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        assert show_format(doc, 'short_video', True, 40) == 0
    assert 'Never hold a still for long.' not in out.getvalue()
    with contextlib.redirect_stdout(io.StringIO()):
        assert show_format(doc, 'cover', False, 40) == 1
    print('floor.py self-test: ok')
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description='The rejection floor, by maker.')
    p.add_argument('--format', help='the maker you are: short_video, long_video, cover, card, script ...')
    p.add_argument('--formats', action='store_true', help='list the makers')
    p.add_argument('--approved-only', action='store_true', help='only the standards he approved or reworded')
    p.add_argument('--all', action='store_true', help='every rejection for the maker, not the newest 40')
    p.add_argument('--check', action='store_true', help='check the file is whole; exit 1 if not')
    p.add_argument('--self-test', action='store_true', help=argparse.SUPPRESS)
    p.add_argument('--file', type=Path, default=FLOOR, help=argparse.SUPPRESS)
    a = p.parse_args(argv)
    if a.self_test:
        return self_test()
    doc = load(a.file)
    if doc is None:
        print('No rejection floor yet: config/rejection-floor.json arrives by pull request from the Rejections engine '
              '(krishanraja/inspirationhouse). Until then, config/failures.json and config/learnings.json hold what he rejected.')
        return 0
    if a.check:
        problems = check(doc)
        for problem in problems:
            print(f'rejection floor: {problem}')
        return 1 if problems else 0
    if a.formats:
        for fmt, entry in sorted(doc['formats'].items()):
            print(f'{fmt}: {entry["maker"]}')
        return 0
    if a.format:
        return show_format(doc, a.format, a.approved_only, None if a.all else 40)
    return summary(doc)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BrokenPipeError:
        # Read through a pager or `head`: the reader stopped, which is not a failure.
        sys.exit(0)
