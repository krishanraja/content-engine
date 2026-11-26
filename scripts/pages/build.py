#!/usr/bin/env python3
"""pages: a piece's branded web page and its Substack copy, from the text that
passed the fact gate.

    python build.py page.json --out OUTDIR [--check] [--shots] [--cover] [--thumbs]
    python build.py cover-facts.json --out OUTDIR --cover --thumbs   (the artwork alone)
    python build.py cover-facts.json --out OUTDIR --thumbs --options 3 --brief BRIEF.json [--past COVER ...]
    python build.py --self-test

Reads the piece's body markdown and a small JSON file of page facts (README.md
has every field), and writes two self-contained files into OUTDIR:

  page.html      the piece in the makeyourmindup look, coloured by its
                 subchannel: masthead, headline and deck, the body with its
                 source links, images and opinion labels, the dated call, the
                 sources, the subscribe band. Fonts and images are inlined.
  substack.html  the same text in one column that pastes into Substack's editor:
                 headings, paragraphs, lists, quotes, links and images (as
                 data URIs, in place) and nothing else. A Copy post button puts
                 it on the clipboard.

Every sentence of the body must be on both pages (the rule in
editions/README.md); the build stops if one is missing.

It also writes phone-images.png: every image in the post at the width a phone
shows it (358 pixels), to look at before publishing, and
email-pictures-off.html: the email as Outlook and many work inboxes first show
it, with every picture replaced by its alt text, because they hide pictures
from a sender the reader has not trusted yet. Substack keeps those
images whole and shrinks them, and a finished PNG's words cannot be measured.
Artwork made from HTML is checked before it becomes a PNG by card.py.

--check   copies substack.html's post the way a person would (Playwright) and
          reports how many images, headings and links survive, and whether
          every sentence is still there.
--shots   screenshots both files at 1440 and 390 pixels wide into OUTDIR/shots.
--cover   draws cover.png, the post's cover image at 1200 x 800, from the
          "cover" page facts, and a cover for every other place it is shown,
          each laid out for its own shape, all in the Receipt (receipt.py;
          house rule THE_RECEIPT: a real proof, the wordmark and the real
          logos, never his face), each with its receipt (.json):
          cover-1200x630.png for Substack's upload box (upload this one:
          Substack crops any other shape itself), cover-1200x675.png, the
          16:9 share card, cover-1080x1080.png, the square, and
          cover-1080x1920.png, the vertical cover for Shorts, TikTok and
          Reels. It refuses if a word or a logo would be cut off where a shape
          is shown, or if a word would be too small to read on a phone.
--thumbs  draws a thumbnail for every video size from the same facts:
          thumb-wide-1280x720.jpg for the 16:9 long cut (YouTube and the
          Substack video post) and thumb-tall-1080x1920.jpg for the 9:16
          short cut (the cover on Reels and TikTok), as the Receipt (house
          rule THE_RECEIPT: a real proof, the wordmark and the real logos,
          never his face), with a receipt thumbs.json. Both or neither: it
          refuses if a word or a logo would sit where a platform covers or
          crops it, or a word would be too small to read.
--options N  with --thumbs: two or three options in place of the one set
          (docs/production/COVER-STANDARD.md, point 8; the thumbnail-designer
          skill), from the facts' "thumb_options" and --brief BRIEF.json,
          with a grid mock beside the last five posted covers (--past, newest
          first). scripts/pages/thumb_options.py has the rest.

Facts with no deck or body (docs/plans/<plan>/cover-facts.json) draw only
the artwork that --cover and --thumbs ask for. Paths in the facts are
relative to the facts file (or to --assets). A plan keeps its real logos as
SVG in docs/plans/<plan>/logos/, so any checkout can draw its artwork. A
"background" picture is optional, because git keeps no pictures: on a
machine without it the artwork is drawn on plain ink and the drawer says so.
A logo that is missing always stops the drawer.
"""
import argparse
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
import copy_lint  # noqa: E402  the name rule (no_name), for the page's own self-test
import card  # noqa: E402

CHOICE = re.compile(r'^(Guess|Future|Scenario|Option|Outcome) (one|two|three|four|five)\. (.+)$', re.S)
BET = re.compile(r'\bOur (?:bet|pick|call): (?:guess|future|scenario|option|outcome) (one|two|three|four|five)\b', re.I)
CALL_HEADINGS = ('OUR PREDICTION', 'OUR CALL', 'THE CALL', 'PREDICTION')
# Opinion is labelled so it never passes for fact. Longest first.
LABELS = ["Here's our guess, and it is a guess:", 'Our read, in plain English:', 'Our read:', 'Our bet:', 'Our guess:', 'Our view:']
ENDNOTE = ('Every fact in this piece was checked against its source before it went out. '
           'Made in public: corrections are welcome in the Substack comments.')


def esc(t):
    return html.escape(t, quote=False)


def attr(t):
    return html.escape(t, quote=True)


# ---------------------------------------------------------------- the body

def parse_blocks(md):
    """Markdown to blocks: ('h2'|'h3', text), ('p', text), ('ul'|'ol', [items]),
    ('quote', text). Covers what the engine writes: headings, paragraphs,
    lists, quotes, **bold**, *italic* and [links](url)."""
    out = []
    for chunk in re.split(r'\n\s*\n', md.replace('\r\n', '\n').strip()):
        lines = [ln.rstrip() for ln in chunk.split('\n') if ln.strip()]
        para, items, kind = [], [], None

        def flush_para():
            if para:
                out.append(('p', ' '.join(s.strip() for s in para)))
                para.clear()

        def flush_list():
            nonlocal kind
            if items:
                out.append((kind, list(items)))
                items.clear()
            kind = None

        if all(ln.lstrip().startswith('>') for ln in lines):
            out.append(('quote', ' '.join(re.sub(r'^\s*>\s?', '', ln).strip() for ln in lines)))
            continue
        for ln in lines:
            h = re.match(r'^(#{1,6})\s+(.*?)\s*#*$', ln)
            ul = re.match(r'^\s*[-*+]\s+(.*)$', ln)
            ol = re.match(r'^\s*\d+[.)]\s+(.*)$', ln)
            if h:
                flush_para(), flush_list()
                out.append(('h2' if len(h.group(1)) <= 2 else 'h3', h.group(2)))
            elif ul or ol:
                flush_para()
                want = 'ul' if ul else 'ol'
                if kind and kind != want:
                    flush_list()
                kind = want
                items.append((ul or ol).group(1).strip())
            elif items:
                items[-1] += ' ' + ln.strip()
            else:
                para.append(ln)
        flush_para(), flush_list()
    return out


def plain(md_text):
    """Inline markdown to the words a reader sees."""
    t = re.sub(r'\[([^\]]+)\]\([^)\s]+\)', r'\1', md_text)
    return t.replace('**', '').replace('*', '')


def inline(text):
    t = esc(text)
    t = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', lambda m: f'<a href="{attr(html.unescape(m.group(2)))}">{m.group(1)}</a>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    return re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)


def on_text(h, fn):
    """Apply fn to the text between tags, outside any link."""
    parts = re.split(r'(<[^>]+>)', h)
    in_link = 0
    for i, part in enumerate(parts):
        if part.startswith('<'):
            if re.match(r'<a[\s>]', part):
                in_link += 1
            elif part.startswith('</a'):
                in_link -= 1
        elif not in_link:
            parts[i] = fn(part)
    return ''.join(parts)


class Linker:
    """Source links: each phrase is linked where it first appears, in reading
    order, to its source. Sources are listed in the order they are first linked."""

    def __init__(self, links, sources):
        self.pending = [(p, k) for p, k in links]
        self.sources = sources
        self.used = []
        for _, k in self.pending:
            if k not in sources:
                brand.fail(f'link to unknown source {k!r}')

    def apply(self, h):
        for phrase, key in list(self.pending):
            target, done = esc(phrase), [False]

            def once(seg, target=target, key=key, done=done):
                if done[0] or target not in seg:
                    return seg
                done[0] = True
                return seg.replace(target, f'<a href="{attr(self.sources[key][1])}">{target}</a>', 1)
            h = on_text(h, once)
            if done[0]:
                self.pending.remove((phrase, key))
                if key not in self.used:
                    self.used.append(key)
        return h


