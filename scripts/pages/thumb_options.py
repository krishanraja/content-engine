#!/usr/bin/env python3
"""thumb_options: two or three thumbnail options for one piece, the grid mock, and the critic's verdict on them.

The cover standard Krish approved (docs/production/COVER-STANDARD.md, Krish, 2026-11-09: "approve the cover standard as
written"), point 8: "Two or three options, never one, each shown in a mock of his grid beside the last five posts."
The thumbnail-designer skill (.agents/skills/thumbnail-designer/SKILL.md) runs this; produce-video step 5 calls it.

    python3 scripts/pages/build.py COVER_FACTS --thumbs --options 3 --brief BRIEF.json [--past COVER ...] --out WORK/thumbs
        draws each option in the week's one skin, the Receipt rules intact: OUT/options/<id>/ holds its wide and tall
        thumbnails and its own thumbs.json (the receipt making.py and visual_gate.py read), OUT/thumb-options.json the
        set (each file's sha256, the brief's, the checks code can make), OUT/grid-mock.png the grid mock and
        OUT/options/<id>/grid-mock.png each option's own. Two or three options, or none written.
    python3 scripts/pages/thumb_options.py mock OUT [--past COVER ...]
        draws the grid mock again, once the last five posted covers are on this machine (newest first).
    python3 scripts/pages/thumb_options.py verdict OUT CRITIC.json --reviewer thumbnail-critic
        writes OUT/thumb-verdict.json from the critic's answer: refused unless it judges every option on the set once,
        names each option's files with the sha256 the files have now and the set records, answers all seven checks, and
        was written by a reader that did not draw the options.
    python3 scripts/pages/thumb_options.py drive OUT a:wide=ID a:tall=ID b:wide=ID b:tall=ID [c:wide=ID c:tall=ID] mock=ID
        writes OUT/drive.json: the Drive id of each file's review copy (filed in his Drive's Inbox from My AI, docs/DRIVE.md),
        every option's two files and the grid mock, so the Publish Board can show the set with its Pick and Not this
        (view contract 1.16.0). making.py thumbnails reads it. Refused unless it names every file of the set on this
        machine and nothing else.
    python3 scripts/pages/thumb_options.py show OUT
    python3 scripts/pages/thumb_options.py --self-test

The options are declared in the cover facts as "thumb_options": [{"id": "a", "note": "what this one tries", ...}, ...].
An option may change only the proof's crop or picture ("proof", merged over the thumbnail's own proof) and the layout
("proof_width" 58%, 50% or 44% on the wide shape; "proof_first" puts the picture above the words on the tall shape;
"logos_under" puts the logos under the headline). The words, the logos, the skin and everything else are the piece's:
never a second skin, never his face, never a badge.

The grid mock is a 3-wide Instagram profile grid: each option's tall thumbnail in the first tile, as the grid shows it
(the middle 1080 x 1440, config/channel-safe-zones.json "instagram_grid"), beside the last five posted covers. A past
cover is only ever a file read on this machine (--past), recorded by its sha256: never drawn, never guessed. With none,
the mock shows the options alone and its record and its caption say so.

Nothing here posts, sends or files anything, and nothing outside the drawer's own output folder is written. The review
copies in Drive are filed by the session (docs/DRIVE.md); `drive` only records their ids beside the set.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import io
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OPTIONS_FILE = 'thumb-options.json'
VERDICT_FILE = 'thumb-verdict.json'
DRIVE_FILE = 'drive.json'
MOCK_FILE = 'grid-mock.png'
OPTIONS_DIR = 'options'
OPTION_IDS = ('a', 'b', 'c')
COUNTS = (2, 3)
PROOF_WIDTHS = ('58%', '50%', '44%')
LAYOUT_KEYS = ('proof_width', 'proof_first', 'logos_under')
OPTION_KEYS = {'id', 'note', 'proof', *LAYOUT_KEYS}
PROOF_KEYS = {'image', 'pdf', 'page', 'html', 'source', 'tag', 'ring', 'alt'}
PICTURE_KINDS = ('image', 'pdf', 'page', 'html')
# What an option may never change, and why, in his rules' words.
NOT_AN_OPTION = {
    'headline': 'the words are the ones he picked in the packaging round; every option carries the same words',
    'rows': 'the logos are the piece\'s, chosen in the brief; options differ in the proof\'s crop and the layout only',
    'strip': 'the logos are the piece\'s, chosen in the brief; options differ in the proof\'s crop and the layout only',
    'skin': 'every option wears the week\'s one skin, never a second',
    'portrait': 'the Receipt never shows his face (house rule THE_RECEIPT)',
    'background': 'the Receipt is drawn on its own ground, never a photograph behind the words',
    'show_tag': 'no badges or proof tags on a cover (COVER-STANDARD point 4)',
}
MAX_WORDS = 7   # COVER-STANDARD point 1
MAX_LOGOS = 3   # point 3
MAX_PARTS = 3   # point 2: one picture, the logos, the series label
QA = ROOT / '.agents' / 'skills' / 'thumbnail-designer' / 'references' / 'qa.md'
# The seven checks the critic answers on every option, in the order of the QA list (references/qa.md).
CHECKS = ('readable_at_grid', 'words_max', 'three_parts', 'logos_named', 'no_badges', 'title_hidden', 'promise_matches')
SEVERITIES = ('block', 'fix', 'note')
THUMB_FILES = {'wide': 'thumb-wide-1280x720.jpg', 'tall': 'thumb-tall-1080x1920.jpg'}
GRID_CROP = (0, 240, 1080, 1680)   # the middle 3:4 of a 1080 x 1920 cover: what the profile grid shows
TILE = (360, 480)
GAP = 4
PAST_MAX = 5
SHA = re.compile(r'^[0-9a-f]{64}$')
DRIVE_ID = re.compile(r'^[A-Za-z0-9_-]{10,}$')
DRIVE_FILE_ID = re.compile(r'^[A-Za-z0-9_-]{20,80}$')   # a Drive file id, the board's own rule (board/_drivePosts.ts)


class OptionsError(Exception):
    """A plain-words reason nothing was written."""


# ---------------------------------------------------------------- small helpers

def sha256_file(path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def line(value, most=600) -> bool:
    return isinstance(value, str) and bool(value.strip()) and len(value) <= most and '\n' not in value


def norm_words(value) -> str:
    """Words as a reader sees them: a list of parts or a string, joined, spaces closed up, case kept."""
    if isinstance(value, (list, tuple)):
        value = ' '.join(str(v) for v in value)
    return ' '.join(str(value or '').split())


def word_count(value) -> int:
    return len(norm_words(value).split())


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def iso_time(value) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo is not None
    except ValueError:
        return False


# ---------------------------------------------------------------- the brief

def brief_problems(brief, words) -> list[str]:
    """Why the brief is not ready to draw from, or []. The brief is written before any option is drawn: the one promise
    the thumbnail makes, where the piece supports it, the claims it must avoid, the exact words he picked, the companies
    the headline or the picture names, and the references looked at (references/brief.md)."""
    if not isinstance(brief, dict):
        return ['the brief is a JSON object: promise, supported_by, avoid, words, named, references (references/brief.md)']
    out = []
    if not line(brief.get('promise'), 300):
        out.append('"promise": the one promise the thumbnail makes, in one line')
    supported = brief.get('supported_by')
    if not (isinstance(supported, list) and supported and all(line(x) for x in supported)):
        out.append('"supported_by": where the piece supports the promise (a line it says, or a checked source), at least one, one line each')
    avoid = brief.get('avoid')
    if not (isinstance(avoid, list) and avoid and all(line(x) for x in avoid)):
        out.append('"avoid": the claims the thumbnail must not make (what the piece does not say or cannot prove), at least one')
    said = norm_words(brief.get('words'))
    if not said:
        out.append('"words": the exact words he picked for the thumbnail')
    elif said != norm_words(words):
        out.append(f'"words" ("{said}") are not the words the facts draw ("{norm_words(words)}"): the thumbnail carries only the words he picked')
    elif word_count(said) > MAX_WORDS:
        out.append(f'the words are {word_count(said)} words; the cover standard allows at most {MAX_WORDS} (point 1)')
    named = brief.get('named')
    if not (isinstance(named, list) and all(line(x, 120) for x in named)):
        out.append('"named": the companies the headline or the picture names (the only logos a thumbnail carries, point 3); [] for none')
    refs = brief.get('references', [])
    if not isinstance(refs, list):
        out.append('"references" is a list of the reference cards looked at (references/reference-library.md)')
        refs = []
    seen_cards, seen_sources = set(), set()
    for i, ref in enumerate(refs):
        at = f'references[{i}]'
        if not isinstance(ref, dict):
            out.append(f'{at} is {{card, source, looked_at, why}}')
            continue
        card, source = ref.get('card'), ref.get('source')
        if not line(card, 120):
            out.append(f'{at}.card is the inspiration card\'s id or name')
        if not (isinstance(source, str) and (DRIVE_ID.match(source) or source.startswith('https://'))):
            out.append(f'{at}.source is where it lives: its Drive file id or an https link, never a file in this repository')
        if not iso_time(ref.get('looked_at')):
            out.append(f'{at}.looked_at is when this session opened it and looked (an ISO time with its zone): a card nobody looked at does not count')
        if not line(ref.get('why'), 400):
            out.append(f'{at}.why says in one line why it works')
        if card in seen_cards or source in seen_sources:
            out.append(f'{at} repeats a card or a source already listed: each reference counts once')
        seen_cards.add(card)
        seen_sources.add(source)
    return out


# ---------------------------------------------------------------- the options

def merged_proof(base: dict, change: dict) -> dict:
    """The thumbnail's proof with an option's change over it: a new crop of the same picture keeps its source; a
    different picture (image, pdf, page or html) replaces the old one whole."""
    proof = json.loads(json.dumps(base or {}))
    new_kinds = [k for k in PICTURE_KINDS if k in change]
    for kind in new_kinds:
        if isinstance(change[kind], dict) and isinstance(proof.get(kind), dict):
            proof[kind] = {**proof[kind], **change[kind]}
        else:
            for other in PICTURE_KINDS:
                proof.pop(other, None)
            proof[kind] = json.loads(json.dumps(change[kind]))
    for key, value in change.items():
        if key not in PICTURE_KINDS:
            proof[key] = json.loads(json.dumps(value))
    proof.pop('show_tag', None)
    return proof


def option_facts(c: dict, option: dict) -> dict:
    """The thumbnail facts one option is drawn from: the piece's own, with the option's proof and layout."""
    out = json.loads(json.dumps(c))
    if option.get('proof'):
        out['proof'] = merged_proof(out.get('proof') or {}, option['proof'])
    else:
        (out.get('proof') or {}).pop('show_tag', None)
    for key in ('proofw', 'proof_first'):
        out.pop(key, None)
    if option.get('proof_width'):
        out['proofw'] = option['proof_width']
    if option.get('proof_first'):
        out['proof_first'] = True
    if 'logos_under' in option:
        out['headline_first'] = bool(option['logos_under'])
    return out


def signature(c: dict) -> str:
    """What makes two options different: the proof (its picture and crop) and the layout."""
    proof = {k: v for k, v in (c.get('proof') or {}).items() if k not in ('alt', 'tag')}
    return canonical({'proof': proof, 'proofw': c.get('proofw'), 'proof_first': bool(c.get('proof_first')),
                      'logos_under': bool(c.get('headline_first'))})


def option_problems(options, n: int, c: dict | None = None) -> list[str]:
    """Why the declared options cannot be drawn as n options, or []."""
    if n not in COUNTS:
        return [f'--options is 2 or 3: two or three options, never one (COVER-STANDARD point 8), not {n}']
    if not isinstance(options, list) or not options:
        return [f'the cover facts declare no "thumb_options": give {n}, each {{"id": "a", "note": "what it tries", "proof": ..., '
                '"proof_width"|"proof_first"|"logos_under": ...}']
    out = []
    if len(options) != n:
        out.append(f'the cover facts declare {len(options)} option(s) and --options asks for {n}')
    ids = []
    for i, o in enumerate(options):
        at = f'thumb_options[{i}]'
        if not isinstance(o, dict):
            out.append(f'{at} is an object')
            continue
        oid = o.get('id')
        if oid not in OPTION_IDS:
            out.append(f'{at}.id is one of {", ".join(OPTION_IDS)}')
        ids.append(oid)
        if not line(o.get('note'), 200):
            out.append(f'{at}.note says in one line what this option tries')
        for key in sorted(set(o) - OPTION_KEYS):
            out.append(f'{at}.{key}: ' + NOT_AN_OPTION.get(key, f'an option changes only the proof and the layout ({", ".join(sorted(OPTION_KEYS - {"id", "note"}))})'))
        if 'proof_width' in o and o['proof_width'] not in PROOF_WIDTHS:
            out.append(f'{at}.proof_width is one of {", ".join(PROOF_WIDTHS)} (the proof\'s share of the wide shape)')
        for key in ('proof_first', 'logos_under'):
            if key in o and not isinstance(o[key], bool):
                out.append(f'{at}.{key} is true or false')
        proof = o.get('proof')
        if proof is not None:
            if not isinstance(proof, dict) or not proof:
                out.append(f'{at}.proof is the change to the proof: a new "crop" or "ring" of the same picture, or another picture from a checked source')
            else:
                for key in sorted(set(proof) - PROOF_KEYS):
                    out.append(f'{at}.proof.{key}: ' + NOT_AN_OPTION.get(key, f'a proof takes only {", ".join(sorted(PROOF_KEYS))}'))
    if len(set(ids)) != len(ids):
        out.append('each option has its own id')
    if c is not None and not out:
        seen = {}
        for o in options:
            sig = signature(option_facts(c, o))
            if sig in seen:
                out.append(f'options {seen[sig]} and {o["id"]} would be drawn the same: each differs in the proof\'s crop or the layout')
            seen.setdefault(sig, o['id'])
    return out


def checks_of(c: dict, brief: dict, series_label: bool) -> dict:
    """What code can say about one option against the QA list (references/qa.md), before the critic looks."""
    logos = [str(r.get('name', '')) for r in [*c.get('rows', []), *c.get('strip', [])] if r.get('logo')]
    named = [str(n).lower() for n in brief.get('named') or []]
    not_named = [n for n in logos if not any(m and (m in n.lower() or n.lower() in m) for m in named)]
    parts = 1 + (1 if logos else 0) + (1 if series_label else 0)
    words = word_count(brief.get('words'))
    badge = bool((c.get('proof') or {}).get('show_tag'))
    return {'words': words, 'words_ok': words <= MAX_WORDS, 'logos': logos, 'logos_ok': len(logos) <= MAX_LOGOS,
            'logos_not_named': not_named, 'parts': parts, 'parts_ok': parts <= MAX_PARTS, 'badge': badge}


def set_digest(options: list[dict]) -> str:
    """One hash for the set: each option's id and its files' sha256s, in order."""
    return hashlib.sha256(canonical([[o['id'], [[f['shape'], f['file'], f['sha256']] for f in o['files']]] for o in options]).encode()).hexdigest()


# ---------------------------------------------------------------- the grid mock

def grid_tile(path, size=TILE):
    """One tile as the profile grid shows it: a 9:16 cover's middle 3:4 (GRID_CROP), any other picture cut to 3:4
    about its middle, scaled to the tile."""
    from PIL import Image
    with Image.open(path) as src:
        im = src.convert('RGB')
    w, h = im.size
    if (w, h) == (1080, 1920):
        im = im.crop(GRID_CROP)
    else:
        want = 3 / 4
        if w / h > want:
            nw = round(h * want)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w / want)
            im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize(size, Image.LANCZOS)


def grid_panel(option_tall, past, label, note):
    """One option's grid: 3 wide, 2 rows; the option in the first tile, then the past covers newest first, then empty
    tiles in the grid's own grey where there are fewer than five. A label above and a caption line under."""
    from PIL import Image, ImageDraw, ImageFont
    tw, th = TILE
    head, foot = 56, 48
    width, height = 3 * tw + 2 * GAP, head + 2 * th + GAP + foot
    panel = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(panel)
    font = ImageFont.load_default(size=30)
    small = ImageFont.load_default(size=20)
    draw.text((8, 12), label, fill=(20, 20, 20), font=font)
    tiles = [option_tall] + list(past)[:PAST_MAX]
    for i in range(6):
        x, y = (i % 3) * (tw + GAP), head + (i // 3) * (th + GAP)
        if i < len(tiles):
            panel.paste(grid_tile(tiles[i]), (x, y))
        else:
            draw.rectangle((x, y, x + tw - 1, y + th - 1), fill=(239, 239, 239))
    draw.rectangle((0, head, tw - 1, head + th - 1), outline=(0, 149, 246), width=4)
    draw.text((8, head + 2 * th + GAP + 12), note, fill=(90, 90, 90), font=small)
    return panel


def past_note(past) -> str:
    if not past:
        return 'The last five posted covers could not be read in this session: the options are shown alone.'
    if len(past) < PAST_MAX:
        return f'Beside it: the last {len(past)} posted covers this session could read (newest first); fewer than five.'
    return 'Beside it: the last five posted covers, newest first.'


def draw_mock(out: Path, tall: dict, past: list) -> dict:
    """OUT/grid-mock.png (every option side by side) and OUT/options/<id>/grid-mock.png. Returns the mock's record."""
    from PIL import Image
    past = [Path(p) for p in past][:PAST_MAX]
    for p in past:
        if not p.is_file():
            raise OptionsError(f'--past {p}: there is no such file on this machine. A past cover is only ever a file read here.')
    note = past_note(past)
    panels, per = [], {}
    for oid, path in tall.items():
        panel = grid_panel(path, past, f'Option {oid.upper()} in your grid', note)
        target = out / OPTIONS_DIR / oid / MOCK_FILE
        target.parent.mkdir(parents=True, exist_ok=True)
        panel.save(target)
        per[oid] = {'file': f'{OPTIONS_DIR}/{oid}/{MOCK_FILE}', 'sha256': sha256_file(target)}
        panels.append(panel)
    sheet = Image.new('RGB', (sum(p.width for p in panels) + 24 * (len(panels) - 1), panels[0].height), 'white')
    x = 0
    for p in panels:
        sheet.paste(p, (x, 0))
        x += p.width + 24
    sheet.save(out / MOCK_FILE)
    return {'file': MOCK_FILE, 'sha256': sha256_file(out / MOCK_FILE), 'per_option': per,
            'past': [{'file': p.name, 'sha256': sha256_file(p)} for p in past], 'past_read': len(past), 'note': note}


# ---------------------------------------------------------------- drawing the options

def clear_old(out: Path) -> None:
    """A new set replaces the old one whole: its files, its record, its mock and any verdict on it."""
    shutil.rmtree(out / OPTIONS_DIR, ignore_errors=True)
    for name in (OPTIONS_FILE, VERDICT_FILE, MOCK_FILE):
        (out / name).unlink(missing_ok=True)


def explained(fit, small, name) -> str:
    import receipt
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        receipt.explain(name, fit, small)
    return ' '.join(buf.getvalue().split())


def draw(facts: dict, base: Path, out: Path, thumb_facts, companies_of, n: int, brief_path, past=(), by='Claude Code') -> bool:
    """Draws n options (2 or 3) in the week's one skin, writes their receipts, the set's record and the grid mock.
    Two or three options or none: True when the set was written."""
    import brand
    import receipt
    out = Path(out)
    c = thumb_facts(facts)
    options = facts.get('thumb_options')
    why = option_problems(options, n, c)
    if why:
        brand.fail('the thumbnail options cannot be drawn:\n  - ' + '\n  - '.join(why))
    if not brief_path:
        brand.fail('--options needs --brief BRIEF.json, written before any option is drawn (.agents/skills/thumbnail-designer/references/brief.md)')
    brief_path = Path(brief_path)
    try:
        brief = json.loads(brief_path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        brand.fail(f'--brief {brief_path}: {e}')
    why = brief_problems(brief, receipt.words_of(c, facts))
    if why:
        brand.fail('the brief is not ready:\n  - ' + '\n  - '.join(why))
    receipt.skin_of(facts, 'tall')   # an unknown "skin", or a series piece with no date, stops here, before anything is removed
    clear_old(out)
    drawn_facts = {o['id']: option_facts(c, o) for o in options}
    # Fetch and cut every proof before the drawing browser opens (a page or figure proof is shot in a browser of its
    # own): each option's, the thumbnails' own, and the covers', which the skin is tried on too.
    for oc in drawn_facts.values():
        receipt.proof_of(oc, facts, base)
    receipt.proof_of(c, facts, base)
    if receipt.skin_of(facts, 'tall'):
        receipt.proof_of(receipt.every_shape(facts, thumb_facts)['cover'], facts, base)
    look = brand.series_look(brand.house(), facts['subchannel'], facts.get('date'), facts.get('carries'))
    shots, refused = {}, []
    with brand.playwright() as pw:
        b = brand.browser(pw)
        settled = receipt.settle(b, facts, base, receipt.every_shape(facts, thumb_facts), tuple(receipt.THUMB_FILES))
        receipt.say_skin(settled)
        for oid, oc in drawn_facts.items():
            got, why = {}, None
            for s, f in THUMB_FILES.items():
                for q in (92, 88, 84, 80):
                    shot, fit, small = receipt.render(b, facts, oc, base, s, jpeg=q, skin=settled['skin'])
                    if not shot or len(shot) <= 2 * 1024 * 1024:
                        break
                if not shot:
                    why = explained(fit, small, f)
                    break
                got[s] = (shot, fit, q)
            if why:
                refused.append({'id': oid, 'why': why})
                print(f'option {oid.upper()}: not drawn in the week\'s skin ({settled["skin"] or "the plain Receipt"}): {why}')
            else:
                shots[oid] = got
        b.close()
    if len(shots) < min(COUNTS):
        print(f'thumbnail options: none written. Two or three options, never one, and only {len(shots)} could be drawn.')
        return False
    out.mkdir(parents=True, exist_ok=True)
    record_options, tall = [], {}
    for o in options:
        oid = o['id']
        if oid not in shots:
            continue
        folder = out / OPTIONS_DIR / oid
        folder.mkdir(parents=True, exist_ok=True)
        files = []
        for s, f in THUMB_FILES.items():
            shot, fit, q = shots[oid][s]
            (folder / f).write_bytes(shot)
            files.append(receipt.thumb_entry(s, f, shot, fit, q) | {'proofw': fit.get('proofw')})
            print(f'{folder / f}  option {oid.upper()}, {s}: headline {fit["head"]} px in {fit["lines"]} line(s)')
        oc = drawn_facts[oid]
        thumbs = receipt.thumbs_record(facts, oc, settled, files, companies_of, drawer='scripts/pages/build.py --thumbs --options (receipt)')
        thumbs['option'] = oid
        (folder / 'thumbs.json').write_text(json.dumps(thumbs, indent=1) + '\n', encoding='utf-8')
        tall[oid] = folder / THUMB_FILES['tall']
        record_options.append({
            'id': oid, 'note': o['note'],
            'layout': {'proof_width': oc.get('proofw'), 'proof_first': bool(oc.get('proof_first')), 'logos_under': bool(oc.get('headline_first'))},
            'proof': {k: (oc.get('proof') or {}).get(k) for k in ('image', 'pdf', 'page', 'html', 'source', 'ring')},
            'files': [{'shape': x['shape'], 'file': f'{OPTIONS_DIR}/{oid}/{x["file"]}', 'sha256': x['sha256'], 'headline_px': x['headline_px'],
                       'proofw': x.get('proofw')} for x in files],
            'checks': checks_of(oc, brief, bool(look.get('series'))),
        })
    mock = draw_mock(out, tall, list(past))
    record = {
        'schema': 'thumb-options/1', 'piece_id': facts.get('piece_id'), 'subchannel': facts['subchannel'], 'date': facts.get('date'),
        'headline': list(receipt.words_of(c, facts)), 'skin': settled['skin'], 'skin_note': settled['note'],
        'brief': {'file': str(brief_path), 'sha256': sha256_file(brief_path), 'named': brief.get('named') or [],
                  'references': len(brief.get('references') or [])},
        'options': record_options, 'refused': refused, 'grid_mock': mock,
        'set_sha256': set_digest(record_options), 'drawn_by': by, 'drawn_at': now_iso(),
    }
    (out / OPTIONS_FILE).write_text(json.dumps(record, indent=1) + '\n', encoding='utf-8')
    print(f'{out / OPTIONS_FILE}  {len(record_options)} option(s), set {record["set_sha256"][:12]}; {mock["note"]}')
    print(f'{out / MOCK_FILE}  the grid mock: each option in the first tile of your profile grid. Next: the critic '
          '(.claude/agents/thumbnail-critic.md), then thumb_options.py verdict.')
    return True


# ---------------------------------------------------------------- reading a set back, and the verdict

def load_set(out: Path) -> dict:
    try:
        record = json.loads((Path(out) / OPTIONS_FILE).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise OptionsError(f'there is no {OPTIONS_FILE} in {out}: draw the options first (build.py --thumbs --options N)')
    if record.get('schema') != 'thumb-options/1' or not isinstance(record.get('options'), list):
        raise OptionsError(f'{OPTIONS_FILE} in {out} is not an options set')
    return record


def set_problems(out: Path, record: dict) -> list[str]:
    """Why the files on this machine are not the set the record names, or []: each file there, with the sha256 the
    record holds, the set's own hash, and the grid mock's."""
    out = Path(out)
    found = []
    for o in record.get('options') or []:
        for f in o.get('files') or []:
            path = out / f['file']
            if not path.is_file():
                found.append(f'{f["file"]} is not on this machine')
            elif sha256_file(path) != f['sha256']:
                found.append(f'{f["file"]} changed after it was drawn (its sha256 is not the one the set records): draw the options again')
    if set_digest(record.get('options') or []) != record.get('set_sha256'):
        found.append('the set\'s own hash does not match its options: draw the options again')
    mock = record.get('grid_mock') or {}
    if not (out / str(mock.get('file'))).is_file() or sha256_file(out / mock['file']) != mock.get('sha256'):
        found.append('the grid mock is missing or changed after it was drawn: run thumb_options.py mock')
    return found


def verdict_problems(critic: dict, record: dict, out: Path, reviewer: str) -> list[str]:
    """Why the critic's answer cannot be the verdict on this set, or []. It must judge every option on the set exactly
    once, name each option's two files with the sha256 they have now and the set records (a verdict on other bytes is
    refused), answer all seven checks, back every failed check with a block or fix finding, and come from a reader that
    did not draw the options."""
    found = set_problems(out, record)
    if not isinstance(critic, dict) or not isinstance(critic.get('options'), list):
        return found + ['the critic\'s answer is {"options": [{"id", "files": [{"file", "sha256"}], "checks": {...}, "findings": [...], "blocking"}], "best"}']
    if not line(reviewer, 60) or reviewer.strip().lower() in ('', 'drawer', str(record.get('drawn_by') or '').strip().lower()):
        found.append(f'the reviewer ("{reviewer}") is the one that drew the options, or no one: the verdict is a separate reader\'s')
    on_set = {o['id']: o for o in record['options']}
    judged = [o.get('id') for o in critic['options'] if isinstance(o, dict)]
    if sorted(judged) != sorted(on_set):
        found.append(f'the critic judged {", ".join(map(str, judged)) or "nothing"}; the set holds {", ".join(on_set)}: every option once')
    for o in critic['options']:
        if not isinstance(o, dict) or o.get('id') not in on_set:
            continue
        at = f'option {o["id"]}'
        want = {(f['file'], f['sha256']) for f in on_set[o['id']]['files']}
        named = {(f.get('file'), f.get('sha256')) for f in o.get('files') or [] if isinstance(f, dict)}
        if named != want:
            found.append(f'{at}: the files and sha256s it names are not the ones on the set ({", ".join(sorted(f for f, _ in want))}): '
                         'a verdict on other bytes is refused')
        checks = o.get('checks')
        if not isinstance(checks, dict) or set(checks) != set(CHECKS) or any(v not in ('pass', 'fail') for v in checks.values()):
            found.append(f'{at}: "checks" answers each of {", ".join(CHECKS)} with pass or fail')
            checks = {}
        findings = o.get('findings')
        if not isinstance(findings, list) or any(
                not isinstance(x, dict) or set(x) != {'severity', 'check', 'text'} or x['severity'] not in SEVERITIES
                or x['check'] not in CHECKS + ('other',) or not line(x['text'], 600) for x in findings):
            found.append(f'{at}: each finding is {{"severity": block|fix|note, "check": one of the checks or "other", "text": one line}}')
            findings = []
        for check, said in checks.items():
            if said == 'fail' and not any(x['check'] == check and x['severity'] in ('block', 'fix') for x in findings):
                found.append(f'{at}: {check} fails with no block or fix finding saying why')
        blocks = any(x['severity'] == 'block' for x in findings)
        if o.get('blocking') is not blocks:
            found.append(f'{at}: "blocking" is true exactly when a finding blocks')
    best = critic.get('best')
    if best is not None and (best not in on_set or any(o.get('id') == best and o.get('blocking') for o in critic['options'] if isinstance(o, dict))):
        found.append('"best" is the id of an option that does not block, or null when every option blocks')
    return found


def write_verdict(out: Path, critic: dict, reviewer: str) -> dict:
    out = Path(out)
    record = load_set(out)
    why = verdict_problems(critic, record, out, reviewer)
    if why:
        raise OptionsError('the verdict is not written:\n  - ' + '\n  - '.join(why))
    options = [{'id': o['id'], 'files': [{'file': f['file'], 'sha256': f['sha256']} for f in o['files']], 'checks': o['checks'],
                'findings': o['findings'], 'blocking': o['blocking']} for o in sorted(critic['options'], key=lambda x: x['id'])]
    verdict = {'schema': 'thumb-verdict/1', 'piece_id': record.get('piece_id'), 'set_sha256': record['set_sha256'],
               'grid_mock_sha256': record['grid_mock']['sha256'], 'reviewer': reviewer.strip(), 'reviewed_at': now_iso(),
               'qa_sha256': sha256_file(QA) if QA.is_file() else None, 'options': options, 'best': critic.get('best'),
               'blocking': all(o['blocking'] for o in options)}
    (out / VERDICT_FILE).write_text(json.dumps(verdict, indent=1) + '\n', encoding='utf-8')
    return verdict


def read_verdict(out: Path, record: dict) -> dict | None:
    """The verdict beside the set, or None. Raises when it is for another set or other bytes."""
    path = Path(out) / VERDICT_FILE
    if not path.is_file():
        return None
    verdict = json.loads(path.read_text(encoding='utf-8'))
    if verdict.get('set_sha256') != record.get('set_sha256'):
        raise OptionsError(f'{VERDICT_FILE} is for another set of options: run the critic again on this one')
    on_set = {o['id']: {(f['file'], f['sha256']) for f in o['files']} for o in record['options']}
    for o in verdict.get('options') or []:
        if {(f['file'], f['sha256']) for f in o.get('files') or []} != on_set.get(o.get('id')):
            raise OptionsError(f'{VERDICT_FILE} names files for option {o.get("id")} that are not the set\'s')
    return verdict


def drive_keys(record: dict) -> dict:
    """Each file of the set by the key `drive` names it: <option>:<wide|tall> for an option's file, mock for the grid mock."""
    keys = {f'{o["id"]}:{f["shape"]}': f['file'] for o in record.get('options') or [] for f in o.get('files') or []}
    keys['mock'] = (record.get('grid_mock') or {}).get('file') or MOCK_FILE
    return keys


def write_drive(out: Path, pairs: list[str]) -> dict:
    """OUT/drive.json from KEY=ID pairs: the Drive id of every file's review copy. Refused unless the set on this machine
    is whole and the pairs name each of its files once, with a Drive file id, and nothing else."""
    out = Path(out)
    record = load_set(out)
    problems = set_problems(out, record)
    if problems:
        raise OptionsError('the set on this machine is not the one recorded, so no Drive ids are written:\n  - ' + '\n  - '.join(problems))
    keys = drive_keys(record)
    ids: dict[str, str] = {}
    for pair in pairs:
        key, _, value = str(pair).partition('=')
        key, value = key.strip().lower(), value.strip()
        if key not in keys:
            raise OptionsError(f'"{key}" names no file of this set: use {", ".join(sorted(keys))}')
        if key in ids:
            raise OptionsError(f'"{key}" is named twice')
        if not DRIVE_FILE_ID.match(value):
            raise OptionsError(f'"{key}": "{value}" is not a Drive file id (the id in drive.google.com/file/d/<id>/view)')
        ids[key] = value
    missing = sorted(set(keys) - set(ids))
    if missing:
        raise OptionsError(f'every file needs its Drive id, so the board can show the whole set; missing: {", ".join(missing)}')
    entry = {'schema': 'thumb-drive/1', 'set_sha256': record['set_sha256'],
             'files': {keys[k]: v for k, v in sorted(ids.items()) if k != 'mock'}, 'grid_mock': ids['mock'], 'at': now_iso()}
    (out / DRIVE_FILE).write_text(json.dumps(entry, indent=1) + '\n', encoding='utf-8')
    return entry


def read_drive(out: Path, record: dict) -> dict | None:
    """The review copies' Drive ids beside the set ({'files': {path: id}, 'grid_mock': id}), or None when none are
    recorded. Raises when they are for another set."""
    path = Path(out) / DRIVE_FILE
    if not path.is_file():
        return None
    entry = json.loads(path.read_text(encoding='utf-8'))
    if entry.get('set_sha256') != record.get('set_sha256'):
        raise OptionsError(f'{DRIVE_FILE} is for another set of options: file this set\'s copies and record their ids again')
    files = entry.get('files') if isinstance(entry.get('files'), dict) else {}
    wanted = {f['file'] for o in record['options'] for f in o['files']}
    if set(files) != wanted or not all(DRIVE_FILE_ID.match(str(v)) for v in files.values()) or not DRIVE_FILE_ID.match(str(entry.get('grid_mock') or '')):
        raise OptionsError(f'{DRIVE_FILE} does not name every file of this set with a Drive id: run thumb_options.py drive again')
    return {'files': dict(files), 'grid_mock': entry['grid_mock']}


def show(out: Path) -> str:
    record = load_set(out)
    lines = [f'{len(record["options"])} option(s) for "{" ".join(record["headline"])}", set {record["set_sha256"][:12]}, '
             f'skin {record.get("skin") or "the plain Receipt"}; {record["grid_mock"]["note"]}']
    for o in record['options']:
        ch = o['checks']
        lines.append(f'  {o["id"].upper()}: {o["note"]}  ({ch["words"]} words, {ch["parts"]} parts, logos {", ".join(ch["logos"]) or "none"}'
                     + (f'; not named by the headline or picture: {", ".join(ch["logos_not_named"])}' if ch['logos_not_named'] else '') + ')')
    for r in record.get('refused') or []:
        lines.append(f'  {r["id"].upper()}: not drawn: {r["why"]}')
    problems = set_problems(out, record)
    lines += [f'  PROBLEM: {p}' for p in problems]
    try:
        verdict = read_verdict(out, record)
    except OptionsError as e:
        verdict, problems = None, problems + [str(e)]
        lines.append(f'  PROBLEM: {e}')
    if verdict:
        lines.append(f'  verdict by {verdict["reviewer"]}: best {verdict["best"] or "none"}' + ('; every option blocks: hold, never ship' if verdict['blocking'] else ''))
        for o in verdict['options']:
            fails = [k for k, v in o['checks'].items() if v == 'fail']
            lines.append(f'    {o["id"].upper()}: ' + ('blocks' if o['blocking'] else 'passes') + (f' (fails {", ".join(fails)})' if fails else ''))
    else:
        lines.append('  no verdict yet: the critic reads the options and the mock next')
    try:
        drive = read_drive(out, record)
        lines.append('  review copies in Drive: every file, so the board can show the set' if drive
                     else '  no review copies in Drive yet: file them, then thumb_options.py drive OUT KEY=ID ...')
    except (OptionsError, ValueError) as e:
        lines.append(f'  PROBLEM: {e}')
    return '\n'.join(lines)


# ---------------------------------------------------------------- the self-test (no browser, no network)

def self_test() -> int:
    import tempfile
    from PIL import Image
    fails, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    c = {'headline': ['Oracle borrowed', '$38 billion'], 'proof': {'pdf': {'url': 'https://example.com/a.pdf', 'page': 2, 'crop': [0, 0, 1, .5]},
         'source': 's1', 'tag': 'ORACLE\'S FILING'}, 'rows': [{'logo': 'logos/oracle.svg', 'name': 'Oracle'}]}
    a = {'id': 'a', 'note': 'the debt line, proof wide', 'proof_width': '58%'}
    b = {'id': 'b', 'note': 'ring the number, proof narrow', 'proof': {'pdf': {'crop': [0, .4, 1, .7]}, 'ring': [.2, .2, .6, .5]}, 'proof_width': '44%'}
    check('two options that differ pass', option_problems([a, b], 2, c), [])
    check('one option is never enough', option_problems([a], 1, c)[0].startswith('--options is 2 or 3'), True)
    check('an option that changes the words is refused', any('headline' in p for p in option_problems([a, dict(b, headline='Other')], 2, c)), True)
    check('an option with a second skin is refused', any('one skin' in p for p in option_problems([a, dict(b, skin='neon')], 2, c)), True)
    check('an option with his face is refused', any('face' in p for p in option_problems([a, dict(b, portrait=True)], 2, c)), True)
    check('two options drawn the same are refused', any('drawn the same' in p for p in option_problems([a, dict(a, id='b')], 2, c)), True)
    check('a proof width off the list is refused', any('proof_width' in p for p in option_problems([a, dict(b, proof_width='70%')], 2, c)), True)
    merged = option_facts(c, b)['proof']
    check('a new crop keeps the picture and its source', (merged['pdf']['url'], merged['pdf']['crop'], merged['source']),
          ('https://example.com/a.pdf', [0, .4, 1, .7], 's1'))
    other = option_facts(c, {'id': 'c', 'note': 'n', 'proof': {'image': 'chart.png'}})['proof']
    check('another picture replaces the old one whole', ('pdf' in other, other['image']), (False, 'chart.png'))
    check('an option never shows the tag', option_facts(dict(c, proof=dict(c['proof'], show_tag=True)), a)['proof'].get('show_tag'), None)
    check('logos_under puts the logos under the headline', option_facts(c, dict(a, logos_under=True)).get('headline_first'), True)
    brief = {'promise': 'Oracle took on $38 billion of debt to build for OpenAI', 'supported_by': ['Oracle\'s filing, page 2'],
             'avoid': ['that Oracle cannot pay it back'], 'words': ['Oracle borrowed', '$38 billion'], 'named': ['Oracle'],
             'references': [{'card': 'tall-chart-cover', 'source': '1AbCdEfGhIjKlMnOp', 'looked_at': '2026-11-15T10:00:00+00:00', 'why': 'one number, huge'}]}
    check('a ready brief passes', brief_problems(brief, ['Oracle borrowed', '$38 billion']), [])
    check('words he did not pick are refused', any('are not the words' in p for p in brief_problems(brief, ['Oracle borrowed', 'big'])), True)
    long_words = ['One two three four', 'five six seven eight']
    check('more than seven words are refused', any('at most 7' in p for p in brief_problems(dict(brief, words=long_words), long_words)), True)
    check('a reference nobody looked at does not count', any('looked_at' in p for p in brief_problems(
        dict(brief, references=[dict(brief['references'][0], looked_at=None)]), brief['words'])), True)
    check('a reference that is a file in the repository is refused', any('never a file in this repository' in p for p in brief_problems(
        dict(brief, references=[dict(brief['references'][0], source='docs/plans/x/ref.png')]), brief['words'])), True)
    check('the same reference twice counts once', any('counts once' in p for p in brief_problems(
        dict(brief, references=brief['references'] * 2), brief['words'])), True)
    ch = checks_of(dict(c, rows=c['rows'] + [{'logo': 'x.svg', 'name': 'OpenAI'}]), brief, True)
    check('code checks: words, parts and a logo the headline does not name', (ch['words'], ch['parts'], ch['logos_not_named']), (4, 3, ['OpenAI']))

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        tall = {}
        for oid, colour in (('a', 'red'), ('b', 'blue')):
            (out / OPTIONS_DIR / oid).mkdir(parents=True)
            for s, f in THUMB_FILES.items():
                Image.new('RGB', (1280, 720) if s == 'wide' else (1080, 1920), colour).save(out / OPTIONS_DIR / oid / f, 'JPEG')
            tall[oid] = out / OPTIONS_DIR / oid / THUMB_FILES['tall']
        past = []
        for i in range(6):
            Image.new('RGB', (1080, 1350), (10 * i, 80, 80)).save(out / f'past{i}.png')
            past.append(out / f'past{i}.png')
        mock = draw_mock(out, tall, past)
        check('the mock takes the last five past covers and no more', mock['past_read'], 5)
        with Image.open(out / MOCK_FILE) as sheet:
            check('the mock sheet holds one 3-wide grid per option', sheet.size, (2 * (3 * TILE[0] + 2 * GAP) + 24, 56 + 2 * TILE[1] + GAP + 48))
        alone = draw_mock(out, tall, [])
        check('with no past covers the record says so', ('could not be read' in alone['note'], alone['past']), (True, []))
        try:
            draw_mock(out, tall, [out / 'missing.png'])
            check('a past cover that is not here is refused', False, True)
        except OptionsError:
            check('a past cover that is not here is refused', True, True)
        options = [{'id': oid, 'files': [{'shape': s, 'file': f'{OPTIONS_DIR}/{oid}/{f}', 'sha256': sha256_file(out / OPTIONS_DIR / oid / f)}
                                         for s, f in THUMB_FILES.items()]} for oid in ('a', 'b')]
        record = {'schema': 'thumb-options/1', 'piece_id': None, 'headline': ['x', 'y'], 'options': options, 'grid_mock': alone,
                  'set_sha256': set_digest(options), 'drawn_by': 'Claude Code', 'refused': []}
        (out / OPTIONS_FILE).write_text(json.dumps(record))
        check('a set read back whole has no problems', set_problems(out, record), [])
        good = {'checks': {k: 'pass' for k in CHECKS}, 'findings': [], 'blocking': False}
        critic = {'options': [dict(good, id=o['id'], files=[{'file': f['file'], 'sha256': f['sha256']} for f in o['files']]) for o in options], 'best': 'a'}
        check('a verdict on the set\'s files passes', verdict_problems(critic, record, out, 'thumbnail-critic'), [])
        check('the drawer cannot judge its own options', any('separate reader' in p for p in verdict_problems(critic, record, out, 'Claude Code')), True)
        wrong = json.loads(json.dumps(critic))
        wrong['options'][0]['files'][0]['sha256'] = '0' * 64
        check('a verdict naming other bytes is refused', any('other bytes' in p for p in verdict_problems(wrong, record, out, 'thumbnail-critic')), True)
        silent = json.loads(json.dumps(critic))
        silent['options'][1]['checks']['title_hidden'] = 'fail'
        check('a failed check with no finding is refused', any('title_hidden fails' in p for p in verdict_problems(silent, record, out, 'thumbnail-critic')), True)
        partial = dict(critic, options=critic['options'][:1])
        check('a verdict that skips an option is refused', any('every option once' in p for p in verdict_problems(partial, record, out, 'thumbnail-critic')), True)
        written = write_verdict(out, critic, 'thumbnail-critic')
        check('the verdict is bound to the set', (written['set_sha256'], written['blocking']), (record['set_sha256'], False))
        check('the verdict reads back for this set', read_verdict(out, record)['best'], 'a')
        check('no review copies recorded reads as none', read_drive(out, record), None)
        fid = lambda n: f'1{n}' + 'x' * 25
        pairs = ['a:wide=' + fid('aw'), 'a:tall=' + fid('at'), 'b:wide=' + fid('bw'), 'b:tall=' + fid('bt'), 'mock=' + fid('mk')]
        for label, bad in (('a file left out is refused', pairs[:-1]), ('a key that names no file is refused', pairs + ['c:wide=' + fid('cw')]),
                           ('an id that is not a Drive id is refused', pairs[:-1] + ['mock=short'])):
            try:
                write_drive(out, bad)
                check(label, False, True)
            except OptionsError:
                check(label, True, True)
        write_drive(out, pairs)
        got = read_drive(out, record)
        check('every file and the mock have their Drive id', (got['files'][f'{OPTIONS_DIR}/a/{THUMB_FILES["wide"]}'], got['grid_mock']), (fid('aw'), fid('mk')))
        try:
            read_drive(out, dict(record, set_sha256='0' * 64))
            check('Drive ids for another set are refused', False, True)
        except OptionsError:
            check('Drive ids for another set are refused', True, True)
        Image.new('RGB', (1080, 1920), 'green').save(tall['a'], 'JPEG')
        check('a file changed after drawing is named', any('changed after it was drawn' in p for p in set_problems(out, record)), True)
    if fails:
        print('thumb_options self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'thumb_options self-test passed: {count} checks')
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='Thumbnail options: the grid mock again, the critic\'s verdict, or what is on file.')
    ap.add_argument('what', nargs='?', choices=['mock', 'verdict', 'drive', 'show'])
    ap.add_argument('out', nargs='?', help='the folder build.py --thumbs --options wrote')
    ap.add_argument('critic', nargs='*', help='with verdict: the critic\'s answer, a JSON file; with drive: KEY=ID for each file '
                    '(a:wide, a:tall, ..., mock)')
    ap.add_argument('--past', action='append', default=[], metavar='COVER', help='with mock: a past posted cover on this machine, newest first (up to five)')
    ap.add_argument('--reviewer', help='with verdict: who judged them (the thumbnail-critic subagent), never the session that drew them')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.what or not a.out:
        ap.error('give mock, verdict or show, and the options folder')
    out = Path(a.out)
    try:
        if a.what == 'show':
            print(show(out))
            return 0
        if a.what == 'drive':
            entry = write_drive(out, a.critic)
            print(f'{out / DRIVE_FILE}  {len(entry["files"])} files and the grid mock, each with its review copy\'s Drive id. '
                  'Next: making.py PIECE thumbnails OUT records them, and the board shows the set with Pick and Not this.')
            return 0
        record = load_set(out)
        if a.what == 'mock':
            tall = {}
            for o in record['options']:
                entry = next(f for f in o['files'] if f['shape'] == 'tall')
                path = out / entry['file']
                if not path.is_file() or sha256_file(path) != entry['sha256']:
                    raise OptionsError(f'option {o["id"]}\'s tall thumbnail is missing or changed: draw the options again')
                tall[o['id']] = path
            record['grid_mock'] = draw_mock(out, tall, a.past)
            (out / VERDICT_FILE).unlink(missing_ok=True)   # the critic judged the old mock
            (out / DRIVE_FILE).unlink(missing_ok=True)     # and the copy in Drive is the old mock
            (out / OPTIONS_FILE).write_text(json.dumps(record, indent=1) + '\n', encoding='utf-8')
            print(f'{out / MOCK_FILE}  {record["grid_mock"]["note"]} Any verdict on the old mock is removed: run the critic again.')
            return 0
        if len(a.critic) != 1 or not a.reviewer:
            ap.error('verdict needs the critic\'s answer (a JSON file) and --reviewer')
        critic = json.loads(Path(a.critic[0]).read_text(encoding='utf-8'))
        verdict = write_verdict(out, critic, a.reviewer)
        print(f'{out / VERDICT_FILE}  by {verdict["reviewer"]}: best {verdict["best"] or "none"}'
              + ('; every option blocks: hold the thumbnail with the reason, never ship it below the bar' if verdict['blocking'] else ''))
        return 0
    except (OptionsError, OSError, ValueError) as e:
        print(f'thumb_options: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.path.insert(0, str(HERE))
    sys.exit(main())
