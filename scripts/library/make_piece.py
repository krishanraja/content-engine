#!/usr/bin/env python3
"""make_piece: fill the makeyourmindup Library from one piece, and hand the files to post-pack.

Production makes every cover, thumbnail and carousel from the approved Library templates
(docs/ve/cards/library/LIBRARY-GUIDE.md and PRODUCTION-PLAYBOOK.md); nothing is drawn freehand.
This tool turns a piece's existing facts into a Library pack, renders it with the Library's own
renderer (`render.py --carousel-pack`), and copies the results to the names scripts/post-pack/build.py
expects.

    python scripts/library/make_piece.py docs/plans/2026-11-13-friday --set covers
    python scripts/library/make_piece.py docs/plans/2026-11-13-friday/cover-facts.json --set video
    python scripts/library/make_piece.py <piece> --set good-news --out <work folder>
    python scripts/library/make_piece.py <piece> --set covers --pack-only   # write the pack, render nothing

Sets:
  covers   the five covers: cover.png (1200 x 800), cover-1200x630.png, cover-1200x675.png,
           cover-1080x1080.png and cover-1080x1920.png, with a receipt (cover.json, cover-WxH.json) beside each
  video    the two video thumbnails: thumbs/thumb-wide-1280x720.jpg and thumbs/thumb-tall-1080x1920.jpg,
           with thumbs/thumbs.json
  <name>   any carousel set in library.json "carousel_sets" (piece, good-news, simple-advice, how-to,
           explainer, quiz, meme): carousel/slide-01.png and on, in the set's order

What it reads from the piece's cover-facts.json:
  cover.headline (or thumbs.headline for "video")      the Receipt's headline, lead line then payoff line
  cover.rows, then cover.strip (or the thumbs' ones)   up to three companies: "name", "logo" (a file beside
                                                       the facts) and "tag" (the verdict chip, optional)
  cover.proof                                          the piece's checked proof (receipt.proof_of): recorded
                                                       on every receipt, and the evidence card for a slot
                                                       that takes a document
  library                                              optional, per piece: {"headline": [...]} to use a
                                                       shorter headline the templates accept, and
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
MAX_LOGOS = 3

# post-pack kind -> (Library template, the file name scripts/post-pack/build.py looks for beside cover.png)
COVERS = {
    'cover': ('newsletter-substack-feed', 'cover.png', (1200, 800)),
    'substack-cover': ('newsletter-substack-cover-wide', 'cover-1200x630.png', (1200, 630)),
    'share-card-cover': ('social-share-card', 'cover-1200x675.png', (1200, 675)),
    'square-cover': ('social-square', 'cover-1080x1080.png', (1080, 1080)),
    'vertical-cover': ('cover-receipt-tall', 'cover-1080x1920.png', (1080, 1920)),
}
# thumbnail shape -> (Library template, the file name post-pack's thumbnail entries use)
THUMBS = {
    'wide': ('cover-receipt-youtube', 'thumb-wide-1280x720.jpg', (1280, 720)),
    'tall': ('cover-receipt-tall', 'thumb-tall-1080x1920.jpg', (1080, 1920)),
}
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


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or 'logo'


def relative(path, start):
    return Path(os.path.relpath(Path(path).resolve(), Path(start).resolve())).as_posix()


def headline_text(lines):
    if isinstance(lines, str):
        return lines
    if isinstance(lines, list) and lines and all(isinstance(s, str) and s.strip() for s in lines):
        return '\n'.join(s.strip() for s in lines)
    raise PieceError('the headline is one line or a list of lines (the lead, then the payoff)')


def approved_lines(facts, first):
    """Krish's own lines for a Receipt headline, in order of preference: the piece's override, then the block the set is
    for (cover or thumbs), then the other one. Each is (where it came from, text). Never a line the piece did not hold."""
    library = facts.get('library') or {}
    order = [('library.headline', library.get('headline'))]
    blocks = [('cover', facts.get('cover') or {}), ('thumbs', facts.get('thumbs') or {})]
    if first == 'thumbs':
        blocks.reverse()
    order += [(name + '.headline', block.get('headline')) for name, block in blocks]
    order.append(('headline', facts.get('headline')))
    lines, seen = [], set()
    for where, value in order:
        if not value:
            continue
        text = headline_text(value)
        if text not in seen:
            seen.add(text)
            lines.append((where, text))
    if not lines:
        raise PieceError('the facts give no headline (cover.headline, thumbs.headline or headline)')
    return lines


def fitting_line(item, lines):
    """The first approved line the template's headline slot takes (its character and line limits, as the renderer
    counts them), or a refusal naming every line tried. The renderer still checks the fitted size."""
    rule = item['slots']['headline_1']
    for where, text in lines:
        if len(text) <= rule['max_chars'] and len(text.split(chr(10))) <= rule['max_lines']:
            return where, text
    tried = '; '.join(f'{where} ({len(text)} characters, {len(text.splitlines())} lines)' for where, text in lines)
    raise PieceError(f'no approved line fits the headline of {item["id"]} (at most {rule["max_chars"]} characters in '
                     f'{rule["max_lines"]} lines): {tried}. Ask Krish for a shorter line in his shape (TITLES.md); never cut his words')


def companies(block, base):
    """Up to three companies for a Receipt, rows first and then the strip, each with a logo file that exists."""
    rows = list(block.get('rows') or []) + list(block.get('strip') or [])
    picked, seen = [], set()
    for row in rows:
        name = str(row.get('name') or '').strip()
        logo = row.get('logo')
        if not name or not logo:
            raise PieceError(f'every company row needs a "name" and a "logo" file: {row}')
        if name in seen:
            continue
        path = (base / logo).resolve()
        if not path.is_file():
            raise PieceError(f'the logo for {name} is missing: {path} (PRODUCTION-PLAYBOOK.md, Logos: add the cream SVG first)')
        if path.suffix.lower() != '.svg':
            raise PieceError(f'the logo for {name} is {path.name}; the piece keeps its logos as SVG (git keeps no PNG or JPEG)')
        seen.add(name)
        picked.append({'name': name, 'path': path, 'tag': (row.get('tag') or '').strip() or None})
        if len(picked) == MAX_LOGOS:
            break
    return picked


def receipt_content(headline, picked, evidence, out_dir):
    """The content and evidence for one Receipt template: headline, logos in row order, one chip per tagged row."""
    keys = []
    for company in picked:
        key = 'piece-' + slug(company['name'])
        evidence['tool_logos'][key] = {'name': company['name'], 'src': relative(company['path'], out_dir)}
        keys.append(key)
    content = {'headline_1': headline, 'logos': keys}
    for n in range(1, MAX_LOGOS + 1):
        tag = picked[n - 1]['tag'] if n <= len(picked) else None
        content[f'chip_{n}'] = tag
    return content


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
                proof_path = proof_image(facts, base)
                if proof_path is None:
                    problems.append(f'{item_id} {name} needs the piece\'s proof (cover.proof)')
                    continue
                ink = given.get('proof_ink_px')
                if not isinstance(ink, (int, float)) or ink <= 0:
                    problems.append('a document slot needs "proof_ink_px" in the facts\' "library" block (the painted height of the '
                                    'proof\'s key line in source pixels), so the reading floor is checked')
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
    facts = json.loads(facts_file.read_text(encoding='utf-8'))
    base = facts_file.parent
    library = registry()
    evidence = {'tool_logos': {}, 'screenshots': {}}
    extra = {'proof': proof_facts(facts)}
    if set_name == 'covers':
        cover = facts.get('cover') or {}
        if not cover:
            raise PieceError('the facts have no "cover" block')
        lines = approved_lines(facts, 'cover')
        picked = companies(cover, base)
        items = {item['id']: item for item in library['items']}
        content, extra['headlines'] = {}, {}
        for template, _, _ in COVERS.values():
            where, text = fitting_line(items[template], lines)
            content[template] = receipt_content(text, picked, evidence, out_dir)
            extra['headlines'][template] = where
        outputs = [(template, name) for template, name, _ in COVERS.values()]
        images = {}
        extra['logos'] = [c['name'] for c in picked]
    elif set_name == 'video':
        thumbs = facts.get('thumbs') or {}
        block = thumbs if (thumbs.get('rows') or thumbs.get('strip')) else (facts.get('cover') or {})
        lines = approved_lines(facts, 'thumbs')
        picked = companies(block, base)
        items = {item['id']: item for item in library['items']}
        content, extra['headlines'] = {}, {}
        for template, _, _ in THUMBS.values():
            where, text = fitting_line(items[template], lines)
            content[template] = receipt_content(text, picked, evidence, out_dir)
            extra['headlines'][template] = where
        outputs = [(template, 'thumbs/' + name) for template, name, _ in THUMBS.values()]
        images = {}
        extra['logos'] = [c['name'] for c in picked]
    else:
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
    receipt = {'template': 'library', 'portrait': False, 'pack': pack_sha, 'set': set_name,
               'proof': extra.get('proof'), 'skin': None}
    if set_name == 'covers':
        for template, target in written:
            record = dict(receipt, library_item=template, sha256=sha256_of(target), logos=extra.get('logos'),
                          rows=extra.get('logos'), headline_from=(extra.get('headlines') or {}).get(template))
            target.with_suffix('.json').write_text(json.dumps(record, indent=1), encoding='utf-8')
    elif set_name == 'video':
        record = dict(receipt, logos=extra.get('logos'), companies=extra.get('logos'),
                      files=[{'file': target.name, 'shape': shape, 'library_item': template, 'sha256': sha256_of(target)}
                             for (template, target), shape in zip(written, THUMBS)])
        (out_dir / 'thumbs' / 'thumbs.json').write_text(json.dumps(record, indent=1), encoding='utf-8')
    return [target for _, target in written]


def post_pack_entries(set_name, written, out_dir, logos):
    """The post.json "files" entries for what was written, as scripts/post-pack/build.py reads them."""
    if set_name == 'covers':
        return [{'kind': 'cover', 'file': relative(out_dir / 'cover.png', out_dir), 'logos': logos}]
    if set_name == 'video':
        return [{'kind': 'thumbnail', 'shape': shape, 'file': f'thumbs/{THUMBS[shape][1]}', 'logos': logos} for shape in THUMBS]
    return [{'category': 'social', 'file': relative(path, out_dir),
             'purpose': f'Carousel slide {n} of {len(written)} ({set_name}), from the Library.'} for n, path in enumerate(written, 1)]


def sha256_of(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n', 1)[0])
    parser.add_argument('piece', help='the piece folder (docs/plans/<day>) or its cover-facts.json')
    parser.add_argument('--set', required=True, dest='set_name', help='covers, video, or a carousel set name')
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
        print('Next: python thumb_gate.py on each cover and thumbnail (docs/ve/cards/library), then look at every file at full and phone size.')
        return 0
    except PieceError as error:
        print(f'make_piece: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