def mark_labels(h, labels, wrap):
    """Wrap an opinion label at the start of a paragraph or of a sentence."""
    for lab in labels:
        e = re.escape(esc(lab))
        h = re.sub(rf'(^|(?<=[.!?"] )){e}', lambda m, lab=lab: m.group(1) + wrap(esc(lab)), h, count=1)
    return h


# ---------------------------------------------------------------- the check

def page_text(h):
    t = re.sub(r'<script[\s\S]*?</script>', '', h)
    t = re.sub(r'<style[\s\S]*?</style>', '', t)
    t = re.sub(r'</?(?:a|span|strong|em|b|i|cite|mark|code|sup|sub)\b[^>]*>', '', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    # Tags are gone by now, so &lt; and &gt; are text a reader sees ("from <1% to 7%", Friday 16 Oct).
    t = t.replace('&lt;', '<').replace('&gt;', '>')
    t = t.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&#x27;', "'")
    return re.sub(r'\s+', ' ', t)


def missing_sentences(body, h):
    """The rule from tests/control-plane/editions.test.ts: every sentence of
    the body is on the page; a labelled row only needs the words after its
    label, and the confidence line is shown as a meter."""
    page = page_text(h).lower()
    missing = []
    for para in body.replace('\r\n', '\n').split('\n\n'):
        text = re.sub(r'^\s*(?:[-*+]|\d+[.)]|>)\s+', '', re.sub(r'^#+ .*$', '', para, flags=re.M), flags=re.M)
        text = plain(text).strip()
        if not text:
            continue
        for raw in re.split(r'(?<=[.!?"])\s+(?=[A-Z"])', text):
            s = re.sub(r'\s+', ' ', raw).strip()
            lab = re.match(r'^(Winners|Losers|First sign|How sure we are): (.+)$', s)
            if lab and lab.group(1) == 'How sure we are':
                continue
            need = re.sub(r'^\[|\]$', '', lab.group(2)) if lab else re.sub(r'\.$', '', s)
            if need.lower() not in page:
                missing.append(s)
    return missing


# ---------------------------------------------------------------- facts

def refuse_author(facts, path):
    """Krish, 2026-10-28: "Even articles written are not authored by Krish." The
    page has no author: its byline is the publication, the date and the
    minutes, with no face beside it (Krish picked "Drop it", 29 Oct). A facts
    file that names one is refused, so no name can come back through it."""
    if 'author' in facts:
        brand.fail(f'{path}: "author" is not read: a page is by makeyourmindup and names no author (house rule NO_NAME); take the field out')


def load_facts(path, body_override, assets):
    facts = json.loads(Path(path).read_text(encoding='utf-8'))
    refuse_author(facts, path)
    base = Path(assets) if assets else Path(path).resolve().parent
    for key in ('subchannel', 'headline', 'deck', 'date'):
        if not facts.get(key):
            brand.fail(f'{path}: "{key}" is required')
    body_path = Path(body_override) if body_override else base / facts.get('body', 'body.md')
    if not body_path.exists():
        brand.fail(f'body not found: {body_path}')
    sources = {}
    for k, v in (facts.get('sources') or {}).items():
        sources[k] = (v['title'], v['url']) if isinstance(v, dict) else (v[0], v[1])
    return facts, base, body_path.read_text(encoding='utf-8').replace('\r\n', '\n'), sources


def resolve(base, rel):
    p = Path(rel)
    return p if p.is_absolute() else base / p


# ---------------------------------------------------------------- building

def build(facts, base, body, sources):
    """The body as page HTML and as Substack HTML, block by block, with the
    images, pull quotes and source links in their places, and the call apart."""
    labels = sorted(set(LABELS + facts.get('opinion_labels', [])), key=len, reverse=True)
    linker = Linker(facts.get('links', []), sources)
    figures = [dict(f, placed=False) for f in facts.get('figures', [])]
    for f in figures:
        if not f.get('alt'):
            brand.fail(f'image {f.get("image")!r} needs "alt": the words a reader hears or sees if the image does not load')
    pulls = [dict(q, placed=False) for q in facts.get('pull_quotes', [])]
    flat_body = re.sub(r'\s+', ' ', plain(body)).lower()
    for q in pulls:
        words = re.sub(r'\s+', ' ', q['quote']).strip(' ."“”').lower()
        if words not in flat_body:
            brand.fail(f'a pull quote must repeat the body word for word: {q["quote"]!r}')
    call_heads = [facts['call_heading'].upper()] if facts.get('call_heading') else list(CALL_HEADINGS)

    def both(md):
        """One block of text: links decided once, labels styled per output."""
        h = linker.apply(inline(md))
        return (mark_labels(h, labels, lambda t: f'<span class="read">{t}</span>'),
                mark_labels(h, labels, lambda t: f'<strong>{t}</strong>'))

    blocks = parse_blocks(body)
    page, sub, call = [], [], None
    i = 0
    while i < len(blocks):
        kind, val = blocks[i]
        if kind == 'h2' and plain(val).strip().upper().rstrip('.') in call_heads:
            call = {'heading': val, 'blocks': []}
            i += 1
            while i < len(blocks) and blocks[i][0] != 'h2':
                call['blocks'].append(blocks[i])
                i += 1
            continue
        if kind in ('h2', 'h3'):
            page.append(f'<{kind}>{inline(val)}</{kind}>')
            sub.append(f'<{kind}>{inline(val)}</{kind}>')
            i += 1
            continue
        if kind == 'p' and CHOICE.match(val):
            # A run of choices ("Guess one. ...", "Guess two. ...") becomes a row
            # of cards; the paragraph after it may name the one we bet on.
            run = []
            while i < len(blocks) and blocks[i][0] == 'p' and CHOICE.match(blocks[i][1]):
                run.append(blocks[i][1])
                i += 1
            nxt = blocks[i][1] if i < len(blocks) and blocks[i][0] == 'p' else ''
            bet = BET.search(plain(nxt))
            bet = bet.group(1).lower() if bet else None
            cards = []
            for text in run:
                m = CHOICE.match(text)
                head = f'{m.group(1)} {m.group(2)}'
                ph, sh = both(m.group(3))
                on = m.group(2) == bet
                sticker = '<span class="sticker">Our bet</span>' if on else ''
                cards.append(f'<div class="guess{" bet" if on else ""}"><div class="guess-head">'
                             f'<span class="label">{esc(head)}</span>{sticker}</div><p>{ph}</p></div>')
                sub.append(f'<p><strong>{esc(head)}.</strong> {sh}</p>')
            page.append(f'<div class="guesses n{min(len(cards), 3)}">{"".join(cards)}</div>')
            for text in run:
                place_after(text, figures, pulls, page, sub, base)
            continue
        if kind in ('ul', 'ol'):
            pairs = [both(it) for it in val]
            page.append(f'<{kind}>' + ''.join(f'<li>{p}</li>' for p, _ in pairs) + f'</{kind}>')
            sub.append(f'<{kind}>' + ''.join(f'<li>{s}</li>' for _, s in pairs) + f'</{kind}>')
            raw = ' '.join(val)
        else:
            ph, sh = both(val)
            wrap = ('<blockquote><p>', '</p></blockquote>') if kind == 'quote' else ('<p>', '</p>')
            page.append(wrap[0] + ph + wrap[1])
            sub.append(wrap[0] + sh + wrap[1])
            raw = val
        place_after(raw, figures, pulls, page, sub, base)
        i += 1

    problems = [f'link phrase not found in the body text (headings and the prediction are never linked): {p!r}' for p, _ in linker.pending]
    problems += [f'image anchor not found in the body: {f["after"]!r}' for f in figures if not f['placed']]
    problems += [f'pull quote anchor not found in the body: {q["after"]!r}' for q in pulls if not q['placed']]
    if problems:
        brand.fail('\n  '.join(['the page facts do not match the body:'] + problems))
    order = linker.used + [k for k in sources if k not in linker.used]
    return {
        'page_body': '\n'.join(page), 'sub_body': '\n'.join(sub), 'call': call,
        'sources': [sources[k] for k in order], 'unlinked': [k for k in sources if k not in linker.used],
        'images': len(figures), 'linked': len(linker.used), 'links': len(facts.get('links', [])),
    }


def place_after(raw_md, figures, pulls, page, sub, base):
    """Pull quotes and images go after the block whose words contain their anchor."""
    text = plain(raw_md)
    for q in pulls:
        if not q['placed'] and q['after'] in text:
            q['placed'] = True
            words = esc(q['quote'].strip().strip('"“”'))
            cite = q.get('cite')
            curly = re.sub(r"(?<=\w)'(?=\w)", '’', words)
            page.append(f'<blockquote class="pull"><p>“{curly}”</p>'
                        + (f'<cite class="label">{esc(cite)}</cite>' if cite else '') + '</blockquote>')
            sub.append(f'<blockquote><p>“{words}”</p>' + (f'<p>{esc(cite)}</p>' if cite else '') + '</blockquote>')
    for f in figures:
        if not f['placed'] and f['after'] in text:
            f['placed'] = True
            uri = brand.data_uri(resolve(base, f['image']), 1360)
            alt, cap = attr(f.get('alt', '')), f.get('caption')
            if len(f.get('alt', '').split()) < ALT_MIN_WORDS:
                print(f'  note: the alt text for {f["image"]} is under {ALT_MIN_WORDS} words. Outlook shows it instead of the '
                      'picture until a reader trusts the sender, so say the picture\'s point in one plain sentence.')
            page.append(f'<figure class="vis"><img src="{uri}" alt="{alt}" width="680">'
                        + (f'<figcaption>{esc(cap)}</figcaption>' if cap else '') + '</figure>')
            sub.append(f'<p><img src="{uri}" alt="{alt}" width="680"></p>' + (f'<p><em>{esc(cap)}</em></p>' if cap else ''))


# ---------------------------------------------------------------- the page

PAGE_CSS = """
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--cream); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }
.label { font-family: var(--mono); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
.pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; padding: 5px 10px; border: 2px solid var(--ink); background: var(--ink); color: var(--cream); white-space: nowrap; }
.pill.accent { background: var(--accent); color: var(--ink); }
.pill.butter { background: var(--butter); color: var(--ink); } .pill.lilac { background: var(--lilac); color: var(--ink); }
.pill.coral { background: var(--coral); color: var(--ink); } .pill.mint { background: var(--mint); color: var(--ink); }
.sticker { display: inline-block; font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; border: 2px solid var(--ink); background: var(--cream); color: var(--ink); transform: rotate(-4deg); box-shadow: 3px 3px 0 var(--ink); white-space: nowrap; }
.strap { background: var(--ink-deep); color: var(--cream); display: flex; justify-content: space-between; gap: 12px; padding-block: 10px; padding-inline: max(16px, calc((100vw - 1200px) / 2)); font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
.strap span:nth-child(2) { color: var(--mint); }
@media (max-width: 560px) { .strap span:nth-child(3) { display: none; } }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 26px; font-family: var(--mono); font-weight: 600; font-size: 14px; letter-spacing: .1em; text-transform: uppercase; text-decoration: none; background: var(--mint); color: var(--ink); border: 2px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); transition: transform .12s, box-shadow .12s; }
.btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--ink); }
.btn:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.receipt { background: var(--paper); color: var(--ink); border: 2px solid var(--ink); box-shadow: var(--shadow); padding: 18px 20px 14px; font-family: var(--mono); font-size: 13px; position: relative; }
.receipt::after { content: ""; position: absolute; left: -2px; right: -2px; bottom: -12px; height: 12px; background: linear-gradient(-45deg, transparent 6px, var(--paper) 0) 0 0 / 12px 12px repeat-x, linear-gradient(45deg, transparent 6px, var(--paper) 0) 0 0 / 12px 12px repeat-x; }
.receipt h3 { font-family: var(--mono); font-size: 13px; letter-spacing: .3em; text-align: center; margin: 0 0 12px; font-weight: 600; }
.receipt .row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px dashed var(--ink); }
.receipt .row img { height: 22px; width: auto; }
.receipt .who { font-weight: 600; text-transform: uppercase; letter-spacing: .06em; font-size: 12px; }
.receipt .when { color: var(--muted); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.receipt .total { display: flex; justify-content: space-between; gap: 12px; padding-top: 10px; border-top: 2px solid var(--ink); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; font-size: 12px; }
.receipt .cust { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.receipt .cust img { height: 20px; width: auto; }
.mast { background: var(--ink); color: var(--cream); padding-block: 22px; padding-inline: max(16px, calc((100vw - 1200px) / 2)); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.mast img { width: min(420px, 70vw); }
.mast .tags { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.hero { background: var(--accent); border-bottom: 3px solid var(--ink); padding-block: clamp(36px, 7vw, 80px); padding-inline: max(16px, calc((100vw - 1200px) / 2)); display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 64px); align-items: center; }
.hero.solo { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 860px) { .hero { grid-template-columns: 1fr; } }
.hero h1 { font-family: var(--anton); font-weight: 400; text-transform: uppercase; font-size: clamp(44px, 7.4vw, 96px); line-height: .92; letter-spacing: .005em; margin: 0 0 22px; text-wrap: balance; }
.hero .dek { font-family: var(--serif); font-style: italic; font-size: clamp(20px, 2.3vw, 26px); line-height: 1.35; margin: 0 0 24px; max-width: 34ch; }
.hero-art { margin: 0; border: 2px solid var(--ink); box-shadow: var(--shadow); background: var(--cream); }
.byline { display: flex; align-items: center; gap: 12px; font-family: var(--mono); font-size: 12px; letter-spacing: .1em; text-transform: uppercase; }
main.col { max-width: 720px; margin: 0 auto; padding-inline: 16px; padding-block: 56px 24px; }
main.col p, main.col li { font-size: 19px; line-height: 1.68; font-weight: 500; }
main.col p { margin: 0 0 1.15em; }
main.col ul, main.col ol { margin: 0 0 1.15em; padding-left: 1.3em; }
main.col li { margin-bottom: .4em; }
main.col > blockquote:not(.pull) { margin: 0 0 1.15em; padding-left: 18px; border-left: 4px solid var(--accent); }
main.col a { text-decoration-color: var(--mint-deep); text-decoration-thickness: 2px; text-underline-offset: 3px; }
main.col a:hover { background: var(--mint); }
main.col h2 { font-family: var(--anton); font-weight: 400; text-transform: uppercase; font-size: clamp(30px, 4.6vw, 42px); line-height: 1; letter-spacing: .01em; margin: 2em 0 .7em; display: flex; align-items: center; gap: 14px; }
main.col h2::before { content: ""; width: 18px; height: 18px; background: var(--accent); border: 2px solid var(--ink); flex: none; }
main.col h3 { font-family: var(--mono); font-size: 14px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; margin: 2em 0 .9em; padding: 6px 10px; display: inline-block; background: var(--ink); color: var(--accent); }
.read { font-family: var(--mono); font-size: .78em; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; background: var(--accent); padding: 1px 6px; border: 1.5px solid var(--ink); white-space: nowrap; }
.pull { margin: 2.2em 0; padding: 26px 0 22px; border-top: 3px solid var(--ink); border-bottom: 3px solid var(--ink); }
.pull p { font-family: var(--serif) !important; font-style: italic; font-size: clamp(26px, 3.6vw, 36px) !important; line-height: 1.2 !important; margin: 0 0 14px !important; text-wrap: balance; }
.pull cite { font-style: normal; color: var(--muted); }
figure.vis { margin: 2.4em 0; border: 2px solid var(--ink); box-shadow: var(--shadow); background: var(--cream); }
figure.vis figcaption { font-family: var(--mono); font-size: 12px; line-height: 1.5; color: var(--muted); padding: 10px 14px; border-top: 2px solid var(--ink); }
.guesses { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 1.6em 0 1.4em; }
.guesses.n2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .guesses.n1 { grid-template-columns: 1fr; }
@media (max-width: 680px) { .guesses, .guesses.n2 { grid-template-columns: 1fr; } }
.guess { background: var(--paper); border: 2px solid var(--ink); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.guess.bet { background: var(--accent); box-shadow: var(--shadow); }
.guess-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 30px; }
.guess p { font-size: 16px !important; line-height: 1.5 !important; margin: 0 !important; }
.call { background: var(--ink); color: var(--cream); padding-block: clamp(40px, 7vw, 72px); padding-inline: 16px; margin-top: 40px; }
.call-in { max-width: 860px; margin: 0 auto; display: grid; gap: 22px; }
.call h2 { font-family: var(--anton); font-weight: 400; text-transform: uppercase; font-size: clamp(48px, 9vw, 104px); line-height: .9; margin: 0; color: var(--accent); }
.call .claim { font-size: clamp(22px, 3vw, 32px); font-weight: 700; line-height: 1.25; margin: 0; text-wrap: balance; }
.call .crow { display: grid; gap: 6px; }
.call .crow p, .call .more { font-size: 19px; line-height: 1.5; font-weight: 500; margin: 0; }
.call .meta { display: flex; flex-wrap: wrap; gap: 18px 36px; align-items: end; }
.meter { flex: 1 1 260px; display: grid; gap: 8px; }
.meter .bar { height: 22px; border: 2px solid var(--cream); background: var(--ink-soft); position: relative; }
.meter .fill { position: absolute; inset: 0 auto 0 0; background: var(--accent); }
.meter .ticks { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 11px; color: #AEAEA5; }
.meter .ticks b { color: var(--accent); font-weight: 600; }
.call .label.dim { color: #AEAEA5; }
.due { display: grid; gap: 6px; }
.big { font-family: var(--anton); font-size: 44px; line-height: 1; color: var(--cream); }
.call .foot { font-family: var(--serif); font-style: italic; font-size: 18px; color: #D1CEC4; margin: 0; }
.sources { max-width: 720px; margin: 0 auto; padding: 48px 16px 24px; }
.sources h2 { margin: 0; }
.sources ol { margin: 14px 0 0; padding-left: 1.6em; font-family: var(--mono); font-size: 13px; line-height: 1.6; color: var(--muted); }
.sources a { color: var(--ink); text-decoration-color: var(--rule); overflow-wrap: anywhere; }
.endnote { max-width: 720px; margin: 0 auto; padding: 0 16px 56px; font-family: var(--serif); font-style: italic; font-size: 17px; color: var(--muted); }
footer.sub { background: var(--mint); border-top: 3px solid var(--ink); padding-block: 48px; padding-inline: 16px; }
footer.sub .in { max-width: 1000px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 24px; }
footer.sub h2 { font-family: var(--anton); font-weight: 400; text-transform: uppercase; font-size: clamp(34px, 5vw, 56px); line-height: .95; margin: 0 0 8px; }
footer.sub p { margin: 0; font-family: var(--serif); font-style: italic; font-size: 19px; }
footer.sub .btn { background: var(--ink); color: var(--mint); }
.bottom { background: var(--ink-deep); color: #AEAEA5; padding-block: 18px; padding-inline: 16px; text-align: center; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
"""

PALETTE = {'butter': '#FFD84D', 'lilac': '#B7A6FF', 'coral': '#FF6A4D'}


def root_css(hs, accent):
    t = hs['tokens']
    return (f':root {{ color-scheme: light; --ink: {t["ink"]}; --ink-deep: {t["ink_deep"]}; --ink-soft: {t["ink_soft"]}; '
            f'--cream: {t["cream"]}; --paper: #FBF8F1; --rule: #D9D3C4; --muted: #5B615C; --mint: {t["mint"]}; --mint-deep: #2F6B5C; '
            f'--butter: {PALETTE["butter"]}; --lilac: {PALETTE["lilac"]}; --coral: {PALETTE["coral"]}; --accent: {accent}; '
            '--anton: "Anton", Impact, "Arial Narrow", sans-serif; --sans: "Archivo", "Helvetica Neue", Arial, sans-serif; '
            '--serif: "Fraunces", Georgia, "Times New Roman", serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace; '
            '--shadow: 6px 6px 0 var(--ink); }')


def long_date(iso):
    d = dt.date.fromisoformat(iso)
    return f'{d:%A} {d.day} {d:%B %Y}'


def hero_art(facts, base):
    hero = facts.get('hero') or {}
    if hero.get('image'):
        return f'<figure class="hero-art"><img src="{brand.data_uri(resolve(base, hero["image"]), 1200)}" alt="{attr(hero.get("alt", ""))}"></figure>'
    r = hero.get('receipt')
    if not r:
        return ''

    def logo(item, height):
        if item.get('logo'):
            return f'<img src="{brand.data_uri(resolve(base, item["logo"]), 300)}" alt="{attr(item.get("name", ""))}" height="{height}">'
        return f'<span class="who">{esc(item.get("name", ""))}</span>' if item.get('name') else '<span></span>'
    cust = r.get('customer')
    rows = ''.join(f'<div class="row">{logo(row, 22)}<span class="when">{esc(row.get("when", ""))}</span>'
                   f'<span class="pill {attr(row.get("colour", "mint"))}">{esc(row.get("verdict", ""))}</span></div>' for row in r.get('rows', []))
    total = r.get('total')
    return (f'<div class="receipt" role="img" aria-label="{attr(r.get("alt", ""))}"><h3>{esc(r.get("title", "RECEIPT"))}</h3>'
            + (f'<div class="cust">{logo(dict(cust, name=""), 20) if cust.get("logo") else ""}<span>{esc(cust.get("text", ""))}</span></div>' if cust else '')
            + rows
            + (f'<div class="total"><span>{esc(total[0])}</span><span>{esc(total[1])}</span></div>' if total else '')
            + '</div>')


def call_band(call, hs):
    if not call:
        return ''
    copy = hs['copy']
    claim, due, conf, rows, more = None, None, None, [], []
    for kind, val in call['blocks']:
        text = plain(val) if isinstance(val, str) else ' '.join(plain(v) for v in val)
        m_conf = re.match(r'^How sure we are: (\d+)%\.?$', text.strip())
        m_row = re.match(r'^([A-Z][A-Za-z ]{1,24}): (.+)$', text.strip())
        if m_conf:
            conf = int(m_conf.group(1))
        elif claim is None:
            claim = inline(val) if isinstance(val, str) else esc(text)
            m_due = re.match(r'^By (.+?\d{4}), ', text)
            due = m_due.group(1) if m_due else None
        elif m_row:
            rows.append(f'<div class="crow"><span class="label dim">{esc(m_row.group(1))}</span><p>{esc(m_row.group(2))}</p></div>')
        else:
            more.append(f'<p class="more">{inline(val) if isinstance(val, str) else esc(text)}</p>')
    meter = (f'<div class="meter" aria-label="How sure we are: {conf}%"><span class="label dim">How sure we are</span>'
             f'<div class="bar"><div class="fill" style="width:{conf}%"></div></div>'
             f'<div class="ticks"><span>0%</span><b>{conf}%</b><span>100%</span></div></div>') if conf is not None else ''
    due_html = f'<div class="due"><span class="label dim">Due</span><span class="big">{esc(due)}</span></div>' if due else ''
    return f"""<section class="call" aria-labelledby="call-h">
  <div class="call-in">
    <h2 id="call-h">{esc(copy.get('call_headline', 'Our call.'))}</h2>
    {f'<p class="claim">{claim}</p>' if claim else ''}
    {''.join(rows)}{''.join(more)}
    {f'<div class="meta">{meter}{due_html}</div>' if meter or due_html else ''}
    <p class="foot">{esc(copy.get('call_footnote', ''))}</p>
  </div>
</section>"""


def render_page(facts, base, body, r, refresh):
    hs = brand.house()
    ch = brand.channel(hs, facts['subchannel'])
    site = hs['copy'].get('site', 'makeyourmindup.ai')
    minutes = max(1, round(len(body.split()) / 200))
    art = hero_art(facts, base)
    sticker = f'<span class="sticker">{esc(ch["sticker"])}</span>' if ch['sticker'] else ''
    sources = ''.join(f'<li><a href="{attr(u)}">{esc(t)}</a></li>' for t, u in r['sources'])
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(facts.get('title') or facts['headline'])}</title>
<meta name="description" content="{attr(facts['deck'])}">
<style>{brand.font_css()}</style>
<style>{root_css(hs, ch['accent'])}{PAGE_CSS}</style>
</head>
<body>
<div class="strap"><span>{esc(facts.get('issue') or long_date(facts['date']))}</span><span>{esc(brand.day_list(hs, short=True))}</span><span>Free to read</span></div>
<header class="mast">
  <img src="{brand.brand_uri('wordmark', refresh)}" alt="makeyourmindup" width="420" height="50">
  <div class="tags"><span class="pill accent">{esc(ch['name'])} · {esc(ch['days'])}</span>{sticker}</div>
