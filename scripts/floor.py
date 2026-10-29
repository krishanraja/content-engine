#!/usr/bin/env python3
"""The rejection floor: what Krish rejected in production work, with his words, and the standards no finished piece may
fall beneath. Read it for the format you are making before the brief, and check the finished file against it before
delivery.

    python3 scripts/floor.py                          # what each maker's floor holds, and every approved standard
    python3 scripts/floor.py --format short_video     # that maker's floor: standards, then what he rejected
    python3 scripts/floor.py --format cover --approved-only
    python3 scripts/floor.py --formats                # the makers, by name
    python3 scripts/floor.py --check                  # the file is whole and well formed (exit 1 if not)
    python3 scripts/floor.py --blocking               # the only taste standards a check may block on: his eight nevers (JSON)
    python3 scripts/floor.py --self-test              # the reader, on a synthetic floor (CI: tests/engine-gates.test.ts)

The file, config/rejection-floor.json, is written only by the Rejections engine (krishanraja/inspirationhouse,
src/rejection/) and changes only by a pull request Krish merges. Never edit it by hand. Krish, 2026-10-28: "It then
makes it really easy for a new session to understand what is a no-no and what kind of stuff cannot be produced."

A standard is approved or reworded by Krish, or a draft the engine read into his rejections. Reviewers and
pre-delivery checks test work against approved and reworded standards and his words, for craft and process only,
never what a piece is about (Ruling, Krish, 2026-10-28). Makers follow the drafts too.

The bar comes first for a video maker, held in the three layers Krish asked for on 2026-10-29 ("I would much rather
the engine know what kind of thing doesn't fly with me, rather than implement incredibly specific rules
everywhere"): the floor (the eight nevers he confirmed on 2026-10-29, "Yes, that's the floor", in his order, each with
his earlier words or the rule it rests on and the gate that already holds it, or held at review; the only things a
check may refuse), the aims (what great looks like: the cuts he named on 2026-10-28, the brand book, his
general words, the qualities of docs/production/THE_BAR.md and its reference moments, never a checklist) and what is
under test (choices he made for now, each the current default, recorded per piece and judged on engagement).
config/reference-cuts.json holds all three. The aims are the engine's reading of the cuts, a draft until he approves
their wording, except the points he ruled; the printed bar says so. --format prints a short version of it before the
rejection standards for the makers in full_bar_for_makers, led by his 29 October words, then the floor, the aims and
what is under test, and a one-line pointer for the other video makers and for --format all. --check holds the two
files together: his words, the rulings, the floor's nevers (their listed words, in his order) and his confirmation of
them, the quality names, the reference moments and each quality's comparison points, word for word; every point the page marks as his words must be his exact words, and a quality that cites a
ruling must quote its answer or name it. The printed bar carries no hashes or file ids (they stay in the
file) and no measured value: those describe the references, never targets. Only --check and a --format read it, so a
broken file never stops another maker's floor or the summary.

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


# Only his eight nevers may block on taste (Krish, 2026-10-29: "I would much rather the engine know what kind of thing
# doesn't fly with me, rather than implement incredibly specific rules everywhere"; "Yes, that's the floor"). Every
# standard in the rejection floor, approved or draft, is an example of the kind of thing that does not fly: it guides
# a maker and a reviewer, and no check refuses on it (W2.10). The nevers live in config/reference-cuts.json floor.
NEVERS = 8


def blocking(bar):
    """[{id, never}]: the blocking taste standards, exactly his eight nevers in his order, or [] when the bar is missing."""
    nevers = ((bar or {}).get('floor') or {}).get('nevers') or []
    return [{'id': n.get('id'), 'never': n.get('listed')} for n in nevers]


def blocking_problems(bar):
    """Why the blocking set is not exactly his eight nevers, or []."""
    found = blocking(bar)
    ids = [n['id'] for n in found]
    out = []
    if len(found) != NEVERS:
        out.append(f'the floor holds {len(found)} nevers; it holds exactly his {NEVERS}')
    if len(set(ids)) != len(ids) or not all(isinstance(i, str) and i for i in ids):
        out.append('each never has its own id')
    if not all(isinstance(n['never'], str) and n['never'].strip() for n in found):
        out.append('each never keeps the words he confirmed (listed)')
    return out


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
STANDINGS = ('draft', 'approved')
IDENTITIES = ('confirmed', 'unconfirmed')
# A question put to him is ruled (his answer settles it), answered (his answer is recorded but settles nothing, as when
# he is not sure) or open (he asked for better questions first).
RULING_STATUSES = ('ruled', 'answered', 'open')
# A point the page marks as his words: (Krish, 28 Oct: "...").
HIS_MARK = re.compile(r'\(Krish, \d{1,2} [A-Z][a-z]{2}: "(.*?)"\)')
STAMP = re.compile(r'^\d\d:\d\d(\.\d+)?$')
SHA256 = re.compile(r'^[0-9a-f]{64}$')
# A bullet under the page's '## Reference moments': "- 00:22.0 to 00:22.3: what it shows".
PAGE_MOMENT = re.compile(r'^- (\d\d:\d\d(?:\.\d+)?)(?: to (\d\d:\d\d(?:\.\d+)?))?: (.+)$')
# One point on a quality's "**Compare beside.**" line: "Friday tall 00:22 to 00:36".
PAGE_POINT = re.compile(r'^(.+?) (\d\d:\d\d(?:\.\d+)?)(?: to (\d\d:\d\d(?:\.\d+)?))?$')
COMPARE = '**Compare beside.**'
# A measured reading of a reference (its length, shape, cuts, timings, levels, tempo or colours) is context, never a
# target (Krish, 2026-10-28: "you are only to look for production quality standards"). None may be written into the
# references as a field, where a brief or a check could read one as a standard. A figure inside a sentence is not seen
# here; the page and the file keep none.
MEASURED = {'duration', 'duration_s', 'length', 'length_s', 'seconds', 'runtime', 'aspect', 'aspect_ratio',
            'resolution', 'width', 'height', 'fps', 'frame_rate', 'bitrate', 'cut_count', 'cuts_per_minute',
            'scene_changes', 'events_per_second', 'caption_changes', 'bpm', 'tempo', 'lufs', 'loudness',
            'true_peak', 'loudness_range', 'palette', 'sampled_palette', 'hex'}
BAR_HINT = ('Making a video? The bar comes first: python3 scripts/floor.py --format short_video (or long_video) prints '
            'its floor, its aims from the cuts Krish named and what is under test; config/reference-cuts.json names its '
            'page.')
# The page's three layers, by heading: the floor's nevers, in his order, and the list's aims and under test lines he
# confirmed with them (ruling 12) sit under these.
FLOOR_SECTION = '## The floor: what never ships'
AIMS_SECTION = '## The aims: what great looks like'
UNDER_TEST_SECTION = '## Under test: the current defaults'
# A numbered never on the page: "3. **your words never cut, changed or out of sync.** ...".
PAGE_NEVER = re.compile(r'^(\d+)\. \*\*(.+?)\*\*')
# Where each ruling Krish gave lands in the printed bar: a never of the floor, an aim, or a choice under test. --check
# holds each ruling's layer to where it bites: a floor ruling is cited by a never, an under_test one by a choice.
LAYERS = ('floor', 'aim', 'under_test')


def read_bar(path=BAR):
    """The references, or None when the file is not there, and an error sentence when it cannot be read. Only the
    makers it applies to and --check read it, so a broken file never stops another maker's floor."""
    if not path.exists():
        return None, None
    try:
        with path.open(encoding='utf-8') as f:
            bar = json.load(f)
    except (OSError, ValueError) as error:
        return None, f'{path.name} cannot be read: {error}'
    if not isinstance(bar, dict):
        return None, f'{path.name} is not a JSON object'
    return bar, None


