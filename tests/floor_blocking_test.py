#!/usr/bin/env python3
"""W2.10: the floor's blocking set is exactly Krish's eight nevers, and floor.py --format short_video shows a test reject.

Krish, 2026-10-29: "I would much rather the engine know what kind of thing doesn't fly with me, rather than implement
incredibly specific rules everywhere". Only the eight nevers he confirmed ("Yes, that's the floor") may block; every
standard in the rejection floor guides and never blocks. The test reject is synthetic (tests/fixtures/floor).
"""
import contextlib
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import floor  # noqa: E402

FIXTURE = ROOT / 'tests' / 'fixtures' / 'floor' / 'test-reject.json'


def run(argv):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = floor.main(argv)
    return code, out.getvalue()


def main():
    problems = []
    code, text = run(['--blocking'])
    found = json.loads(text)
    if code != 0 or len(found['blocking']) != 8 or found['problems']:
        problems.append(f'--blocking is exactly his eight nevers ({code}, {len(found["blocking"])}, {found["problems"]})')
    bar = json.loads((ROOT / 'config' / 'reference-cuts.json').read_text(encoding='utf-8'))
    if [n['id'] for n in floor.blocking(bar)] != [n['id'] for n in bar['floor']['nevers']]:
        problems.append('the blocking set keeps his order')
    seven = json.loads(json.dumps(bar))
    seven['floor']['nevers'].pop()
    if not floor.blocking_problems(seven):
        problems.append('a floor with seven nevers is refused')
    nine = json.loads(json.dumps(bar))
    nine['floor']['nevers'].append(dict(nine['floor']['nevers'][0], id='a_ninth_rule'))
    if not floor.blocking_problems(nine):
        problems.append('a ninth blocking rule is refused')
    code, text = run(['--format', 'short_video', '--file', str(FIXTURE)])
    if code != 0 or 'TEST REJECT (synthetic, filed by a clocked run)' not in text or 'Synthetic test reject: this card holds too long.' not in text:
        problems.append('floor.py --format short_video shows the test reject with his words')
    if 'Blocking: only his eight nevers' not in text or 'they never block' not in text:
        problems.append('the maker\'s floor says only the eight nevers block, and the standards never do')
    if problems:
        print('floor blocking test FAILED:\n  ' + '\n  '.join(problems))
        return 1
    print('floor blocking test passed: eight nevers block, nothing else does, and the test reject shows')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