</header>
<section class="hero{'' if art else ' solo'}">
  <div>
    <h1>{esc(facts['headline'])}</h1>
    <p class="dek">{esc(facts['deck'])}</p>
    <div class="byline"><span>makeyourmindup · {long_date(facts['date'])} · {minutes} minute read</span></div>
  </div>
  {art}
</section>
<main class="col">
{r['page_body']}
</main>
{call_band(r['call'], hs)}
{f'<section class="sources" aria-labelledby="src-h"><h2 id="src-h" class="label">Sources</h2><ol>{sources}</ol></section>' if sources else ''}
<p class="endnote">{esc(facts.get('endnote', ENDNOTE))}</p>
<footer class="sub">
  <div class="in">
    <div><h2>Get every piece in your inbox</h2><p>Free. Every {esc(brand.day_list(hs))}.</p></div>
    <a class="btn" href="{brand.SUBSTACK}/subscribe">Subscribe free</a>
  </div>
</footer>
<div class="bottom label">{esc(site)}</div>
</body>
</html>
"""


# ---------------------------------------------------------------- the Substack copy

SUB_CSS = """
:root { color-scheme: dark; --ink: #0C1512; --ink-soft: #16221D; --line: #363C38; --cream: #F4EFE4; --cream-2: #D1CEC4; --muted: #AEAEA5; --mint: #7EF0C0; --on: #07110C; --link: #0B5E43; --accent: ACCENT;
  --anton: "Anton", Impact, sans-serif; --sans: "Archivo", "Helvetica Neue", Arial, sans-serif; --serif: "Source Serif 4", Georgia, serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--ink); color: var(--cream); font-family: var(--sans); }
