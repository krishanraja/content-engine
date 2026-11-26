#!/usr/bin/env python3
"""channel_captions: per-channel words and titles, written at make time into the piece manifest's SPEC.

Ruling (Krish, 2026-11-26): content-engine makes every asset, the captions included ("Caption always gets generated
by the growth repository", 19 Nov, is retired). Growth posts the words exactly as the sealed manifest carries them.
Ported from growth-makeyourmindup engine/run/maker.py (the writer, the account voices, the word limits, the YouTube
title, the subscribe line and the blind review) and engine/run/voice_profile.py, at main e530161. Every wording lives
in config/channel-captions.json; the reader is config/beat.json's reader row.

The words are written in a Claude session, never by a scheduled job or a paid call from here: this step writes the
briefs, the session's writer answers one, a separate reviewer who has seen nothing else answers the other, and this
step checks both and records the words.

    python3 scripts/post-pack/channel_captions.py brief FACTS.json --out DIR             DIR/writer-brief.md
    python3 scripts/post-pack/channel_captions.py check FACTS.json ANSWER.json           every check, voice included
    python3 scripts/post-pack/channel_captions.py review-brief FACTS.json ANSWER.json --out DIR   DIR/review-brief.md (blind)
    python3 scripts/post-pack/channel_captions.py record FACTS.json ANSWER.json REVIEW.json --spec SPEC.json

FACTS.json: {"piece_id", "item": "<board item id>", "idea", "claim", "note": {"direction", "on_media": [...]} | null,
             "channels": {"<channel>": {"format": "carousel|short-video|image|text", "assets": [names], "voice"?}}}
ANSWER.json: {"<channel>": {"words", "title"}}   REVIEW.json: {"<channel>": {"would_send", "receiver", "why"}}

`record` writes each channel's final words (the writer's words plus the subscribe line, subscribe_links.route_line)
and, for YouTube, its title into SPEC.json's channels, keeping their assets, alt text and cover, and writes the
captions.json receipt beside it. The checks are the claim word for word, the channel's length and limit, the copy lint
(channel_copy, titles), this step's own rules (no hashtag, link, mention, em dash, exclamation mark, brand name,
dated call or share ask) and Control Center's one voice check (voice_gate.py). Exit 0 done, 1 refused (with the
reasons, for one rewrite), 2 not checked (the voice check could not be asked: the step holds, never a pass).
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
import copy_lint  # noqa: E402
import subscribe_links  # noqa: E402
import voice_gate  # noqa: E402
import voice_profile  # noqa: E402

CONFIG = ROOT / 'config' / 'channel-captions.json'
BEAT = ROOT / 'config' / 'beat.json'


class Refused(Exception):
    def __init__(self, reasons, code=1):
        super().__init__('; '.join(reasons))
        self.reasons, self.code = list(reasons), code


def config():
    return json.loads(CONFIG.read_text(encoding='utf-8'))


def reader_line():
    return json.loads(BEAT.read_text(encoding='utf-8'))['reader']['audience_short']


def collapse(text):
    return ' '.join(str(text).split())


def carries(claim, words):
    """True when words carry the claim word for word, as whole words (Growth's concepts.carries)."""
    claim, words = collapse(claim), collapse(words)
    if not claim:
        return False
    start = words.find(claim)
    while start != -1:
        before = words[start - 1] if start else ''
        after = words[start + len(claim):start + len(claim) + 1]
        if not (claim[0].isalnum() and before.isalnum()) and not (claim[-1].isalnum() and after.isalnum()):
            return True
        start = words.find(claim, start + 1)
    return False


def facts_problems(facts, cfg):
    out = []
    if not isinstance(facts, dict):
        return ['FACTS is a JSON object']
    for key in ('piece_id', 'item', 'idea', 'claim'):
        if not (isinstance(facts.get(key), str) and facts[key].strip()):
            out.append(f'FACTS needs {key}')
    channels = facts.get('channels')
    if not isinstance(channels, dict) or not channels:
        out.append('FACTS needs channels')
        return out
    for ch, e in channels.items():
        if ch not in cfg['channels']:
            out.append(f'{ch}: not a channel this step writes for ({", ".join(cfg["channels"])})')
        elif not isinstance(e, dict) or not isinstance(e.get('format'), str) or not isinstance(e.get('assets', []), list):
            out.append(f'{ch}: give its format and its asset names')
    return out


def voice_of(facts, ch, cfg):
    return (facts['channels'][ch] or {}).get('voice') or cfg['channels'][ch]['voice']


def brief(facts, profile=None, cfg=None):
    """The writer's brief for every channel of the piece."""
    cfg = cfg or config()
    bad = facts_problems(facts, cfg)
    if bad:
        raise Refused(bad)
    w = cfg['writer']
    lines = [w['head'], 'Its reader: ' + reader_line() + '.', '', *w['system'], *w['rules'], '',
             'Idea: ' + facts['idea'], 'Claim: ' + facts['claim']]
    note = facts.get('note') if isinstance(facts.get('note'), dict) else {}
    if note.get('direction'):
        lines.append('Editor\'s direction (follow it, never quote it): ' + note['direction'])
    for text in note.get('on_media') or []:
        lines.append('Already on the picture or video, exactly: ' + json.dumps(text, ensure_ascii=False))
    lines.append('')
    for ch, e in facts['channels'].items():
        c = cfg['channels'][ch]
        voice = voice_of(facts, ch, cfg)
        n = len(e.get('assets') or [])
        media = 'text only, no picture' if not n else f'{n} file{"s" if n > 1 else ""}'
        style = (' ' + profile[voice]) if profile and profile.get(voice) else ''
        lines.append(f'- {ch}: {c["name"]}, {cfg["voices"][voice]}{style} Format: {e["format"]}, {media}. '
                     f'At most {c["words_max"]} characters of words, the claim included.'
                     + (f' A title of at most {cfg["title_max"]} characters.' if c['title'] else ' title: an empty string.'))
    if profile is None:
        lines += ['', '(The voice profile could not be read: write to the account rules alone.)']
    return '\n'.join(lines) + '\n'


def own_findings(text, cfg):
    return [rule['why'] for rule in cfg['checks']['own'] if re.search(rule['regex'], text or '')]


def channel_findings(ch, entry, facts, cfg):
    """Every reason one channel's answer is refused, before the voice check."""
    c = cfg['channels'][ch]
    if not isinstance(entry, dict) or not isinstance(entry.get('words'), str) or not entry['words'].strip() \
            or not isinstance(entry.get('title', ''), str):
        return [f'{ch}: answer with words and a title']
    words, title = entry['words'].strip(), (entry.get('title') or '').strip()
    out = []
    if not carries(facts['claim'], words):
        out.append(f'{ch}: the claim is not in the words exactly as given')
    if len(words) > c['words_max']:
        out.append(f'{ch}: the words are longer than {c["words_max"]} characters')
    out += [f'{ch}: copy lint {h["id"]} ("{h["match"]}")' for h in copy_lint.copy_lint(words, 'channel_copy')]
    out += [f'{ch}: {why}' for why in own_findings(words, cfg)]
    if c['title']:
        if not title or len(title) > cfg['title_max']:
            out.append(f'{ch}: a plain title of at most {cfg["title_max"]} characters')
        out += [f'{ch} title: copy lint {h["id"]} ("{h["match"]}")' for h in copy_lint.copy_lint(title, 'titles')]
        out += [f'{ch} title: {why}' for why in own_findings(title, cfg)]
    elif title:
        out.append(f'{ch}: only YouTube carries a title; leave it empty')
    return out


def check(facts, answer, voice_call=None, voice_key=None, cfg=None):
    """[] when every channel passes; Refused(code 2) when the voice check could not be asked; Refused(1) otherwise."""
    cfg = cfg or config()
    bad = facts_problems(facts, cfg)
    if bad:
        raise Refused(bad)
    if not isinstance(answer, dict):
        raise Refused(['the answer is {"<channel>": {"words", "title"}}'])
    out = [f'{ch}: no words for it' for ch in facts['channels'] if ch not in answer]
    out += [f'{ch}: not a channel of this piece' for ch in answer if ch not in facts['channels']]
    for ch in facts['channels']:
        if ch in answer:
            out += channel_findings(ch, answer[ch], facts, cfg)
    if out:
        raise Refused(out)
    unchecked = []
    for ch in facts['channels']:
        texts = [answer[ch]['words']] + ([answer[ch]['title']] if answer[ch].get('title') else [])
        for text in texts:
            checked, found = voice_gate.check(text, voice_gate.MANIFEST_CHANNEL[ch], voice_call, voice_key)
            if not checked:
                unchecked.append(f'{ch}: the voice check could not be asked (Control Center); this step holds')
            out += [f'{ch}: voice {m}' for m in found]
    if out:
        raise Refused(out)
    if unchecked:
        raise Refused(unchecked, code=2)
    return []


def review_brief(facts, answer, cfg=None):
    """The blind reviewer's brief: each post's channel, format, blind file names and exact words, and nothing else."""
    cfg = cfg or config()
    r = cfg['review']
    lines = [r['head'], 'The reader: ' + reader_line() + '.', r['lens'], r['shape'], '']
    for ch, e in facts['channels'].items():
        files = [f'file {i}' for i in range(1, len(e.get('assets') or []) + 1)]
        post = {'channel': cfg['channels'][ch]['name'], 'format': e['format'], 'files': files,
                'words': (answer.get(ch) or {}).get('words', '')}
        if cfg['channels'][ch]['title']:
            post['title'] = (answer.get(ch) or {}).get('title', '')
        lines.append(f'{ch}: ' + json.dumps(post, ensure_ascii=False, sort_keys=True))
    return '\n'.join(lines) + '\n'


def review_problems(facts, review):
    out = []
    if not isinstance(review, dict):
        return ['the review is {"<channel>": {"would_send", "receiver", "why"}}']
    for ch in facts['channels']:
        r = review.get(ch)
        if not isinstance(r, dict) or not isinstance(r.get('would_send'), bool) or not str(r.get('why') or '').strip():
            out.append(f'{ch}: the blind review did not answer for it')
        elif not r['would_send']:
            out.append(f'{ch}: the blind reader would not send it ({r["why"]})')
    return out


def final_words(ch, words, item, cfg=None):
    """The writer's words with the channel's subscribe line, never past its limit (Growth's with_route)."""
    cfg = cfg or config()
    line = subscribe_links.route_line(ch, subscribe_links.item_content(item, ch)) if ch in subscribe_links.spec()['sources'] else None
    final = words if not line or line in words else words + '\n' + line
    if len(final) > cfg['channels'][ch]['limit']:
        raise Refused([f'{ch}: the subscribe line takes the post past its limit of {cfg["channels"][ch]["limit"]}; shorten the words'])
    return final


def record(facts, answer, review, spec, voice_call=None, voice_key=None, now=None, cfg=None):
    """(spec with the words and titles, receipt). Every check passes first, the blind review included."""
    cfg = cfg or config()
    check(facts, answer, voice_call, voice_key, cfg)
    bad = review_problems(facts, review)
    if bad:
        raise Refused(bad)
    if not isinstance(spec, dict) or spec.get('piece_id') != facts['piece_id']:
        raise Refused([f'SPEC is for {spec.get("piece_id") if isinstance(spec, dict) else None}, not {facts["piece_id"]}'])
    channels = dict(spec.get('channels') or {})
    written = {}
    for ch, e in facts['channels'].items():
        words = final_words(ch, answer[ch]['words'].strip(), facts['item'], cfg)
        title = (answer[ch].get('title') or '').strip()
        held = channels.get(ch) if isinstance(channels.get(ch), dict) else {}
        entry = {'words': words, 'alt_text': held.get('alt_text'), 'assets': held.get('assets') or list(e.get('assets') or [])}
        if 'cover' in held:
            entry['cover'] = held['cover']
        if cfg['channels'][ch]['title']:
            entry['title'] = title
        channels[ch] = entry
        written[ch] = {'words_sha256': hashlib.sha256(words.encode('utf-8')).hexdigest(),
                       **({'title_sha256': hashlib.sha256(title.encode('utf-8')).hexdigest()} if cfg['channels'][ch]['title'] else {}),
                       'voice': voice_of(facts, ch, cfg), 'review': {k: review[ch].get(k) for k in ('would_send', 'receiver', 'why')}}
    receipt = {'schema': cfg['schema'], 'piece_id': facts['piece_id'], 'item': facts['item'],
               'written_at': (now or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ'),
               'made_by': 'content-engine', 'checks': ['claim', 'length', 'copy_lint', 'own_rules', 'voice', 'blind_review'],
               'channels': written}
    return {**spec, 'channels': channels}, receipt


def _read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('brief')
    b.add_argument('facts')
    b.add_argument('--out', required=True, type=Path)
    c = sub.add_parser('check')
    c.add_argument('facts')
    c.add_argument('answer')
    r = sub.add_parser('review-brief')
    r.add_argument('facts')
    r.add_argument('answer')
    r.add_argument('--out', required=True, type=Path)
    rec = sub.add_parser('record')
    rec.add_argument('facts')
    rec.add_argument('answer')
    rec.add_argument('review')
    rec.add_argument('--spec', required=True, type=Path)
    a = ap.parse_args(argv)
    try:
        facts = _read(a.facts)
        if a.cmd == 'brief':
            a.out.mkdir(parents=True, exist_ok=True)
            (a.out / 'writer-brief.md').write_text(brief(facts, voice_profile.read()), encoding='utf-8')
            print(a.out / 'writer-brief.md')
            return 0
        answer = _read(a.answer)
        if a.cmd == 'check':
            check(facts, answer)
            print('ok: every channel passes')
            return 0
        if a.cmd == 'review-brief':
            a.out.mkdir(parents=True, exist_ok=True)
            (a.out / 'review-brief.md').write_text(review_brief(facts, answer), encoding='utf-8')
            print(a.out / 'review-brief.md')
            return 0
        spec, receipt = record(facts, answer, _read(a.review), _read(a.spec))
    except Refused as e:
        for reason in e.reasons:
            print(('NOT CHECKED  ' if e.code == 2 else 'REFUSED  ') + reason)
        return e.code
    a.spec.write_text(json.dumps(spec, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    (a.spec.parent / config()['receipt']).write_text(json.dumps(receipt, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'ok: words for {", ".join(receipt["channels"])} written into {a.spec}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
