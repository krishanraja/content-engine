#!/usr/bin/env python3
"""make_piece: fill the makeyourmindup Library from one piece, and hand the files to post-pack.

Production makes every carousel and Library item from the approved Library templates
(docs/ve/cards/library/LIBRARY-GUIDE.md and PRODUCTION-PLAYBOOK.md); nothing is drawn freehand. Covers and
thumbnails come from the approved cover systems instead, scripts/covers/make_covers.py (Krish, 26 Nov 2026:
"I approve the new cover thumbnail systems, go"), and this tool refuses the old "covers" and "video" sets.
This tool turns a piece's existing facts into a Library pack, renders it with the Library's own
renderer (`render.py --carousel-pack`), and copies the results to the names scripts/post-pack/build.py
expects.

    python scripts/library/make_piece.py <piece> --set good-news --out <work folder>
    python scripts/library/make_piece.py <piece> --set how-to --pack-only   # write the pack, render nothing

Sets:
  <name>   any carousel set in library.json "carousel_sets" (piece, good-news, simple-advice, how-to,
           explainer, quiz, meme): carousel/slide-01.png and on, in the set's order

What it reads from the piece's cover-facts.json:
  cover.proof                                          the piece's checked proof (receipt.proof_of): recorded
                                                       on every receipt, and the evidence card for a slot
                                                       that takes a document
  library                                              optional, per piece:
                                                       {"<template id>": {"<slot>": "words"}} for every text
                                                       slot of a carousel set, {"images": {"<template id>":
                                                       {"<slot>": record}}} for its pictures (imagery.js's
                                                       acceptCarouselImage record, "src" beside the facts),
                                                       and "proof_ink_px", the painted height in source pixels
                                                       of the proof's key line, so the reading floor is checked

It never invents words: every text slot of every template it renders must come from the piece, or it refuses
and names the slot. A template's refusal (a red REFUSED stamp in review) stops it too, in the renderer's own
words (PRODUCTION-PLAYBOOK.md section 5 says how to fix each). Data devices whose numbers live in the template
(the bar meters, the threshold axis and the built-in Spotify evidence) cannot take a piece's numbers yet, so a
set that holds one is refused rather than drawing another story's data.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = ROOT / 'docs' / 've' / 'cards' / 'library'
PACKS = ROOT / '.scratch' / 'library' / 'out' / 'packs'
COVER_ROUTE = ('covers and thumbnails come from the approved cover systems: python scripts/covers/make_covers.py '
               '<piece folder> --out <folder> (docs/ve/cards/library/COVERS-PLAYBOOK.md). The Library cover templates '
               'it replaced are retired (Krish, 26 Nov 2026: "I approve the new cover thumbnail systems, go")')
# Scene ops that carry the template's own sample data, which a pack cannot replace yet.
FIXED_DEVICES = {'meter', 'threshold-axis', 'evidence', 'timeline', 'scale'}


class PieceError(Exception):
    """A plain-words reason the piece cannot be filled."""


def registry():
    return json.loads((LIBRARY / 'library.json').read_text(encoding='utf-8'))


def facts_path(target):
    path = Path(target)
    if path.is_dir():
        path = path / 'cover-facts.json'
    if not path.is_file():
        raise PieceError(f'no cover facts at {path}: give the piece folder (docs/plans/<day>) or its cover-facts.json')
    return path.resolve()


def relative(path, start):
    return Path(os.path.relpath(Path(path).resolve(), Path(start).resolve())).as_posix()


def proof_facts(facts):
    """The piece's proof as its facts give it, checked against the piece's sources: recorded on every receipt."""
    proof = (facts.get('cover') or {}).get('proof') or (facts.get('thumbs') or {}).get('proof')
    if not proof:
        return None
    if not any(proof.get(k) for k in ('image', 'pdf', 'page', 'html')):
        raise PieceError('"proof" names no picture: give "image", "pdf", "page" or "html" from one of the checked sources of the piece')
    sources = facts.get('sources') or {}
    if sources and proof.get('source') not in sources:
        raise PieceError(f'"proof": "source" must be one of the sources of the piece ({", ".join(sources)}), not {proof.get("source")!r}')
    return {k: proof.get(k) for k in ('image', 'pdf', 'page', 'html', 'source', 'tag')}


def proof_image(facts, base):
    """The proof as a picture on this machine, through the old drawer's own capture and checks (receipt.proof_of).
    Only a slot that shows the proof needs it; a page or PDF proof is fetched once into .cache/proofs."""
    proof = (facts.get('cover') or {}).get('proof') or (facts.get('thumbs') or {}).get('proof')
    if not proof:
        return None
    sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
    import receipt  # noqa: E402  (the proof capture and its source checks)
    try:
        checked = receipt.proof_of({'proof': proof}, facts, base)
    except SystemExit as exc:
        raise PieceError(f'the proof is not usable: {exc}') from exc
    return Path(checked['path'])


def text_slots(item):
    slots = item.get('slots') or {}
    return [name for name, rule in slots.items()
            if rule.get('role') not in ('photo', 'document', 'screenshot', 'logos') and 'headshot' not in name]


def carousel_pack(facts, base, set_name, library, out_dir, evidence):
    sets = library['carousel_sets']
    if set_name not in sets:
        raise PieceError(f'there is no carousel set {set_name!r}: the sets are {", ".join(sets)}, plus covers and video')
    by_id = {item['id']: item for item in library['items'] if item.get('status') != 'retired'}
    chosen = sets[set_name]
    order = [chosen['cover'], *chosen['inside'], chosen['close']]
    given = facts.get('library') or {}
    content, images, problems = {}, {}, []
    for item_id in order:
        item = by_id[item_id]
        fixed = sorted({op['kind'] for op in item.get('scene') or [] if op['kind'] in FIXED_DEVICES})
        if fixed:
            problems.append(f'{item_id} draws the template\'s own sample data ({", ".join(fixed)}), which a pack cannot set yet')
            continue
        words = dict(given.get(item_id) or {})
        for name in text_slots(item):
            if name not in words:
                problems.append(f'{item_id} needs its {name} from the piece (library.{item_id}.{name} in the cover facts)')
        for name, rule in (item.get('slots') or {}).items():
            if rule.get('role') == 'document':
                ink = given.get('proof_ink_px')
                if not isinstance(ink, (int, float)) or ink <= 0:
                    problems.append('a document slot needs "proof_ink_px" in the facts\' "library" block (the painted height of the '
                                    'proof\'s key line in source pixels), so the reading floor is checked')
                    continue
                proof_path = proof_image(facts, base)
                if proof_path is None:
                    problems.append(f'{item_id} {name} needs the piece\'s proof (cover.proof)')
                    continue
                from PIL import Image
                with Image.open(proof_path) as im:
                    size = list(im.size)
                key = 'piece-proof'
                evidence['screenshots'][key] = {'name': 'The piece\'s proof', 'source': str(facts.get('cover', {}).get('proof', {}).get('tag') or 'source'),
                                                'src': relative(proof_path, out_dir), 'size': size, 'crops': [[0, 0, *size]], 'key_ink_px': ink}
                words[name] = key
        content[item_id] = words
        for slot, record in ((given.get('images') or {}).get(item_id) or {}).items():
            record = dict(record)
            src = (base / record['src']).resolve()
            if not src.is_file():
                problems.append(f'{item_id} {slot}: the picture is missing: {src}')
                continue
            record['src'] = relative(src, out_dir)
            images.setdefault(item_id, {})[slot] = record
    if problems:
        raise PieceError('the carousel set cannot be filled from this piece:\n  - ' + '\n  - '.join(problems))
    outputs = [(item_id, f'carousel/slide-{n:02d}.png') for n, item_id in enumerate(order, 1)]
    return content, images, outputs


def build_pack(facts_file, set_name, out_dir):
    """(pack dict, outputs [(template id, relative output name)], receipt extras)."""
    if set_name in ('covers', 'video'):
        raise PieceError(COVER_ROUTE)
    facts = json.loads(facts_file.read_text(encoding='utf-8'))
    base = facts_file.parent
    library = registry()
    evidence = {'tool_logos': {}, 'screenshots': {}}
    extra = {'proof': proof_facts(facts)}
    content, images, outputs = carousel_pack(facts, base, set_name, library, out_dir, evidence)
    pack = {'piece': {'facts': relative(facts_file, out_dir), 'set': set_name, 'date': facts.get('date'),
                      'subchannel': facts.get('subchannel')},
            'content': content, 'images': images, 'evidence': evidence}
    return pack, outputs, extra


def render(pack_file, templates):
    """Run the Library's renderer on the pack, for these templates only. Returns the pack's output folder."""
    command = [sys.executable, '-B', 'render.py', '--carousel-pack', str(pack_file), '--items', ','.join(templates)]
    env = dict(os.environ, PYTHONUTF8='1')
    done = subprocess.run(command, cwd=LIBRARY, env=env, capture_output=True, text=True, encoding='utf-8')
    said = (done.stdout or '') + (done.stderr or '')
    if done.returncode:
        refused = re.findall(r'REFUSED[^\n]*|Error: [^\n]*', said)
        raise PieceError('the Library refused the pack:\n  ' + ('\n  '.join(dict.fromkeys(refused)) or said.strip()[-1500:]))
    folder = PACKS / hashlib.sha256(pack_file.read_bytes()).hexdigest()[:16]
    if not (folder / 'items').is_dir():
        raise PieceError(f'the renderer finished but wrote no items under {folder}')
    return folder


def copy_outputs(folder, outputs, out_dir, set_name, extra, pack_sha):
    from PIL import Image
    written = []
    for template, name in outputs:
        source = folder / 'items' / f'{template}.png'
        if not source.is_file():
            raise PieceError(f'the renderer wrote no {template}.png')
        target = out_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.suffix.lower() == '.jpg':
            with Image.open(source) as im:
                im.convert('RGB').save(target, 'JPEG', quality=92)
        else:
            shutil.copyfile(source, target)
        written.append((template, target))
    return [target for _, target in written]


def post_pack_entries(set_name, written, out_dir, logos):
    """The post.json "files" entries for what was written, as scripts/post-pack/build.py reads them."""
    return [{'category': 'social', 'file': relative(path, out_dir),
             'purpose': f'Carousel slide {n} of {len(written)} ({set_name}), from the Library.'} for n, path in enumerate(written, 1)]


def sha256_of(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n', 1)[0])
    parser.add_argument('piece', help='the piece folder (docs/plans/<day>) or its cover-facts.json')
    parser.add_argument('--set', required=True, dest='set_name', help='a carousel set name (covers and thumbnails: scripts/covers/make_covers.py)')
    parser.add_argument('--out', type=Path, help='where the files go (default .cache/library/<piece folder>/<set>)')
    parser.add_argument('--pack-only', action='store_true', help='write the pack and stop, rendering nothing')
    args = parser.parse_args(argv)
    try:
        facts_file = facts_path(args.piece)
        out_dir = (args.out or ROOT / '.cache' / 'library' / facts_file.parent.name / args.set_name).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        pack, outputs, extra = build_pack(facts_file, args.set_name, out_dir)
        pack_file = out_dir / 'library-pack.json'
        pack_file.write_text(json.dumps(pack, indent=1, ensure_ascii=False), encoding='utf-8')
        print(f'Pack: {pack_file}')
        if args.pack_only:
            return 0
        templates = list(dict.fromkeys(template for template, _ in outputs))
        folder = render(pack_file, templates)
        written = copy_outputs(folder, outputs, out_dir, args.set_name, extra, sha256_of(pack_file))
        entries = post_pack_entries(args.set_name, written, out_dir, extra.get('logos') or [])
        (out_dir / 'post-pack-files.json').write_text(json.dumps(entries, indent=1), encoding='utf-8')
        for path in written:
            print(f'Wrote {path}')
        print(f'post.json "files" entries: {out_dir / "post-pack-files.json"}')
        print('Next: look at every slide at full and phone size.')
        return 0
    except PieceError as error:
        print(f'make_piece: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
