#!/usr/bin/env python3
"""The one route a carousel is made by: the deck checked, the v5 Library called by path, the drawn slides checked.

Krish, 26 Nov 2026: "Tell the Content-engine story intelligence for makeyourmindup v5 session that it is to enforce
carousel formatting." Every carousel content-engine makes goes through here (config/carousel-format.json route):

    python3 scripts/carousel_make.py <piece> --set <set> --deck DECK.json --out <folder>

1. The Library must be on this checkout (scripts/library/make_piece.py and scripts/covers/make_covers.py, which land
   on main since #984). Absent: it refuses with "the v5 Library is not on this checkout yet" (exit 2) and
   never falls back to another renderer.
2. The deck (carousel-deck/3) must pass scripts/carousel_check.py: the set and piece it names are this run's, 4 to 7
   slides in the set's registry order, the cover from make_covers.py, the glance lines, the takeaway close. A refusal
   fails the run (exit 1) before anything is drawn.
3. make_piece.py <piece> --set <set> --out <folder> draws the set in the registry's order, then
   make_covers.py <piece> --out <folder> draws the image-led cover over carousel/slide-01.png and writes covers.json.
   A Library refusal (its REFUSED stamp, a non-zero exit) fails the run.
4. The drawn slides must number 4 to 7 and match the deck; slide 1 must be the one covers.json records. Then it writes
   <folder>/carousel-receipt.json (carousel_check.receipt), which the manifest draft reads: a carousel whose receipt
   did not pass is not approvable (scripts/post-pack/piece_manifest.py).

Exit 0 made and passed; 1 refused (the reasons are printed); 2 the Library is not on this checkout. Local renders only:
nothing here posts, sends, publishes or spends.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import carousel_check  # noqa: E402
import carousel_format  # noqa: E402

ROOT = HERE.parent


class Refused(Exception):
    def __init__(self, message, code=1):
        super().__init__(message)
        self.code = code


def _argv(template, **fill):
    return [sys.executable if part == 'python' else part.format(**fill) for part in template]


def _run(argv, run=subprocess.run):
    done = run(argv, cwd=ROOT, capture_output=True, text=True)
    if done.returncode != 0:
        said = (done.stdout or '') + (done.stderr or '')
        raise Refused(f'the Library refused it ({" ".join(map(str, argv[1:3]))}):\n  ' + said.strip()[-1500:])
    return done


def _cover_sha(out: Path, first: str):
    """The sha256 covers.json records for the carousel's first slide, or None when it records none."""
    try:
        record = json.loads((out / 'covers.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise Refused('make_covers.py wrote no covers.json: the first slide comes only from make_covers.py') from None
    stack = [record]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if str(node.get('file') or node.get('path') or '').replace('\\', '/').endswith(first) and node.get('sha256'):
                return node['sha256']
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return None


def make(piece, set_name, deck_path, out, run=subprocess.run, root=ROOT):
    """Make the carousel, or Refused. Returns the receipt."""
    fmt = carousel_format.rules()
    refusal = carousel_format.absent_refusal(fmt, root)
    if refusal:
        raise Refused(refusal, 2)
    deck = json.loads(Path(deck_path).read_text(encoding='utf-8'))
    found = carousel_check.problems(deck)
    if deck.get('set') != set_name:
        found.insert(0, f'the deck is for set "{deck.get("set")}", this run makes "{set_name}"')
    if str(deck.get('piece') or '') != str(piece):
        found.insert(0, f'the deck is for piece "{deck.get("piece")}", this run makes "{piece}"')
    if found:
        raise Refused('the deck does not hold the carousel format, so nothing is drawn:\n  ' + '\n  '.join(found))
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    route = fmt['route']
    _run(_argv(route['carousel'], piece=piece, set=set_name, out=out), run)
    _run(_argv(route['covers'], piece=piece, out=out), run)
    slides = sorted(out.glob(route['slides_glob']))
    found = carousel_format.drawn_problems([str(p) for p in slides], fmt, deck)
    first = out / route['first_slide']
    want = None
    if not first.is_file():
        found.append(f'no {route["first_slide"]}: the first slide comes from make_covers.py')
    else:
        want = _cover_sha(out, route['first_slide'])
        if not want:
            found.append(f'covers.json records no sha256 for {route["first_slide"]}: the first slide comes only from make_covers.py')
        elif hashlib.sha256(first.read_bytes()).hexdigest() != want:
            found.append(f'{route["first_slide"]} is not the slide covers.json records: the first slide comes only from '
                         'make_covers.py')
    rec = carousel_check.receipt([str(p) for p in slides], str(deck_path), found, made_by='carousel_make',
                                 first_slide_sha256=want)
    (out / route['receipt']).write_text(json.dumps(rec, indent=1) + '\n', encoding='utf-8')
    if found:
        raise Refused('the drawn carousel does not hold the format:\n  ' + '\n  '.join(found))
    return rec


def main(argv=None, run=subprocess.run):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('piece')
    ap.add_argument('--set', required=True, dest='set_name')
    ap.add_argument('--deck', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args(argv)
    try:
        rec = make(a.piece, a.set_name, a.deck, a.out, run)
    except Refused as r:
        print(f'carousel_make: REFUSED {r}', file=sys.stderr)
        return r.code
    print(f'carousel_make: {len(rec["slides"])} slides made from the Library set {a.set_name}; receipt '
          f'{Path(a.out) / carousel_format.rules()["route"]["receipt"]}. Look at every slide at full size and at phone '
          'size, then ask the judges (scripts/post-pack/judge_assets.py).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
