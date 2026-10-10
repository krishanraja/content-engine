#!/usr/bin/env python3
"""The visual gate: a post's pictures and videos are not packed unless they
carry the real logos of every company the piece names, show real evidence
when the piece is about volume, and the cover came from the house drawer.

Krish, 2026-10-10, of Friday's first cover and pictures: "we need to add all
the logos of the businesses that are related to what we are talking about.
Sometimes, that is just one business - but here, it's all the LLMs. This
needs to be considered in every post possible. ... an article like this
should screenshot as many live articles of model releases ... it should pile
up on top of one another visually. ... The cover and email thumbnail is
really boring and losing it's personality ... it needs to be a literal gate
that stuff like this cannot be produced, whether in static asset form or
video."

What a rule can check, it checks here; `build.py` refuses the pack when any
check fails, and only Krish's own words in "visual_gate_override" let one
through. What a rule cannot check (whether the picture is beautiful) is the
house rules BOLD, VISUAL_EXPLAINS and VISUAL_EVIDENCE, which every writer,
judge and the Studio read.

The three checks:

  1. LOGOS. Every company in config/logo-registry.json that the fact-checked
     body names (and is not a mentions-only source) appears in the "logos"
     of at least one packed picture and of the cover, and of every packed
     video (declared: what the edit put on screen).
  2. EVIDENCE. When the body is about volume (it says "so many", "every few
     months", "keeps growing", "more than a dozen", "flood", "pile", "one
     after another" or the like), the pack holds a picture of kind
     "evidence" built from at least six real pages, each with its URL and
     date, and the screenshots exist.
  3. COVER. cover.png was drawn by scripts/pages/build.py --cover: its
     cover.json receipt matches the PNG byte for byte, it carries Krish's
     portrait, and when the piece names companies it carries at least one
     logo row.

    python visual_gate.py post.json            # explain what would pass or fail
    python visual_gate.py --self-test
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / 'config' / 'logo-registry.json'
VOLUME = re.compile(r"\b(so many|every few (?:weeks|months)|keeps? growing|more than a dozen|a flood of|pile[sd]? up|one after another|"
                    r"launch(?:es|ed)? (?:every|each)|dozens of|fourteen|\d{2,} (?:models|versions|releases|launches))\b", re.I)
MIN_EVIDENCE_PAGES = 6


def registry(path=REGISTRY):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    only = set(n.lower() for n in data.get('mentions_only', []))
    out = []
    for c in data['companies']:
        out.append({'name': c['names'][0], 'names': c['names'], 'domain': c['domain'], 'subject': c['names'][0].lower() not in only})
    return out


def named(body, reg):
    """The registry companies the body names as subjects, by their first name."""
    found = []
    for c in reg:
        if not c['subject']:
            continue
        if any(re.search(r'\b' + re.escape(n) + r'\b', body) for n in c['names']):
            found.append(c['name'])
    return found


def about_volume(body):
    return bool(VOLUME.search(body))


def problems(post, planned, body, base, reg=None):
    """Plain-words reasons the pack fails the gate, or [] when it passes.
    `planned` is build.py's plan: dicts with 'kind' (as given), 'logos',
    'evidence', 'source' and 'path'."""
    reg = reg or registry()
    found = []
    names = named(body or '', reg)
    pictures = [p for p in planned if p.get('kind') in ('image', 'share-card', 'cover', 'linkedin-card')]
    videos = [p for p in planned if p.get('kind') == 'video']
    cover = next((p for p in planned if p.get('kind') == 'cover'), None)

    # 1. LOGOS
    if names:
        shown = set()
        for p in pictures:
            shown.update(l for l in (p.get('logos') or []))
        missing = [n for n in names if n not in shown]
        if missing:
            found.append(f'the piece names {", ".join(names)} but no picture carries the real logo of {", ".join(missing)} '
                         '(give each picture a "logos" list of the companies it shows, from Brandfetch; config/logo-registry.json)')
        for v in videos:
            vm = [n for n in names if n not in set(v.get('logos') or [])]
            if vm:
                found.append(f'the video {Path(str(v.get("source", ""))).name} declares no logo for {", ".join(vm)}: put the real logos on '
                             'screen in the edit and list them in its "logos"')
        if cover is not None and not set(cover.get('logos') or []) & set(names):
            found.append('the cover shows none of the companies the piece names: give it logo rows (the "cover" page facts) and list them in its "logos"')
    # 2. EVIDENCE
    if about_volume(body or ''):
        ev = [p for p in planned if (p.get('evidence') or {}).get('pages')]
        if not ev:
            found.append('the piece is about volume ("so many", "keeps growing", a count of releases) but no picture is built from real pages: '
                         f'add one with "evidence": {{"pages": [{{"url", "date", "shot"}}, ...]}} of at least {MIN_EVIDENCE_PAGES} real pages, piled up')
        for p in ev:
            pages = p['evidence']['pages']
            bad = [x for x in pages if not (isinstance(x, dict) and str(x.get('url', '')).startswith('http') and x.get('date'))]
            if len(pages) < MIN_EVIDENCE_PAGES:
                found.append(f'"{p.get("path", "?")}" is built from {len(pages)} real pages; the gate wants at least {MIN_EVIDENCE_PAGES}')
            if bad:
                found.append(f'"{p.get("path", "?")}": every page needs a "url" (https) and a "date"; {len(bad)} do not')
            lost = [x.get('shot') for x in pages if isinstance(x, dict) and x.get('shot') and not (base / x['shot']).is_file()]
            if lost:
                found.append(f'"{p.get("path", "?")}": these screenshots are missing: {", ".join(map(str, lost))}')
    # 3. COVER
    if cover is not None:
        src = Path(str(cover.get('source', '')))
        receipt = src.with_name('cover.json')
        if not receipt.is_file():
            found.append('the cover was not drawn by the house drawer (no cover.json beside it): draw it with scripts/pages/build.py --cover, '
                         'with "portrait": true and logo rows, so it carries the wordmark, Krish and the real logos')
        else:
            try:
                r = json.loads(receipt.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                r = {}
            if r.get('sha256') != hashlib.sha256(src.read_bytes()).hexdigest():
                found.append('cover.json does not match cover.png: the cover was changed after the drawer made it. Draw it again')
            if not r.get('portrait'):
                found.append('the cover has no portrait: draw it with "portrait": true (house rule LOGOS_AND_FACE)')
            if names and not r.get('rows'):
                found.append('the cover has no logo rows although the piece names companies: add "rows" with each real logo')
    return found


def explain(post_path):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import build
    post_path = Path(post_path)
    post = json.loads(post_path.read_text(encoding='utf-8-sig'))
    folder, planned = build.plan(post, post_path.parent)
    body = build.fact_checked_body(post, post_path.parent)
    found = problems(post, planned, body, post_path.parent)
    reg = registry()
    print(f'names: {", ".join(named(body, reg)) or "none"}; about volume: {about_volume(body)}')
    if found:
        print('NOT READY')
        for f in found:
            print(f'  - {f}')
        return 1
    print('ready: logos, evidence and cover all pass')
    return 0


# ---------------------------------------------------------------- self-test

def self_test():
    import tempfile
    fails, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    reg = [{'name': 'OpenAI', 'names': ['OpenAI', 'ChatGPT'], 'domain': 'openai.com', 'subject': True},
           {'name': 'Anthropic', 'names': ['Anthropic', 'Claude'], 'domain': 'anthropic.com', 'subject': True},
           {'name': 'Reuters', 'names': ['Reuters'], 'domain': 'reuters.com', 'subject': False}]
    body = 'Open Claude today. ChatGPT too. Reuters reported it. There are so many of them now.'
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        png = b'\x89PNG fake'
        (t / 'cover.png').write_bytes(png)
        good_receipt = {'sha256': hashlib.sha256(png).hexdigest(), 'portrait': True, 'rows': ['OpenAI', 'Anthropic']}
        (t / 'cover.json').write_text(json.dumps(good_receipt))
        for i in range(6):
            (t / f's{i}.png').write_bytes(b'x')
        pages = [{'url': f'https://example.com/{i}', 'date': '2026-01-0' + str(i + 1), 'shot': f's{i}.png'} for i in range(6)]
        full = [
            {'kind': 'cover', 'source': t / 'cover.png', 'logos': ['OpenAI', 'Anthropic'], 'path': '2/cover.png'},
            {'kind': 'image', 'source': t / 'a.png', 'logos': ['OpenAI', 'Anthropic'], 'path': '2/a.png'},
            {'kind': 'image', 'source': t / 'p.png', 'logos': ['Anthropic'], 'evidence': {'pages': pages}, 'path': '2/p.png'},
            {'kind': 'video', 'source': t / 'v.mp4', 'logos': ['OpenAI', 'Anthropic'], 'path': '3/v.mp4'},
        ]
        check('a full pack passes', problems({}, full, body, t, reg), [])
        check('Reuters is a source, never a subject', named(body, reg), ['OpenAI', 'Anthropic'])
        no_logo = [dict(full[0]), {'kind': 'image', 'source': t / 'a.png', 'logos': ['OpenAI'], 'path': '2/a.png'}, full[2], full[3]]
        check('a named company with no logo anywhere fails', any('no picture carries the real logo of Anthropic' in x for x in problems({}, [full[0] | {'logos': ['OpenAI']}, full[1] | {'logos': ['OpenAI']}, full[2] | {'logos': []}, full[3]], body, t, reg)), True)
        check('a video with no declared logo fails', any('declares no logo' in x for x in problems({}, full[:3] + [full[3] | {'logos': []}], body, t, reg)), True)
        check('a cover with no logo fails', any('cover shows none' in x for x in problems({}, [full[0] | {'logos': []}] + full[1:], body, t, reg)), True)
        check('a volume piece with no evidence picture fails', any('built from real pages' in x for x in problems({}, [full[0], full[1], full[3]], body, t, reg)), True)
        check('five pages are not enough', any('at least 6' in x for x in problems({}, [full[0], full[1], full[2] | {'evidence': {'pages': pages[:5]}}, full[3]], body, t, reg)), True)
        check('a quiet piece needs no evidence', problems({}, [full[0], full[1], full[3]], 'Open Claude today. ChatGPT too.', t, reg), [])
        (t / 'cover.json').write_text(json.dumps(good_receipt | {'portrait': False}))
        check('a cover without the portrait fails', any('no portrait' in x for x in problems({}, full, body, t, reg)), True)
        (t / 'cover.json').write_text(json.dumps(good_receipt | {'sha256': 'nope'}))
        check('a cover edited after the drawer fails', any('does not match' in x for x in problems({}, full, body, t, reg)), True)
        (t / 'cover.json').unlink()
        check('a hand-made cover fails', any('not drawn by the house drawer' in x for x in problems({}, full, body, t, reg)), True)
        check('volume words are found', about_volume('Claude Code lists more than a dozen models.'), True)
        check('no volume words, no evidence needed', about_volume('A quiet week for prices.'), False)
    if fails:
        print('visual gate self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'visual gate self-test passed: {count} checks')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='The visual gate: logos, real evidence, a house cover.')
    ap.add_argument('post', nargs='?')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.post:
        ap.error('give post.json')
    return explain(a.post)


if __name__ == '__main__':
    sys.exit(main())
