#!/usr/bin/env python3
"""The ten-second swipe: a carousel's story must reach a complete layperson in ten seconds (Krish, 2026-11-13).

Krish, 13 Nov 2026, on the Thursday 12 Nov Git carousel: "Git carousel cards look terrible apart from the cover card and
they also are not very easy to follow. Remember that a complete layperson is swiping through these cards at light speed
and needs to be able to follow the story within 10 seconds. This cannot ever happen again in any future carousel."

    python3 scripts/carousel_check.py DECK.json      exit 0 when the deck may be made and filed, 1 with every reason

DECK.json (schema carousel-deck/1) is the deck's words as the cards carry them, written before the cards are drawn:
  {"schema": "carousel-deck/1", "title": "...",
   "five_whys": [{"q": "Why ...?", "a": "..."}, x5],
   "arc": {"what": 1, "happened": [1, 2], "why": 3, "so_what": [5, 6, 7], "do": [8, 9]},
   "cards": [{"headline": "...", "line": "...", "picture": "...", "source": "on the trend card"}, ..., {"cta": "Follow for more"}],
   "read_back": [{"reader": "...", "answers": {"what": "...", "happened": "...", "why": "...", "so_what": "...", "do": "..."}}],
   "explains": {"git": "the tool programmers use to save code"}}

What it refuses (each is what a Git deck of 12 or 13 Nov got wrong; docs/CAROUSEL-STANDARD.md, "The ten-second swipe"):
  - no five whys asked before writing, or no card for what it is, what happened, why, the wider trend or what to do,
    or those steps out of order;
  - a wider-trend card with no evidence from outside the story ("source");
  - more than 10 cards, the cover and the call-to-action card included, or a last card without "Follow for more";
  - a card whose headline is not a whole sentence a stranger reads in about two seconds (3 to 12 words, ending . ! ?;
    the cover may drop the full stop), so no card leads with a label such as "CODE CHANGES ANTHROPIC MERGED PER DAY";
  - headlines that together take longer than ten seconds to read (over 50 words across the deck);
  - a card after the cover with no picture of its point (a number alone, a list of names, words alone);
  - a line under a headline over 20 words: the line adds, it never carries the story;
  - jargon a layperson does not know (config/carousel-plain-words.json) unless the deck explains it in plain words;
  - fewer than two fresh readers who saw only the headlines, in order, and answered all five questions in their words.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDS = ROOT / 'config' / 'carousel-plain-words.json'
HEADLINE_WORDS = (3, 12)
DECK_HEADLINE_WORDS = 50
MAX_CARDS = 10            # the cover and the call-to-action card included (Krish, 2026-11-13)
ARC = ('what', 'happened', 'why', 'so_what', 'do')
ARC_SAYS = {'what': 'what the thing is, in plain words', 'happened': 'what happened', 'why': 'why it happened',
            'so_what': 'the wider trend it points to, with evidence from outside the story', 'do': 'what a business person should do'}
LINE_WORDS = 20
READERS = 2


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9][A-Za-z0-9'’,.%+×-]*", text or '')


def problems(deck: dict) -> list[str]:
    out: list[str] = []
    if deck.get('schema') != 'carousel-deck/1':
        out.append('not a carousel-deck/1 file')
    cards = deck.get('cards')
    if not isinstance(cards, list) or len(cards) < 2:
        return out + ['a deck needs a cover and at least one card after it']
    if len(cards) > MAX_CARDS:
        out.append(f'{len(cards)} cards: at most {MAX_CARDS}, the cover and the call-to-action card included')
    # The story route (Krish, 2026-11-13: "Nobody knows what Git is. No one knows why Anthropic did this. No one knows
    # why it's important to basic people or what could change as a result ... Ask why five times"; "the 'so what' is
    # missing ... That's where the gold dust lies"): five whys first, then a card for each step, in order.
    whys = [w for w in (deck.get('five_whys') or []) if isinstance(w, dict) and str(w.get('q') or '').strip() and len(words(str(w.get('a') or ''))) >= 4]
    if len(whys) < 5:
        out.append(f'ask why five times before writing a card ("five_whys": five questions with their answers; {len(whys)} given)')
    arc = deck.get('arc') if isinstance(deck.get('arc'), dict) else {}
    placed = []
    for step in ARC:
        at = arc.get(step)
        at = at if isinstance(at, list) else [at]
        at = [i for i in at if isinstance(i, int) and 1 <= i <= len(cards)]
        if not at:
            out.append(f'no card says {ARC_SAYS[step]} ("arc": {{"{step}": <card number>}})')
        else:
            placed.append((step, min(at)))
    order = [step for step, _ in sorted(placed, key=lambda x: x[1])]
    if order != [step for step, _ in placed]:
        out.append('the story runs out of order: what it is, what happened, why, the wider trend, then what to do')
    so = arc.get('so_what')
    so = so if isinstance(so, list) else [so]
    if not any(isinstance(i, int) and 1 <= i <= len(cards) and str((cards[i - 1] or {}).get('source') or '').strip() for i in so):
        out.append('the wider-trend card names its evidence ("source" on that card): a trend is shown, never asserted')
    last = cards[-1] if isinstance(cards[-1], dict) else {}
    if 'follow for more' not in f"{last.get('line') or ''} {last.get('cta') or ''}".lower():
        out.append('the last card ends on "Follow for more" over the centred wordmark (Krish, 5 Nov 2026)')
    jargon = json.loads(WORDS.read_text(encoding='utf-8'))['jargon'] if WORDS.is_file() else []
    explained = {k.lower() for k in (deck.get('explains') or {}) if str((deck.get('explains') or {})[k]).strip()}
    total = 0
    for n, card in enumerate(cards, 1):
        card = card if isinstance(card, dict) else {}
        head = str(card.get('headline') or '').strip()
        count = len(words(head))
        total += count
        if not HEADLINE_WORDS[0] <= count <= HEADLINE_WORDS[1]:
            out.append(f'card {n}: the headline has {count} words; a stranger swiping reads {HEADLINE_WORDS[0]} to '
                       f'{HEADLINE_WORDS[1]} in about two seconds')
        if n > 1 and not re.search(r'[.!?]["’\')]*$', head):
            out.append(f'card {n}: the headline is not a whole sentence ("{head[:60]}"): a label is not a story')
        line = str(card.get('line') or '').strip()
        if len(words(line)) > LINE_WORDS:
            out.append(f'card {n}: the line under the headline has {len(words(line))} words (at most {LINE_WORDS}): '
                       'the headline carries the story, the line only adds')
        if n > 1 and not str(card.get('picture') or '').strip():
            out.append(f'card {n}: no picture of its point; every card after the cover shows what its headline says')
        text = f'{head} {line}'.lower()
        for term in jargon:
            if re.search(rf'\b{re.escape(term.lower())}\b', text) and term.lower() not in explained:
                out.append(f'card {n}: "{term}" is jargon to a layperson; say it plainly, or explain it in "explains" '
                           'and on the card where it first appears')
    if total > DECK_HEADLINE_WORDS:
        out.append(f'the headlines total {total} words; read in order they must take ten seconds or less '
                   f'(at most {DECK_HEADLINE_WORDS})')
    told = [r for r in (deck.get('read_back') or []) if isinstance(r, dict) and str(r.get('reader') or '').strip()
            and all(len(words(str((r.get('answers') or {}).get(step) or ''))) >= 3 for step in ARC)]
    if len(told) < READERS:
        out.append(f'{READERS} fresh readers must see only the headlines, in order, once, and answer in their own words '
                   f'what it is, what happened, why, why it matters to them and what to do ({len(told)} given)')
    return out


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print(__doc__)
        return 2
    deck = json.loads(Path(argv[0]).read_text(encoding='utf-8'))
    found = problems(deck)
    for p in found:
        print(f'carousel_check: {p}')
    if not found:
        heads = ' / '.join(str(c.get('headline')) for c in deck['cards'])
        print(f'carousel_check: passes the ten-second swipe: {heads}')
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main())