def load_bar(path=BAR):
    return read_bar(path)[0]


def never_words(never):
    """What he said on one never, each {'said', 'on'} (a date) or {'said', 'where'} (where it is recorded)."""
    return [w for w in never.get('words') or [] if isinstance(w, dict)]


def blockquote(words):
    """His words as the page quotes them: in quotes, each of his lines kept, inside a '> ' block."""
    return '\n'.join(f'> {line}' if line else '>' for line in f'"{words}"'.split('\n'))


def applies(bar, fmt):
    return bool(bar) and fmt in bar.get('applies_to_makers', [])


def full_bar(bar, fmt):
    return applies(bar, fmt) and fmt in bar.get('full_bar_for_makers', [])


def section(text, title):
    """The lines under one '## ' heading of the page."""
    lines, inside = [], False
    for line in text.splitlines():
        if line.startswith('## '):
            inside = line.strip() == title
        elif inside:
            lines.append(line)
    return lines


def bar_headings(text):
    """The quality headings of the bar's page, in order, without their numbers."""
    return [re.sub(r'^\d+\.\s+', '', line[4:].strip())
            for line in section(text, '## The qualities') if line.startswith('### ')]


def quality_texts(text):
    """quality name -> the text under its heading on the page."""
    found, name = {}, None
    for line in section(text, '## The qualities'):
        if line.startswith('### '):
            name = re.sub(r'^\d+\.\s+', '', line[4:].strip())
            found[name] = ''
        elif name:
            found[name] += line + '\n'
    return found


def page_moments(text, labels):
    """(ref, at, to, what) for each bullet under '## Reference moments', its reference named by the '### <label> (...)'
    heading above it, and the lines that could not be read."""
    found, problems, ref = [], [], None
    for line in section(text, '## Reference moments'):
        if line.startswith('### '):
            label = line[4:].split(' (')[0].strip()
            ref = labels.get(label)
            if ref is None:
                problems.append(f'reference moments: the heading {label!r} names no reference label')
        elif line.startswith('- '):
            m = PAGE_MOMENT.match(line.strip())
            if not m or ref is None:
                problems.append(f'reference moments: cannot read {line.strip()[:70]!r}')
            else:
                found.append((ref, m[1], m[2], m[3]))
    return found, problems


