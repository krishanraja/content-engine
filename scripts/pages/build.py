#!/usr/bin/env python3
"""pages: a piece's branded web page and its Substack copy, from the text that
passed the fact gate.

    python build.py page.json --out OUTDIR [--check] [--shots] [--cover] [--thumbs]
    python build.py cover-facts.json --out OUTDIR --cover --thumbs   (the artwork alone)
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
          "cover" page facts, and cover-crops.png, what Substack's feed, share
          card and archive each show of it. It refuses if a word or a logo
          would be cut off by any of them, or if a word would be too small to
          read in a phone's feed. It also draws a cover for every other
          place it is shown, each laid out for its own shape, with its
          receipt (.json) and check image (-crops.png): cover-1200x630.png
          for Substack's upload box (upload this one: Substack crops any
          other shape itself), cover-1200x675.png, the 16:9 share card,
          cover-1080x1080.png, the square, and cover-1080x1920.png, the
          vertical cover for Shorts, TikTok and Reels.
--thumbs  draws a thumbnail for every video size from the same facts:
          thumb-wide-1280x720.jpg for the 16:9 long cut (YouTube and the
          Substack video post) and thumb-tall-1080x1920.jpg for the 9:16
          short cut (the cover on Reels and TikTok), with Krish's face and
          the real logos, a receipt thumbs.json and thumbs-check.png. Both or
          neither: it refuses if a word, the face or a logo would sit where a
          platform covers or crops it, or a word would be too small to read.

Facts with no deck or body (docs/plans/<plan>/cover-facts.json) draw only
the artwork that --cover and --thumbs ask for. Paths in the facts are
relative to the facts file (or to --assets). A plan keeps its real logos as
SVG in docs/plans/<plan>/logos/, so any checkout can draw its artwork. A
"background" picture is optional, because git keeps no pictures: on a
machine without it the artwork is drawn on plain ink and the drawer says so.
A logo that is missing always stops the drawer.
"""
import argparse
import base64
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
import title_check  # noqa: E402  the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK)
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

def load_facts(path, body_override, assets):
    facts = json.loads(Path(path).read_text(encoding='utf-8'))
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


def background(c, base):
    """The photo a cover or thumbnail is drawn over, or None. It is optional,
    unlike a logo: git keeps no pictures (every PNG and JPEG is ignored), so
    a plan's background is only on the machine that made it. Elsewhere the
    artwork is drawn on plain ink, the drawer says so, and its receipt
    records that no background was drawn."""
    if not c.get('background'):
        return None
    p = resolve(base, c['background'])
    return p if p.is_file() else None


def no_background_note(c, base):
    if c.get('background') and background(c, base) is None:
        print(f'  note: the background {c["background"]} is not on this machine (git keeps no pictures), so it is drawn on plain ink')


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
.byline img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--ink); }
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
    <div class="byline"><img src="{brand.brand_uri('krish', refresh)}" alt="" width="40" height="40"><span>By {esc(facts.get('author', brand.AUTHOR))} · {long_date(facts['date'])} · {minutes} minute read</span></div>
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


# ---------------------------------------------------------------- what Substack does to the artwork

# Substack shows a post's cover image three ways and fills each by cropping
# (measured on 2026-10-05 from article 1's live post and a screenshot of
# Krish's phone; walk log F64): the feed on a phone at about 3:2, cut evenly
# from both sides; the share card for LinkedIn and others at 16:9 (1200 x 675,
# Substack picks its own middle); and the archive list as the centre square,
# 150 to 450 pixels.
# Article 1's first cover was 1200 x 630, and all three cut the ends off its
# headline, its wordmark and its labels. So the cover is drawn at the feed's
# own 3:2, and every word and logo sits inside COVER_SAFE, which all three keep.
# But Substack's upload box asks for 1.91:1 and crops a 3:2 upload itself, so
# the cover to upload is the 1200 x 630 one, laid out for that shape (below,
# "the cover Substack's upload box asks for"); this 3:2 one is kept beside it.
#
# Krish reads the feed on his phone, where the card is about 358 pixels wide,
# so every word on the cover comes out at 358/1200 of its size there. The
# cover's words are held to card.py's phone floors like any other artwork:
# card.needed(COVER_W) is the size a word, and fine print, must be drawn at,
# the template draws at exactly those sizes, and the cover is refused if a
# word comes out smaller.
COVER_W, COVER_H = 1200, 800
COVER_SAFE = (220, 84, 980, 716)  # left, top, right, bottom
COVER_CROPS = [  # what each shows of the cover: left, top, right, bottom
    ('The feed on a phone: 3:2, so all of it', (0, 0, COVER_W, COVER_H)),
    ('The share card, for LinkedIn and others: 16:9', (0, (COVER_H - COVER_W * 9 / 16) / 2, COVER_W, (COVER_H + COVER_W * 9 / 16) / 2)),
    ('The archive list: the centre square', ((COVER_W - COVER_H) / 2, 0, (COVER_W + COVER_H) / 2, COVER_H)),
]
COVER_HEAD_PX = (104, 100, 96, 92, 88)  # the headline takes the largest of these at which it fits...
COVER_HEAD_LINES = 3                    # ...in this many lines, or the cover is refused

# --head, --words and --fine are set per cover: the headline's size, and the
# phone floors from card.needed().
COVER_CSS = """
* { box-sizing: border-box; margin: 0; }
body { background: var(--deep); }
#card { position: relative; overflow: hidden; background: var(--deep); color: var(--cream); }
#card .ph { position: absolute; inset: 0; background-position: center 30%; background-size: cover; opacity: .3; }
#card .fade { position: absolute; inset: 0; background: radial-gradient(60% 70% at 50% 50%, rgba(var(--shade), .92) 0%, rgba(var(--shade), .8) 55%, rgba(var(--shade), .35) 100%); }
#safe { position: absolute; display: flex; flex-direction: column; align-items: center; text-align: center; }
.wm { height: 48px; }
h1 { margin-top: 22px; font-family: "Anton", Impact, sans-serif; font-weight: 400; text-transform: uppercase; font-size: var(--head); line-height: .94; }
h1 span { display: block; color: var(--accent); }
.sub { margin-top: 18px; font-family: "Archivo", Arial, sans-serif; font-size: var(--words); line-height: 1.1; font-weight: 700; }
.rows { margin-top: 26px; width: 100%; display: flex; flex-direction: column; gap: 12px; }
.row { background: rgba(var(--shade), .9); border: 2px solid #2A3430; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.row img { height: 64px; }
.mono { font-family: "IBM Plex Mono", monospace; }
.tag { font-size: var(--words); line-height: 1; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 8px 14px; color: var(--ink); white-space: nowrap; }
.ft { margin-top: 18px; font-size: var(--fine); line-height: 1.1; color: #AEAEA5; white-space: nowrap; }
.band { margin-top: 24px; width: 100%; display: flex; align-items: center; gap: 30px; text-align: left; }
.face { flex: none; width: 236px; height: 236px; border-radius: 50%; background-size: cover; background-position: center 28%; border: 6px solid var(--accent); box-shadow: 10px 10px 0 rgba(0, 0, 0, .35); }
.side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.band .sub, .band .rows { margin-top: 0; }
"""

# The largest size from the list at which the headline fits in `most` lines,
# and how many lines it takes there.
FIT_HEADLINE_JS = r"""([sizes, most]) => {
  const h = document.querySelector('#safe h1');
  let size = sizes[0], lines = 0;
  for (size of sizes) {
    document.documentElement.style.setProperty('--head', size + 'px');
    lines = Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight));
    if (lines <= most) break;
  }
  return [size, lines];
}"""


def split_headline(text):
    """A headline as (the words in cream, the last line in the subchannel's
    colour): split after its last comma, full stop, colon or question mark.
    With none of those, all of it is in colour."""
    m = re.match(r'^(.*[,.:?])\s+(\S.*)$', text.strip())
    return (m.group(1), m.group(2)) if m else ('', text.strip())


def beside(face, words):
    """The subline and rows, beside Krish's face when the cover has one."""
    return f'<div class="band">{face}<div class="side">{words}</div></div>' if face else words