.wrap { max-width: 46rem; margin: 0 auto; padding-inline: 16px; padding-block: 28px 72px; display: flex; flex-direction: column; gap: 22px; }
h1 { font-family: var(--anton); font-weight: 400; text-transform: uppercase; font-size: clamp(40px, 9vw, 64px); line-height: .95; margin: 0; }
h1 em { font-style: normal; color: var(--accent); }
.lede { font-family: var(--serif); font-size: 18px; line-height: 1.55; color: var(--cream-2); margin: 0; }
.label { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.field { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: var(--ink-soft); }
.field-head, .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.field p { margin: 8px 0 2px; }
.t { font-size: 22px; font-weight: 800; line-height: 1.2; }
.s { font-family: var(--serif); font-size: 17px; line-height: 1.45; color: var(--cream-2); }
button.copy { font-family: var(--mono); font-size: 13px; font-weight: 500; min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--mint); background: transparent; color: var(--mint); cursor: pointer; }
button.copy.big { background: var(--mint); color: var(--on); min-height: 48px; padding: 0 22px; font-size: 14px; }
button.copy.done { background: var(--cream); border-color: var(--cream); color: var(--on); }
button.copy:focus-visible { outline: 2px solid var(--cream); outline-offset: 2px; }
.note { font-family: var(--serif); font-size: 16px; color: var(--muted); margin: 0; line-height: 1.5; }
.paper { background: var(--cream); color: var(--ink); border-radius: 14px; padding-block: 28px; padding-inline: clamp(18px, 5vw, 40px); font-family: var(--serif); font-size: 18px; line-height: 1.6; min-width: 0; overflow-wrap: anywhere; }
.paper p { margin: 0 0 1em; }
.paper h2 { font-family: var(--sans); font-size: 17px; font-weight: 800; letter-spacing: .06em; margin: 1.8em 0 .7em; }
.paper h3 { font-family: var(--sans); font-size: 15px; font-weight: 700; letter-spacing: .06em; margin: 1.4em 0 .5em; }
.paper img { display: block; width: 100%; height: auto; border-radius: 4px; }
.paper a { color: var(--link); }
.paper blockquote { margin: 1.4em 0; padding-left: 16px; border-left: 3px solid var(--ink); font-style: italic; }
.paper ul, .paper ol { padding-left: 1.3em; }
.paper li { margin-bottom: .35em; }
"""

SUB_JS = r"""
(function () {
  function plainOf(node) {
    return Array.prototype.map.call(node.children, function (el) {
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        return Array.prototype.map.call(el.children, function (li, n) {
          var a = li.querySelector('a');
          return (el.tagName === 'OL' ? (n + 1) + '. ' : '- ') + li.textContent.trim() + (a ? ' (' + a.href + ')' : '');
        }).join('\n');
      }
      return el.textContent.trim();
    }).filter(Boolean).join('\n\n');
  }
  function mark(btn, text) { var was = btn.dataset.label || btn.textContent; btn.dataset.label = was; btn.textContent = text; btn.classList.add('done'); setTimeout(function () { btn.textContent = was; btn.classList.remove('done'); }, 2200); }
  function selectNode(n) { var r = document.createRange(); r.selectNodeContents(n); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.querySelectorAll('button.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.dataset.copy);
      var rich = btn.dataset.rich === '1';
      var job;
      try {
        job = rich && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write
          ? navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([src.innerHTML], { type: 'text/html' }), 'text/plain': new Blob([plainOf(src)], { type: 'text/plain' }) })])
          : navigator.clipboard.writeText(src.textContent.trim());
      } catch (e) { job = Promise.reject(e); }
      job.then(function () { mark(btn, 'Copied'); }, function () { selectNode(src); mark(btn, 'Selected: press copy'); });
    });
  });
})();
"""


def render_substack(facts, r):
    hs = brand.house()
    ch = brand.channel(hs, facts['subchannel'])
    sources = ''.join(f'<li><a href="{attr(u)}">{esc(t)}</a></li>' for t, u in r['sources'])
    call = ''
    if r['call']:
        call = f'<h2>{inline(r["call"]["heading"])}</h2>\n' + '\n'.join(
            f'<p>{inline(v)}</p>' if k == 'p' else f'<{k}>' + ''.join(f'<li>{inline(x)}</li>' for x in v) + f'</{k}>'
            if k in ('ul', 'ol') else f'<{k}>{inline(v)}</{k}>' if k in ('h2', 'h3') else f'<blockquote><p>{inline(v)}</p></blockquote>'
            for k, v in r['call']['blocks'])
    post = '\n'.join(filter(None, [
        r['sub_body'], call,
        f'<h2>SOURCES</h2>\n<ol>{sources}</ol>' if sources else '',
        f'<p><em>{esc(facts.get("endnote", ENDNOTE))}</em></p>',
    ]))
    title = facts.get('substack_title') or facts['headline']
    subtitle = facts.get('substack_subtitle') or facts['deck']
    fonts = brand.font_css(extra=[brand.SERIF_FILE])
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}: Substack copy</title>
<style>{fonts}</style>
<style>{SUB_CSS.replace('ACCENT', ch['accent'])}</style>
</head>
<body>
<main class="wrap">
  <header style="display:flex;flex-direction:column;gap:12px">
    <span class="label">{esc(ch['name'])} · {esc(ch['day'])} · for Substack</span>
    <h1>Ready to <em>paste</em></h1>
    <p class="lede">One column, so Substack can take it. The images are part of the copy, in place, so they paste with the words.</p>
  </header>
  <div class="field"><div class="field-head"><span class="label">Title</span><button class="copy" type="button" data-copy="t">Copy</button></div><p class="t" id="t">{esc(title)}</p></div>
  <div class="field"><div class="field-head"><span class="label">Subtitle</span><button class="copy" type="button" data-copy="s">Copy</button></div><p class="s" id="s">{esc(subtitle)}</p></div>
  <div class="bar"><span class="label">The post</span><button class="copy big" type="button" data-copy="post" data-rich="1">Copy post</button></div>
  <p class="note">Paste it into the post body on a computer. A phone may paste plain words only.</p>
  <article class="paper" id="post">
{post}
  </article>
</main>
<script>{SUB_JS}</script>
</body>
</html>
"""