def page_points(text, labels):
    """quality name -> [(ref, at, to)] from each quality's Compare beside line, and the points that could not be read."""
    found, problems, name = {}, [], None
    for line in section(text, '## The qualities'):
        if line.startswith('### '):
            name = re.sub(r'^\d+\.\s+', '', line[4:].strip())
        elif line.startswith(COMPARE) and name:
            points = []
            for part in line[len(COMPARE):].strip().rstrip('.').split(';'):
                m = PAGE_POINT.match(part.strip())
                if not m or m[1] not in labels:
                    problems.append(f'quality {name!r}: cannot read the comparison point {part.strip()!r}')
                    continue
                points.append((labels[m[1]], m[2], m[3]))
            found[name] = points
    return found, problems


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
    for key in ('doc', 'taste', 'ruling', 'general', 'rulings', 'standing', 'principle', 'measured_values',
                'applies_to_makers', 'floor', 'under_test', 'qualities', 'references', 'reference_moments'):
        if not bar.get(key):
            problems.append(f'missing {key}')
    if problems:
        return problems
    if not bar['ruling'].get('words') or not bar['ruling'].get('on'):
        problems.append('the ruling has no words or no date')
    if not bar['general'].get('words') or not bar['general'].get('on'):
        problems.append('his general words have no words or no date')
    # Each question put to him keeps his exact answer and says what changed, or what holds while it stays open.
    items = bar['rulings'].get('items') or []
    numbers = [item.get('n') for item in items]
    if not bar['rulings'].get('section') or not items:
        problems.append('the rulings need their page section and their items')
    if len(set(numbers)) != len(numbers):
        problems.append('every ruling needs its own number')
    ruled = {item.get('n') for item in items if item.get('status') == 'ruled'}
    for item in items:
        if item.get('status') not in RULING_STATUSES:
            problems.append(f'ruling {item.get("n")}: status must be one of {", ".join(RULING_STATUSES)}')
        for key in ('topic', 'question', 'answer', 'changed'):
            if not item.get(key):
                problems.append(f'ruling {item.get("n")}: missing {key}')
        if item.get('production') and item.get('status') != 'ruled':
            problems.append(f'ruling {item.get("n")}: only a ruled answer bites in production')
        if item.get('quote') and item['quote'] not in str(item.get('answer')):
            problems.append(f'ruling {item.get("n")}: its quote is not his exact words from the answer')
    # A ruling's layer says where it bites, and the floor and what is under test agree with it.
    layer_of = {item.get('n'): item.get('layer') for item in items}
    cited = {'floor': {never.get('ruling') for never in bar['floor'].get('nevers') or [] if never.get('ruling')}
             | ({bar['floor']['ruling']} if bar['floor'].get('ruling') is not None else set()),
             'under_test': {c.get('ruling') for c in bar['under_test'].get('choices') or [] if c.get('ruling')}}
    for item in items:
        layer = item.get('layer')
        if layer is not None and layer not in LAYERS:
            problems.append(f'ruling {item.get("n")}: layer must be one of {", ".join(LAYERS)}')
        elif layer in cited and item.get('n') not in cited[layer]:
            problems.append(f'ruling {item.get("n")}: its layer is {layer}, but no '
                            + ('never of the floor' if layer == 'floor' else 'choice under test') + ' cites it')
    for layer, numbers in cited.items():
        for n in sorted(numbers, key=str):
            if layer_of.get(n) != layer:
                problems.append(f'ruling {n}: cited by the {"floor" if layer == "floor" else "choices under test"}, '
                                f'so its layer is {layer}, not {layer_of.get(n)}')
    # The floor: his nevers, each in the words of the list he confirmed, with his words (when or where he said them)
    # and the gate that already holds it; the ruling that confirmed them is a ruled answer.
    nevers = bar['floor'].get('nevers') or []
    never_ids = [never.get('id') for never in nevers]
    if not nevers:
        problems.append('the floor has no nevers')
    if len(set(never_ids)) != len(never_ids) or not all(never_ids):
        problems.append('every never needs its own id')
    for never in nevers:
        for key in ('listed', 'held_by'):
            if not never.get(key):
                problems.append(f'never {never.get("id")}: missing {key}')
        for words in never.get('words') or []:
            if not isinstance(words, dict) or not words.get('said') or not (words.get('on') or words.get('where')):
                problems.append(f'never {never.get("id")}: each of his words needs what he said, and when or where')
    confirmed = bar['floor'].get('ruling')
    confirm = next((item for item in items if item.get('n') == confirmed), None) if confirmed is not None else None
    if confirmed is not None and (confirm is None or confirm.get('status') != 'ruled'):
        problems.append(f'the floor cites ruling {confirmed}, which is not a ruled answer')
    # His words named the cuts; the qualities are the engine's reading of them until he approves their wording.
    if bar['standing'] not in STANDINGS:
        problems.append(f'standing must be one of {", ".join(STANDINGS)}')
    if bar['standing'] == 'draft' and not bar.get('standing_note'):
        problems.append('a draft bar needs its standing_note, the line that says he has not approved its wording')
    if 'never' not in bar['measured_values'] or 'target' not in bar['measured_values']:
        problems.append('measured_values must say measured values are never targets')
    if not set(bar.get('full_bar_for_makers', [])) <= set(bar['applies_to_makers']):
        problems.append('full_bar_for_makers must be makers in applies_to_makers')
    qualities = [q.get('id') for q in bar['qualities']]
    if len(set(qualities)) != len(qualities) or not all(qualities):
        problems.append('every quality needs its own id')
    refs = [r.get('id') for r in bar['references']]
    if len(set(refs)) != len(refs) or not all(refs):
        problems.append('every reference needs its own id')
    labels = {r.get('label'): r.get('id') for r in bar['references']}
    if len(labels) != len(refs) or not all(labels):
        problems.append('every reference needs its own label, the name the page uses for it')
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
        # Whether the file is the latest cut he meant is evidence, never assumed.
        if r.get('identity') not in IDENTITIES or not r.get('identity_evidence'):
            problems.append(f'reference {r.get("id")}: identity must be {" or ".join(IDENTITIES)}, with its '
                            'identity_evidence')

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
        # A sound moment says whether anyone has heard it (F03: a reference studied without its sound).
        if 'sound' in m.get('shows', []) and not isinstance(m.get('heard'), bool):
            problems.append(f'reference moment {i + 1}: a sound moment must say whether it was heard')
    for q in bar['qualities']:
        for n in q.get('ruled', []):
            if n not in ruled:
                problems.append(f'quality {q.get("id")}: ruling {n} is not a ruled answer')
        for j, m in enumerate(q.get('compare_beside', [])):
            problems += moment(m, f'quality {q.get("id")} comparison {j + 1}')
        if q.get('id') == 'sound' and not isinstance(q.get('heard'), bool):
            problems.append('quality sound: its comparison points must say whether they were heard')
    for key in measured_keys(bar):
        problems.append(f'{key}: a measured value is context, never a target; keep it out of the references')
    if page is None:
        problems.append(f'{bar["doc"]} is missing')
        return problems
    names = [q.get('name') for q in bar['qualities']]
    headings = bar_headings(page)
    if names != headings:
        problems.append(f'the quality names and the headings of {bar["doc"]} disagree: '
                        f'{[n for n in names if n not in headings] or "same names"} in the references only, '
                        f'{[h for h in headings if h not in names] or "same names"} on the page only'
                        + (' (the order differs)' if sorted(names) == sorted(headings) else ''))
    if bar['standing'] == 'draft' and bar.get('standing_note') and bar['standing_note'] not in page:
        problems.append(f'{bar["doc"]} does not carry the draft standing_note under his words')
    # His words are quoted on the page exactly as the file keeps them, and his general words open it.
    general, earlier = blockquote(bar['general']['words']), blockquote(bar['ruling']['words'])
    if general not in page:
        problems.append(f'{bar["doc"]} does not quote his general words exactly')
    elif earlier in page and page.index(general) > page.index(earlier):
        problems.append(f'{bar["doc"]} must open with his general words, before his earlier words')
    title = f'## {bar["rulings"].get("section")}'
    lines = [line for line in section(page, title) if line.strip()]
    if not lines:
        problems.append(f'{bar["doc"]} has no section {title!r}')
    for item in items:
        line = next((x for x in lines if x.startswith(f'{item.get("n")}. **')), None)
        if line is None:
            problems.append(f'ruling {item.get("n")} is not on the page')
        elif f'"{item.get("answer")}"' not in line:
            problems.append(f'ruling {item.get("n")}: his answer on the page is not the one in the references')
        elif item.get('status') == 'open' and 'Still open' not in line:
            problems.append(f'ruling {item.get("n")} is open in the references but not on the page')
        elif item.get('status') != 'open' and 'Still open' in line:
            problems.append(f'ruling {item.get("n")} is {item.get("status")} in the references but open on the page')
    # The floor on the page says what the file says: each never in the words of the list he confirmed, in his order,
    # the question's own wording where it differs, held at review where no gate holds it, and his confirmation; the
    # aims and under test sections carry the list's lines he confirmed with it.
    floor_text = section(page, FLOOR_SECTION)
    if not floor_text:
        problems.append(f'{bar["doc"]} has no section {FLOOR_SECTION!r}')
    else:
        listed = [line for line in floor_text if PAGE_NEVER.match(line)]
        on_page = [(int(PAGE_NEVER.match(line)[1]), PAGE_NEVER.match(line)[2]) for line in listed]
        want = [(i, f'{never.get("listed")}.') for i, never in enumerate(nevers, 1)]
        if on_page != want:
            problems.append(f'the floor on {bar["doc"]} and in the references disagree: '
                            f'{[f"{n}. {w}" for n, w in want if (n, w) not in on_page] or "same nevers"} in the '
                            f'references only, {[f"{n}. {w}" for n, w in on_page if (n, w) not in want] or "same nevers"} '
                            'on the page only' + (' (the order differs)' if sorted(w for _, w in on_page)
                                                  == sorted(w for _, w in want) else ''))
        for never, line in zip(nevers, listed):
            if never.get('asked') and never['asked'] != never.get('listed') and f'Asked as: {never["asked"]}' not in line:
                problems.append(f'never {never.get("id")}: the page does not give the question\'s own wording')
            if str(never.get('held_by', '')).lower().startswith('held at review') and 'held at review' not in line.lower():
                problems.append(f'never {never.get("id")}: no gate holds it, and the page does not say it is held at '
                                'review')
        if confirm:
            said = (f'Krish picked: "{confirm.get("answer")}"' if confirm.get('picked')
                    else f'"{confirm.get("answer")}"')
            if said not in '\n'.join(floor_text):
                problems.append(f'the floor on {bar["doc"]} does not carry his confirmation, {said}')
    for key, title in (('listed_aims', AIMS_SECTION), ('listed_under_test', UNDER_TEST_SECTION)):
        if confirm and confirm.get(key) and f'"{confirm[key]}"' not in '\n'.join(section(page, title)):
            problems.append(f'ruling {confirm.get("n")}: the list\'s line he confirmed is not under {title!r}')
    # A point marked as his words quotes his exact words, and a quality that cites a ruling quotes its answer or names it.
    his = [str(item.get('answer', '')) for item in items] + [bar['general']['words'], bar['ruling']['words'],
                                                             bar['ruling'].get('correction') or '',
                                                             str(bar['taste'].get('words') or '')]
    his += [str(words['said']) for never in nevers for words in never_words(never) if words.get('said')]
    for said in HIS_MARK.findall(page):
        if not any(said in words for words in his):
            problems.append(f'{bar["doc"]} marks words as his that are not his exact words: {said[:60]!r}')
    texts = quality_texts(page)
    for q in bar['qualities']:
        text = texts.get(q.get('name'), '')
        for n in q.get('ruled', []):
            answer = next((str(i.get('answer')) for i in items if i.get('n') == n), '')
            if f'ruling {n}' not in text and not any(said in answer for said in HIS_MARK.findall(text)):
                problems.append(f'quality {q.get("id")}: cites ruling {n}, but its section on the page neither quotes '
                                'his answer nor names the ruling')
    # One home per fact: the page's moments and comparison points say what the file says, word for word.
    on_page, unread = page_moments(page, labels)
    problems += unread
    in_file = [(m.get('ref'), m.get('at'), m.get('to'), m.get('what')) for m in bar['reference_moments']]
    for side, extra in (('the references', set(in_file) - set(on_page)), ('the page', set(on_page) - set(in_file))):
        for ref, at, to, _ in sorted(extra, key=lambda x: (str(x[0]), str(x[1]))):
            problems.append(f'reference moment {ref} {at}{" to " + to if to else ""} is in {side} only, '
                            'or its words differ')
    points, unread = page_points(page, labels)
    problems += unread
    for q in bar['qualities']:
        want = [(c.get('ref'), c.get('at'), c.get('to')) for c in q.get('compare_beside', [])]
        if points.get(q.get('name')) != want:
            problems.append(f'quality {q.get("id")}: the Compare beside points on the page and in the references '
                            'disagree')
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
                         subsequent_indent=indent if then is None else then, break_on_hyphens=False)


