#!/usr/bin/env python3
"""title_check: the anti-dumb filter on every title a reader sees first.

Krish, 2026-10-14, on Wednesday's "Muse vs ChatGPT isn't a fair fight" and
"Muse isn't ChatGPT. There are now three kinds of AI.": "no one has ever said
'Muse versus ChatGPT' is a fair fight! The titles can't be boring, but they
also can't just be made from nothing. Of course, Muse isn't ChatGPT. That's
a stupid thing to say. It's dumb. We need an anti-dumb filter. We need titles
that people will go, 'Oh, I need to read that. That's going to be awesome.'
... this sort of crap cannot be allowed to pass in the future, ever". He liked
"Muse's real rival: Siri."

A title passes only when it is none of these (house rule TITLE_EARNS_THE_CLICK):

  - a straw man: knocking down a claim nobody made ("X isn't Y", "X vs Y
    isn't a fair fight", "X is not just Y", "stop calling X a Y");
  - the obvious or a bare topic: no named company, product or person doing
    something, and no number (a label like "Three kinds of AI" or "Whose side
    is it on?" says what the piece is about, not why to read it);
  - a stock headline: "explained", "everything you need to know", "here's
    why", "the truth about", "you won't believe", "what you need to know",
    "game changer", "a closer look", "deep dive", "the future of";
  - made from nothing: a name or a number in it that the piece never says
    (checked when the piece's words are given).

    python title_check.py "Title" [more titles] [--source body.md [--source script.md]]
    python title_check.py lessons            what Krish's verdicts teach, and his picked and rejected titles
    python title_check.py verdict "Title" --picked|--rejected --why "..." --krish "his words" [--surface card] [--piece UUID]
    python title_check.py --self-test

The filter is the floor. What is good is what Krish picks (Krish, 2026-10-14:
"figure out why I dislike it, and iterate, and understand what I actually
like, and then encode that into the system forever"). Every title is written
against config/title-verdicts.json (its lessons and his picked and rejected
titles), offered to him as a few options, and used only once he has picked
it: `gate()` refuses a title with no "picked" verdict, and names his reason
for one he rejected. No card, cover, publish page or video title is made
from a title he has not picked.

Exit 0 when every title passes, 1 with each refusal named. video_card.py,
publish_manager.py and build.py (covers) call `problems()` on their titles.
"""
import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VERDICTS = REPO / 'config' / 'title-verdicts.json'

STRAWMAN = [
    (re.compile(r"\b(isn'?t|is not|aren'?t|are not|wasn'?t|was not)\s+(a\s+)?fair\s+fight\b", re.I), 'calls a comparison unfair that nobody made'),
    (re.compile(r"^\s*[\w'’.&-]+(?:\s+[\w'’.&-]+){0,3}\s+(isn'?t|is not|aren'?t|are not)\s+(?!only\b|just\b)[\w'’.&-]+(?:\s+[\w'’.&-]+){0,3}\s*[.!?]?\s*(?:$|[.!?:])", re.I),
     'says what something is not (a straw man: nobody claimed it was)'),
    (re.compile(r"\b(isn'?t|is not|aren'?t|are not)\s+(just|only|simply)\b", re.I), '"X isn\'t just Y" is a straw man'),
    (re.compile(r"\bstop\s+calling\b", re.I), 'argues with a name nobody gave it'),
    (re.compile(r"\bit'?s not\s+[^,.]+[,.]\s*it'?s\b", re.I), '"it\'s not X, it\'s Y" is a straw man'),
    (re.compile(r"\b\w+\s+(vs\.?|versus)\s+\w+", re.I), '"X vs Y" is a matchup label, not a reason to read'),
]
STOCK = re.compile(r"\b(explained|everything you need to know|here'?s why|here is why|the truth about|you won'?t believe|what you need to "
                   r"know|game[- ]changer|a closer look|deep dive|the future of|all you need|why it matters|let'?s talk about)\b", re.I)