# ---------------------------------------------------------------- browser steps

def clipboard_check(sub_path, body):
    """Press Copy post the way a person would, read the clipboard back, and
    count what came across. True when everything did."""
    with brand.playwright() as p:
        b = brand.browser(p)
        ctx = b.new_context(permissions=['clipboard-read', 'clipboard-write'])
        pg = ctx.new_page()
        pg.goto(Path(sub_path).resolve().as_uri())
        pg.click('button[data-copy="post"]')
        pg.wait_for_timeout(600)
        res = pg.evaluate("""async () => {
          const count = (root) => {
            const imgs = [...root.querySelectorAll('img')];
            return { images: imgs.length, inline: imgs.filter(i => (i.getAttribute('src') || '').startsWith('data:image/')).length,
                     h2: root.querySelectorAll('h2').length, h3: root.querySelectorAll('h3').length,
                     links: root.querySelectorAll('a[href]').length, paragraphs: root.querySelectorAll('p').length };
          };
          const items = await navigator.clipboard.read();
          const html = await (await items[0].getType('text/html')).text();
          const ed = document.createElement('div'); ed.innerHTML = html;
          return { button: document.querySelector('button[data-copy="post"]').textContent, types: items[0].types,
                   source: count(document.getElementById('post')), copy: count(ed), html,
                   layout: ed.querySelectorAll('[style], [class], div, table, figure').length };
        }""")
        b.close()
    src, cp = res['source'], res['copy']
    missing = missing_sentences(body, res['html'])
    rows = [
        ('images', cp['images'], src['images'], f'{cp["inline"]} inline'),
        ('h2 headings', cp['h2'], src['h2'], ''),
        ('h3 headings', cp['h3'], src['h3'], ''),
        ('links', cp['links'], src['links'], ''),
        ('paragraphs', cp['paragraphs'], src['paragraphs'], ''),
    ]
    print(f'clipboard check: {sub_path}')
    print(f'  button said "{res["button"]}"; clipboard holds {", ".join(res["types"])} ({len(res["html"]) / 1e6:.1f} MB of HTML)')
    ok = res['button'] == 'Copied' and cp['inline'] == src['images']
    for name, got, want, extra in rows:
        ok &= got == want
        print(f'  {name:<12} {got} of {want} copied' + (f' ({extra})' if extra else '') + ('' if got == want else '  <-- lost in the copy'))
    print(f'  layout boxes (div, table, figure, class or style) in the copy: {res["layout"]}')
    ok &= res['layout'] == 0
    if missing:
        ok = False
        print(f'  {len(missing)} sentence(s) of the body did not survive the copy:')
        for s in missing:
            print('    -', s[:120])
    else:
        print('  every sentence of the body is in the copy')
    print('  result:', 'it will paste whole' if ok else 'something did not copy; do not paste this yet')
    return ok