def ruled_in(item):
    """His words for a ruling, as the printed bar gives them: an option he picked, or the part of his exact answer that
    bites (`quote`; the whole answer stays in the file and on the page)."""
    if item.get('picked'):
        return f'Krish picked: {quote(item["answer"])}'
    return f'In his words: {quote(item.get("quote") or item["answer"])}'


def bar_lines(bar):
    """The short form of the bar a video maker reads first: his words on how taste is held, then the floor, the aims
    and what is under test, each in a few lines; the page holds the rest. The aims are marked as the engine's reading
    where they are; no hashes, no file ids and no measured values."""
    r, g, t = bar['ruling'], bar['general'], bar['taste']
    draft = bar['standing'] == 'draft'
    items = bar['rulings']['items']
    by_n = {item.get('n'): item for item in items}
    lines = ['The bar: how every video should look, sound and feel, held in three layers.',
             f'  {t["by"]}, {t["on"]}, on how he wants taste held:',
             para(quote(t['words']), indent='    ')]
    lines.append('Floor: the only refusals this bar adds; existing gates and approved standards refuse as they do.')
    confirm = by_n.get(bar['floor'].get('ruling'))
    if confirm:
        lines.append(para(f'{confirm.get("by", "Krish")} confirmed these, in his order, on '
                          f'{confirm.get("on", bar["rulings"]["on"])}: {ruled_in(confirm)}.'))
    for i, never in enumerate(bar['floor'].get('nevers') or [], 1):
        said = ' And '.join(f'({w.get("on") or w.get("where")}): {quote(w["said"])}' for w in never_words(never))
        held = str(never['held_by'])
        held = held[0].upper() + held[1:] if held.lower().startswith('held at review') else f'Held by: {held}'
        text = f'- {i}. {never["listed"]}.' + (f' In his words {said}' if said else '')
        lines.append(para(f'{text} {held}.', then='    '))
    lines.append('Aims: what great looks like, to aim at and compare against; never a checklist, and no check refuses on '
                 'them.')
    lines += [f'  {g["by"]}, {g["on"]}, on how every video should be made:', textwrap.indent(f'"{g["words"]}"', '    ')]
    for item in items:
        if item['status'] == 'ruled' and item.get('production') and item.get('layer', 'aim') == 'aim':
            lines.append(para(f'- {item["topic"]} ({item.get("on", bar["rulings"]["on"])}): {ruled_in(item)}',
                              then='    '))
    for item in items:
        if item['status'] == 'open':
            lines.append(para(f'- Still open ({item["topic"].lower()}): {item["question"]} {item["changed"]}', then='    '))
    # The part of his naming words that bites; the whole of them stays in the file and on the page.
    lines.append(para(f'{r["by"]} named the cuts on {r["on"]}. In his words: {quote(r.get("quote") or r["words"])}'))
    lines.append(para(f'Standing: {bar["standing"]}. {bar.get("standing_note", "")}'))
    lines.append(para(("The engine's reading of those cuts, a draft: " if draft else '') + bar['principle']))
    names = '; '.join(q['name'].split(':')[0] for q in bar['qualities'])
    lines.append(para(f'The qualities, each on {bar["doc"]}: {names}.'))
    # Which file each reference is, how it was confirmed and what the studies measured live in the page and the file;
    # the printout names them and warns only when a reference's identity is not confirmed.
    labels = ', '.join(ref['label'] for ref in bar['references'])
    lines.append(para(f'The references ({labels}) are named in config/reference-cuts.json; what the studies measured '
                      'there is context, never targets.'))
    for ref in bar['references']:
        if ref.get('identity') != 'confirmed':
            lines.append(para(f'- {ref["label"]}. Identity unconfirmed: whether this is the latest cut is not '
                              'established; config/reference-cuts.json says what is.', then='    '))
    for later in bar.get('not_yet_references', []):
        family = f' ({FAMILIES[later["format_family"]]})' if later.get('format_family') in FAMILIES else ''
        lines.append(para(f'- Not a reference yet: {later["which_file"]}{family} of {later["piece"]}. '
                          f'{later["status"].split(". ")[0].rstrip(".")}.', then='    '))
    lines.append(para('Under test: his choices for now, each a default recorded per piece and judged on real engagement; '
                      'never a refusal.', indent='', then='  '))
    record = bar['under_test'].get('record', '').split(',')[0].rsplit('.', 1)[-1]
    for choice in bar['under_test'].get('choices') or []:
        item = by_n.get(choice.get('ruling'))
        words = f' {ruled_in(item)} ({item.get("on", bar["rulings"]["on"])})' if item else ''
        lines.append(para(f'- {choice["title"]} ({record}.{choice["id"]}): {choice["what"]}{words}', then='    '))
    return lines


