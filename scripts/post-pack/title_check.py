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
    python title_check.py --self-test

Exit 0 when every title passes, 1 with each refusal named. video_card.py,
publish_manager.py and build.py (covers) call `problems()` on their titles.
"""
import argparse
import re
import sys
from pathlib import Path

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
    if fails:
        print('title_check self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print('title_check self-test passed')
    return 0


def main(argv=None):
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
        why = problems(t, source)
        print(('REFUSED  ' if why else 'passes   ') + t)
        for w in why:
            print('  - ' + w)
        bad += bool(why)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