def cover_html(facts, base, refresh=False):
    """The cover, 1200 x 800: the wordmark, the headline with its last line in
    the subchannel's colour, an optional bold subline, a row per logo with its
    tag, and the subchannel and a label in mono as fine print, over an
    optional photo at 30%. Every word is drawn at least as big as a phone's
    feed needs (card.needed).

    With "portrait", Krish's face sits in a circle under the headline, the
    subline and rows beside it, so the cover reads as him taking the subject
    apart. His words, 2026-10-06: "even one of the funny headshots on the
    cover pictures or social share pictures like this that make it even more
    personal that it's me analysing it". `true` uses the cover site's photo
    (brand.REMOTE['krish']); a path uses that picture instead."""
    hs = brand.house()
    ch = brand.channel(hs, facts['subchannel'])
    t = hs['tokens']
    c = facts.get('cover') or {}
    head = c.get('headline') or facts['headline']
    if not isinstance(head, str) and len(head) != 2:
        brand.fail('"cover": "headline" is one line of text, or two: the words in cream, then the last line in the subchannel\'s colour')
    lead, last = split_headline(head) if isinstance(head, str) else head
    why = title_check.problems(f'{lead} {last}')
    if why:
        brand.fail(f'the cover headline "{lead} {last}" fails the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK): ' + '; '.join(why))
    colours = {'mint': t['mint'], **PALETTE}
    rows = []
    for row in c.get('rows', []):
        colour = colours.get(row.get('colour', 'mint'))
        if not row.get('logo') or not row.get('tag'):
            brand.fail('"cover": each row needs "logo" (one that reads on dark ink) and "tag" (the words beside it)')
        if not colour:
            brand.fail(f'"cover": a row\'s colour is one of {", ".join(colours)}, not {row.get("colour")!r}')
        rows.append(f'<div class="row"><img src="{brand.data_uri(resolve(base, row["logo"]), 600)}" alt="{attr(row.get("name", ""))}">'
                    f'<span class="tag mono" style="background:{colour}">{esc(row["tag"])}</span></div>')
    face = ''
    if c.get('portrait'):
        source = brand.fetch('krish', refresh) if c['portrait'] is True else resolve(base, c['portrait'])
        face = f'<div class="face" role="img" aria-label="{attr(facts.get("author", brand.AUTHOR))}" style="background-image:url({brand.data_uri(source, 600)})"></div>'
    photo = ''
    if background(c, base):
        photo = (f'<div class="ph" style="background-image:url({brand.data_uri(background(c, base), 2000)})"></div>'
                 '<div class="fade"></div>')
    label = c.get('label') or facts.get('issue') or long_date(facts['date'])
    deep = t['ink_deep'].lstrip('#')
    left, top, right, bottom = COVER_SAFE
    words, fine = card.needed(COVER_W)
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="artwork-size" content="{COVER_W}x{COVER_H}">
<style>{brand.font_css()}</style>
<style>:root {{ --ink: {t['ink']}; --deep: {t['ink_deep']}; --cream: {t['cream']}; --accent: {ch['accent']}; --shade: {', '.join(str(int(deep[i:i + 2], 16)) for i in (0, 2, 4))};
  --head: {COVER_HEAD_PX[0]}px; --words: {words}px; --fine: {fine}px; }}
{COVER_CSS}
#card {{ width: {COVER_W}px; height: {COVER_H}px; }}
#safe {{ left: {left}px; top: {top}px; width: {right - left}px; height: {bottom - top}px; }}</style>
</head>
<body>
<div id="card">{photo}<div id="safe">
<img class="wm" src="{brand.brand_uri('wordmark', refresh)}" alt="makeyourmindup">
<h1>{esc(lead) + ' ' if lead else ''}<span>{esc(last)}</span></h1>
{beside(face, (f'<p class="sub">{esc(c["subline"])}</p>' if c.get('subline') else '') + (f'<div class="rows">{"".join(rows)}</div>' if rows else ''))}
<p class="ft mono" data-fine-print>{esc(ch['name'])} · {esc(label)}</p>
</div></div>
</body>
</html>
"""


def cover_crops_html(png):
    """What the feed, the share card and the archive each show of the cover,
    side by side at one height, and the archive tile at its smallest."""
    src = 'data:image/png;base64,' + base64.b64encode(png).decode()
    label = "font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.06em;color:#333;margin:0 0 8px"

    def panel(name, box, height):
        x0, y0, x1, y1 = box
        s = height / (y1 - y0)
        return (f'<div style="width:{(x1 - x0) * s:.1f}px"><p style="{label}">{esc(name)}</p>'
                f'<div style="height:{height}px;background:url({src}) -{x0 * s:.1f}px -{y0 * s:.1f}px / '
                f'{COVER_W * s:.1f}px {COVER_H * s:.1f}px no-repeat;outline:1px solid #ccc"></div></div>')
    panels = [panel(name, box, 280) for name, box in COVER_CROPS]
    panels.append(panel('The archive list at its smallest, 150 pixels', COVER_CROPS[2][1], 150))
    return (f'<meta charset="utf-8"><style>{brand.font_css()}\n*{{box-sizing:border-box;margin:0}}</style>'
            '<body style="margin:0;background:#fff"><div id="sheet" style="display:inline-flex;gap:20px;align-items:flex-end;'
            f'padding:20px;background:#fff">{"".join(panels)}</div></body>')


def draw_cover(facts, base, out, refresh=False):
    """cover.png and cover-crops.png. The headline takes the largest size in
    COVER_HEAD_PX at which it fits in COVER_HEAD_LINES lines, and the label
    line is left out when the cover only fits without it. Refuses, writing
    nothing and removing an older cover.png, when the headline still takes
    more lines, when a word or a logo falls outside the part every crop keeps,
    or when a word comes out too small to read in a phone's feed. True when
    the cover was written."""
    out = Path(out)
    for name in ('cover.png', 'cover-crops.png'):
        (out / name).unlink(missing_ok=True)
    page = cover_html(facts, base, refresh)
    png = crops = None
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': COVER_W, 'height': COVER_H})
        pg.set_content(page)
        card.settle(pg)
        size, lines = pg.evaluate(FIT_HEADLINE_JS, [list(COVER_HEAD_PX), COVER_HEAD_LINES])
        cut = card.outside(card.boxes(pg, '#safe'), COVER_SAFE)
        dropped = False
        if cut and pg.evaluate("() => { const f = document.querySelector('#safe .ft'); if (f) f.remove(); return !!f; }"):
            cut = card.outside(card.boxes(pg, '#safe'), COVER_SAFE)
            dropped = not cut
        words = card.texts(pg, (0, 0, COVER_W, COVER_H))
        small = card.too_small(words, COVER_W)
        ok = lines <= COVER_HEAD_LINES and not cut and not small
        if ok:
            png = pg.screenshot(clip={'x': 0, 'y': 0, 'width': COVER_W, 'height': COVER_H})
            sheet = b.new_page(viewport={'width': 1600, 'height': 600})
            sheet.set_content(cover_crops_html(png))
            card.settle(sheet)
            crops = sheet.locator('#sheet').screenshot()
        b.close()
    left, top, right, bottom = COVER_SAFE
    keep = f'x {left} to {right}, y {top} to {bottom}'
    need_words, need_fine = card.needed(COVER_W)
    feed = f'in a phone\'s feed the cover is about {card.PHONE_COLUMN} px wide'
    if not ok:
        print('cover: not written.')
        if lines > COVER_HEAD_LINES:
            print(f'  the headline takes {lines} lines even at {size} px, and {COVER_HEAD_LINES} fit: shorten the cover\'s "headline"')
        if cut:
            print(f'  Substack would cut these off, because they fall outside {keep}, the part its feed, its share card '
                  'and its archive all keep:')
            for x in cut:
                x0, y0, x1, y1 = x['box']
                print(f'    {card.short(x["what"])}  at x {x0:.0f} to {x1:.0f}, y {y0:.0f} to {y1:.0f}')
            print('  shorten the headline, or take the subline or a row out (the "cover" page facts)')
        if small:
            print(f'  {feed[0].upper() + feed[1:]}, and these words would be too small to read there '
                  f'(words need {card.MIN_READ_PX} px there, fine print {card.MIN_FINE_PX} px):')
            for w in small:
                print(f'    {w["phone"]:4.1f} px on a phone, drawn at {w["px"]:.0f} px; it needs '
                      f'{need_fine if w["fine"] else need_words} px  "{card.short(w["text"])}"')
            print('  draw each at the size it needs, or take those words off the cover')
        return False
    (out / 'cover.png').write_bytes(png)
    (out / 'cover-crops.png').write_bytes(crops)
    # The drawer's receipt: scripts/post-pack/visual_gate.py packs a cover only
    # when this sidecar matches the PNG, so a cover drawn any other way (Krish,
    # 2026-10-10: "really boring and losing its personality") is refused.
    import hashlib
    cv = facts.get('cover') or {}
    (out / 'cover.json').write_text(json.dumps({
        'drawer': 'scripts/pages/build.py --cover', 'sha256': hashlib.sha256(png).hexdigest(),
        'portrait': bool(cv.get('portrait')), 'rows': [r.get('name', '') for r in cv.get('rows', [])],
        'background': background(cv, base) is not None, 'headline_px': size, 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }, indent=1) + '\n', encoding='utf-8')
    print(f'{out / "cover.png"}  {COVER_W} x {COVER_H}, the 3:2 cover. Do not upload it to Substack, whose upload box crops it: upload {COVER_SHAPES["upload"]["file"]}, below')
    print(f'  the headline is {size} px, in {lines} line(s); every word and logo is inside {keep}, so the feed, '
          'the share card and the archive keep all of it')
    if dropped:
        print('  the label line did not fit, so the cover leaves it out')
    no_background_note(cv, base)
    print(f'  {feed}, and every word can be read there:')
    for w in sorted(words, key=lambda w: -w['px']):
        print(f'    {card.on_phone(w["px"], COVER_W):4.1f} px  "{card.short(w["text"])}"' + ('  (fine print)' if w['fine'] else ''))
    print(f'{out / "cover-crops.png"}  what each of them shows. Look at it before publishing.')
    return True


# ---------------------------------------------------------------- a cover for every place it is shown

# Krish, 2026-10-12, with a screenshot of Substack's cover upload box: "Once
# again, the Substack cover image is incorrect. Why is this? Why did this not
# get fixed last time?" The box says "Recommended: 1200 x 630 px (1.91:1).
# Keep important text and logos away from the edges." Given the 3:2 cover,
# Substack ran its own crop (g_auto), which slid down to his face and cut the
# headline in half. Then, the same day: "the cover crops need to be all
# individual images, a vertical cover thumbnail for the shorts/tiktok etc as
# well, every post moving forward".
#
# So every --cover draws, beside the 3:2 cover.png, one cover for each place
# the post's cover is shown, each designed for its own shape from the same
# cover facts (never a crop of another): the wordmark, the headline with its
# last line in the subchannel's colour, Krish's face and a row per real logo.
# Each has its own safe box, which keeps `margin` pixels clear of the edge of
# every crop that place makes (`crops`), its own receipt and a check image.
# Words are held to card.py's phone floors at the image's full width.
#
#   upload    1200 x 630, Substack's cover upload box (1.91:1). Its 16:9 share
#             card (1120 x 630, wherever g_auto slides it) and the phone feed's
#             3:2 (945 x 630 from the middle) both keep the safe box.
#   share     1200 x 675, the 16:9 share card for LinkedIn and link previews.
#             LinkedIn shows 1.91:1 from the middle (y 23 to 652).
#   square    1080 x 1080, for Substack's archive list and the Instagram feed.
#             Instagram's profile grid shows the middle 3:4 (x 135 to 945).
#   vertical  1080 x 1920, the vertical cover for YouTube Shorts, TikTok and
#             Instagram Reels. The apps lay their bars, caption and buttons
#             over the top and bottom, so every word, the face and every logo
#             sit inside x 60 to 1020, y 250 to 1480; profile grids show the
#             middle 3:4 (y 240 to 1680).
COVER_SHAPES = {
    'upload': {
        'w': 1200, 'h': 630, 'file': 'cover-1200x630.png', 'layout': 'side', 'safe': (152, 36, 1048, 594), 'margin': 24,
        'use': "upload THIS one as the cover image in Substack's post settings",
        'crops': [("Substack's upload box and a 1.91:1 share card: all of it", (0, 0, 1200, 630)),
                  ('The share card at 16:9, slid fully left', (0, 0, 1120, 630)),
                  ('The share card at 16:9, slid fully right', (80, 0, 1200, 630)),
                  ('The feed on a phone: 3:2 from the middle', (127.5, 0, 1072.5, 630))],
        'heads': (100, 96, 92, 88, 84, 80, 76), 'lines': 3, 'faces': (300, 280, 260, 240), 'wm': 44, 'logo': 56,
    },
    'share': {
        'w': 1200, 'h': 675, 'file': 'cover-1200x675.png', 'layout': 'side', 'safe': (88, 72, 1112, 603), 'margin': 36,
        'use': 'the 16:9 share card: attach it to LinkedIn posts and anywhere a link preview takes a picture',
        'crops': [('The 16:9 share card: all of it', (0, 0, 1200, 675)),
                  ("LinkedIn's link preview: 1.91:1 from the middle", (0, 675 / 2 - 1200 / 1.91 / 2, 1200, 675 / 2 + 1200 / 1.91 / 2))],
        'heads': (108, 104, 100, 96, 92, 88, 84, 80), 'lines': 3, 'faces': (340, 320, 300, 280, 260), 'wm': 48, 'logo': 60,
    },
    'square': {
        'w': 1080, 'h': 1080, 'file': 'cover-1080x1080.png', 'layout': 'band', 'safe': (167, 72, 913, 1008), 'margin': 32,
        'use': "the square cover: Substack's archive list and the Instagram feed",
        'crops': [('The square, as the Instagram feed and the archive list show it: all of it', (0, 0, 1080, 1080)),
                  ("Instagram's profile grid: 3:4 from the middle", (135, 0, 945, 1080))],
        'heads': (108, 100, 96, 90, 84, 78, 72), 'lines': 3, 'faces': (250, 230, 210, 200), 'wm': 48, 'logo': 52,
        'tag': 48, 'photo': .2,  # a square shows more of the photo, so it is dimmer
    },
    'vertical': {
        'w': 1080, 'h': 1920, 'file': 'cover-1080x1920.png', 'layout': 'stack', 'safe': (96, 286, 984, 1444), 'margin': 36,
        'use': 'the vertical cover: set it as the cover on YouTube Shorts, TikTok and Instagram Reels',
        'crops': [('Where Shorts, TikTok and Reels lay nothing over it', (60, 250, 1020, 1480)),
                  ('A profile grid: 3:4 from the middle', (0, 240, 1080, 1680))],
        'covered': [('the app\'s top bar', (0, 0, 1080, 250)), ('the caption and buttons', (0, 1480, 1080, 1920))],
        'heads': (136, 128, 120, 112, 104, 96, 88), 'lines': 4, 'faces': (420, 380, 340, 300, 280), 'wm': 60, 'logo': 76,
        'tag': 56, 'photo': .16,  # a landscape photo zoomed to fill 9:16 is louder, so it is dimmer
    },
}
COVER_SHAPE_ORDER = ('upload', 'share', 'square', 'vertical')


def cover_receipt(shape):
    """The receipt and check image names beside a shape's PNG."""
    stem = COVER_SHAPES[shape]['file'].rsplit('.', 1)[0]
    return f'{stem}.json', f'{stem}-crops.png'


