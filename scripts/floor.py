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

The bar comes first for a video maker. Krish, 2026-10-28: "the video production quality standards for the latest
Friday (AI Passports) and Monday (character.ai) pieces are the floor for what I expect". config/reference-cuts.json
names those cuts and the quality names of docs/production/THE_BAR.md; --format prints a short version of it before
the rejection standards for every maker it applies to, and --check holds the two files together. It carries no
hashes or file ids (they stay in the file) and no measured value: those describe the references, never targets.

Standard library only, offline: it runs in Codex's sandbox, which has no internet.
"""
import argparse
import json
import re
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOOR = ROOT / 'config' / 'rejection-floor.json'
BAR = ROOT / 'config' / 'reference-cuts.json'
NO_FLOOR = ('No rejection floor yet: config/rejection-floor.json arrives by pull request from the Rejections engine '
            '(krishanraja/inspirationhouse). Until then, config/failures.json and config/learnings.json hold what he rejected.')


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

# The bar: the finished cuts Krish named as the production quality floor (config/reference-cuts.json).
FAMILIES = {'voiceover': 'voiceover', 'split_screen': 'split screen'}
STAMP = re.compile(r'^\d\d:\d\d(\.\d+)?$')
SHA256 = re.compile(r'^[0-9a-f]{64}$')
# A measured reading of a reference (its length, shape, cuts, timings, levels, tempo or colours) is context, never a
# target (Krish, 2026-10-28: "you are only to look for production quality standards"). None may be written into the
# references, where a brief or a check could read one as a standard.
MEASURED = {'duration', 'duration_s', 'length', 'length_s', 'seconds', 'runtime', 'aspect', 'aspect_ratio',
            'resolution', 'width', 'height', 'fps', 'frame_rate', 'bitrate', 'cut_count', 'cuts_per_minute',
            'scene_changes', 'events_per_second', 'caption_changes', 'bpm', 'tempo', 'lufs', 'loudness',
            'true_peak', 'loudness_range', 'palette', 'sampled_palette', 'hex'}


def load_bar(path=BAR):
    if not path.exists():
        return None
    with path.open(encoding='utf-8') as f:
        return json.load(f)


def applies(bar, fmt):
    return bool(bar) and fmt in bar.get('applies_to_makers', [])


def bar_headings(text):
    """The quality headings of the bar's page, in order, without their numbers."""
    names, inside = [], False
    for line in text.splitlines():
        if line.startswith('## '):
            inside = line.strip() == '## The qualities'
        elif inside and line.startswith('### '):
            names.append(re.sub(r'^\d+\.\s+', '', line[4:].strip()))
    return names


def measured_keys(node, at=''):
    found = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key.lower() in MEASURED:
                found.append(at + key)
            found += measured_keys(value, f'{at}{key}.')
    elif isinstance(node, list):
        for i, value in enumerate(node):
            found += measured_keys(value, f'{at}{i}.')
    return found