NUMBER = re.compile(r"\d")
# A capitalised word that is not the first word: a named company, product or person.
NAME = re.compile(r"(?<!^)(?<![.!?]\s)\b([A-Z][\w'’&.-]*[a-z0-9][\w'’&.-]*|[A-Z]{2,}[a-z]*)\b")
VERB_HINT = re.compile(r"\b(\w{3,}ed|is|are|was|were|has|have|had|can|will|won'?t|can'?t|does|did|makes?|made|gets?|got|pays?|paid|"
                       r"sells?|sold|buys?|bought|blocks?|lets?|ties?|beats?|loses?|lost|wins?|won|picks?|reads?|keeps?|kept|runs?|ran|"
                       r"hides?|hid|knows?|knew|owns?|takes?|took|breaks?|broke|says?|said|wants?|needs?|goes|went|comes?|came|"
                       r"shows?|tells?|told|sees?|saw|finds?|found|leaves?|left|stops?|starts?|kills?|lets?|lock(?:ed|s)?)\b", re.I)
# A first word is a name unless it is an everyday word that opens a sentence.
OPENERS = {'the', 'a', 'an', 'this', 'that', 'these', 'those', 'why', 'how', 'what', 'who', 'whose', 'when', 'where', 'which', 'my', 'your',
           'our', 'their', 'his', 'her', 'its', 'it', 'i', 'we', 'you', 'they', 'one', 'two', 'three', 'four', 'five', 'six', 'ten', 'every',
           'each', 'all', 'no', 'none', 'nobody', 'only', 'soon', 'by', 'in', 'on', 'at', 'for', 'from', 'with', 'after', 'before', 'now',
           'here', 'there', 'is', 'are', 'can', 'do', 'does', 'will', 'should', 'would', 'did', 'if', 'so', 'but', 'and', 'or', 'stop',
           'ready', 'big', 'small', 'most', 'first', 'last', 'new', 'old', 'next', 'more', 'less', 'some', 'many', 'few', 'ai'}
# A claim with a stake: a contrast or an extreme, with something done.
STAKE = re.compile(r"\b(only|every|none|nobody|no one|first|last|most|least|never|always|already|just)\b", re.I)


def names_in(title):
    found = set(NAME.findall(title))
    first = re.match(r"\s*([\w'’]+)", title)
    if first and re.sub(r"['’]s$", '', first.group(1)).lower() not in OPENERS and not first.group(1)[0].isdigit():
        found.add(first.group(1))
    return {re.sub(r"['’]s$", '', n) for n in found if n.upper() not in {'I', 'AI', 'AIS', 'MY', 'A'} and n.lower() not in {'i', 'my'}}


def problems(title, source=None):
    """The reasons a title fails, [] when it passes. source: the piece's own
    words (body and scripts), to check its names and numbers are the piece's."""
    t = ' '.join(str(title or '').split())
    if not t:
        return ['no title']
    out = []
    for rx, why in STRAWMAN:
        if rx.search(t):
            out.append(why)
    m = STOCK.search(t)
    if m:
        out.append(f'"{m.group(0)}" is a stock headline phrase')
    names = names_in(t)
    earned = (NUMBER.search(t) or (names and VERB_HINT.search(t)) or len(names) >= 2
              or (STAKE.search(t) and VERB_HINT.search(t)))
    if not earned:
        out.append('a bare topic or the obvious: name who does what, or give the number that surprises (why would someone have to read it?)')
    if source:
        hay = ' '.join(str(source).split()).lower()
        for n in sorted(names):
            if n.lower() not in hay:
                out.append(f'"{n}" is not in the piece: a title is made from the piece, never from nothing')
        for num in {n.rstrip('.,') for n in re.findall(r"\d[\d,.]*%?", t)}:
            if num.lower() not in hay:
                out.append(f'"{num}" is not in the piece')
    return out