# --head, --face, --wm, --logo, --words and --fine are set per cover.
COVER_SHAPE_CSS = """
* { box-sizing: border-box; margin: 0; }
body { background: var(--deep); }
#card { position: relative; overflow: hidden; background: var(--deep); color: var(--cream); }
#card .ph { position: absolute; inset: 0; background-position: center 30%; background-size: cover; opacity: var(--photo); }
#card .fade { position: absolute; inset: 0; background: radial-gradient(70% 80% at 50% 50%, rgba(var(--shade), .92) 0%, rgba(var(--shade), .8) 55%, rgba(var(--shade), .4) 100%); }
#safe { position: absolute; display: flex; }
.face { flex: none; width: var(--face); height: var(--face); border-radius: 50%; background-size: cover; background-position: center 28%; border: 6px solid var(--accent); box-shadow: 10px 10px 0 rgba(0, 0, 0, .35); }
.wm { height: var(--wm); }
h1 { margin-top: 16px; font-family: "Anton", Impact, sans-serif; font-weight: 400; text-transform: uppercase; font-size: var(--head); line-height: .94; text-wrap: balance; }
h1 span { display: block; color: var(--accent); }
.sub { margin-top: 14px; font-family: "Archivo", Arial, sans-serif; font-size: var(--words); line-height: 1.1; font-weight: 700; }
.rows { margin-top: 20px; width: 100%; display: flex; flex-direction: column; gap: 10px; }
.row { background: rgba(var(--shade), .9); border: 2px solid #2A3430; padding: 8px 18px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.row img { height: var(--logo); }
.mono { font-family: "IBM Plex Mono", monospace; }
.tag { font-size: var(--tag); line-height: 1; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 7px 13px; color: var(--ink); white-space: nowrap; }
.ft { margin-top: 14px; font-size: var(--fine); line-height: 1.1; color: #AEAEA5; white-space: nowrap; }
.side { align-items: center; gap: 36px; }
.side .col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
.band, .stack { flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.band .pair { margin-top: 28px; width: 100%; display: flex; align-items: center; gap: 28px; }
.band .pair .col { flex: 1; min-width: 0; }
.band .pair .rows { margin-top: 0; }
.stack h1 { margin-top: 22px; }
.stack .face { margin-top: 34px; }
.stack .rows { margin-top: 34px; gap: 14px; }
.stack .row { padding: 10px 22px; }
.stack .ft { margin-top: 22px; }
"""


