#!/usr/bin/env python3
"""figure_check: the three checks every article figure passes before anyone sees it (failure report of 19 Nov 2026,
Fri 20 production session; config/failures.json article-figure-typed-mark-and-word-cards).

Krish, 19 Nov 2026: "these dont look visually good enough and they have the wrong brand mark. Are these to go inside, in
line, in the Substack article? If so, we don't even need the brand mark."

    python3 scripts/pages/figure_check.py <figure.html> [--article ARTICLE.md] [--json]

1. The mark. An inline figure (the default, <meta name="figure-kind" content="inline">) carries no mark: no element with
   a mark class, no image named for a wordmark, logo or brand, and never the typed words "makeyourmindup". A share card
   (<meta name="figure-kind" content="share-card">) may carry the wordmark only as the palette's own image, checked by
   its sha256 against config/brand-palette.json marks; typed text is refused there too.
2. Picture first. The figure names its one form in <meta name="figure-form"> (config/article-figures.json forms:
   source-page, scale, timeline, ledger, map, comparison), and holds at most max_running_words of running text outside
   its labels, so a card of words never passes.
3. Nothing the article doesn't say. Every number, date, quoted phrase and mid-sentence name drawn on the figure must be in
   the article (<meta name="figure-article" content="../article.md"> or --article), and every claim label's words must
   stand together in the article (claim_window). Words inside a real source's screenshot (an element with
   data-source-crop, or an image) are the source's own and are not read; the caption around it is.

Exit 0 when the figure passes, 1 with each problem named, 2 when a file cannot be read. Standard library only.
"""
import argparse
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RULES = ROOT / 'config' / 'article-figures.json'
PALETTE = ROOT / 'config' / 'brand-palette.json'
MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november',
          'december']
MONTH_SHORT = {m[:3]: m for m in MONTHS} | {'sept': 'september'}
VOID = {'meta', 'img', 'br', 'hr', 'link', 'input', 'source', 'area', 'col', 'embed', 'param', 'track', 'wbr'}


def rules():
    return json.loads(RULES.read_text(encoding='utf-8'))