def verdicts_path():
    return Path(os.environ.get('MYMU_TITLE_VERDICTS') or VERDICTS)


def load_verdicts():
    path = verdicts_path()
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'lessons': [], 'verdicts': []}


def norm(title):
    t = str(title or '').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return ' '.join(t.split()).strip().lower()


def verdict_of(title, data=None):
    """Krish's latest verdict on this exact title, or None."""
    data = data or load_verdicts()
    hits = [v for v in data.get('verdicts', []) if norm(v.get('title')) == norm(title)]
    return hits[0] if hits else None


def gate(title, source=None, data=None):
    """problems() and Krish's verdict: [] only for a title he picked that also clears the floor."""
    out = problems(title, source)
    v = verdict_of(title, data)
    if v is None:
        out.append('Krish has not picked this title: offer him a few options written against `title_check.py lessons`, '
                   'and record his pick with `title_check.py verdict`')
    elif v.get('verdict') != 'picked':
        out.append(f'Krish rejected this title ({v.get("why")}; his words: "{v.get("krish")}")')
    return out


def record_verdict(title, verdict, why, krish, surface=None, piece=None, on=None):
    if verdict not in ('picked', 'rejected'):
        raise ValueError('a verdict is picked or rejected')
    if not str(why or '').strip() or not str(krish or '').strip():
        raise ValueError('a verdict carries why (what it teaches) and Krish\'s own words')
    data = load_verdicts()
    entry = {'title': ' '.join(str(title).split()), 'surface': surface or 'any', 'verdict': verdict, 'why': why.strip(),
             'krish': krish.strip(), 'on': on or date.today().isoformat()}
    if piece:
        entry['piece'] = piece
    data['verdicts'] = [entry] + [v for v in data.get('verdicts', []) if norm(v.get('title')) != norm(title)]
    verdicts_path().write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return entry


class picked_for_tests:
    """A self-test's own verdicts: the given titles marked picked, in a file of
    their own, so a tool's tests check the tool, never Krish's real picks."""

    def __init__(self, titles, tmp):
        self.path = Path(tmp) / 'title-verdicts.test.json'
        self.path.write_text(json.dumps({'lessons': [], 'verdicts': [
            {'title': t, 'surface': 'test', 'verdict': 'picked', 'why': 'a test fixture', 'krish': 'test', 'on': '2026-10-14'}
            for t in titles]}), encoding='utf-8')
        self.before = None

    def __enter__(self):
        self.before = os.environ.get('MYMU_TITLE_VERDICTS')
        os.environ['MYMU_TITLE_VERDICTS'] = str(self.path)
        return self

    def __exit__(self, *exc):
        if self.before is None:
            os.environ.pop('MYMU_TITLE_VERDICTS', None)
        else:
            os.environ['MYMU_TITLE_VERDICTS'] = self.before


def lessons_text(data=None):
    data = data or load_verdicts()
    lines = ['What Krish likes in a title (config/title-verdicts.json):']
    lines += [f'  - {l["lesson"]}' for l in data.get('lessons', [])]
    lines.append('Picked:')
    lines += [f'  + "{v["title"]}" ({v["surface"]}): {v["why"]}' for v in data.get('verdicts', []) if v.get('verdict') == 'picked']
    lines.append('Rejected:')
    lines += [f'  - "{v["title"]}" ({v["surface"]}): {v["why"]}' for v in data.get('verdicts', []) if v.get('verdict') != 'picked']
    return '\n'.join(lines)