def shots(out):
    """Full-page screenshots at a computer's width and a phone's."""
    folder = Path(out) / 'shots'
    folder.mkdir(parents=True, exist_ok=True)
    with brand.playwright() as p:
        b = brand.browser(p)
        for name in ('page', 'substack'):
            for w in (1440, 390):
                pg = b.new_page(viewport={'width': w, 'height': 900})
                pg.goto((Path(out) / f'{name}.html').resolve().as_uri())
                pg.evaluate('document.fonts.ready.then(() => true)')
                pg.wait_for_timeout(300)
                sw = pg.evaluate('document.documentElement.scrollWidth')
                path = folder / f'{name}-{w}.png'
                pg.screenshot(path=str(path), full_page=True)
                print(f'  {path}' + (f'  <-- wider than the screen ({sw}px): something overflows' if sw > w else ''))
                pg.close()
        b.close()


# ---------------------------------------------------------------- the covers and thumbnails: the Receipt

# The Receipt is the floor for every cover and thumbnail drawn from 2 November
# 2026 on, whatever the post's own date (Ruling, Krish, 2026-11-02: "make this the
# floor level standard moving forward, inviolable"): receipt.py draws every shape,
# with a real proof, the wordmark and the real logos, never his face. The older
# look with a face, and the drawer that made it, were removed on 15 Nov 2026, when
# nothing could reach them any more; files already shipped stay as they are.


def draw_covers(facts, base, out, refresh=False):
    """--cover: the 3:2 cover (cover.png) and a cover for every other place the
    post is shown (receipt.COVER_FILES), each in the Receipt with its receipt
    json. True when every one was written. `refresh` is kept for the callers;
    the Receipt fetches what it needs itself."""
    import receipt
    return receipt.draw_covers(facts, base, out, thumb_facts)


# ---------------------------------------------------------------- a thumbnail for every video size

# Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
# produced as an asset every time." --thumbs draws one for each shape a video
# is made in, from the same cover facts: thumb-wide-1280x720.jpg for the 16:9
# long cut (YouTube and the Substack video post) and thumb-tall-1080x1920.jpg
# for the 9:16 short cut (the cover on Reels and TikTok), both in the Receipt
# (receipt.py; house rule THE_RECEIPT), with their receipt thumbs.json.
#
# The facts may hold "thumbs" beside "cover": the same fields, each falling
# back to the cover's, plus "strip": [{"logo", "name"}], more real logos drawn
# small in a line, so a thumbnail can carry every company the piece names (the
# visual gate holds each thumbnail to that, as it holds a video).
LOGO_REGISTRY = Path(__file__).resolve().parents[2] / 'config' / 'logo-registry.json'


def companies_of(rows, registry=LOGO_REGISTRY):
    """One name per company the drawn rows and strip show, as the visual gate
    and a post.json "logos" list want them: a row may name two ("Warner Music
    Group and BMG"). Each company is named as config/logo-registry.json names
    it first; a row the registry does not know is kept as it is."""
    try:
        reg = json.loads(Path(registry).read_text(encoding='utf-8')).get('companies') or []
    except (OSError, ValueError):
        reg = []
    out = []
    for row in rows:
        found = [c['names'][0] for c in reg if c.get('names') and any(
            re.search(r'(?<!\w)' + re.escape(n) + r'(?!\w)', str(row), re.I) for n in c['names'])]
        for name in found or [str(row)]:
            if name and name not in out:
                out.append(name)
    return out