def bar_problems(bar, page):
    """Problems with the references and their page, as plain sentences. Empty when they are whole and agree.
    `page` is the text of the bar's page, or None when it is missing."""
    problems = []
    for key in ('doc', 'ruling', 'principle', 'measured_values', 'applies_to_makers', 'qualities', 'references',
                'reference_moments'):
        if not bar.get(key):
            problems.append(f'missing {key}')
    if problems:
        return problems
    if not bar['ruling'].get('words') or not bar['ruling'].get('on'):
        problems.append('the ruling has no words or no date')
    if 'never' not in bar['measured_values'] or 'target' not in bar['measured_values']:
        problems.append('measured_values must say measured values are never targets')
    qualities = [q.get('id') for q in bar['qualities']]
    if len(set(qualities)) != len(qualities) or not all(qualities):
        problems.append('every quality needs its own id')
    refs = [r.get('id') for r in bar['references']]
    if len(set(refs)) != len(refs) or not all(refs):
        problems.append('every reference needs its own id')
    for r in bar['references']:
        if r.get('format_family') not in FAMILIES:
            problems.append(f'reference {r.get("id")}: format_family must be one of {", ".join(FAMILIES)}')
        if not SHA256.match(str(r.get('sha256', ''))):
            problems.append(f'reference {r.get("id")}: sha256 is not 64 lowercase hex characters')
        served = r.get('served_from') or {}
        if not served.get('board_week') or not served.get('asset'):
            problems.append(f'reference {r.get("id")}: served_from needs board_week and asset')
        for key in ('piece', 'which_file', 'series', 'published_on'):
            if not r.get(key):
                problems.append(f'reference {r.get("id")}: missing {key}')

    def moment(m, where):
        out = []
        if m.get('ref') not in refs:
            out.append(f'{where}: names reference {m.get("ref")}, which is not listed')
        for key in ('at', 'to'):
            if key in m and not STAMP.match(str(m[key])):
                out.append(f'{where}: {key} {m[key]!r} is not a MM:SS(.f) timestamp')
        if 'at' not in m:
            out.append(f'{where}: no timestamp')
        return out

    for i, m in enumerate(bar['reference_moments']):
        problems += moment(m, f'reference moment {i + 1}')
        if not m.get('what'):
            problems.append(f'reference moment {i + 1}: says nothing')
        for q in m.get('shows', []):
            if q not in qualities:
                problems.append(f'reference moment {i + 1}: shows {q}, which is not a quality')
        if not m.get('shows'):
            problems.append(f'reference moment {i + 1}: shows no quality')
    for q in bar['qualities']:
        for j, m in enumerate(q.get('compare_beside', [])):
            problems += moment(m, f'quality {q.get("id")} comparison {j + 1}')
    for key in measured_keys(bar):
        problems.append(f'{key}: a measured value is context, never a target; keep it out of the references')
    if page is None:
        problems.append(f'{bar["doc"]} is missing')
    else:
        names = [q.get('name') for q in bar['qualities']]
        headings = bar_headings(page)
        if names != headings:
            problems.append(f'the quality names and the headings of {bar["doc"]} disagree: '
                            f'{[n for n in names if n not in headings] or "same names"} in the references only, '
                            f'{[h for h in headings if h not in names] or "same names"} on the page only'
                            + (' (the order differs)' if sorted(names) == sorted(headings) else ''))
    return problems


def bar_check(bar, root=ROOT):
    """The references checked against their page on disk, each problem as a printed line."""
    if bar is None:
        return []
    page = root / bar['doc'] if bar.get('doc') else None
    text = page.read_text(encoding='utf-8') if page and page.exists() else None
    return [f'the bar: {p}' for p in bar_problems(bar, text)]


def para(text, indent='  ', then=None):
    return textwrap.fill(' '.join(str(text).split()), width=118, initial_indent=indent,
                         subsequent_indent=indent if then is None else then)


def bar_lines(bar):
    """The short form of the bar a video maker reads first. Words, names and where to watch only: no hashes, no file
    ids and no measured values."""
    r = bar['ruling']
    lines = [f'The bar ({r["by"]}, {r["on"]}): the production quality floor for every video, whatever its story, '
             'format or length.',
             para(f'In his words: {quote(r["words"])}')]
    if r.get('correction'):
        lines.append(para(f'And: {quote(r["correction"])}'))
    lines.append(para(bar['principle']))
    lines.append(f'The qualities ({bar["doc"]} has each one: the bar, the reference moments, what falls below it '
                 'and how it is checked):')
    lines += [f'  {i}. {q["name"]}' for i, q in enumerate(bar['qualities'], 1)]
    lines.append('The references: watch each whole, in motion, at full size, with sound (config/reference-cuts.json '
                 'names the files and the moments):')
    for ref in bar['references']:
        served = ref['served_from']
        lines.append(f'  - {ref["published_on"]} {ref["series"]}, {ref["piece"]}: {ref["which_file"]} '
                     f'({FAMILIES[ref["format_family"]]}); board week {served["board_week"]}, asset {served["asset"]}')
    for later in bar.get('not_yet_references', []):
        family = f' ({FAMILIES[later["format_family"]]})' if later.get('format_family') in FAMILIES else ''
        lines.append(para(f'- Not a reference yet: {later["which_file"]}{family} of {later["piece"]}. {later["status"]}',
                          then='    '))
    lines.append(para(bar['measured_values']))
    return lines


def show_bar(bar, fmt):
    if applies(bar, fmt):
        print('\n'.join(bar_lines(bar)) + '\n')


