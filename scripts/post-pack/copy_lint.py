#!/usr/bin/env python3
"""copy_lint: the deterministic copy lint on every public word around a piece.

Krish, 2026-10-28: "don't add stupid eyebrow text and asterisks and "generated
by AI" and "Krish's take" verbal diahorrea like you tend to. This needs to feel
like a world class media channel". With his 26 October ruling that no
illustration-generation boilerplate goes on public artwork, captions or
descriptions (docs/CAROUSEL-STANDARD.md).

The patterns live once, in config/copy-lint.json, and
apps/control-plane/api/_copyLint.ts reads the same file, so CI
(scripts/check-public-copy.ts) and every session that runs this read the same
patterns. Each pattern says which public surface it covers:

  channel_copy      captions, descriptions, Notes and posts
  carousel_text     every word on a carousel card
  video_onscreen    on-screen words, covers and thumbnails
  titles            video, episode, Short and article titles
  article_metadata  the article's headline, deck and description

It never runs on the article body's markdown source, where emphasis and
headings are the markdown itself.

    python3 scripts/post-pack/copy_lint.py [--applies-to channel_copy] caption.txt [more files]
    python3 scripts/post-pack/copy_lint.py materials.json cards.json cover-facts.json creative-direction.json

A text file is one piece of copy, linted as --applies-to (channel_copy when
not given). A JSON file in one of the engine's own shapes (board materials,
carousel cards, cover facts, a creative direction) is read field by field,
always each field as the surface it is: --applies-to never applies to a JSON
file, so it cannot switch a field's rules off. A JSON file in none of those
shapes is refused (exit 2), so the lint is never clean on a file it did not
read.

Prints one line per hit (id, file, line, match) and exits 1 on any hit, 0 when
the copy is clean, 2 when a file cannot be read. Import copy_lint(text, applies_to) to use it in code.
No model, no network, no secrets: it runs before any paid call.
"""
import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / 'config' / 'copy-lint.json'
SURFACES = ('channel_copy', 'carousel_text', 'video_onscreen', 'titles', 'article_metadata')
_FLAGS = {'i': re.IGNORECASE, 'm': re.MULTILINE}
_compiled = None


def config():
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def patterns():
    """[(id, compiled regex, applies_to)] from config/copy-lint.json, read once."""
    global _compiled
    if _compiled is None:
        out = []
        for p in config()['patterns']:
            flags = 0
            for f in p.get('flags', ''):
                if f not in _FLAGS:
                    raise ValueError(f"copy-lint pattern {p['id']}: flag {f!r} is not one both Python and the server read (i, m)")
                flags |= _FLAGS[f]
            # ASCII word rules (\w, \b, \d), as the server's JavaScript reads them.
            out.append((p['id'], re.compile(p['regex'], flags | re.ASCII), tuple(p['applies_to'])))
        _compiled = out
    return _compiled


_SPACES = re.compile('[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]')
# U+2028 and U+2029 end a line for JavaScript's ^, $ and \s but not for
# re.ASCII, and pasted text can end a line with U+0085, so both readers turn
# all three into \n first.
_LINE_ENDS = re.compile('[\u2028\u2029\u0085]')


def normalise(text):
    """Line ends as \\n and every odd space as a plain one, so a pattern reads the same in Python and on the server."""
    return _SPACES.sub(' ', _LINE_ENDS.sub('\n', text.replace('\r\n', '\n').replace('\r', '\n')))


def copy_lint(text, applies_to):
    """Every hit in one piece of public copy: [{'id', 'match', 'index', 'line'}], in order.

    index is the offset in the normalised copy (line ends as \\n). It counts
    characters; the server counts UTF-16 units, so the two differ only after an
    emoji. id and match are the same on both sides."""
    if applies_to not in SURFACES:
        raise ValueError(f'applies_to must be one of {", ".join(SURFACES)}, not {applies_to!r}')
    text = normalise(text or '')
    hits = []
    for pid, rx, surfaces in patterns():
        if applies_to not in surfaces:
            continue
        for m in rx.finditer(text):
            if m.group(0) == '':
                continue
            hits.append({'id': pid, 'match': m.group(0), 'index': m.start(),
                         'line': text.count('\n', 0, m.start()) + 1})
    hits.sort(key=lambda h: (h['index'], h['id']))
    return hits


def _list(value):
    return value if isinstance(value, list) else []


def _title_label(label):
    return bool(re.search(r'\btitle\b', label or '', re.I))