def thumb_facts(facts):
    """The facts a thumbnail is drawn from: "thumbs" over "cover", field by field."""
    c = dict(facts.get('cover') or {})
    t = facts.get('thumbs') or {}
    if not isinstance(t, dict):
        brand.fail('"thumbs" is an object: the same fields as "cover", each falling back to the cover\'s, and "strip"')
    c.update(t)
    if not c.get('headline'):
        c['headline'] = facts.get('headline')
    return c


def draw_options(facts, base, out, a):
    """--thumbs --options N: two or three thumbnail options, the grid mock and their record (thumb_options.py), in
    place of the one set. True when the set was written."""
    import os
    import thumb_options
    by = os.environ.get('MAKING_BY', '').strip() or ('Codex' if any(k.startswith('CODEX') for k in os.environ) else 'Claude Code')
    return thumb_options.draw(facts, base, out, thumb_facts, companies_of, a.options, a.brief, a.past, by=by)


def draw_thumbs(facts, base, out, refresh=False):
    """thumb-wide-1280x720.jpg and thumb-tall-1080x1920.jpg in the Receipt, under
    2 MB, with their receipt thumbs.json. Both or neither. True when the set was
    written. `refresh` is kept for the callers; the Receipt fetches what it
    needs itself."""
    import receipt
    return receipt.draw_thumbs(facts, base, out, thumb_facts, companies_of)



# Outlook, and many work inboxes, hide every picture in an email from a sender
# the reader has not trusted yet and show its alt text instead (2026-10-06: a
# subscriber's Outlook showed article 1's launch email as captions, with no
# pictures). So the alt text has to carry the picture's point on its own.
ALT_MIN_WORDS = 8


def pictures_off(sub_html, out):
    """The email with pictures hidden, as Outlook first shows it: every image
    becomes its alt text in a dashed box. Written next to substack.html so a
    person can read the post the way a reader who has not trusted the sender
    will."""
    def box(m):
        alt = re.search(r'alt="([^"]*)"', m.group(0))
        text = alt.group(1) if alt and alt.group(1).strip() else '(a picture with no alt text: this reader sees nothing here)'
        return ('<span style="display:block;border:1px dashed #8a8f98;padding:10px 12px;margin:8px 0;'
                f'color:#1a5fb4;font:15px/1.4 Segoe UI,Arial,sans-serif">{text}</span>')
    body = re.sub(r'<img\b[^>]*>', box, sub_html)
    path = Path(out) / 'email-pictures-off.html'
    path.write_text(body, encoding='utf-8')
    print(f'{path}  the email as Outlook first shows it, pictures replaced by their alt text')
    print('  read it before publishing: if a point only lives in a picture, a reader with pictures off misses it')


def phone_images(facts, base, out):
    """Every image in the post as a phone shows it, 358 pixels wide in a
    390-pixel screen, as phone-images.png. Substack keeps these images whole
    and shrinks them; a finished PNG's words cannot be measured, so a person
    has to look. Needs Pillow."""
    path = Path(out) / 'phone-images.png'
    path.unlink(missing_ok=True)
    figures = facts.get('figures') or []
    if not figures:
        return
    try:
        from PIL import Image
    except ImportError:
        print(f'  note: phone-images.png needs Pillow (pip install pillow). Without it, look at every image {card.PHONE_COLUMN} pixels wide before publishing.')
        return
    shown = []
    for f in figures:
        try:
            im = Image.open(resolve(base, f['image'])).convert('RGBA')
        except Exception as e:  # noqa: BLE001
            print(f'  note: could not open {f["image"]} to show it at a phone\'s width ({e}); look at it yourself')
            continue
        w = min(card.PHONE_COLUMN, im.width)
        shown.append(im.resize((w, round(im.height * w / im.width)), Image.LANCZOS))
    if not shown:
        return
    gap = 24
    sheet = Image.new('RGB', (card.PHONE_COLUMN + 32, 32 + sum(im.height for im in shown) + gap * (len(shown) - 1)), 'white')
    y = 16
    for im in shown:
        sheet.paste(im, (16, y), im)
        y += im.height + gap
    sheet.save(path)
    print(f'{path}  every image in the post at a phone\'s width ({card.PHONE_COLUMN} px)')
    print('  look at it before publishing: a word you cannot read there, a reader on a phone cannot read either')


# ---------------------------------------------------------------- main

def page_ready(facts, base, body_override):
    """True when the facts can build the page: a headline, a deck, a date and
    a body. Cover facts (docs/plans/<plan>/cover-facts.json) hold only what
    the artwork needs."""
    if not all(facts.get(k) for k in ('headline', 'deck', 'date')):
        return False
    return (Path(body_override) if body_override else base / facts.get('body', 'body.md')).exists()


# ---------------------------------------------------------------- self-test