class Figure(HTMLParser):
    """The figure's metas, images, mark elements and visible text, each text run with the classes around it."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.images, self.marked, self.runs = {}, [], [], []
        self.stack = []  # (tag, classes, exempt)
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = set((a.get('class') or '').split())
        if tag == 'meta' and a.get('name'):
            self.meta[a['name'].lower()] = (a.get('content') or '').strip()
        if tag == 'img':
            self.images.append({'src': a.get('src') or '', 'alt': a.get('alt') or '', 'classes': classes})
        if tag in ('script', 'style', 'head', 'title'):
            self.skip += 1
        exempt = 'data-source-crop' in a or (self.stack and self.stack[-1][2])
        if classes:
            self.marked.append(classes)
        if tag not in VOID:
            self.stack.append((tag, classes, bool(exempt)))

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'head', 'title'):
            self.skip = max(0, self.skip - 1)
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        text = ' '.join(data.split())
        if not text or self.skip:
            return
        tags = [s[0] for s in self.stack]
        classes = set().union(*[s[1] for s in self.stack]) if self.stack else set()
        exempt = any(s[2] for s in self.stack)
        self.runs.append({'text': text, 'tags': tags, 'classes': classes, 'own': self.stack[-1][1] if self.stack else set(),
                          'exempt': exempt})


def parse(html):
    f = Figure()
    f.feed(html)
    return f


def words(text):
    return re.findall(r"[A-Za-z][A-Za-z'’-]*", text)


# ── 1. the mark ─────────────────────────────────────────────────────────────────────────────────────────────────────

def palette_mark_shas():
    p = json.loads(PALETTE.read_text(encoding='utf-8')).get('marks') or {}
    out = set()
    for key in ('wordmark', 'masthead', 'icon'):
        m = p.get(key) or {}
        if m.get('sha256'):
            out.add(m['sha256'])
        out.update(m.get('same_drawing') or [])
    return out


def mark_problems(fig, base, r):
    kind = fig.meta.get('figure-kind') or r['default_kind']
    m = r['mark']
    out = []
    if kind not in r['kinds']:
        return [f'figure-kind "{kind}" is not one of {", ".join(r["kinds"])}']
    for classes in fig.marked:
        hit = classes & set(m['classes'])
        if hit:
            out.append(f'a mark element (class {sorted(hit)[0]}): an inline figure carries no mark, and a share card\'s mark is the palette\'s own image, never typed')
            break
    for run in fig.runs:
        low = run['text'].lower()
        if not run['exempt'] and any(w in low for w in m['words']):
            out.append(f'the typed words "{run["text"][:40]}": the brand is never set as type on a figure')
            break
    for img in fig.images:
        name = f'{img["src"]} {img["alt"]}'.lower()
        if any(w in name for w in m['image_names']):
            if kind == 'inline':
                out.append(f'an image named for a mark ({img["src"] or img["alt"]}): an inline Substack figure carries no mark (the post already carries the brand)')
            else:
                path = (base / img['src']).resolve() if img['src'] and not re.match(r'^[a-z]+:', img['src']) else None
                sha = hashlib.sha256(path.read_bytes()).hexdigest() if path and path.is_file() else None
                if sha not in palette_mark_shas():
                    out.append(f'a share card\'s mark ({img["src"]}) is not the palette\'s own image by its sha256 (config/brand-palette.json marks)')
    return out


# ── 2. picture first ────────────────────────────────────────────────────────────────────────────────────────────────

def form_problems(fig, r):
    out = []
    form = fig.meta.get('figure-form')
    if form not in r['forms']:
        out.append(f'no picture form: name one in <meta name="figure-form"> ({", ".join(r["forms"])}); a card of words restates the article instead of showing it'
                   if not form else f'figure-form "{form}" is not one of {", ".join(r["forms"])}')
    rt, labels = r['running_text'], set(r['label_classes'])
    running = 0
    for run in fig.runs:
        if run['exempt'] or (run['classes'] & labels):
            continue
        if (set(run['tags']) & set(rt['tags'])) or (run['classes'] & set(rt['classes'])):
            running += len(words(run['text']))
    if running > r['max_running_words']:
        out.append(f'{running} words of running text outside its labels (at most {r["max_running_words"]}): a figure shows, the article tells')
    return out


# ── 3. nothing the article doesn't say ──────────────────────────────────────────────────────────────────────────────

NUM = re.compile(r'(?<![\w.])\$?\d[\d,]*(?:\.\d+)?\s*(?:%|percent|per cent|k\b|m\b|bn\b|million|billion|thousand)?', re.I)


def number_values(text):
    vals = set()
    for m in NUM.finditer(text):
        raw = m.group(0).lower().replace(',', '').replace('$', '').strip()
        mult = 1
        for suf, k in (('thousand', 1e3), ('million', 1e6), ('billion', 1e9), ('bn', 1e9), ('k', 1e3), ('m', 1e6)):
            if raw.endswith(suf):
                raw, mult = raw[: -len(suf)].strip(), k
                break
        pct = raw.endswith('%') or raw.endswith('percent') or raw.endswith('per cent')
        raw = re.sub(r'(%|percent|per cent)$', '', raw).strip()
        try:
            v = float(raw) * mult
        except ValueError:
            continue
        vals.add(('%' if pct else '') + (f'{v:.6g}'))
    return vals


def dates(text):
    out = set()
    low = text.lower()
    for m in re.finditer(r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{4}|\d{1,2})\b', low):
        mon = MONTH_SHORT.get(m.group(1)[:4] if m.group(1).startswith('sept') else m.group(1)[:3], m.group(1))
        out.add(f'{mon} {m.group(2)}')
    for m in re.finditer(r'\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b', low):
        out.add(f'{m.group(2)} {m.group(1)}')
    return out


def quoted(text):
    return {q.strip().lower() for q in re.findall(r'["“”]([^"“”]{3,})["“”]', text)}


def names(text):
    """Mid-sentence capitalised words (a name the reader must already know from the article)."""
    out = set()
    for sentence in re.split(r'(?<=[.!?:·])\s+', text):
        toks = sentence.split()
        for i, t in enumerate(toks):
            w = t.strip('.,;:!?()[]"“”‘’')
            if i and re.match(r"^[A-Z][a-z][\w'’-]*$", w) and w.lower() not in MONTHS:
                out.add(re.sub(r"['’]s$", '', w))
    return out


def stem(w):
    w = re.sub(r"['’]s$", '', w.lower()).strip("'’")
    for suf in ('ions', 'ion', 'ing', 'ed', 'es', 's'):
        if len(w) > 4 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def content(text, stop):
    out = []
    for w in words(text.replace('-', ' ')):
        low = w.lower().replace('’', "'")
        if low in stop or len(low) <= 2 or re.search(r"n't$|'(re|ve|ll|d|m)$", low):
            continue
        out.append(stem(low))
    return out


def clauses(text):
    """A label's clauses: words are paired only inside one, never across a comma, a stop or a middle dot."""
    return [c for c in re.split(r'[.,;:!?·()\[\]]+', text) if c.strip()]


