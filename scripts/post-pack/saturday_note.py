#!/usr/bin/env python3
"""saturday_note: the Saturday Note that points at the weekly edition, made in content-engine's Notes production.

Ruling (Krish, 2026-11-26): content-engine makes every asset, Substack Notes words and images included; Growth only
schedules it in Buffer. Until now this Note had no maker. One Note each Saturday, signed by Krish like every Note (his
own Substack account, never his name in the text), words plus an optional image, and two tagged links per the edition
contract (the shared edition-contract.md; growth PR 144 engine/route.py), because Growth's subscribe gate refuses a
Note whose only link is the edition's:

    Read the week: <subscribe_links.edition_url(<Saturday>, 'note')>     credited to the newsletter, place note
    Subscribe: <subscribe_links.subscribe_url('substack-notes', <slot>)> the channel's own link

    python3 scripts/post-pack/saturday_note.py brief --saturday YYYY-MM-DD [--edition edition.draft.json] --out DIR
    python3 scripts/post-pack/saturday_note.py make --saturday YYYY-MM-DD --words WORDS.txt [--edition FILE]
                                              [--edition-url https://home.makeyourmindup.ai/p/...] [--image FILE] --out DIR

`make` checks the words (length, copy lint, the captions step's own rules, Control Center's voice check), adds the two
links and writes DIR/saturday-note.json, filed beside the edition's draft (config/saturday-note.json `filed`). Exit 0
made, 1 refused, 2 not checked (the voice check could not be asked: it holds, never a pass). Nothing here posts.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import asset_routes  # noqa: E402
import channel_captions  # noqa: E402
import copy_lint  # noqa: E402
import subscribe_links  # noqa: E402
import voice_gate  # noqa: E402

CONFIG = ROOT / 'config' / 'saturday-note.json'
WORD = re.compile(r"[A-Za-z0-9À-ɏ]+(?:['’.,-][A-Za-z0-9À-ɏ]+)*")


class Refused(Exception):
    def __init__(self, reasons, code=1):
        super().__init__('; '.join(reasons))
        self.reasons, self.code = list(reasons), code


def config():
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def saturday_of(text):
    day = dt.date.fromisoformat(str(text))
    if day.weekday() != 5:
        raise Refused([f'{text} is a {day.strftime("%A")}: the Note goes out on the edition\'s Saturday'])
    return day


def edition_facts(edition):
    """What the writer is shown of the edition: its subject, opener and piece titles (content-engine-edition/1)."""
    if not isinstance(edition, dict):
        return []
    out = []
    if edition.get('subject'):
        out.append('The edition\'s subject: ' + str(edition['subject']))
    for s in edition.get('sections') or []:
        if isinstance(s, dict) and s.get('kind') == 'opener' and s.get('text'):
            out.append('Its opener: ' + str(s['text']))
        if isinstance(s, dict) and s.get('kind') == 'piece' and s.get('title'):
            out.append(f'{s.get("label") or "A piece"}: {s["title"]}')
    return out


def brief(saturday, edition=None, cfg=None):
    cfg = cfg or config()
    w = cfg['writer']
    lines = [w['head'], 'Its reader: ' + channel_captions.reader_line() + '.', 'The edition goes out on ' + saturday.isoformat() + '.', '']
    lines += [r.format(**cfg['words']) for r in w['rules']]
    facts = edition_facts(edition)
    lines += [''] + (facts or ['(No edition draft was given: ask for it before writing.)'])
    return '\n'.join(lines) + '\n'


def word_count(text):
    return len(WORD.findall(text))


def words_findings(words, cfg):
    out = []
    n = word_count(words)
    if not cfg['words']['min'] <= n <= cfg['words']['max']:
        out.append(f'the Note is {n} words; it is {cfg["words"]["min"]} to {cfg["words"]["max"]}')
    out += [f'copy lint {h["id"]} ("{h["match"]}")' for h in copy_lint.copy_lint(words, 'channel_copy')]
    out += channel_captions.own_findings(words, channel_captions.config())
    return out


def links(saturday, slot, edition_url=None):
    """{'read_the_week', 'subscribe'}: the edition link at place note and the channel's own subscribe link."""
    return {'read_the_week': subscribe_links.edition_url(saturday, 'note', edition_url),
            'subscribe': subscribe_links.subscribe_url('substack-notes', subscribe_links.content_of(slot))}


