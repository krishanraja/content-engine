#!/usr/bin/env python3
"""One spine per piece (house rule ONE_SPINE): the outline's shape, and the
engine's judge on the draft.

Krish, 2026-10-14: "we ended up with an absolute ton of drift here ... All of
this could have been turned into something coherent, but it's ended up
sprawling quite a lot ... the engine cannot do this again." Wednesday's piece
was re-angled five times and each new angle was added as sections; none
replaced the spine.

An outline (docs/plans/<date>-outline.md) from SPINE_FROM on holds:

    Spine: <the one question the piece answers>?
    Answer: <its one-line answer>
    1. <SECTION HEADING> | proves: <the part of the answer it proves>
    ... (at most MAX_SECTIONS, the prediction included)
    Approved by Krish: <his words>, <date>

and the draft's "## " headings are exactly those sections, in that order. A
new angle is a new spine and a new outline from scratch, approved again: never
sections added to an approved outline.

    python3 scripts/post-pack/spine_check.py outline docs/plans/<date>-outline.md
    python3 scripts/post-pack/spine_check.py draft docs/plans/<date>-draft-body.md --outline <outline>
    python3 scripts/post-pack/spine_check.py judge <piece id> --outline <outline>   (the engine reads the stored body)
    python3 scripts/post-pack/spine_check.py --self-test
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPINE_FROM = '2026-10-19'  # outlines for pieces from the week of 19 October; Friday 16 Oct's was approved before the rule
MAX_SECTIONS = 6
SECTION = re.compile(r'^\s*\d+\.\s+(.+?)\s*\|\s*proves:\s*(.+?)\s*$', re.I)


def parse_outline(text):
    spine = re.search(r'^Spine:\s*(.+?)\s*$', text, re.M)
    answer = re.search(r'^Answer:\s*(.+?)\s*$', text, re.M)
    sections = [(m.group(1).strip(), m.group(2).strip()) for m in (SECTION.match(l) for l in text.splitlines()) if m]
    return {
        'spine': spine.group(1) if spine else '',
        'answer': answer.group(1) if answer else '',
        'sections': sections,
        'approved': bool(re.search(r'^Approved by Krish:\s*\S', text, re.M)),
    }


def outline_problems(text):
    o = parse_outline(text)
    out = []
    if not o['spine'].endswith('?'):
        out.append('no spine: add "Spine: <the one question the piece answers>?"')
    if len(re.findall(r'^Spine:', text, re.M)) > 1:
        out.append('more than one spine: a piece answers one question')
    if not o['answer']:
        out.append('no answer: add "Answer: <its one-line answer>"')
    if not o['sections']:
        out.append('no sections: list each as "1. <HEADING> | proves: <the part of the answer it proves>"')
    if len(o['sections']) > MAX_SECTIONS:
        out.append(f'{len(o["sections"])} sections, over {MAX_SECTIONS}: cut the ones that answer a different question')
    numbered = [l for l in text.splitlines() if re.match(r'^\s*\d+\.\s', l)]
    loose = [l.strip() for l in numbered if not SECTION.match(l)]
    if loose:
        out.append('sections without what they prove: ' + '; '.join(loose[:3]))
    if not o['approved']:
        out.append('not approved: add Krish\'s words as "Approved by Krish: <his words>, <date>"')
    return out


def headings(body):
    return [m.group(1).strip() for m in re.finditer(r'^##\s+(.+?)\s*$', body, re.M)]


def draft_problems(body, outline_text):
    want = [h for h, _ in parse_outline(outline_text)['sections']]
    got = headings(body)
    norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()
    out = []
    extra = [h for h in got if norm(h) not in {norm(w) for w in want}]
    missing = [w for w in want if norm(w) not in {norm(h) for h in got}]
    if extra:
        out.append('sections the approved outline does not have: ' + '; '.join(extra)
                   + '. A new angle is a new spine and a new outline, approved by Krish; never sections added on top')
    if missing:
        out.append('outline sections the draft lacks: ' + '; '.join(missing))
    if not extra and not missing and [norm(h) for h in got] != [norm(w) for w in want]:
        out.append('the sections are not in the approved order')
    return out


def dated(path):
    m = re.match(r'(\d{4}-\d{2}-\d{2})-', Path(path).name)
    return m.group(1) if m else None


def judge(piece, outline_text):
    o = parse_outline(outline_text)
    body = json.dumps({'spine': o['spine'], 'answer': o['answer'], 'client': 'claude_code'})
    p = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'engine.py'), 'POST', f'/api/content-ideas/{piece}/spine-check', body, '--full'],
                       capture_output=True, text=True, cwd=ROOT)
    text = p.stdout
    try:
        return json.loads(text[text.index('{'):])
    except ValueError:
        return {'ok': False, 'error': (text + p.stderr).strip()[-600:]}


def self_test():
    good = ('Spine: Who decides which AI answers you?\nAnswer: The app does, and soon you will not see it.\n'
            '1. THE MENU IS ALREADY GOING | proves: the choice is being taken away\n'
            '2. WHOEVER PICKS, PRICES | proves: the picker sets what your money buys\n'
            '3. MY PREDICTION | proves: when the menu disappears\nApproved by Krish: "yes", 2026-10-20\n')
    body = 'Opening.\n\n## THE MENU IS ALREADY GOING\nx\n\n## WHOEVER PICKS, PRICES\ny\n\n## MY PREDICTION\nz\n'
    added = body.replace('## MY PREDICTION', '## WHY SIRI, OF ALL THINGS?\nw\n\n## MY PREDICTION')
    checks = [
        ('a full outline passes', outline_problems(good), []),
        ('no spine is refused', any('no spine' in p for p in outline_problems(good.replace('Spine: Who decides which AI answers you?\n', ''))), True),
        ('a spine that is not a question is refused', any('no spine' in p for p in outline_problems(good.replace('answers you?', 'answers you.'))), True),
        ('a section without what it proves is refused', any('without what they prove' in p for p in outline_problems(good + '4. ADS\n')), True),
        ('seven sections are refused', any('over 6' in p for p in outline_problems(good + ''.join(f'{n}. S{n} | proves: x\n' for n in range(4, 8)))), True),
        ('an unapproved outline is refused', any('not approved' in p for p in outline_problems(good.replace('Approved by Krish', 'Draft'))), True),
        ('the draft matching the outline passes', draft_problems(body, good), []),
        ('a section added on top is refused, naming it', any('WHY SIRI' in p and 'new spine' in p for p in draft_problems(added, good)), True),
        ('a missing section is named', any('WHOEVER PICKS' in p for p in draft_problems(body.replace('## WHOEVER PICKS, PRICES\ny\n\n', ''), good)), True),
        ('the outline\'s date decides the rule', dated('docs/plans/2026-10-21-outline.md') >= SPINE_FROM > dated('docs/plans/2026-10-09-outline.md'), True),
    ]
    fails = [f'{n}: got {g!r}, want {w!r}' for n, g, w in checks if g != w]
    print('spine check self-test ' + ('FAILED:\n  ' + '\n  '.join(fails) if fails else f'passed: {len(checks)} checks'))
    return 1 if fails else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='One spine per piece (house rule ONE_SPINE).')
    ap.add_argument('what', nargs='?', choices=['outline', 'draft', 'judge'])
    ap.add_argument('target', nargs='?', help='the outline, the draft body, or the piece id')
    ap.add_argument('--outline')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if a.what == 'outline':
        why = outline_problems(Path(a.target).read_text(encoding='utf-8'))
    elif a.what == 'draft':
        why = draft_problems(Path(a.target).read_text(encoding='utf-8'), Path(a.outline).read_text(encoding='utf-8'))
    elif a.what == 'judge':
        r = judge(a.target, Path(a.outline).read_text(encoding='utf-8'))
        if not r.get('ok'):
            print('the judge did not run: ' + str(r.get('error')))
            return 1
        for s in r['spine_check']['sections']:
            print(('answers  ' if s['answers'] else 'OFF SPINE ') + s['heading'] + ': ' + s['why'])
        print('passed' if r['passed'] else 'NOT PASSED: cut the sections off the spine, or ask Krish for a new spine and a new outline')
        return 0 if r['passed'] else 1
    else:
        ap.error('say outline, draft or judge')
    print('\n'.join('- ' + w for w in why) if why else 'passes')
    return 1 if why else 0


if __name__ == '__main__':
    sys.exit(main())