def fields(data):
    """(where, text, applies_to) for every public word in one of the engine's JSON shapes.

    Board materials: sections[].copy[] (a label with "title" in it is a title).
    Carousel cards: cards[].kicker and cards[].lines[].text.
    Cover facts: headline and deck (article metadata), video_title (title),
    comment_question and the cover and thumbnail words (on screen).
    Creative direction: cuts.<cut>.beats[].on_screen_text (on screen)."""
    out = []
    if not isinstance(data, dict):
        return out
    for si, section in enumerate(_list(data.get('sections'))):
        for ci, item in enumerate(_list(section.get('copy') if isinstance(section, dict) else None)):
            if isinstance(item, dict) and isinstance(item.get('text'), str):
                label = item.get('label') if isinstance(item.get('label'), str) else ''
                surface = 'titles' if _title_label(label) else 'channel_copy'
                out.append((f'sections[{si}].copy[{ci}] ({label})', item['text'], surface))
    for ki, card in enumerate(_list(data.get('cards'))):
        if not isinstance(card, dict):
            continue
        if isinstance(card.get('kicker'), str):
            out.append((f'cards[{ki}].kicker', card['kicker'], 'carousel_text'))
        for li, line in enumerate(_list(card.get('lines'))):
            if isinstance(line, dict) and isinstance(line.get('text'), str):
                out.append((f'cards[{ki}].lines[{li}]', line['text'], 'carousel_text'))
    for key, surface in (('headline', 'article_metadata'), ('deck', 'article_metadata'),
                         ('video_title', 'titles'), ('comment_question', 'video_onscreen')):
        if isinstance(data.get(key), str) and ('subchannel' in data or 'cover' in data or 'thumbs' in data):
            out.append((key, data[key], surface))
    for panel in ('cover', 'thumbs'):
        block = data.get(panel)
        if not isinstance(block, dict):
            continue
        for hi, words in enumerate(_list(block.get('headline'))):
            if isinstance(words, str):
                out.append((f'{panel}.headline[{hi}]', words, 'video_onscreen'))
        for group in ('rows', 'strip'):
            for ri, row in enumerate(_list(block.get(group))):
                for key in ('name', 'tag'):
                    if isinstance(row, dict) and isinstance(row.get(key), str):
                        out.append((f'{panel}.{group}[{ri}].{key}', row[key], 'video_onscreen'))
    cuts = data.get('cuts')
    if isinstance(cuts, dict):
        for cut, spec in cuts.items():
            for bi, beat in enumerate(_list(spec.get('beats') if isinstance(spec, dict) else None)):
                words = beat.get('on_screen_text') if isinstance(beat, dict) else None
                if isinstance(words, str) and words.strip():
                    out.append((f'cuts.{cut}.beats[{bi}].on_screen_text', words, 'video_onscreen'))
    return out


def known_shape(data):
    """True when the JSON is one of the shapes fields() reads, even with no words in it yet."""
    return isinstance(data, dict) and (isinstance(data.get('sections'), list) or isinstance(data.get('cards'), list)
                                       or isinstance(data.get('cuts'), dict)
                                       or any(k in data for k in ('subchannel', 'cover', 'thumbs')))


def _line_in_file(raw, text, fallback=1):
    """The line in the JSON file where this string's value sits, so a hit can be found by eye."""
    encoded = json.dumps(text, ensure_ascii=False)[1:-1]
    at = raw.find(encoded)
    if at < 0:
        at = raw.find(json.dumps(text)[1:-1])
    return raw.count('\n', 0, at) + 1 if at >= 0 else fallback


class Unreadable(ValueError):
    """A file the lint cannot read, so it must not report it clean."""


def lint_file(path, applies_to=None):
    """Hits in one file: [{'id', 'file', 'line', 'match', 'where'}].

    applies_to is the surface of a text file. A JSON file's fields are always
    read as their own surfaces, whatever applies_to says, and a JSON file in
    none of the engine's shapes raises Unreadable."""
    path = Path(path)
    raw = path.read_text(encoding='utf-8-sig')
    hits = []
    if path.suffix.lower() == '.json':
        try:
            data = json.loads(raw)
        except ValueError as exc:
            raise Unreadable(f'{path}: not JSON ({exc})')
        if not known_shape(data):
            raise Unreadable(f'{path}: not a shape the copy lint reads (board materials, carousel cards, cover facts, '
                             'a creative direction); lint the words as a text file with --applies-to')
        for where, text, surface in fields(data):
            base = _line_in_file(raw, text)
            for h in copy_lint(text, surface):
                hits.append({'id': h['id'], 'file': str(path), 'line': base + h['line'] - 1,
                             'match': h['match'], 'where': where})
    else:
        for h in copy_lint(raw, applies_to or 'channel_copy'):
            hits.append({'id': h['id'], 'file': str(path), 'line': h['line'], 'match': h['match'], 'where': ''})
    return hits


def main(argv=None):
    ap = argparse.ArgumentParser(description='The copy lint: eyebrows, asterisks, AI-provenance notes and take labels in public copy.')
    ap.add_argument('--applies-to', choices=SURFACES, help='the surface a text file is (default: channel_copy); never applies to a JSON file, whose fields carry their own')
    ap.add_argument('--json', action='store_true', help='print the hits as JSON')
    ap.add_argument('files', nargs='+')
    args = ap.parse_args(argv)
    hits = []
    for f in args.files:
        if args.applies_to and Path(f).suffix.lower() == '.json':
            print(f'copy lint: --applies-to does not apply to {f}; each field is read as its own surface', file=sys.stderr)
        try:
            hits.extend(lint_file(f, args.applies_to))
        except Unreadable as exc:
            print(f'copy lint: {exc}', file=sys.stderr)
            return 2
    if args.json:
        print(json.dumps({'ok': not hits, 'version': config()['version'], 'hits': hits}, indent=2, ensure_ascii=False))
    else:
        for h in hits:
            where = f'  ({h["where"]})' if h['where'] else ''
            print(f'{h["id"]}  {h["file"]}:{h["line"]}  {json.dumps(h["match"], ensure_ascii=False)}{where}')
        print(f'copy lint {config()["version"]}: ' + (f'{len(hits)} hit(s) in {len(args.files)} file(s)' if hits
                                                       else f'clean, {len(args.files)} file(s)'))
    return 1 if hits else 0


if __name__ == '__main__':
    sys.exit(main())