def self_test():
    """The rules that need no browser: that every cover and thumbnail is the
    Receipt, the Receipt's own refusals, the facts falling back to the cover's,
    the page (with stand-ins for the fonts and logos) and the page check the
    build runs. Prints the result; 0 when every check passes."""
    import inspect
    import tempfile
    fails, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    # The Receipt is the floor (Ruling, Krish, 2026-11-02: "inviolable"): every shape, a real proof required, no face.
    import receipt
    check('--cover draws every cover as the Receipt', 'receipt.draw_covers(' in inspect.getsource(draw_covers), True)
    check('--thumbs draws both thumbnails as the Receipt', 'receipt.draw_thumbs(' in inspect.getsource(draw_thumbs), True)
    check('the Receipt draws every cover shape and both thumbnails', sorted(receipt.SHAPES), sorted([*receipt.COVER_FILES, *receipt.THUMB_FILES]))
    check('a headline of two parts is kept as given', receipt.words_of({'headline': ['Claude is eating', 'its own jobs']}, {}), ('Claude is eating', 'its own jobs'))
    with tempfile.TemporaryDirectory() as tmp:
        for label, proof in [('no proof', None), ('a proof with no picture', {'tag': 'X'}), ('a missing picture', {'image': 'nope.png', 'tag': 'X'}),
                             ('a proof with no tag', {'image': __file__}), ('a ring outside the picture', {'image': __file__, 'tag': 'X', 'ring': [0, 0, 1.4, 1]}),
                             ('a picture not from a named source', {'image': __file__, 'tag': 'X', 'source': 's9'})]:
            try:
                receipt.proof_of({'proof': proof} if proof else {}, {'sources': {'s1': ['a', 'https://a.example']}}, tmp)
                refused = False
            except SystemExit:
                refused = True
            check(f'the Receipt refuses {label}', refused, True)
    check('a lone short word on a line is refused', receipt.LONE_WORD_MAX >= 2, True)
    check('--cover draws every cover', inspect.getsource(main).count('draw_covers('), 2)

    # The facts: "thumbs" over "cover", field by field, then the page headline.
    check('thumbs.json names each company of a row of two once, as the registry names it',
          companies_of(['Suno', 'Warner Music Group and BMG', 'Sony Music and Universal Music Group', 'Believe', 'A row nobody knows']),
          ['Suno', 'Warner Music Group', 'BMG', 'Sony Music', 'Universal Music Group', 'Believe', 'A row nobody knows'])
    check('a thumbnail falls back to the cover', thumb_facts({'cover': {'headline': ['A', 'B?'], 'rows': [1]}}),
          {'headline': ['A', 'B?'], 'rows': [1]})
    check('"thumbs" changes only what it names', thumb_facts({'cover': {'headline': ['A', 'B?'], 'rows': [1]}, 'thumbs': {'headline': 'Who? Me.', 'strip': [2]}}),
          {'headline': 'Who? Me.', 'rows': [1], 'strip': [2]})
    check('with neither, the page headline', thumb_facts({'headline': 'Who gets paid?'})['headline'], 'Who gets paid?')

    # The page, with stand-ins for the fonts and the wordmark.
    saved = (brand.font_css, brand.brand_uri)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        brand.font_css = lambda extra=(): ''
        brand.brand_uri = lambda name, refresh=False, full=False: 'data:image/png;base64,'
        try:
            # House rule NO_NAME (Krish, 2026-10-28: "Even articles written are not authored by Krish. My face
            # only, for assets and the video format."): the byline is the publication, with no face (Krish
            # picked "Drop it", 29 Oct).
            article = {'subchannel': 'follow.the.money', 'headline': 'Who gets paid?', 'deck': 'Two answers to one agent.', 'date': '2026-10-12'}
            words = 'Warner sued Suno. Now it takes a cut of every song.\n\nHow sure we are: 70%.'
            page = render_page(article, tmp, words, build(article, tmp, words, {}), False)
            byline = re.search(r'<div class="byline">(.*?)</div>', page).group(1)
            check('the byline is the publication, the date and the minutes, with no face',
                  byline, '<span>makeyourmindup · Monday 12 October 2026 · 1 minute read</span>')
            check('the page says "By " nowhere and never names him',
                  ('By ' in page_text(page), [h['match'] for h in copy_lint.copy_lint(page_text(page), 'article_body') if h['id'] == 'no_name']), (False, []))
            check('the page has no long dashes', [ch for ch in page if ch in '\u2013\u2014'], [])
            try:
                refuse_author({'author': 'Krish Raja'}, 'facts.json')
                check('a facts file that names an author is refused', False, True)
            except SystemExit as stop:
                check('a facts file that names an author is refused', 'names no author' in str(stop), True)
        finally:
            brand.font_css, brand.brand_uri = saved

    # The page check every build runs.
    check('markdown blocks', parse_blocks('## A head\n\nOne line\nand more.\n\n- a\n- b\n\n> said'),
          [('h2', 'A head'), ('p', 'One line and more.'), ('ul', ['a', 'b']), ('quote', 'said')])
    body = 'The first sentence is here. The second one follows.\n\nHow sure we are: 70%.'
    check('every sentence on the page passes', missing_sentences(body, '<p>The first sentence is here. The second one follows.</p>'), [])
    check('a lost sentence is named', missing_sentences(body, '<p>The first sentence is here.</p>'), ['The second one follows.'])
    check('cover facts alone are not page facts', page_ready({'subchannel': 'x', 'headline': 'H', 'date': '2026-10-12'}, Path('.'), None), False)

    if fails:
        print('pages self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'pages self-test passed: {count} checks')
    return 0


def main():
    ap = argparse.ArgumentParser(description='A piece as a branded page and a Substack copy, its cover, and a thumbnail for every video size.')
    ap.add_argument('facts', nargs='?', help='the page facts JSON (README.md), or the cover facts for --cover and --thumbs alone')
    ap.add_argument('--out', help='output folder (default: .cache/pages/<working folder name>/ in the repository, which git ignores)')
    ap.add_argument('--body', help='the body markdown, instead of the "body" field')
    ap.add_argument('--assets', help='folder that image paths are relative to (default: the facts file\'s folder)')
    ap.add_argument('--check', action='store_true', help='copy the Substack post and report what survives')
    ap.add_argument('--shots', action='store_true', help='screenshot both files at 1440 and 390 wide')
    ap.add_argument('--cover', action='store_true', help="draw a cover for every place it is shown, in the Receipt: cover-1200x630.png (upload to Substack), cover-1200x675.png, cover-1080x1080.png, cover-1080x1920.png and cover.png at 3:2, each with its receipt")
    ap.add_argument('--thumbs', action='store_true', help='draw thumb-wide-1280x720.jpg and thumb-tall-1080x1920.jpg, a thumbnail for each video '
                    'size, in the Receipt, with their receipt thumbs.json')
    ap.add_argument('--options', type=int, metavar='N', help='with --thumbs: draw 2 or 3 thumbnail options from the facts\' "thumb_options", '
                    'each in its own folder, with a grid mock (scripts/pages/thumb_options.py)')
    ap.add_argument('--brief', metavar='BRIEF.json', help='with --options: the thumbnail brief, written before any option is drawn')
    ap.add_argument('--past', action='append', default=[], metavar='COVER', help='with --options: a past posted cover on this machine, newest first (up to five)')
    ap.add_argument('--refresh-brand', action='store_true', help='fetch the logo images again now')
    ap.add_argument('--self-test', action='store_true', help='check that covers and thumbnails are the Receipt, the facts and the page check, with no browser')
    ap.add_argument('--legacy', action='store_true', help='allow the archived Receipt drawer')
    a = ap.parse_args()
    if a.cover or a.thumbs:
        import skins
        skins.LEGACY = a.legacy
        skins.require_legacy()
    if a.self_test:
        sys.exit(self_test())
    if not a.facts:
        ap.error('give the facts file, or --self-test')

    out = Path(a.out) if a.out else brand.ROOT / '.cache' / 'pages' / Path(a.facts).resolve().parent.name
    raw = json.loads(Path(a.facts).read_text(encoding='utf-8'))
    refuse_author(raw, a.facts)
    base = Path(a.assets) if a.assets else Path(a.facts).resolve().parent
    if a.options is not None and not a.thumbs:
        ap.error('--options draws thumbnail options: give --thumbs too')
    if (a.cover or a.thumbs) and not (a.check or a.shots) and not page_ready(raw, base, a.body):
        # Cover facts: only the artwork.
        for key in ('subchannel',) + (('date',) if a.cover else ()):
            if not raw.get(key):
                brand.fail(f'{a.facts}: "{key}" is required')
        if not raw.get('headline') and not (raw.get('cover') or {}).get('headline'):
            brand.fail(f'{a.facts}: give a "headline", or a "headline" in "cover"')
        out.mkdir(parents=True, exist_ok=True)
        print(f'{a.facts} has no deck or body, so only the artwork is drawn')
        ok = True
        if a.cover:
            ok &= draw_covers(raw, base, out, a.refresh_brand)
        if a.thumbs:
            ok &= draw_thumbs(raw, base, out, a.refresh_brand) if a.options is None else draw_options(raw, base, out, a)
        sys.exit(0 if ok else 1)

    facts, base, body, sources = load_facts(a.facts, a.body, a.assets)
    out.mkdir(parents=True, exist_ok=True)
    r = build(facts, base, body, sources)
    page_html = render_page(facts, base, body, r, a.refresh_brand)
    sub_html = render_substack(facts, r)
    for name, h in (('page.html', page_html), ('substack.html', sub_html)):
        miss = missing_sentences(body, h)
        if miss:
            brand.fail(f'{name} is missing {len(miss)} sentence(s) of the body, so it was not written:\n  - '
                       + '\n  - '.join(miss))
        (out / name).write_text(h, encoding='utf-8')
        print(f'{out / name}  {len(h.encode()) / 1e6:.1f} MB')
    print(f'  every sentence of the body is on both pages; {r["images"]} image(s) placed; '
          f'{r["links"]} link phrase(s) linked to {r["linked"]} source(s); {len(r["sources"])} under Sources')
    if r['unlinked']:
        print(f'  note: listed under Sources but linked from no phrase: {", ".join(r["unlinked"])}')
    if not r['call']:
        print('  note: no prediction section found, so the page has no call band')
    phone_images(facts, base, out)
    pictures_off(sub_html, out)
    if facts.get('cover') and not a.cover:
        print('  note: the page facts describe a cover; add --cover to draw cover.png')
    ok = True
    if a.shots:
        shots(out)
    if a.cover:
        ok &= draw_covers(facts, base, out, a.refresh_brand)
    if a.thumbs:
        ok &= draw_thumbs(facts, base, out, a.refresh_brand) if a.options is None else draw_options(facts, base, out, a)
    if a.check:
        ok &= clipboard_check(out / 'substack.html', body)
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
