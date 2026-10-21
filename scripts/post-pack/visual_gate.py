#!/usr/bin/env python3
"""The visual gate: a post's pictures, videos and thumbnails are not packed
unless they carry the real logos of every company the piece names, show real
evidence when the piece is about volume, and the cover and the thumbnails
came from the house drawer.

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

The five checks:

  1. LOGOS. Every company in config/logo-registry.json that the fact-checked
     body names (and is not a mentions-only source) appears in the "logos"
     of at least one packed picture and of the cover, and of every packed
     video (declared: what the edit put on screen) and every packed
     thumbnail, as a video's.
  2. EVIDENCE. When the body is about volume (it says "so many", "every few
     months", "keeps growing", "more than a dozen", "flood", "pile", "one
     after another" or the like), the pack holds a picture of kind
     "evidence" built from at least six real pages, each with its URL and
     date, and the screenshots exist.
  3. COVER. cover.png was drawn by scripts/pages/build.py --cover: its
     cover.json receipt matches the PNG byte for byte (and each cover for
     another place, cover-1200x630.png, cover-1200x675.png,
     cover-1080x1080.png and cover-1080x1920.png, its own receipt), it carries Krish's
     portrait, and when the piece names companies it carries at least one
     logo row.
  4. THUMBNAILS. Each video thumbnail (Krish, 2026-10-12: "I always want a
     video thumbnail for all video sizes produced as an asset every time")
     was drawn by scripts/pages/build.py --thumbs: its thumbs.json receipt
     holds a file of its shape that matches it byte for byte, it carries
     Krish's portrait, and every logo its entry declares is one the drawer
     drew, in a row or the strip. So a thumbnail cannot claim a logo it
     does not show.
  5. REAL THINGS. From posts dated 16 October 2026, every article and
     video picture says what real thing it shows ("shows": screenshot,
     chart, photo, evidence, quote or logos), and a chart names its
     "data_source" and what it "measures". Krish, 2026-10-16: "I don't think
     the visuals should have analogies in them. The visuals should look like
     genuine reviews of the actual product, with statistics, rather than
     having analogies." (house rule ANALOGY_IN_SCRIPTS_ONLY)

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


def drawn(declared, receipt_logos, reg):
    """True when a declared logo is among those the drawer drew: the
    receipt's row and strip names hold the company's name, or another of its
    names from the registry. A row may show two companies ("Warner Music
    Group and BMG")."""
    names = next((c['names'] for c in reg if declared.lower() in (n.lower() for n in c['names'])), [declared])
    text = ' | '.join(str(x) for x in receipt_logos or [])
    return any(re.search(r'(?<!\w)' + re.escape(n) + r'(?!\w)', text, re.I) for n in names)


def companies_in(declared, reg):
    """The registry companies a declared logo entry names, by any of their
    names: a drawn row may name two ("Warner Music Group and BMG")."""
    text = str(declared)
    return [c for c in reg if any(re.search(r'(?<!\w)' + re.escape(n) + r'(?!\w)', text, re.I) for n in c['names'])]


def declared_drawn(declared, receipt_logos, reg):
    """True when a declared entry was drawn: every company it names is among
    the drawer's rows and strip (drawn), or, naming none the registry knows,
    its own text is."""
    found = companies_in(declared, reg)
    if found:
        return all(drawn(c['name'], receipt_logos, reg) for c in found)
    return drawn(declared, receipt_logos, reg)


# Each cover kind a pack carries, and the receipt scripts/pages/build.py
# --cover writes beside it (Krish, 2026-10-12: "the cover crops need to be
# all individual images, a vertical cover thumbnail for the shorts/tiktok etc
# as well, every post moving forward").
COVER_RECEIPTS = {
    'cover': ('the cover', 'cover.json'),
    'substack-cover': ('the Substack cover', 'cover-1200x630.json'),
    'share-card-cover': ('the share card cover', 'cover-1200x675.json'),
    'square-cover': ('the square cover', 'cover-1080x1080.json'),
    'vertical-cover': ('the vertical cover', 'cover-1080x1920.json'),
}


def problems(post, planned, body, base, reg=None):
    """Plain-words reasons the pack fails the gate, or [] when it passes.
    `planned` is build.py's plan: dicts with 'kind' (as given), 'logos',
    'evidence', 'source' and 'path'."""
    reg = reg or registry()
    found = []
    names = named(body or '', reg)
    pictures = [p for p in planned if p.get('kind') in ('image', 'share-card', 'linkedin-card') + tuple(COVER_RECEIPTS)]
    videos = [p for p in planned if p.get('kind') == 'video']
    thumbs = [p for p in planned if p.get('kind') == 'thumbnail']
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
        # A video's or a thumbnail's declared logos may name a drawn row of two
        # companies ("Warner Music Group and BMG", as thumbs.json lists rows):
        # each company counts by any of its names (drawn), as the receipt does.
        for v in videos:
            vm = [n for n in names if not drawn(n, v.get('logos'), reg)]
            if vm:
                found.append(f'the video {Path(str(v.get("source", ""))).name} declares no logo for {", ".join(vm)}: put the real logos on '
                             'screen in the edit and list them in its "logos"')
        for t in thumbs:
            tm = [n for n in names if not drawn(n, t.get('logos'), reg)]
            if tm:
                found.append(f'the {t.get("shape", "")} thumbnail {Path(str(t.get("source", ""))).name} declares no logo for {", ".join(tm)}: '
                             'draw it with their logos (rows, or "strip", in the "thumbs" cover facts) and list them in its "logos"')
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
    # 3. COVER: the 3:2 one and the one for every other place it is shown,
    # each against its own receipt from scripts/pages/build.py --cover.
    for c in [p for p in planned if p.get('kind') in COVER_RECEIPTS]:
        src = Path(str(c.get('source', '')))
        what, name = COVER_RECEIPTS[c['kind']]
        receipt = src.with_name(name)
        if not receipt.is_file():
            found.append(f'{what} was not drawn by the house drawer (no {receipt.name} beside it): draw it with scripts/pages/build.py --cover, '
                         'with "portrait": true and logo rows, so it carries the wordmark, Krish and the real logos')
            continue
        try:
            r = json.loads(receipt.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            r = {}
        if r.get('sha256') != hashlib.sha256(src.read_bytes()).hexdigest():
            found.append(f'{receipt.name} does not match {src.name}: {what} was changed after the drawer made it. Draw it again')
        if not r.get('portrait'):
            found.append(f'{what} has no portrait: draw it with "portrait": true (house rule LOGOS_AND_FACE)')
        if names and not r.get('rows'):
            found.append(f'{what} has no logo rows although the piece names companies: add "rows" with each real logo')
    # 4. THUMBNAILS
    for t in thumbs:
        src = Path(str(t.get('source', '')))
        shape = t.get('shape', '')
        receipt = src.with_name('thumbs.json')
        if not receipt.is_file():
            found.append(f'the {shape} thumbnail {src.name} was not drawn by the house drawer (no thumbs.json beside it): draw it with '
                         'scripts/pages/build.py COVER_FACTS --thumbs, so it carries the wordmark, Krish and the real logos')
            continue
        try:
            r = json.loads(receipt.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            r = {}
        digest = hashlib.sha256(src.read_bytes()).hexdigest() if src.is_file() else None
        made = next((f for f in r.get('files') or [] if isinstance(f, dict) and f.get('sha256') == digest), None)
        if made is None:
            found.append(f'thumbs.json does not match {src.name}: the thumbnail was changed after the drawer made it. Draw it again')
            continue
        if made.get('shape') != shape:
            found.append(f'{src.name} is the drawer\'s {made.get("shape")} thumbnail, packed as the {shape} one')
        if not r.get('portrait'):
            found.append(f'the {shape} thumbnail has no portrait: draw it with "portrait": true (house rule LOGOS_AND_FACE)')
        shown = [l for l in (t.get('logos') or []) if not declared_drawn(l, r.get('logos'), reg)]
        if shown:
            found.append(f'the {shape} thumbnail declares the logo of {", ".join(shown)}, but the drawer drew no row or strip for it: '
                         'add it to the "thumbs" cover facts and draw it again')
    # 5. REAL THINGS
    found += real_thing_problems(post)
    return found


# Krish, 2026-10-16, of a drawn race between two cars standing for two AIs:
# "No that's car visual is not clear ... I don't think the visuals should have
# analogies in them. The visuals should look like genuine reviews of the actual
# product, with statistics, rather than having analogies. The analogies should
# only be in my casual narrative explanation style." (house rule
# ANALOGY_IN_SCRIPTS_ONLY). Every article and video picture of a post dated
# from then declares what real thing it shows; a chart names its source and
# says what it measures, so a number on screen is never bare (PLAIN_SCORES).
REAL_FROM = '2026-10-16'
SHOWS = {
    'screenshot': 'a real page or app, as it is',
    'chart': 'real statistics, with "data_source" and "measures"',
    'photo': 'the real product, place or person',
    'evidence': 'real pages piled up ("evidence")',
    'quote': 'a real quote, from its source',
    'logos': 'the companies\' own logos',
    'reconstruction': 'an explicitly labelled reconstruction, with its source and scope',
}


def real_thing_problems(post):
    """Why a post's pictures are not the real thing, or []: posts dated from
    REAL_FROM only, so a pack already posted is never refused afterwards."""
    if str((post or {}).get('date') or '') < REAL_FROM:
        return []
    found = []
    for f in (post or {}).get('files') or []:
        if not isinstance(f, dict) or f.get('kind') != 'image':
            continue
        label = f.get('name') or f.get('file') or '?'
        shows = f.get('shows')
        if shows not in SHOWS:
            found.append(f'"{label}" does not say what real thing it shows: give it "shows": one of '
                         + ', '.join(f'"{k}" ({v})' for k, v in SHOWS.items())
                         + '. A drawing that acts out an analogy is not one: analogies belong in the spoken script '
                         '(house rule ANALOGY_IN_SCRIPTS_ONLY; Krish, 2026-10-16: "The visuals should look like genuine reviews '
                         'of the actual product, with statistics, rather than having analogies")')
        elif shows == 'chart':
            if not str(f.get('data_source') or '').strip():
                found.append(f'"{label}" is a chart with no "data_source": name who measured the numbers and when '
                             '(for example "Artificial Analysis, 16 Oct 2026")')
            if not str(f.get('measures') or '').strip():
                found.append(f'"{label}" is a chart with no "measures": say what its numbers measure, the scale and which way '
                             'is better, and draw that on the chart too, so no number on it is bare (house rule PLAIN_SCORES)')
        elif shows == 'evidence' and not (f.get('evidence') or {}).get('pages'):
            found.append(f'"{label}" says it shows evidence but lists no "evidence" pages')
        elif shows == 'reconstruction':
            if not str(f.get('data_source') or '').strip() or not str(f.get('scope') or '').strip():
                found.append(f'"{label}" is a reconstruction without its source and scope; name both and label it as reconstructed')
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
    print('ready: logos, evidence, cover and thumbnails all pass')
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
        (t / 'cover.json').write_text(json.dumps(good_receipt))
        # The 1200 x 630 cover Substack's upload box asks for, against its own receipt.
        wide_png = b'\x89PNG wide'
        (t / 'cover-1200x630.png').write_bytes(wide_png)
        sub = {'kind': 'substack-cover', 'source': t / 'cover-1200x630.png', 'logos': ['OpenAI', 'Anthropic'], 'path': '2/substack-cover-1200x630.png'}
        (t / 'cover-1200x630.json').write_text(json.dumps(good_receipt | {'sha256': hashlib.sha256(wide_png).hexdigest()}))
        check('a full pack with the Substack cover passes', problems({}, full + [sub], body, t, reg), [])
        (t / 'cover-1200x630.json').write_text(json.dumps(good_receipt))
        check('a Substack cover that does not match its receipt fails', any('cover-1200x630.json does not match' in x for x in problems({}, full + [sub], body, t, reg)), True)
        (t / 'cover-1200x630.json').unlink()
        check('a hand-made Substack cover fails', any('the Substack cover was not drawn by the house drawer' in x for x in problems({}, full + [sub], body, t, reg)), True)
        tall_png = b'\x89PNG vertical'
        (t / 'cover-1080x1920.png').write_bytes(tall_png)
        vert = {'kind': 'vertical-cover', 'source': t / 'cover-1080x1920.png', 'logos': ['OpenAI', 'Anthropic'], 'path': '2/vertical.png'}
        (t / 'cover-1080x1920.json').write_text(json.dumps(good_receipt | {'sha256': hashlib.sha256(tall_png).hexdigest()}))
        check('a vertical cover drawn by the house drawer passes', problems({}, full + [vert], body, t, reg), [])
        (t / 'cover-1080x1920.json').write_text(json.dumps(good_receipt | {'sha256': hashlib.sha256(tall_png).hexdigest(), 'portrait': False}))
        check('a vertical cover without the portrait fails', any('the vertical cover has no portrait' in x for x in problems({}, full + [vert], body, t, reg)), True)
        # 4. THUMBNAILS: drawn by the house drawer, with the face and every logo they declare.
        (t / 'cover.json').write_text(json.dumps(good_receipt))
        (t / 'thumbs').mkdir()
        wide_jpg, tall_jpg = b'\xff\xd8 wide', b'\xff\xd8 tall'
        (t / 'thumbs' / 'thumb-wide-1280x720.jpg').write_bytes(wide_jpg)
        (t / 'thumbs' / 'thumb-tall-1080x1920.jpg').write_bytes(tall_jpg)
        thumbs_receipt = {'portrait': True, 'logos': ['OpenAI', 'Claude by Anthropic'],
                          'files': [{'file': 'thumb-wide-1280x720.jpg', 'shape': 'wide', 'sha256': hashlib.sha256(wide_jpg).hexdigest()},
                                    {'file': 'thumb-tall-1080x1920.jpg', 'shape': 'tall', 'sha256': hashlib.sha256(tall_jpg).hexdigest()}]}
        (t / 'thumbs' / 'thumbs.json').write_text(json.dumps(thumbs_receipt))
        thumbs = [{'kind': 'thumbnail', 'shape': 'wide', 'source': t / 'thumbs' / 'thumb-wide-1280x720.jpg', 'logos': ['OpenAI', 'Anthropic'], 'path': '3/w.jpg'},
                  {'kind': 'thumbnail', 'shape': 'tall', 'source': t / 'thumbs' / 'thumb-tall-1080x1920.jpg', 'logos': ['OpenAI', 'Anthropic'], 'path': '3/t.jpg'}]
        check('a full pack with both thumbnails passes', problems({}, full + thumbs, body, t, reg), [])
        check('a row may name a company by another of its names', drawn('Anthropic', ['Claude by Anthropic'], reg), True)
        # The second reviewer's case (2026-10-12): logos copied from thumbs.json,
        # where a row names two companies, failed the thumbnail name check.
        rows = ['OpenAI and Anthropic']
        check('a thumbnail or video whose declared logos are the drawer\'s rows of two companies passes',
              problems({}, full[:3] + [full[3] | {'logos': rows}, thumbs[0] | {'logos': rows}, thumbs[1] | {'logos': rows}], body, t, reg), [])
        check('a name inside another word is not a logo drawn', drawn('Meta', ['Metadata Inc'], []), False)
        check('a thumbnail that declares no logo for a named company fails',
              any('thumbnail thumb-tall-1080x1920.jpg declares no logo for Anthropic' in x for x in problems({}, full + [thumbs[0], thumbs[1] | {'logos': ['OpenAI']}], body, t, reg)), True)
        (t / 'thumbs' / 'thumbs.json').write_text(json.dumps(thumbs_receipt | {'logos': ['OpenAI']}))
        check('a thumbnail that declares a logo it does not show fails',
              any('declares the logo of Anthropic, but the drawer drew no row or strip' in x for x in problems({}, full + thumbs, body, t, reg)), True)
        (t / 'thumbs' / 'thumbs.json').write_text(json.dumps(thumbs_receipt | {'portrait': False}))
        check('a thumbnail without the portrait fails', any('wide thumbnail has no portrait' in x for x in problems({}, full + thumbs, body, t, reg)), True)
        (t / 'thumbs' / 'thumbs.json').write_text(json.dumps(thumbs_receipt))
        (t / 'thumbs' / 'thumb-wide-1280x720.jpg').write_bytes(wide_jpg + b' edited')
        check('a thumbnail edited after the drawer fails', any('does not match thumb-wide-1280x720.jpg' in x for x in problems({}, full + thumbs, body, t, reg)), True)
        (t / 'thumbs' / 'thumb-wide-1280x720.jpg').write_bytes(wide_jpg)
        check('the tall picture packed as the wide thumbnail fails',
              any('is the drawer\'s tall thumbnail, packed as the wide one' in x for x in problems({}, full + [thumbs[1] | {'shape': 'wide'}], body, t, reg)), True)
        (t / 'thumbs' / 'thumbs.json').unlink()
        check('a hand-made thumbnail fails', any('was not drawn by the house drawer (no thumbs.json' in x for x in problems({}, full + thumbs, body, t, reg)), True)
        # 5. REAL THINGS (Krish, 2026-10-16)
        race = {'kind': 'image', 'name': 'race.png', 'purpose': 'two cars racing, standing for two AIs'}
        chart = {'kind': 'image', 'name': 'scores.png', 'shows': 'chart', 'data_source': 'Artificial Analysis, 16 Oct 2026',
                 'measures': 'Intelligence Index: 10 hard tests, 0 to 100, higher is better'}
        check('a picture of a post from 16 Oct that does not say what real thing it shows is refused, naming his rule',
              any('ANALOGY_IN_SCRIPTS_ONLY' in x for x in real_thing_problems({'date': '2026-10-16', 'files': [race]})), True)
        check('the same picture on a post already made before then is left alone',
              real_thing_problems({'date': '2026-10-14', 'files': [race]}), [])
        check('a chart with its source and what it measures passes; a screenshot passes',
              real_thing_problems({'date': '2026-10-19', 'files': [chart, {'kind': 'image', 'name': 's.png', 'shows': 'screenshot'}]}), [])
        check('a chart with no source and no measure is refused twice',
              len(real_thing_problems({'date': '2026-10-19', 'files': [{'kind': 'image', 'name': 'c.png', 'shows': 'chart'}]})), 2)
        check('"shows": "analogy" is not a real thing',
              len(real_thing_problems({'date': '2026-10-19', 'files': [race | {'shows': 'analogy'}]})), 1)
        reconstruction = {'kind': 'image', 'name': 'inbox.png', 'shows': 'reconstruction',
                          'data_source': 'Redacted test readback, 20 October 2026',
                          'scope': 'Anonymised reconstruction of the observed draft; no screenshot claimed.'}
        check('a source-bound reconstruction is distinct from an evidence screenshot',
              real_thing_problems({'date': '2026-10-21', 'files': [reconstruction]}), [])
        for missing in ('data_source', 'scope'):
            check('a reconstruction requires '+missing,
                  len(real_thing_problems({'date': '2026-10-21', 'files': [reconstruction | {missing: ''}]})), 1)
        check('calling a reconstruction an evidence pile still needs real pages',
              len(real_thing_problems({'date': '2026-10-21', 'files': [reconstruction | {'shows': 'evidence'}]})), 1)
        check('the real-thing check runs through problems()',
              any('ANALOGY_IN_SCRIPTS_ONLY' in x for x in problems({'date': '2026-10-16', 'files': [race]}, full + thumbs, body, t, reg)), True)
        check('volume words are found', about_volume('Claude Code lists more than a dozen models.'), True)
        check('no volume words, no evidence needed', about_volume('A quiet week for prices.'), False)
    if fails:
        print('visual gate self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'visual gate self-test passed: {count} checks')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='The visual gate: logos, real evidence, a house cover and house thumbnails.')
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