def bar_pointer(bar, fmt):
    """One line for a video maker the full bar is not printed for (and for --format all): where it is, and that it
    applies."""
    full = ' or '.join(f'--format {m}' for m in bar.get('full_bar_for_makers', [])) or 'the page'
    who = 'this maker too' if applies(bar, fmt) else 'every video maker'
    return para(f'The bar: {bar["doc"]} holds the floor, the aims and what is under test for {who}, the aims from '
                f'the cuts {bar["ruling"]["by"]} named on {bar["ruling"]["on"]} (standing: {bar["standing"]}). Read it '
                f'before the brief; python3 scripts/floor.py {full} prints it.', indent='', then='  ')


def show_bar(bar, fmt):
    if full_bar(bar, fmt):
        print('\n'.join(bar_lines(bar)) + '\n')
    elif bar and (applies(bar, fmt) or fmt == 'all'):
        print(bar_pointer(bar, fmt) + '\n')


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
    print('Blocking: only his eight nevers, above. Every standard below is the kind of thing that does not fly: it guides '
          'the work and a reviewer, and no check refuses on it (Krish, 2026-10-29).\n')
    print(f'Approved standards ({len(approved)}): he approved their wording; follow them.')
    for ref in approved:
        print('\n'.join(standard_lines(ref, doc['standards'][ref])))
    if not approved:
        print('- None approved yet.')
    if not approved_only:
        patterns = sum(1 for ref in drafts if doc['standards'][ref].get('weight') == 'pattern')
        print(f'\nDraft standards ({len(drafts)}, {patterns} of them patterns): the engine\'s reading of his rejections, examples of what '
              'does not fly. Follow them; they never block, and only he approves them. A PATTERN he raised about two or more productions comes first.')
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
    print('Read the one you are making: python3 scripts/floor.py --format <maker>')
    print(BAR_HINT + '\n')
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
        'general': {'by': 'Krish', 'on': '2026-10-28', 'words': 'synthetic: in general\n- keep it simple\n\nOn brand.'},
        'taste': {'by': 'Krish', 'on': '2026-10-29', 'words': 'synthetic: kinds, never narrow rules'},
        'floor': {'ruling': 4, 'nevers': [
            {'id': 'name', 'listed': 'synthetic: no name', 'asked': 'synthetic: no name, as asked',
             'words': [{'on': '2026-10-28', 'said': 'synthetic: no name, ever'}], 'held_by': 'the synthetic lint'},
            {'id': 'close', 'listed': 'synthetic: one close',
             'words': [{'where': 'a synthetic canon', 'said': 'synthetic: one close only'}],
             'held_by': 'held at review: no gate holds it yet'}]},
        'under_test': {'record': 'content_ideas.meta.making.production_choices, written by making.py',
                       'choices': [{'id': 'opening', 'title': 'The hook first', 'ruling': 3, 'what': 'Synthetic: hook.'}]},
        'rulings': {'on': '2026-10-28', 'section': 'Rulings', 'items': [
            {'n': 1, 'topic': 'Music', 'status': 'ruled', 'layer': 'aim', 'question': 'Synthetic: throughout?',
             'answer': 'synthetic: yes', 'production': 'the bed is heard throughout', 'changed': 'Sound.'},
            {'n': 2, 'topic': 'Readings', 'status': 'open', 'question': 'Synthetic: one idea?', 'answer': 'synthetic: ask me',
             'changed': 'Synthetic: drafts until he answers.'},
            {'n': 3, 'on': '2026-10-29', 'topic': 'Opening', 'status': 'ruled', 'layer': 'under_test', 'picked': True,
             'question': 'Synthetic: which opening?', 'answer': 'The hook', 'production': 'the hook first',
             'changed': 'Under test.'},
            {'n': 4, 'on': '2026-10-29', 'topic': 'The floor', 'status': 'ruled', 'layer': 'floor', 'picked': True,
             'question': 'Synthetic: is this the floor?', 'answer': 'Yes, the floor', 'listed_aims': 'synthetic: aim high',
             'listed_under_test': 'synthetic: the hook', 'changed': 'The floor.'}]},
        'standing': 'draft', 'standing_note': 'Synthetic: the engine reads the cuts; he has not approved it.',
        'principle': 'Synthetic: every frame looks owned.',
        'measured_values': 'Context about the references, never targets.',
        'applies_to_makers': ['short_video', 'motion'], 'full_bar_for_makers': ['short_video'],
        'qualities': [{'id': 'finish', 'name': 'Finish: every frame owned',
                       'compare_beside': [{'ref': 'ref-a', 'at': '00:02'}]},
                      {'id': 'sound', 'name': 'Sound finish', 'heard': False, 'ruled': [1],
                       'compare_beside': [{'ref': 'ref-a', 'at': '00:00', 'to': '00:03'}]}],
        'references': [{'id': 'ref-a', 'label': 'Synthetic tall', 'piece': 'Synthetic piece',
                        'published_on': '2026-10-23', 'series': 'synthetic', 'format_family': 'voiceover',
                        'which_file': 'the synthetic cut', 'sha256': 'c' * 64, 'drive_file_id': 'synthetic-drive-id',
                        'served_from': {'board_week': '2026-10-19', 'asset': 'syn-video'},
                        'identity': 'unconfirmed', 'identity_evidence': 'Synthetic: not established.'}],
        'not_yet_references': [{'piece': 'Synthetic piece', 'which_file': 'the long cut', 'status': 'In post.'}],
        'reference_moments': [{'ref': 'ref-a', 'at': '00:01.5', 'to': '00:04', 'shows': ['finish'], 'what': 'A build.'},
                              {'ref': 'ref-a', 'at': '00:00', 'shows': ['sound'], 'heard': False,
                               'what': 'Measured, not yet heard: a sting.'}],
    }
    page = ('# Bar\n\n> "synthetic: in general\n> - keep it simple\n>\n> On brand."\n\n> "synthetic: these two are the floor"\n\n'
            'Synthetic: the engine reads the cuts; he has not approved it.\n\n## The floor: what never ships\n\n'
            'Confirmed: Krish picked: "Yes, the floor".\n\n'
            '1. **synthetic: no name.** Asked as: synthetic: no name, as asked. Held by the synthetic lint.\n'
            '2. **synthetic: one close.** Held at review: no gate holds it yet.\n\n'
            '## The aims: what great looks like\n\nAs listed: "synthetic: aim high".\n\n## The qualities\n\n'
            '### 1. Finish: every frame owned\n\n**Compare beside.** Synthetic tall 00:02.\n\n'
            '### 2. Sound finish\n\nHeard throughout (Krish, 28 Oct: "synthetic: yes").\n\n'
            '**Compare beside.** Synthetic tall 00:00 to 00:03.\n\n'
            '## Reference moments\n\n### Synthetic tall (23 October)\n\n- 00:01.5 to 00:04: A build.\n'
            '- 00:00: Measured, not yet heard: a sting.\n\n## Under test: the current defaults\n\n'
            'As listed: "synthetic: the hook".\n\n## What is not the bar\n\n### x\n\n## Rulings\n\n'
            '1. **Music.** Synthetic: throughout? His answer: "synthetic: yes" Changed: sound.\n'
            '2. **Readings.** Synthetic: one idea? His answer: "synthetic: ask me" Still open.\n'
            '3. **Opening.** Synthetic: which opening? His answer: Krish picked: "The hook" Changed: under test.\n'
            '4. **The floor.** Synthetic: is this the floor? His answer: Krish picked: "Yes, the floor" Changed: floor.\n'
            'Never synthetic (Krish, 28 Oct: "synthetic: no name, ever"); held (Krish, 29 Oct: "synthetic: kinds").\n')
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
    stray['reference_moments'][0]['shows'] = ['grace']
    assert bar_problems(stray, page) == ['reference moment 1: shows grace, which is not a quality'], \
        bar_problems(stray, page)
    # One home per fact: a moment or a comparison point changed on one side only is caught.
    drifted = page.replace('- 00:01.5 to 00:04: A build.', '- 00:01.5 to 00:05: A build.')
    assert sum('in the page only' in p or 'in the references only' in p for p in bar_problems(bar, drifted)) == 2
    assert any('Compare beside' in p for p in bar_problems(bar, page.replace('Synthetic tall 00:02.', 'Synthetic tall 00:03.')))
    # His words named the cuts; the reading stays a draft, the identity and the hearing are said, never assumed.
    for key, broken in (('standing', 'settled'), ('standing_note', '')):
        b = json.loads(json.dumps(bar))
        b[key] = broken
        assert bar_problems(b, page), key
    assert any('standing_note' in p for p in bar_problems(bar, page.replace('Synthetic: the engine reads', 'X')))
    b = json.loads(json.dumps(bar))
    del b['references'][0]['identity']
    assert any('identity' in p for p in bar_problems(b, page))
    b = json.loads(json.dumps(bar))
    del b['reference_moments'][1]['heard']
    assert any('heard' in p for p in bar_problems(b, page))
    # His words, exactly: a changed answer, a general word, an open question marked ruled or a stray ruling is caught.
    assert any('answer on the page' in p for p in bar_problems(bar, page.replace('"synthetic: yes"', '"synthetic: yes!"')))
    assert any('general words exactly' in p for p in bar_problems(bar, page.replace('> - keep it simple', '> - keep it short')))
    moved = page.replace('> "synthetic: these two are the floor"\n\n', '')
    moved = moved.replace('# Bar\n\n', '# Bar\n\n> "synthetic: these two are the floor"\n\n')
    assert any('open with his general words' in p for p in bar_problems(bar, moved)), bar_problems(bar, moved)
    b = json.loads(json.dumps(bar))
    b['rulings']['items'][1]['status'] = 'ruled'
    assert any('open on the page' in p for p in bar_problems(b, page))
    b = json.loads(json.dumps(bar))
    b['qualities'][0]['ruled'] = [2]
    assert any('not a ruled answer' in p for p in bar_problems(b, page))
    # A ruling's layer agrees with where it bites: a choice under test's ruling is under_test, and a layer is a layer.
    b = json.loads(json.dumps(bar))
    b['rulings']['items'][2]['layer'] = 'floor'
    assert any('no never of the floor cites it' in p for p in bar_problems(b, page)) and \
        any('so its layer is under_test' in p for p in bar_problems(b, page)), bar_problems(b, page)
    b = json.loads(json.dumps(bar))
    b['rulings']['items'][0]['layer'] = 'aspiration'
    assert any('layer must be one of' in p for p in bar_problems(b, page)), bar_problems(b, page)
    # The floor he confirmed: its nevers, their order, the question's wording, held at review, his confirmation and
    # the list's aims and under test lines agree between the page and the file, and its ruling stays a floor ruling.
    renamed = page.replace('1. **synthetic: no name.**', '1. **synthetic: no names.**')
    assert any('the floor on' in p and 'disagree' in p for p in bar_problems(bar, renamed)), bar_problems(bar, renamed)
    b = json.loads(json.dumps(bar))
    b['floor']['nevers'].reverse()
    assert any('order differs' in p for p in bar_problems(b, page)), bar_problems(b, page)
    b = json.loads(json.dumps(bar))
    b['floor']['nevers'].pop()
    assert any('disagree' in p for p in bar_problems(b, page)), 'a never dropped from the file must be caught'
    assert any("question's own wording" in p for p in bar_problems(bar, page.replace(' Asked as: synthetic: no name, as asked.', '')))
    assert any('held at review' in p for p in bar_problems(bar, page.replace('Held at review: no gate', 'Held by: no gate')))
    assert any('confirmation' in p for p in bar_problems(bar, page.replace('Krish picked: "Yes, the floor".', 'Yes.')))
    assert any("'## The aims" in p for p in bar_problems(bar, page.replace('"synthetic: aim high"', '"synthetic: aim"')))
    assert any("'## Under test" in p for p in bar_problems(bar, page.replace('"synthetic: the hook".', 'the hook.')))
    b = json.loads(json.dumps(bar))
    b['floor']['nevers'][1]['words'] = [{'said': 'synthetic: one close only'}]
    assert any('when or where' in p for p in bar_problems(b, page)), bar_problems(b, page)
    b = json.loads(json.dumps(bar))
    del b['floor']['nevers'][0]['held_by']
    assert any('missing held_by' in p for p in bar_problems(b, page)), bar_problems(b, page)
    b = json.loads(json.dumps(bar))
    b['rulings']['items'][3]['layer'] = 'aim'
    assert any('cited by the floor, so its layer is floor' in p for p in bar_problems(b, page)), bar_problems(b, page)
    b = json.loads(json.dumps(bar))
    b['floor']['ruling'] = 2
    assert any('the floor cites ruling 2, which is not a ruled answer' in p for p in bar_problems(b, page)), \
        bar_problems(b, page)
    b = json.loads(json.dumps(bar))
    b['rulings']['items'][0]['status'] = 'answered'
    del b['rulings']['items'][0]['production'], b['qualities'][1]['ruled']
    assert bar_problems(b, page) == [], bar_problems(b, page)
    assert any('answered in the references but open' in p
               for p in bar_problems(b, page.replace('"synthetic: yes" Changed', '"synthetic: yes" Still open')))
    # Words marked as his on the page are his exact words, and a quality citing a ruling quotes or names it.
    assert any('not his exact words' in p for p in bar_problems(bar, page.replace('(Krish, 28 Oct: "synthetic: yes")',
                                                                              '(Krish, 28 Oct: "synthetic: always")')))
    # His words on the floor and on how taste is held count as his words, and only exactly.
    assert any('not his exact words' in p for p in bar_problems(bar, page.replace('"synthetic: no name, ever"',
                                                                              '"synthetic: no names"')))
    assert any('not his exact words' in p for p in bar_problems(bar, page.replace('"synthetic: kinds"', '"synthetic: rules"')))
    for layer in ('taste', 'floor', 'under_test'):
        b = json.loads(json.dumps(bar))
        del b[layer]
        assert bar_problems(b, page) == [f'missing {layer}'], layer
    unquoted = page.replace(' (Krish, 28 Oct: "synthetic: yes")', '')
    assert any('cites ruling 1' in p for p in bar_problems(bar, unquoted)), bar_problems(bar, unquoted)
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        assert show_format(doc, 'short_video', False, 40, bar=bar) == 0
    text = out.getvalue()
    assert text.index('The bar: how every video should look') < text.index('The rejection floor for short_video') \
        < text.index('Approved standards'), text
    # His words on how taste is held lead; then the floor, the aims and what is under test, in that order.
    flat = ' '.join(text.split())
    assert flat.index('"synthetic: kinds, never narrow rules"') < flat.index('Floor: ') \
        < flat.index('Krish confirmed these, in his order, on 2026-10-29: Krish picked: "Yes, the floor".') \
        < flat.index('- 1. synthetic: no name. In his words (2026-10-28): "synthetic: no name, ever" Held by: the '
                     'synthetic lint.') \
        < flat.index('- 2. synthetic: one close. In his words (a synthetic canon): "synthetic: one close only" Held at '
                     'review: no gate holds it yet.') < flat.index('Aims: ') < flat.index('Under test: '), text
    assert 'The floor (2026-10-29)' not in text, 'the ruling that confirmed the floor is printed with the floor'
    assert text.index('"synthetic: these two are the floor"') < text.index('Standing: draft.') \
        < text.index("The engine's reading of those cuts, a draft:"), text
    assert text.index('    "synthetic: in general\n    - keep it simple\n\n    On brand."') \
        < text.index('- Music (2026-10-28): In his words: "synthetic: yes"') \
        < text.index('- Still open (readings):') < text.index('"synthetic: these two are the floor"'), text
    assert '- The hook first (production_choices.opening): Synthetic: hook. Krish picked: "The hook" (2026-10-29)' in text
    assert 'Opening (2026-10-29)' not in text, 'a choice under test is printed under test, never as an aim'
    assert 'Finish; Sound finish.' in text and 'Identity unconfirmed' in text, text
    assert 'The references (Synthetic tall) are named in' in text and 'board week' not in text, text
    assert 'Not a reference yet: the long cut' in text, text
    assert 'c' * 64 not in text and 'synthetic-drive-id' not in text, 'no hashes or file ids in the printed bar'
    bare = io.StringIO()
    with contextlib.redirect_stdout(bare):
        show_format(doc, 'short_video', False, 40)
    assert text.endswith(bare.getvalue()), 'the bar is added before the floor, which is otherwise unchanged'
    # Another video maker gets one line pointing at the bar; a maker it does not apply to gets nothing.
    pointer = io.StringIO()
    with contextlib.redirect_stdout(pointer):
        show_bar(bar, 'motion')
    assert pointer.getvalue().startswith('The bar: docs/production/SYNTHETIC_BAR.md') and \
        '--format short_video' in pointer.getvalue() and 'Finish: every frame owned' not in pointer.getvalue()
    other = json.loads(json.dumps(bar))
    other['applies_to_makers'] = ['long_video']
    other['full_bar_for_makers'] = ['long_video']
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
    p.add_argument('--blocking', action='store_true', help='the only taste standards a check may block on, as JSON: his eight nevers')
    p.add_argument('--self-test', action='store_true', help=argparse.SUPPRESS)
    p.add_argument('--file', type=Path, default=FLOOR, help=argparse.SUPPRESS)
    p.add_argument('--bar-file', type=Path, default=BAR, help=argparse.SUPPRESS)
    a = p.parse_args(argv)
    if a.self_test:
        return self_test()
    if a.blocking:
        bar, error = read_bar(a.bar_file)
        found = [] if error else blocking(bar)
        problems = [error] if error else blocking_problems(bar)
        print(json.dumps({'blocking': found, 'problems': problems}, indent=1))
        return 1 if problems else 0
    doc = load(a.file)
    if a.check:
        problems = [f'rejection floor: {problem}' for problem in (check(doc) if doc is not None else [])]
        bar, error = read_bar(a.bar_file)
        problems += [f'the bar: {error}'] if error else bar_check(bar) + [f'the bar: {x}' for x in blocking_problems(bar)]
        if doc is None:
            print(NO_FLOOR)
        for problem in problems:
            print(problem)
        return 1 if problems else 0
    bar = None
    if a.format:
        # Read only for a maker; a broken file is reported and never stops that maker's floor.
        bar, error = read_bar(a.bar_file)
        if error:
            print(f'The bar could not be read ({error}); run python3 scripts/floor.py --check.', file=sys.stderr)
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