def self_test():
    fails = []

    def check(name, got, want):
        if got != want:
            fails.append(f'{name}: got {got!r}, want {want!r}')

    body = ('Amazon blocked Muse from buying on its site. Walmart lets ChatGPT and Muse buy there. Meta made $59.36 billion from ads, '
            'out of $60.8 billion. Muse and Siri tie on 43 out of 60. Three kinds of AI.')
    for bad in ("Muse vs ChatGPT isn't a fair fight", "Muse isn't ChatGPT. There are now three kinds of AI.", 'Three kinds of AI',
                'Whose side is it on?', 'Who can read your stuff?', 'AI assistants, explained', "Here's why Muse matters", 'Why so many AIs',
                'Muse features', 'Who gets paid for AI songs',
                "Siri isn't just a voice", 'Stop calling Muse a chatbot', 'Each shop decides'):
        check(f'refused: {bad}', bool(problems(bad, body)), True)
    for good in ("Muse's real rival: Siri.", 'Amazon locked Muse out. Walmart let it in.', '97% of Meta\'s money comes from ads',
                 'Muse and Siri tie on 43. For opposite reasons.', 'Three kinds of AI. Only one runs your errands.'):
        check(f'passes: {good}', problems(good, body if '97' not in good else body + ' 97%'), [])
    check('made from nothing: a name the piece never says', any('Tesco' in p for p in problems('Tesco blocked Muse', body)), True)
    check('made from nothing: a number the piece never says', any('"12"' in p for p in problems('Muse wins 12 to 3', body)), True)
    # The gate: only a title Krish picked; a rejected one says why.
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        os.environ['MYMU_TITLE_VERDICTS'] = str(Path(tmp) / 'v.json')
        try:
            check('gate: a title nobody picked is refused', any('has not picked' in p for p in gate('Amazon locked Muse out. Walmart let it in.')), True)
            record_verdict('Amazon locked Muse out. Walmart let it in.', 'picked', 'a concrete twist', 'that one', 'card')
            check('gate: once picked it passes (quotes and spaces aside)', gate('Amazon locked Muse out.  Walmart let it in.'), [])
            record_verdict('Amazon locked Muse out. Walmart let it in.', 'rejected', 'flat', 'no, boring', 'card')
            check('gate: a later rejection wins, with his words', any('no, boring' in p for p in gate('Amazon locked Muse out. Walmart let it in.')), True)
            check('lessons list his picked and rejected titles', 'Amazon locked Muse out' in lessons_text(), True)
            try:
                record_verdict('X did Y', 'picked', '', '', 'card')
                check('a verdict without his words is refused', 'no error', 'error')
            except ValueError:
                check('a verdict without his words is refused', True, True)
        finally:
            os.environ.pop('MYMU_TITLE_VERDICTS', None)
    if fails:
        print('title_check self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print('title_check self-test passed')
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv[:1] == ['lessons']:
        print(lessons_text())
        return 0
    if argv[:1] == ['verdict']:
        vp = argparse.ArgumentParser(description='Record Krish\'s verdict on a title.')
        vp.add_argument('title')
        g = vp.add_mutually_exclusive_group(required=True)
        g.add_argument('--picked', action='store_true')
        g.add_argument('--rejected', action='store_true')
        vp.add_argument('--why', required=True, help='what it teaches')
        vp.add_argument('--krish', required=True, help='his own words')
        vp.add_argument('--surface', default='any')
        vp.add_argument('--piece')
        v = vp.parse_args(argv[1:])
        e = record_verdict(v.title, 'picked' if v.picked else 'rejected', v.why, v.krish, v.surface, v.piece)
        print(f'recorded: {e["verdict"]} "{e["title"]}"')
        return 0
    ap = argparse.ArgumentParser(description='The anti-dumb filter on titles (house rule TITLE_EARNS_THE_CLICK).')
    ap.add_argument('titles', nargs='*')
    ap.add_argument('--source', action='append', default=[], help='the piece\'s words (body, scripts), to check names and numbers')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    source = ' '.join(Path(p).read_text(encoding='utf-8') for p in a.source) if a.source else None
    bad = 0
    for t in a.titles:
        why = gate(t, source)
        print(('REFUSED  ' if why else 'passes   ') + t)
        for w in why:
            print('  - ' + w)
        bad += bool(why)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