def cover_shape_html(facts, base, shape, refresh=False):
    """One cover as a page, laid out for its shape from the "cover" facts (as
    the 3:2 one is): "side" puts Krish's face on the left and the wordmark,
    headline and rows on the right; "band" puts the wordmark and headline on
    top and the face beside the rows under them; "stack" puts each under the
    one before. The subchannel and label are fine print under the rest."""
    spec = COVER_SHAPES[shape]
    hs = brand.house()
    ch = brand.channel(hs, facts['subchannel'])
    t = hs['tokens']
    c = facts.get('cover') or {}
    head = c.get('headline') or facts['headline']
    if not isinstance(head, str) and len(head) != 2:
        brand.fail('"cover": "headline" is one line of text, or two: the words in cream, then the last line in the subchannel\'s colour')
    lead, last = split_headline(head) if isinstance(head, str) else head
    why = title_check.problems(f'{lead} {last}')
    if why:
        brand.fail(f'the cover headline "{lead} {last}" fails the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK): ' + '; '.join(why))
    colours = {'mint': t['mint'], **PALETTE}
    rows = []
    for row in c.get('rows', []):
        colour = colours.get(row.get('colour', 'mint'))
        if not row.get('logo') or not row.get('tag'):
            brand.fail('"cover": each row needs "logo" (one that reads on dark ink) and "tag" (the words beside it)')
        if not colour:
            brand.fail(f'"cover": a row\'s colour is one of {", ".join(colours)}, not {row.get("colour")!r}')
        rows.append(f'<div class="row"><img src="{brand.data_uri(resolve(base, row["logo"]), 800)}" alt="{attr(row.get("name", ""))}">'
                    f'<span class="tag mono" style="background:{colour}">{esc(row["tag"])}</span></div>')
    face = ''
    if c.get('portrait'):
        source = brand.fetch('krish', refresh) if c['portrait'] is True else resolve(base, c['portrait'])
        face = f'<div class="face" role="img" aria-label="{attr(facts.get("author", brand.AUTHOR))}" style="background-image:url({brand.data_uri(source, 900)})"></div>'
    photo = ''
    if background(c, base):
        photo = (f'<div class="ph" style="background-image:url({brand.data_uri(background(c, base), 2000)})"></div>'
                 '<div class="fade"></div>')
    label = c.get('label') or facts.get('issue') or long_date(facts['date'])
    wm = f'<img class="wm" src="{brand.brand_uri("wordmark", refresh)}" alt="makeyourmindup">'
    h1 = f'<h1>{esc(lead) + " " if lead else ""}<span>{esc(last)}</span></h1>'
    sub = f'<p class="sub">{esc(c["subline"])}</p>' if c.get('subline') else ''
    rws = f'<div class="rows">{"".join(rows)}</div>' if rows else ''
    ft = f'<p class="ft mono" data-fine-print>{esc(ch["name"])} · {esc(label)}</p>'
    if spec['layout'] == 'side':
        inner = f'{face}<div class="col">{wm}{h1}{sub}{rws}{ft}</div>'
    elif spec['layout'] == 'band':
        pair = f'<div class="pair">{face}<div class="col">{rws}</div></div>' if face and rws else face + rws
        inner = f'{wm}{h1}{sub}{pair}{ft}'
    else:
        inner = f'{wm}{h1}{face}{sub}{rws}{ft}'
    deep = t['ink_deep'].lstrip('#')
    w, h = spec['w'], spec['h']
    left, top, right, bottom = spec['safe']
    words, fine = card.needed(w)
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="artwork-size" content="{w}x{h}">
<style>{brand.font_css()}</style>
<style>:root {{ --ink: {t['ink']}; --deep: {t['ink_deep']}; --cream: {t['cream']}; --accent: {ch['accent']}; --shade: {', '.join(str(int(deep[i:i + 2], 16)) for i in (0, 2, 4))};
  --head: {spec['heads'][0]}px; --face: {spec['faces'][0]}px; --wm: {spec['wm']}px; --logo: {spec['logo']}px; --words: {words}px; --fine: {fine}px;
  --tag: {max(words, spec.get('tag') or 0)}px; --photo: {spec.get('photo', .3)}; }}
{COVER_SHAPE_CSS}
#card {{ width: {w}px; height: {h}px; }}
#safe {{ left: {left}px; top: {top}px; width: {right - left}px; height: {bottom - top}px; }}</style>
</head>
<body>
<div id="card" class="cover-{shape}">{photo}<div id="safe" class="{spec['layout']}">{inner}</div></div>
</body>
</html>
"""


# A row is cramped when its tag comes nearer its logo than this, even if both fit.
COVER_ROW_GAP = 32
COVER_ROW_ROOM_JS = r"""(gap) => [...document.querySelectorAll('#safe .row')].filter(r => {
  const i = r.querySelector('img'), t = r.querySelector('.tag');
  return i && t && t.getBoundingClientRect().left - i.getBoundingClientRect().right < gap;
}).map(r => r.querySelector('img')?.alt || 'a row')"""


def fit_cover_shape(pg, shape):
    """The largest headline, then the largest face, at which every word, the
    face and every logo sit inside the shape's safe box, the headline takes
    at most its lines and every row holds its logo and tag. At each size it
    tries with the label line first, then without it, so the label never
    costs the headline or the face a size. Returns what it settled on."""
    spec = COVER_SHAPES[shape]
    faces = spec['faces'] if pg.locator('#safe .face').count() else spec['faces'][:1]
    tried = None
    for head in spec['heads']:
        for face in faces:
            for label in (True, False):
                pg.evaluate("([h, f, l]) => { const s = document.documentElement.style; s.setProperty('--head', h + 'px'); s.setProperty('--face', f + 'px');"
                            " const ft = document.querySelector('#safe .ft'); if (ft) ft.style.display = l ? '' : 'none'; }", [head, face, label])
                lines, spill = pg.evaluate(THUMB_MEASURE_JS)
                spill = spill + [x for x in pg.evaluate(COVER_ROW_ROOM_JS, COVER_ROW_GAP) if x not in spill]
                cut = card.outside(card.boxes(pg, '#safe'), spec['safe'])
                tried = {'head': head, 'face': face, 'label': label, 'lines': lines, 'cut': cut, 'spill': spill}
                if lines <= spec['lines'] and not cut and not spill:
                    return dict(tried, ok=True)
    return dict(tried, ok=False)


def cover_shape_check_html(png, shape):
    """What a person checks: the whole image with its safe box dashed (and,
    on the vertical one, what the apps lay over it shaded), each crop the
    places it goes make, and the image as small as it is shown."""
    spec = COVER_SHAPES[shape]
    W, H = spec['w'], spec['h']
    src = 'data:image/png;base64,' + base64.b64encode(png).decode()
    label = "font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.04em;color:#333;margin:0 0 8px;max-width:420px"

    def panel(name, box, height, marks=False):
        x0, y0, x1, y1 = box
        s = height / (y1 - y0)
        over = ''
        if marks:
            for _, (l, t, r, b) in spec.get('covered', []):
                over += (f'<span style="position:absolute;left:{(l - x0) * s:.1f}px;top:{(t - y0) * s:.1f}px;width:{(r - l) * s:.1f}px;'
                         f'height:{(b - t) * s:.1f}px;background:rgba(255,106,77,.35)"></span>')
            l, t, r, b = spec['safe']
            over += (f'<span style="position:absolute;left:{(l - x0) * s:.1f}px;top:{(t - y0) * s:.1f}px;width:{(r - l) * s:.1f}px;'
                     f'height:{(b - t) * s:.1f}px;outline:2px dashed #FF6A4D"></span>')
        return (f'<div><p style="{label}">{esc(name)}</p>'
                f'<div style="position:relative;width:{(x1 - x0) * s:.1f}px;height:{height}px;background:url({src}) -{x0 * s:.1f}px -{y0 * s:.1f}px / '
                f'{W * s:.1f}px {H * s:.1f}px no-repeat;outline:1px solid #ccc">{over}</div></div>')
    big = 640 if H > W else 360 if H == W else 300
    whole = 'The whole image; the dashed box is what every crop keeps' + ('; shaded, what the apps lay over it' if spec.get('covered') else '')
    panels = [panel(whole, (0, 0, W, H), big, marks=True)]
    panels += [panel(name, box, big) for name, box in spec['crops'] if box != (0, 0, W, H)]
    if shape == 'upload':
        panels.append(panel("The archive list's centre square at 150 px (the square cover is drawn for it)", ((W - H) / 2, 0, (W + H) / 2, H), 150))
    elif shape == 'square':
        panels.append(panel("The archive list at its smallest, 150 px", (0, 0, W, H), 150))
        panels.append(panel('In an Instagram profile grid, 120 px wide', spec['crops'][1][1], 160))
    elif shape == 'vertical':
        panels.append(panel('In a profile grid, 120 px wide', spec['crops'][1][1], 160))
    else:
        panels.append(panel(f'At a phone\'s width, {card.PHONE_COLUMN} px', (0, 0, W, H), round(card.PHONE_COLUMN * H / W)))
    return (f'<meta charset="utf-8"><style>{brand.font_css()}\n*{{box-sizing:border-box;margin:0}}</style>'
            '<body style="margin:0;background:#fff"><div id="sheet" style="display:inline-flex;flex-wrap:wrap;max-width:1700px;gap:24px;align-items:flex-end;'
            f'padding:20px;background:#fff">{"".join(panels)}</div></body>')


def draw_cover_shape(facts, base, out, shape, refresh=False):
    """One shape's cover, its receipt and its check image. Refuses, writing
    nothing and removing an older set, when no headline size and face size
    fit everything inside its safe box, or a word would be too small to read
    on a phone. True when it was written."""
    spec = COVER_SHAPES[shape]
    W, H, name = spec['w'], spec['h'], spec['file']
    receipt, check = cover_receipt(shape)
    out = Path(out)
    for n in (name, receipt, check):
        (out / n).unlink(missing_ok=True)
    page = cover_shape_html(facts, base, shape, refresh)
    png = crops = None
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(page)
        card.settle(pg)
        fit = fit_cover_shape(pg, shape)
        words = card.texts(pg, (0, 0, W, H))
        small = card.too_small(words, W)
        ok = fit['ok'] and not small
        if ok:
            png = pg.screenshot(clip={'x': 0, 'y': 0, 'width': W, 'height': H})
            sheet = b.new_page(viewport={'width': 1800, 'height': 900})
            sheet.set_content(cover_shape_check_html(png, shape))
            card.settle(sheet)
            crops = sheet.locator('#sheet').screenshot()
        b.close()
    left, top, right, bottom = spec['safe']
    keep = f'x {left} to {right}, y {top} to {bottom}'
    need_words, need_fine = card.needed(W)
    if not ok:
        print(f'{name}: not written.')
        if fit['lines'] > spec['lines']:
            print(f'  the headline takes {fit["lines"]} lines even at {fit["head"]} px, and {spec["lines"]} fit: shorten the cover\'s "headline"')
        if fit['cut']:
            print(f'  these fall outside {keep}, the part every place it is shown keeps:')
            for x in fit['cut']:
                x0, y0, x1, y1 = x['box']
                print(f'    {card.short(x["what"])}  at x {x0:.0f} to {x1:.0f}, y {y0:.0f} to {y1:.0f}')
            print('  shorten the headline or a tag, or take the subline or a row out (the "cover" facts)')
        for what in fit['spill']:
            print(f'  the row "{what}" cannot hold its logo and tag with {COVER_ROW_GAP} px between them: shorten the tag')
        for w in small:
            print(f'  too small to read on a phone: {w["phone"]:4.1f} px, drawn at {w["px"]:.0f} px; it needs '
                  f'{need_fine if w["fine"] else need_words} px  "{card.short(w["text"])}"')
        return False
    import hashlib
    cv = facts.get('cover') or {}
    (out / name).write_bytes(png)
    (out / check).write_bytes(crops)
    # The drawer's receipt, as cover.json is the 3:2 cover's:
    # scripts/post-pack/visual_gate.py packs the cover only when this matches it.
    (out / receipt).write_text(json.dumps({
        'drawer': 'scripts/pages/build.py --cover', 'shape': shape, 'file': name, 'width': W, 'height': H,
        'sha256': hashlib.sha256(png).hexdigest(), 'portrait': bool(cv.get('portrait')), 'rows': [r.get('name', '') for r in cv.get('rows', [])],
        'background': background(cv, base) is not None, 'headline_px': fit['head'], 'face_px': fit['face'] if cv.get('portrait') else 0,
        'label': fit['label'], 'safe': list(spec['safe']), 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }, indent=1) + '\n', encoding='utf-8')
    print(f'{out / name}  {W} x {H}: {spec["use"]}')
    print(f'  the headline is {fit["head"]} px, in {fit["lines"]} line(s)' + (f'; the face is {fit["face"]} px' if cv.get('portrait') else '; no face: add "portrait": true')
          + f'; every word and logo is inside {keep}' + ('' if fit['label'] else '; the label line did not fit, so it is left out'))
    print('  on a phone: ' + ', '.join(f'"{card.short(w["text"], 30)}" {card.on_phone(w["px"], W):.1f} px'
                                      for w in sorted(words, key=lambda w: -w['px']) if w['text'].strip()))
    print(f'{out / check}  what each place shows of it. Look at it before publishing.')
    return True


def draw_covers(facts, base, out, refresh=False):
    """--cover: the 3:2 cover (cover.png) and a cover for every other place
    the post is shown (COVER_SHAPES). True when every one was written."""
    done = [draw_cover(facts, base, out, refresh)]
    for shape in COVER_SHAPE_ORDER:
        done.append(draw_cover_shape(facts, base, out, shape, refresh))
    if not all(done):
        print('covers: not every shape was drawn. Every post needs all of them, so fix the facts and draw them again.')
    return all(done)


# ---------------------------------------------------------------- a thumbnail for every video size

# Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
# produced as an asset every time." --thumbs draws one for each shape a video
# is made in, from the same cover facts the 3:2 cover reads and in the same
# look: the wordmark, the headline with its last line in the subchannel's
# colour, Krish's face and a row per real logo (house rule LOGOS_AND_FACE).
#
#   wide  1280 x 720, for the 16:9 long cut: the size YouTube asks for in a
#         custom thumbnail, and the Substack video post's. YouTube lays the
#         video's length over the bottom-right corner (THUMBS['wide']
#         ['clear']), so nothing is drawn there.
#   tall  1080 x 1920, for the 9:16 short cut: the cover for Reels and
#         TikTok. Their profile grids show only the middle 1080 x 1440 (3:4),
#         so every word, face and logo sits inside it.
#
# Every word is held to card.py's phone floors at a phone's full width, as the
# cover's are. The headline must also read where the thumbnail is shown
# smallest: YouTube's Up next list on a computer, about 168 pixels wide, and a
# profile grid on a phone, three across, about 120 pixels wide.
#
# The facts may hold "thumbs" beside "cover": the same fields ("headline",
# "rows", "portrait", "background"), each falling back to the cover's, plus
# "strip": [{"logo", "name"}], more real logos drawn small in a line under the
# rows, so a thumbnail can carry every company the piece names (the visual
# gate holds each thumbnail to that, as it holds a video).
THUMB_RECEIPT = 'thumbs.json'
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
THUMBS = {
    'wide': {
        'file': 'thumb-wide-1280x720.jpg', 'w': 1280, 'h': 720,
        'safe': (56, 40, 1224, 680),  # left, top, right, bottom
        # YouTube's video length badge keeps its own size however small the
        # thumbnail is shown, so it covers most where the thumbnail is
        # smallest: about 36 x 18 pixels, 4 in from the corner, on a 168-wide
        # Up next thumbnail, which is this much of a 1280 x 720 one.
        'clear': [("YouTube's video length, bottom right", (968, 548, 1280, 720))],
        'small': (168, "YouTube's Up next list on a computer"),
        'heads': (140, 132, 124, 116, 108), 'lines': 3,
        'faces': (320, 290, 260, 230),
        'band': 968 - 56 - 16,  # the face and rows stop short of the video length
        'wm': 46, 'logo': 56, 'strip': 34, 'ring': 6, 'tag': None,
    },
    'tall': {
        'file': 'thumb-tall-1080x1920.jpg', 'w': 1080, 'h': 1920,
        'safe': (72, 260, 1008, 1660),  # inside the middle 1080 x 1440 (y 240 to 1680)
        'clear': [],
        'small': (120, 'a profile grid on a phone, three across'),
        'heads': (200, 184, 168, 156, 144, 132), 'lines': 4,
        'faces': (440, 400, 360, 320),  # never under 320: in a grid the face is what is seen first
        'band': None,
        'wm': 64, 'logo': 76, 'strip': 52, 'ring': 8, 'tag': 56,
    },
}
THUMB_SHAPES = ('wide', 'tall')
THUMB_MAX_BYTES = 2 * 1024 * 1024  # YouTube refuses a custom thumbnail over 2 MB
THUMB_QUALITY = (92, 88, 84, 80)   # JPEG quality, highest first, until the file is under the limit

THUMB_CSS = """
* { box-sizing: border-box; margin: 0; }
body { background: var(--deep); }
#card { position: relative; overflow: hidden; background: var(--deep); color: var(--cream); }
#card .ph { position: absolute; inset: 0; background-position: center 30%; background-size: cover; opacity: .3; }
#card .fade { position: absolute; inset: 0; background: radial-gradient(70% 70% at 50% 50%, rgba(var(--shade), .92) 0%, rgba(var(--shade), .8) 55%, rgba(var(--shade), .4) 100%); }
#safe { position: absolute; display: flex; flex-direction: column; }
.top { display: flex; align-items: center; gap: 22px; }
.wm { height: var(--wm); }
.mono { font-family: "IBM Plex Mono", monospace; }
.pill { font-size: var(--fine); line-height: 1; font-weight: 700; letter-spacing: .04em; padding: 8px 14px; background: var(--accent); color: var(--ink); white-space: nowrap; }
h1 { font-family: "Anton", Impact, sans-serif; font-weight: 400; text-transform: uppercase; font-size: var(--head); line-height: .94; text-wrap: balance; }
h1 span { display: block; color: var(--accent); }
.face { flex: none; width: var(--face); height: var(--face); border-radius: 50%; background-size: cover; background-position: center 28%; border: var(--ring) solid var(--accent); box-shadow: 10px 10px 0 rgba(0, 0, 0, .35); }
.side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.rows { display: flex; flex-direction: column; gap: 12px; }
.row { background: rgba(var(--shade), .9); border: 2px solid #2A3430; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.row img { height: var(--logo); }
.tag { font-size: var(--tag); line-height: 1; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 8px 14px; color: var(--ink); white-space: nowrap; }
.strip { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 30px; background: rgba(var(--shade), .9); border: 2px solid #2A3430; padding: 10px 18px; }
.strip img { height: var(--strip); }
.wide #safe { align-items: flex-start; text-align: left; }
.wide h1 { margin-top: 18px; }
.wide .band { margin-top: 24px; width: var(--band); display: flex; align-items: center; gap: 28px; }
.wide .side { flex: 1; gap: 12px; }
.wide .rows { gap: 10px; }
.wide .row { padding: 6px 16px; }
.wide .tag { padding: 6px 12px; }
.wide .strip { padding: 6px 14px; gap: 10px 22px; }
.tall #safe { align-items: center; text-align: center; }
.tall .top { flex-direction: column; gap: 18px; }
.tall h1 { margin-top: 30px; }
.tall .face { margin-top: 40px; }
.tall .side { margin-top: 40px; width: 100%; }
.tall .strip { justify-content: center; }
"""

# How many lines the headline takes, and whether every row holds its logo and tag.
THUMB_MEASURE_JS = r"""() => {
  const h = document.querySelector('#safe h1');
  const lines = Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight));
  const spill = [...document.querySelectorAll('#safe .row')].filter(r => r.scrollWidth > r.clientWidth + 1).map(r => r.querySelector('img')?.alt || 'a row');
  return [lines, spill];
}"""


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


def overlapping(found, zones):
    """The boxes that reach into any zone (name, (left, top, right, bottom)),
    as {'what', 'box', 'zone'}. Half a pixel is allowed for rounding."""
    hit = []
    for name, (l, t, r, b) in zones:
        for x in found:
            x0, y0, x1, y1 = x['box']
            if x1 > l + .5 and x0 < r - .5 and y1 > t + .5 and y0 < b - .5:
                hit.append({'what': x['what'], 'box': x['box'], 'zone': name})
    return hit


def thumb_html(facts, base, shape, refresh=False):
    """One thumbnail as a page: the cover's look, laid out for its shape."""
    spec = THUMBS[shape]
    hs = brand.house()
    ch = brand.channel(hs, facts['subchannel'])
    t = hs['tokens']
    c = thumb_facts(facts)
    head = c.get('headline')
    if not head or (not isinstance(head, str) and len(head) != 2):
        brand.fail('the thumbnail\'s "headline" is one line of text, or two: the words in cream, then the last line in the subchannel\'s colour')
    lead, last = split_headline(head) if isinstance(head, str) else head
    why = title_check.problems(f'{lead} {last}')
    if why:
        brand.fail(f'the cover headline "{lead} {last}" fails the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK): ' + '; '.join(why))
    colours = {'mint': t['mint'], **PALETTE}
    rows = []
    for row in c.get('rows', []):
        colour = colours.get(row.get('colour', 'mint'))
        if not row.get('logo') or not row.get('tag'):
            brand.fail('a thumbnail row needs "logo" (one that reads on dark ink) and "tag" (the words beside it)')
        if not colour:
            brand.fail(f'a row\'s colour is one of {", ".join(colours)}, not {row.get("colour")!r}')
        rows.append(f'<div class="row"><img src="{brand.data_uri(resolve(base, row["logo"]), 800)}" alt="{attr(row.get("name", ""))}">'
                    f'<span class="tag mono" style="background:{colour}">{esc(row["tag"])}</span></div>')
    strip = []
    for item in c.get('strip', []):
        if not isinstance(item, dict) or not item.get('logo') or not item.get('name'):
            brand.fail('each logo in "strip" needs "logo" (one that reads on dark ink) and "name" (the company)')
        strip.append(f'<img src="{brand.data_uri(resolve(base, item["logo"]), 800)}" alt="{attr(item["name"])}">')
    face = ''
    if c.get('portrait'):
        source = brand.fetch('krish', refresh) if c['portrait'] is True else resolve(base, c['portrait'])
        face = f'<div class="face" role="img" aria-label="{attr(facts.get("author", brand.AUTHOR))}" style="background-image:url({brand.data_uri(source, 900)})"></div>'
    photo = ''
    if background(c, base):
        photo = (f'<div class="ph" style="background-image:url({brand.data_uri(background(c, base), 2000)})"></div>'
                 '<div class="fade"></div>')
    side = ((f'<div class="rows">{"".join(rows)}</div>' if rows else '') + (f'<div class="strip">{"".join(strip)}</div>' if strip else ''))
    side = f'<div class="side">{side}</div>' if side else ''
    body = f'<div class="band">{face}{side}</div>' if shape == 'wide' else face + side
    deep = t['ink_deep'].lstrip('#')
    w, h = spec['w'], spec['h']
    left, top, right, bottom = spec['safe']
    words, fine = card.needed(w)
    tag = max(words, spec['tag'] or 0)
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="artwork-size" content="{w}x{h}">
<style>{brand.font_css()}</style>
<style>:root {{ --ink: {t['ink']}; --deep: {t['ink_deep']}; --cream: {t['cream']}; --accent: {ch['accent']}; --shade: {', '.join(str(int(deep[i:i + 2], 16)) for i in (0, 2, 4))};
  --head: {spec['heads'][0]}px; --face: {spec['faces'][0]}px; --words: {words}px; --fine: {fine}px; --tag: {tag}px;
  --wm: {spec['wm']}px; --logo: {spec['logo']}px; --strip: {spec['strip']}px; --ring: {spec['ring']}px; --band: {spec['band'] or 0}px; }}
{THUMB_CSS}
#card {{ width: {w}px; height: {h}px; }}
#safe {{ left: {left}px; top: {top}px; width: {right - left}px; height: {bottom - top}px; }}</style>
</head>
<body>
<div id="card" class="{shape}">{photo}<div id="safe">
<div class="top"><img class="wm" src="{brand.brand_uri('wordmark', refresh)}" alt="makeyourmindup"><span class="pill mono" data-fine-print>{esc(ch['name'])}</span></div>
<h1>{esc(lead) + ' ' if lead else ''}<span>{esc(last)}</span></h1>
{body}
</div></div>
</body>
</html>
"""


def fit_thumb(pg, shape):
    """The largest headline, then the largest face, at which the thumbnail
    fits: the headline in its lines, every word, face and logo inside the safe
    area, nothing in a zone the platform covers, and every row holding its
    logo and tag. Returns what it settled on and, when nothing fits, why."""
    spec = THUMBS[shape]
    faces = spec['faces'] if pg.locator('#safe .face').count() else spec['faces'][:1]
    tried = None
    for head in spec['heads']:
        for face in faces:
            pg.evaluate("([h, f]) => { const s = document.documentElement.style; s.setProperty('--head', h + 'px'); s.setProperty('--face', f + 'px'); }",
                        [head, face])
            lines, spill = pg.evaluate(THUMB_MEASURE_JS)
            found = card.boxes(pg, '#safe')
            cut = card.outside(found, spec['safe'])
            hit = overlapping(found, spec['clear'])
            tried = {'head': head, 'face': face, 'lines': lines, 'cut': cut, 'hit': hit, 'spill': spill}
            if lines <= spec['lines'] and not cut and not hit and not spill:
                return dict(tried, ok=True)
    return dict(tried, ok=False)


def thumbs_check_html(shots):
    """What a person checks: the wide thumbnail at a phone's width and at its
    smallest, with the video length where YouTube puts it, and the tall one
    whole, with the 3:4 the profile grids keep marked, and in a grid tile."""
    label = "font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.04em;color:#333;margin:0 0 8px;max-width:360px"

    def uri(shape):
        return 'data:image/jpeg;base64,' + base64.b64encode(shots[shape]).decode()

    def wide(width):
        # The badge at YouTube's own size, which it keeps at every thumbnail size.
        badge = ('<span style="position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,.8);color:#fff;'
                 'font:600 12px/16px Arial,sans-serif;padding:1px 4px;border-radius:4px">3:04</span>')
        return (f'<div><p style="{label}">The wide thumbnail {width} px wide, with the video length where YouTube puts it</p>'
                f'<div style="position:relative;width:{width}px"><img src="{uri("wide")}" style="display:block;width:{width}px">{badge}</div></div>')

    spec = THUMBS['tall']
    full_h = 420
    k = full_h / spec['h']
    y0, y1 = (spec['h'] - spec['w'] * 4 / 3) / 2 * k, (spec['h'] + spec['w'] * 4 / 3) / 2 * k
    line = 'position:absolute;left:0;right:0;border-top:2px dashed #FF6A4D'
    tall_full = (f'<div><p style="{label}">The tall thumbnail whole; the dashed lines mark the middle 3:4 the grids keep</p>'
                 f'<div style="position:relative;height:{full_h}px;width:{spec["w"] * k:.0f}px"><img src="{uri("tall")}" style="display:block;height:{full_h}px">'
                 f'<span style="{line};top:{y0:.0f}px"></span><span style="{line};top:{y1:.0f}px"></span></div></div>')
    tile_w = THUMBS['tall']['small'][0]
    s = tile_w / spec['w']
    tile = (f'<div><p style="{label}">In a profile grid, {tile_w} px wide</p>'
            f'<div style="width:{tile_w}px;height:{tile_w * 4 / 3:.0f}px;background:url({uri("tall")}) 0 -{(spec["h"] - spec["w"] * 4 / 3) / 2 * s:.1f}px / '
            f'{tile_w}px {spec["h"] * s:.0f}px no-repeat;outline:1px solid #ccc"></div></div>')
    panels = [wide(card.PHONE_COLUMN), wide(THUMBS['wide']['small'][0]), tall_full, tile]
    return (f'<meta charset="utf-8"><style>{brand.font_css()}\n*{{box-sizing:border-box;margin:0}}</style>'
            '<body style="margin:0;background:#fff"><div id="sheet" style="display:inline-flex;gap:24px;align-items:flex-end;'
            f'padding:20px;background:#fff">{"".join(panels)}</div></body>')


def draw_thumbs(facts, base, out, refresh=False):
    """thumb-wide-1280x720.jpg and thumb-tall-1080x1920.jpg, their receipt
    thumbs.json and thumbs-check.png. Writes all of them or none: an older set
    is removed first, and nothing is written when either shape cannot fit
    every word and logo where its platforms show it, or a word would be too
    small to read. True when the set was written."""
    out = Path(out)
    for name in [THUMBS[s]['file'] for s in THUMB_SHAPES] + [THUMB_RECEIPT, 'thumbs-check.png']:
        (out / name).unlink(missing_ok=True)
    c = thumb_facts(facts)
    pages = {shape: thumb_html(facts, base, shape, refresh) for shape in THUMB_SHAPES}
    shots, fits, problems, check = {}, {}, {}, None
    with brand.playwright() as p:
        b = brand.browser(p)
        for shape in THUMB_SHAPES:
            spec = THUMBS[shape]
            pg = b.new_page(viewport={'width': spec['w'], 'height': spec['h']})
            pg.set_content(pages[shape])
            card.settle(pg)
            fit = fit_thumb(pg, shape)
            words = card.texts(pg, (0, 0, spec['w'], spec['h']))
            small = card.too_small(words, spec['w'])
            tiny = fit['head'] * spec['small'][0] / spec['w']
            fits[shape] = dict(fit, words=words, small=small, tiny=tiny)
            if fit['ok'] and not small and round(tiny, 2) >= card.MIN_READ_PX:
                for quality in THUMB_QUALITY:
                    shot = pg.screenshot(type='jpeg', quality=quality, clip={'x': 0, 'y': 0, 'width': spec['w'], 'height': spec['h']})
                    if len(shot) <= THUMB_MAX_BYTES:
                        break
                if len(shot) <= THUMB_MAX_BYTES:
                    shots[shape] = shot
                    fits[shape]['quality'] = quality
                else:
                    problems[shape] = [f'even at JPEG quality {THUMB_QUALITY[-1]} it is {len(shot) / 1e6:.1f} MB, over the 2 MB YouTube takes: '
                                       'use a plainer "background"']
            pg.close()
        if len(shots) == len(THUMB_SHAPES):
            sheet = b.new_page(viewport={'width': 1600, 'height': 700})
            sheet.set_content(thumbs_check_html(shots))
            card.settle(sheet)
            check = sheet.locator('#sheet').screenshot()
        b.close()
    ok = len(shots) == len(THUMB_SHAPES)
    for shape in THUMB_SHAPES:
        spec, fit = THUMBS[shape], fits[shape]
        left, top, right, bottom = spec['safe']
        name = f'{shape} {spec["w"]} x {spec["h"]}'
        if shape in shots:
            continue
        print(f'{name}: not drawn.')
        if fit['lines'] > spec['lines']:
            print(f'  the headline takes {fit["lines"]} lines even at {fit["head"]} px, and {spec["lines"]} fit: '
                  'give "thumbs" a shorter "headline"')
        if fit['cut']:
            print(f'  these fall outside x {left} to {right}, y {top} to {bottom}, the part every place it is shown keeps:')
            for x in fit['cut']:
                x0, y0, x1, y1 = x['box']
                print(f'    {card.short(x["what"])}  at x {x0:.0f} to {x1:.0f}, y {y0:.0f} to {y1:.0f}')
        for x in fit['hit']:
            print(f'  {card.short(x["what"])} reaches into {x["zone"]}')
        for what in fit['spill']:
            print(f'  the row "{what}" cannot hold its logo and tag: shorten the tag')
        if fit['cut'] or fit['hit'] or fit['spill']:
            print('  shorten the headline or a tag, or take a row out (the "thumbs" or "cover" facts)')
        for w in fit['small']:
            print(f'  too small to read on a phone: {w["phone"]:4.1f} px, drawn at {w["px"]:.0f} px  "{card.short(w["text"])}"')
        if round(fit['tiny'], 2) < card.MIN_READ_PX:
            print(f'  the headline comes out at {fit["tiny"]:.1f} px in {spec["small"][1]} ({spec["small"][0]} px wide), '
                  f'under the {card.MIN_READ_PX} px a word needs: shorten it so it can be drawn bigger')
        for line in problems.get(shape, []):
            print(f'  {line}')
    if not ok:
        print('thumbnails: none written. A thumbnail for every video size, every time, so both or neither.')
        return False
    import hashlib
    logos = [r.get('name', '') for r in c.get('rows', [])] + [s.get('name', '') for s in c.get('strip', [])]
    files = []
    for shape in THUMB_SHAPES:
        spec, fit = THUMBS[shape], fits[shape]
        (out / spec['file']).write_bytes(shots[shape])
        files.append({'file': spec['file'], 'shape': shape, 'width': spec['w'], 'height': spec['h'], 'bytes': len(shots[shape]),
                      'sha256': hashlib.sha256(shots[shape]).hexdigest(), 'headline_px': fit['head'],
                      'face_px': fit['face'] if c.get('portrait') else 0, 'jpeg_quality': fit['quality']})
    (out / 'thumbs-check.png').write_bytes(check)
    # The drawer's receipt: scripts/post-pack/visual_gate.py packs a thumbnail
    # only when it matches a file here byte for byte, carries Krish's face,
    # and every logo its post.json entry declares is one drawn here.
    (out / THUMB_RECEIPT).write_text(json.dumps({
        'schema_version': 1, 'drawer': 'scripts/pages/build.py --thumbs', 'subchannel': facts['subchannel'],
        'headline': list(split_headline(c['headline']) if isinstance(c['headline'], str) else c['headline']),
        'portrait': bool(c.get('portrait')), 'logos': [n for n in logos if n], 'companies': companies_of([n for n in logos if n]),
        'background': background(c, base) is not None,
        'files': files, 'drawn_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }, indent=1) + '\n', encoding='utf-8')
    for shape in THUMB_SHAPES:
        spec, fit = THUMBS[shape], fits[shape]
        use = 'for the 16:9 long cut: YouTube and the Substack video post' if shape == 'wide' else \
              'for the 9:16 short cut: the cover on Reels and TikTok'
        print(f'{out / spec["file"]}  {spec["w"]} x {spec["h"]}, {len(shots[shape]) / 1e3:.0f} KB, {use}')
        print(f'  headline {fit["head"]} px in {fit["lines"]} line(s), {fit["tiny"]:.1f} px in {spec["small"][1]}'
              + (f'; face {fit["face"]} px' if c.get('portrait') else '; no face: add "portrait": true (house rule LOGOS_AND_FACE)'))
        left, top, right, bottom = spec['safe']
        print(f'  every word, face and logo is inside x {left} to {right}, y {top} to {bottom}'
              + ''.join(f'; nothing in {name}' for name, _ in spec['clear']))
    no_background_note(c, base)
    print(f'{out / THUMB_RECEIPT}  the receipt: each file\'s sha256, the face and the logos drawn ({", ".join(n for n in logos if n) or "none"})')
    print(f'{out / "thumbs-check.png"}  how they show at a phone\'s width, at their smallest and in a grid. Look at it before publishing.')
    return True


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
    """The rules that need no browser: the thumbnail shapes and their safe
    areas, the YouTube corner, the facts falling back to the cover's, the
    thumbnail page itself (with stand-ins for the fonts and logos), and the
    page check the build runs. Prints the result; 0 when every check passes."""
    import tempfile
    fails, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    # The shapes, and where each platform shows them.
    check('the wide thumbnail is 16:9', THUMBS['wide']['w'] * 9 == THUMBS['wide']['h'] * 16, True)
    check('the tall thumbnail is 9:16', THUMBS['tall']['w'] * 16 == THUMBS['tall']['h'] * 9, True)
    for shape in THUMB_SHAPES:
        spec = THUMBS[shape]
        l, t, r, b = spec['safe']
        check(f'{shape}: the file name says its shape and size', spec['file'], f'thumb-{shape}-{spec["w"]}x{spec["h"]}.jpg')
        check(f'{shape}: the safe area is inside the picture', 0 < l < r < spec['w'] and 0 < t < b < spec['h'], True)
        check(f'{shape}: headline sizes run largest first', list(spec['heads']), sorted(spec['heads'], reverse=True))
        check(f'{shape}: face sizes run largest first', list(spec['faces']), sorted(spec['faces'], reverse=True))
        check(f'{shape}: the smallest headline still reads in {spec["small"][1]}',
              min(spec['heads']) * spec['small'][0] / spec['w'] >= card.MIN_READ_PX, True)
        check(f'{shape}: the tags are drawn at least as big as a phone needs', max(card.needed(spec['w'])[0], spec['tag'] or 0) >= card.needed(spec['w'])[0], True)
    tall, wide = THUMBS['tall'], THUMBS['wide']
    check('tall: everything sits inside the middle 1080 x 1440 the profile grids keep',
          tall['safe'][1] >= (tall['h'] - tall['w'] * 4 / 3) / 2 and tall['safe'][3] <= (tall['h'] + tall['w'] * 4 / 3) / 2, True)
    corner = wide['clear'][0][1]
    check('wide: the video length zone is the bottom-right corner', (corner[2], corner[3]), (wide['w'], wide['h']))
    check('wide: the face and rows stop short of the video length', wide['safe'][0] + wide['band'] <= corner[0], True)
    check('wide: the video length zone reaches into the safe area, so it is checked', corner[0] < wide['safe'][2] and corner[1] < wide['safe'][3], True)
    zx, zy = corner[0], corner[1]
    found = [{'what': 'in the corner', 'box': [1100, 600, 1200, 650]}, {'what': 'top left', 'box': [60, 50, 300, 120]},
             {'what': 'touching its edge', 'box': [600, 590, zx, 676]}, {'what': 'above it', 'box': [1100, 400, 1220, zy]}]
    check('a box in the video length zone is found, one touching its edge is not',
          [x['what'] for x in overlapping(found, wide['clear'])], ['in the corner'])
    check('the cover safe area is inside each crop Substack makes', all(
        COVER_SAFE[0] >= x0 and COVER_SAFE[1] >= y0 and COVER_SAFE[2] <= x1 and COVER_SAFE[3] <= y1 for _, (x0, y0, x1, y1) in COVER_CROPS), True)
    # A cover for every place it is shown, each its own image (Krish, 2026-10-12).
    check('the covers and their sizes', {k: (v['w'], v['h'], v['file']) for k, v in COVER_SHAPES.items()},
          {'upload': (1200, 630, 'cover-1200x630.png'), 'share': (1200, 675, 'cover-1200x675.png'),
           'square': (1080, 1080, 'cover-1080x1080.png'), 'vertical': (1080, 1920, 'cover-1080x1920.png')})
    check('every shape is drawn by --cover', sorted(COVER_SHAPE_ORDER), sorted(COVER_SHAPES))
    check('each has its own receipt and check image', cover_receipt('vertical'), ('cover-1080x1920.json', 'cover-1080x1920-crops.png'))
    check('the upload cover\'s crops: all of it, 16:9 slid either way, and the feed\'s 3:2',
          [round((x1 - x0) / (y1 - y0), 3) for _, (x0, y0, x1, y1) in COVER_SHAPES['upload']['crops']], [round(1200 / 630, 3), round(16 / 9, 3), round(16 / 9, 3), 1.5])
    check('the share card is 16:9', COVER_SHAPES['share']['w'] * 9 == COVER_SHAPES['share']['h'] * 16, True)
    check('the vertical cover is 9:16', COVER_SHAPES['vertical']['w'] * 16 == COVER_SHAPES['vertical']['h'] * 9, True)
    check('the vertical cover keeps clear of what Shorts, TikTok and Reels lay over it', COVER_SHAPES['vertical']['crops'][0][1], (60, 250, 1020, 1480))
    for shape, spec in COVER_SHAPES.items():
        l, t, r, b = spec['safe']
        m = spec['margin']
        check(f'{shape}: every crop lies inside the image', all(x0 >= 0 and y0 >= 0 and x1 <= spec['w'] and y1 <= spec['h'] for _, (x0, y0, x1, y1) in spec['crops']), True)
        check(f'{shape}: its safe box keeps {m} px clear of the edge of every crop',
              all(l - x0 >= m and t - y0 >= m and x1 - r >= m and y1 - b >= m for _, (x0, y0, x1, y1) in spec['crops']), True)
        check(f'{shape}: headline and face sizes run largest first', (list(spec['heads']), list(spec['faces'])),
              (sorted(spec['heads'], reverse=True), sorted(spec['faces'], reverse=True)))
    import inspect
    check('--cover draws every cover', inspect.getsource(main).count('draw_covers('), 2)

    # The facts: "thumbs" over "cover", field by field, then the page headline.
    check('thumbs.json names each company of a row of two once, as the registry names it',
          companies_of(['Suno', 'Warner Music Group and BMG', 'Sony Music and Universal Music Group', 'Believe', 'A row nobody knows']),
          ['Suno', 'Warner Music Group', 'BMG', 'Sony Music', 'Universal Music Group', 'Believe', 'A row nobody knows'])
    check('a thumbnail falls back to the cover', thumb_facts({'cover': {'headline': ['A', 'B?'], 'rows': [1], 'portrait': True}}),
          {'headline': ['A', 'B?'], 'rows': [1], 'portrait': True})
    check('"thumbs" changes only what it names', thumb_facts({'cover': {'headline': ['A', 'B?'], 'portrait': True}, 'thumbs': {'headline': 'Who? Me.', 'strip': [2]}}),
          {'headline': 'Who? Me.', 'portrait': True, 'strip': [2]})
    check('with neither, the page headline', thumb_facts({'headline': 'Who gets paid?'})['headline'], 'Who gets paid?')
    check('a headline splits after its last stop', split_headline('Warner sued Suno. Now it takes a cut. Who else gets paid?'),
          ('Warner sued Suno. Now it takes a cut.', 'Who else gets paid?'))
    check('with no stop, all of it is in colour', split_headline('So many AIs'), ('', 'So many AIs'))

    # The thumbnail page, with stand-ins for the fonts, the wordmark and the photo.
    dot = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
    saved = (brand.font_css, brand.brand_uri, brand.fetch)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for name in ('logo.png', 'krish.png', 'bg.png'):
            (tmp / name).write_bytes(dot)
        brand.font_css = lambda extra=(): ''
        brand.brand_uri = lambda name, refresh=False, full=False: 'data:image/png;base64,'
        brand.fetch = lambda name, refresh=False: tmp / 'krish.png'
        try:
            facts = {'subchannel': 'follow.the.money', 'headline': 'Who gets paid?',
                     'cover': {'headline': ["A fan's AI song.", 'Who gets paid?'], 'portrait': True, 'background': 'bg.png',
                               'rows': [{'logo': 'logo.png', 'name': 'Suno', 'tag': 'Pays', 'colour': 'butter'}]},
                     'thumbs': {'strip': [{'logo': 'logo.png', 'name': 'Udio'}]}}
            for shape in THUMB_SHAPES:
                spec = THUMBS[shape]
                page = thumb_html(facts, tmp, shape)
                check(f'{shape} page: its size', f'content="{spec["w"]}x{spec["h"]}"' in page, True)
                check(f'{shape} page: laid out for its shape', f'id="card" class="{shape}"' in page, True)
                check(f'{shape} page: the headline, its last line in colour', 'A fan&#x27;s AI song. <span>Who gets paid?</span>' in page or "A fan's AI song. <span>Who gets paid?</span>" in page, True)
                check(f'{shape} page: Krish\'s face', 'class="face"' in page, True)
                check(f'{shape} page: the row and the strip carry their names', ('alt="Suno"' in page, 'alt="Udio"' in page), (True, True))
                check(f'{shape} page: the subchannel, as fine print', '<span class="pill mono" data-fine-print>follow.the.money</span>' in page, True)
                check(f'{shape} page: the face sits in a band only on the wide one', '<div class="band">' in page, shape == 'wide')
                check(f'{shape} page: no long dashes', [ch for ch in page if ch in '\u2013\u2014'], [])
            refused = []
            for bad in ({'strip': [{'logo': 'logo.png'}]}, {'rows': [{'logo': 'logo.png', 'colour': 'mint'}]}, {'headline': ['one', 'two', 'three']}):
                try:
                    thumb_html(dict(facts, thumbs=bad), tmp, 'wide')
                    refused.append(False)
                except SystemExit:
                    refused.append(True)
            check('a strip logo with no name, a row with no tag and a three-part headline are refused', refused, [True, True, True])
            # A background is optional (git keeps no pictures); a logo never is.
            check('the background is named only when it is on this machine',
                  (background({'background': 'bg.png'}, tmp), background({'background': 'gone.png'}, tmp), background({}, tmp)),
                  (tmp / 'bg.png', None, None))
            gone = dict(facts, cover=dict(facts['cover'], background='gone.png'))
            for shape in THUMB_SHAPES:
                check(f'{shape} page: a background on this machine is drawn', 'class="ph"' in thumb_html(facts, tmp, shape), True)
                page = thumb_html(gone, tmp, shape)
                check(f'{shape} page: one that is not is left out, and the rest is drawn',
                      ('class="ph"' in page, 'class="face"' in page, 'alt="Udio"' in page), (False, True, True))
            check('the cover: a background that is not on this machine is left out', 'class="ph"' in cover_html(dict(gone, date='2026-10-12'), tmp), False)
            for shape, spec in COVER_SHAPES.items():
                page = cover_shape_html(dict(facts, date='2026-10-12'), tmp, shape)
                check(f'{shape} cover page: its size and layout', (f'content="{spec["w"]}x{spec["h"]}"' in page, f'id="safe" class="{spec["layout"]}"' in page), (True, True))
                check(f'{shape} cover page: the real wordmark, the headline with its last line in colour, the face and the row',
                      ('alt="makeyourmindup"' in page, "A fan's AI song. <span>Who gets paid?</span>" in page or 'A fan&#x27;s AI song. <span>Who gets paid?</span>' in page,
                       'class="face"' in page, 'alt="Suno"' in page), (True, True, True, True))
                check(f'{shape} cover page: the label as fine print', 'data-fine-print>follow.the.money · ' in page, True)
                check(f'{shape} cover page: no long dashes', [ch for ch in page if ch in '\u2013\u2014'], [])
                check(f'{shape} cover: a background on this machine is drawn, one that is not is left out',
                      ('class="ph"' in page, 'class="ph"' in cover_shape_html(dict(gone, date='2026-10-12'), tmp, shape)), (True, False))
            up = cover_shape_html(dict(facts, date='2026-10-12'), tmp, 'upload')
            check('the upload cover: the face on the left, before the words', up.index('class="face"') < up.index('<h1>'), True)
            vert = cover_shape_html(dict(facts, date='2026-10-12'), tmp, 'vertical')
            check('the vertical cover: the headline above the face', vert.index('<h1>') < vert.index('class="face"'), True)
            try:
                thumb_html(dict(facts, thumbs={'strip': [{'logo': 'gone.svg', 'name': 'Udio'}]}), tmp, 'wide')
                check('a logo that is not on this machine is refused', False, True)
            except SystemExit:
                check('a logo that is not on this machine is refused', True, True)
        finally:
            brand.font_css, brand.brand_uri, brand.fetch = saved

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
    ap.add_argument('--cover', action='store_true', help="draw a cover for every place it is shown: cover-1200x630.png (upload to Substack), cover-1200x675.png, cover-1080x1080.png, cover-1080x1920.png and cover.png at 3:2, each with its check")
    ap.add_argument('--thumbs', action='store_true', help='draw thumb-wide-1280x720.jpg and thumb-tall-1080x1920.jpg, a thumbnail for each video '
                    'size, with their receipt thumbs.json and thumbs-check.png')
    ap.add_argument('--refresh-brand', action='store_true', help='fetch the logo images again now')
    ap.add_argument('--self-test', action='store_true', help='check the thumbnail shapes, the facts and the page check, with no browser')
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    if not a.facts:
        ap.error('give the facts file, or --self-test')

    out = Path(a.out) if a.out else brand.ROOT / '.cache' / 'pages' / Path(a.facts).resolve().parent.name
    raw = json.loads(Path(a.facts).read_text(encoding='utf-8'))
    base = Path(a.assets) if a.assets else Path(a.facts).resolve().parent
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
            ok &= draw_thumbs(raw, base, out, a.refresh_brand)
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
        ok &= draw_thumbs(facts, base, out, a.refresh_brand)
    if a.check:
        ok &= clipboard_check(out / 'substack.html', body)
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    main()