def article_problems(fig, article, r):
    a = r['article_match']
    stop = set(a['stopwords'])
    body = article
    body_low = body.lower()
    body_nums = number_values(body)
    body_dates = dates(body)
    body_words = content(body, stop)
    positions = {}
    for i, w in enumerate(body_words):
        positions.setdefault(w, []).append(i)
    out = []
    claim = set(a['claim_classes'])
    for run in fig.runs:
        if run['exempt']:
            continue
        t = run['text']
        for v in sorted(number_values(t) - body_nums):
            out.append(f'the number {v.lstrip("%")}{"%" if v.startswith("%") else ""} in "{t[:60]}" is not in the article')
        for d in sorted(dates(t) - body_dates):
            out.append(f'the date "{d}" in "{t[:60]}" is not in the article')
        for q in sorted(quoted(t)):
            if q not in body_low:
                out.append(f'the quoted words "{q}" are not in the article')
        for n in sorted(names(t)):
            if not re.search(r'\b' + re.escape(n) + r'\b', body):
                out.append(f'the name "{n}" in "{t[:60]}" is never named in the article')
        if run['own'] & claim:
            missing = [w for w in content(t, stop) if w not in positions]
            if missing:
                out.append(f'the label "{t[:60]}" says "{", ".join(missing)}", which the article never does')
                continue
            if not (run['own'] & set(a.get('pair_classes') or [])):
                continue
            for clause in clauses(t):
                ws = content(clause, stop)
                far = next(((x, y) for x, y in zip(ws, ws[1:])
                            if not any(abs(i - j) <= a['claim_window'] for i in positions[x] for j in positions[y])), None)
                if far:
                    out.append(f'the label "{t[:60]}" puts "{far[0]} … {far[1]}" together, which the article never does')
                    break
    return list(dict.fromkeys(out))


# ── the whole check ─────────────────────────────────────────────────────────────────────────────────────────────────

def check(path, article_path=None):
    r = rules()
    path = Path(path)
    fig = parse(path.read_text(encoding='utf-8'))
    out = mark_problems(fig, path.parent, r) + form_problems(fig, r)
    art = article_path or fig.meta.get('figure-article')
    if art:
        ap = Path(art) if article_path else (path.parent / art)
        if not ap.is_file():
            out.append(f'the article it is checked against ({art}) is not there')
        else:
            out += article_problems(fig, ap.read_text(encoding='utf-8'), r)
    else:
        out.append('no article named: <meta name="figure-article" content="<path to the article>"> or --article, so its words can be checked against the article before anyone sees it')
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('figure', nargs='+')
    ap.add_argument('--article')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    bad = 0
    report = {}
    for f in args.figure:
        try:
            probs = check(f, args.article)
        except OSError as e:
            print(f'figure_check: {f}: {e}', file=sys.stderr)
            return 2
        report[f] = probs
        if probs:
            bad += 1
            if not args.json:
                print(f'figure_check: {f} is refused:', file=sys.stderr)
                for p in probs:
                    print(f'  - {p}', file=sys.stderr)
        elif not args.json:
            print(f'figure_check: {f} passes the mark, form and article checks')
    if args.json:
        print(json.dumps(report, indent=1))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