def image_refusal(cfg):
    """None when the Library makes a Notes image, else why an image is refused (the Note goes as words only)."""
    routes = asset_routes.load()
    try:
        row = asset_routes.kind_row(routes, cfg['image']['asset_kind'])
    except asset_routes.Refused as r:
        return str(r)
    if row['status'] != 'route':
        return cfg['image']['rule'] + ' ' + row.get('gap', '')
    return asset_routes.library_present(routes, row['command'])


def make(saturday, words, edition=None, edition_url=None, image=None, voice_call=None, voice_key=None, cfg=None):
    """The Note's record, or Refused."""
    cfg = cfg or config()
    words = (words or '').strip()
    bad = words_findings(words, cfg)
    if image is not None:
        why = image_refusal(cfg)
        if why:
            bad.append('the image: ' + why.strip())
    if bad:
        raise Refused(bad)
    checked, found = voice_gate.check(words, voice_gate.MANIFEST_CHANNEL[cfg['channel']], voice_call, voice_key)
    if found:
        raise Refused([f'voice {m}' for m in found])
    if not checked:
        raise Refused(['the voice check could not be asked (Control Center); the Note holds'], code=2)
    slot = cfg['slot'].format(saturday=saturday.isoformat())
    lk = links(saturday, slot, edition_url)
    lines = subscribe_links.config()['lines']
    text = words + '\n\n' + lines['read_the_week'].format(url=lk['read_the_week']) + '\n' + lines['subscribe'].format(url=lk['subscribe'])
    image_row = None
    if image is not None:
        data = Path(image).read_bytes()
        image_row = {'file': Path(image).name, 'sha256': hashlib.sha256(data).hexdigest(), 'template': cfg['image']['library_template']}
    week_of = saturday - dt.timedelta(days=5)
    record = {'schema': cfg['schema'], 'saturday': saturday.isoformat(), 'week_of': week_of.isoformat(),
              'channel': cfg['channel'], 'place': cfg['place'], 'account': cfg['account'], 'signed': cfg['signed'],
              'slot': slot, 'words': words, 'links': lk, 'text': text, 'image': image_row,
              'edition_sha256': hashlib.sha256(json.dumps(edition, sort_keys=True).encode('utf-8')).hexdigest() if edition else None,
              'checks': ['length', 'copy_lint', 'own_rules', 'voice', 'two_links'],
              'made_by': 'content-engine', 'posted_by': 'growth-makeyourmindup, which schedules it in Buffer',
              'manifest_channel': {cfg['channel']: {'words': text, 'alt_text': None, 'assets': [image_row['file']] if image_row else []}}}
    return record


def main(argv=None, voice_call=None, voice_key=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('brief')
    b.add_argument('--saturday', required=True)
    b.add_argument('--edition', type=Path)
    b.add_argument('--out', required=True, type=Path)
    m = sub.add_parser('make')
    m.add_argument('--saturday', required=True)
    m.add_argument('--words', required=True, type=Path)
    m.add_argument('--edition', type=Path)
    m.add_argument('--edition-url')
    m.add_argument('--image', type=Path)
    m.add_argument('--out', required=True, type=Path)
    a = ap.parse_args(argv)
    try:
        saturday = saturday_of(a.saturday)
        edition = json.loads(a.edition.read_text(encoding='utf-8')) if a.edition else None
        a.out.mkdir(parents=True, exist_ok=True)
        if a.cmd == 'brief':
            (a.out / 'note-brief.md').write_text(brief(saturday, edition), encoding='utf-8')
            print(a.out / 'note-brief.md')
            return 0
        record = make(saturday, a.words.read_text(encoding='utf-8'), edition, a.edition_url, a.image, voice_call, voice_key)
    except (Refused, ValueError) as e:
        reasons, code = (e.reasons, e.code) if isinstance(e, Refused) else ([str(e)], 1)
        for r in reasons:
            print(('NOT CHECKED  ' if code == 2 else 'REFUSED  ') + r)
        return code
    path = a.out / 'saturday-note.json'
    data = (json.dumps(record, indent=1, ensure_ascii=False) + '\n').encode('utf-8')
    path.write_bytes(data)
    print(f'{path}  sha256 {hashlib.sha256(data).hexdigest()}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
