"""Refuse retired robot artwork and robot cover prompts under the locked v5 look."""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROBOT = json.loads((ROOT / 'config' / 'brand-robot.json').read_text(encoding='utf-8'))
HOUSE_ROBOT = {r['sha256'] for r in ROBOT['references']}
ASKS_FOR_A_ROBOT = re.compile(r'\b(robots?|robotic|androids?|humanoids?|droids?|cyborgs?|mechs?|automatons?|'
                              r'(?:toy|tin|chat)\s*-?\s*bots?)\b', re.IGNORECASE)


def problems(record):
    """Why a cover generation record breaks the rule, or []."""
    if not isinstance(record, dict) or not isinstance(record.get('prompt'), str) or not record['prompt'].strip():
        return ['a cover record carries its "prompt"']
    refs = record.get('references') or []
    if not isinstance(refs, list):
        return ['"references" is a list of {"file", "sha256"}']
    asked = sorted({m.group(1).lower() for m in ASKS_FOR_A_ROBOT.finditer(record['prompt'])})
    if asked or HOUSE_ROBOT & {str(r.get('sha256', '')).lower() for r in refs if isinstance(r, dict)}:
        return ['the house robot is retired under v5']
    return []


def self_test():
    standing = ROBOT['references'][0]['sha256']
    cases = [
        ({'prompt': 'A toy chatbot robot alone on an auction podium'}, False),
        ({'prompt': 'A humanoid android at a desk grading its own exam'}, False),
        ({'prompt': 'The felt robot from the references at a desk', 'references': [{'file': 'robot-standing-source.webp', 'sha256': standing}]}, False),
        ({'prompt': 'A filing cabinet buried under an avalanche of printed code'}, True),
        ({'prompt': 'A robot', 'references': [{'file': 'other.png', 'sha256': '00'}]}, False),
        ({'prompt': ''}, False),
    ]
    failed = [c for c, ok in cases if (not problems(c)) != ok]
    if failed:
        sys.exit(f'cover_scene self-test failed: {failed}')
    print(f'cover_scene self-test passed: {len(cases)} checks')


def main(argv=None):
    ap = argparse.ArgumentParser(description='Check a cover prompt against the v5 robot retirement.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    chk = sub.add_parser('check', help='check one generation record (JSON) before generating')
    chk.add_argument('record', type=Path)
    sub.add_parser('self-test')
    args = ap.parse_args(argv)
    if args.cmd == 'self-test':
        return self_test()
    found = problems(json.loads(args.record.read_text(encoding='utf-8')))
    for p in found:
        print(f'{args.record}: {p}')
    if found:
        sys.exit(1)
    print(f'{args.record}: ok')


if __name__ == '__main__':
    main()