def show_format(doc, fmt, approved_only, limit, bar=None):
    entry = doc['formats'].get(fmt)
    if entry is None:
        print(f'No floor for "{fmt}" yet. Makers: {", ".join(sorted(doc["formats"]))}.')
        return 1
    show_bar(bar, fmt)
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

    # The bar: a video maker reads it before the rejection standards; another maker never sees it.
    bar = {
        'doc': 'docs/production/SYNTHETIC_BAR.md',
        'ruling': {'by': 'Krish', 'on': '2026-10-28', 'words': 'synthetic: these two are the floor',
                   'correction': 'synthetic: only production quality'},
        'principle': 'Synthetic: every frame looks owned.',
        'measured_values': 'Context about the references, never targets.',
        'applies_to_makers': ['short_video'],
        'qualities': [{'id': 'finish', 'name': 'Finish: every frame owned',
                       'compare_beside': [{'ref': 'ref-a', 'at': '00:02'}]},
                      {'id': 'sound', 'name': 'Sound finish'}],
        'references': [{'id': 'ref-a', 'piece': 'Synthetic piece', 'published_on': '2026-10-23', 'series': 'synthetic',
                        'format_family': 'voiceover', 'which_file': 'the synthetic cut', 'sha256': 'c' * 64,
                        'drive_file_id': 'synthetic-drive-id',
                        'served_from': {'board_week': '2026-10-19', 'asset': 'syn-video'}}],
        'not_yet_references': [{'piece': 'Synthetic piece', 'which_file': 'the long cut', 'status': 'In post.'}],
        'reference_moments': [{'ref': 'ref-a', 'at': '00:01.5', 'to': '00:04', 'shows': ['finish'], 'what': 'A build.'}],
    }
    page = '# Bar\n\n## The qualities\n\n### 1. Finish: every frame owned\n\n### 2. Sound finish\n\n## What is not the bar\n\n### x\n'
    assert bar_problems(bar, page) == [], bar_problems(bar, page)
    assert any('headings' in p for p in bar_problems(bar, page.replace('### 2. Sound finish', '### 2. Sound'))), \
        'a quality renamed on one side only must be caught'
    swapped = page.replace('### 1. Finish: every frame owned', '@').replace('### 2. Sound finish', '### 1. Finish: every frame owned')
    assert any('order differs' in p for p in bar_problems(bar, swapped.replace('@', '### 2. Sound finish'))), \
        'the order of the qualities must agree too'
    assert any('is missing' in p for p in bar_problems(bar, None))
    measured = json.loads(json.dumps(bar))
    measured['references'][0]['duration_s'] = 78.6
    assert any('never a target' in p for p in bar_problems(measured, page)), 'a measured value must be refused'
    stray = json.loads(json.dumps(bar))
    stray['reference_moments'][0]['ref'] = 'ref-z'
    stray['reference_moments'][0]['shows'] = ['grace']
    assert len(bar_problems(stray, page)) == 2, bar_problems(stray, page)
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        assert show_format(doc, 'short_video', False, 40, bar=bar) == 0
    text = out.getvalue()
    assert text.index('The bar (Krish, 2026-10-28)') < text.index('The rejection floor for short_video') \
        < text.index('Approved standards'), text
    assert '"synthetic: these two are the floor"' in text and '  2. Sound finish' in text, text
    assert 'board week 2026-10-19, asset syn-video' in text and 'Not a reference yet: the long cut' in text, text
    assert 'c' * 64 not in text and 'synthetic-drive-id' not in text, 'no hashes or file ids in the printed bar'
    bare = io.StringIO()
    with contextlib.redirect_stdout(bare):
        show_format(doc, 'short_video', False, 40)
    assert text.endswith(bare.getvalue()), 'the bar is added before the floor, which is otherwise unchanged'
    other = json.loads(json.dumps(bar))
    other['applies_to_makers'] = ['long_video']
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        show_format(doc, 'short_video', False, 40, bar=other)
    assert 'The bar' not in out.getvalue()
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
    p.add_argument('--bar-file', type=Path, default=BAR, help=argparse.SUPPRESS)
    a = p.parse_args(argv)
    if a.self_test:
        return self_test()
    doc = load(a.file)
    bar = load_bar(a.bar_file)
    if a.check:
        problems = [f'rejection floor: {problem}' for problem in (check(doc) if doc is not None else [])]
        problems += bar_check(bar)
        if doc is None:
            print(NO_FLOOR)
        for problem in problems:
            print(problem)
        return 1 if problems else 0
    if doc is None:
        if a.format:
            show_bar(bar, a.format)
        print(NO_FLOOR)
        return 0
    if a.formats:
        for fmt, entry in sorted(doc['formats'].items()):
            print(f'{fmt}: {entry["maker"]}')
        return 0
    if a.format:
        return show_format(doc, a.format, a.approved_only, None if a.all else 40, bar=bar)
    return summary(doc)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BrokenPipeError:
        # Read through a pager or `head`: the reader stopped, which is not a failure.
        sys.exit(0)
