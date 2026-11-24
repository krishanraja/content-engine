#!/usr/bin/env python3
"""The ten-second swipe: a carousel's story must reach a complete layperson in ten seconds (Krish, 2026-11-13).

Krish, 13 Nov 2026, on the Thursday 12 Nov Git carousel: "Git carousel cards look terrible apart from the cover card and
they also are not very easy to follow. Remember that a complete layperson is swiping through these cards at light speed
and needs to be able to follow the story within 10 seconds. This cannot ever happen again in any future carousel."

    python3 scripts/carousel_check.py DECK.json      exit 0 when the deck may be made and filed, 1 with every reason
    python3 scripts/carousel_check.py --cards card-1.png ... card-n.png
                                                     the drawn cards, cover first: a cover that looks like a front cover,
                                                     body cards that use the page centrally with real visual effort
                                                     (scripts/carousel_layout.py, config/carousel-layout.json)

Ruling (Krish, 2026-11-15): a carousel body card carries one full plain sentence of 8 to 20 words ("Use 8 to 20
words"); his 2 Nov "WAY too much text" means no paragraphs. His words that day: "They assume that people have a working knowledge
of what we're talking about and use too few words. For example, "12x more code in 4 months" should be something like:
"12 times more code is being produced per month because of AI doing more coding"."

DECK.json (schema carousel-deck/1) is the deck's words as the cards carry them, written before the cards are drawn:
  {"schema": "carousel-deck/1", "title": "...",
   "five_whys": [{"q": "Why ...?", "a": "..."}, x5],
   "arc": {"what": 1, "happened": [1, 2], "why": 3, "so_what": [5, 6, 7], "do": [8, 9]},
   "cards": [{"headline": "...", "line": "...", "picture": "...", "source": "on the trend card"}, ..., {"headline": "the takeaway.", "picture": "...", "cta": "Follow for more"}],
   "read_back": [{"reader": "...", "answers": {"what": "...", "happened": "...", "why": "...", "so_what": "...", "do": "..."}}],
   "explains": {"git": "the tool programmers use to save code"}}

carousel-deck/2 is the same file climbing the why-ladder (Ruling, Krish, 2026-11-24: the signature format is the 5
Whys; get rid of everything that suggests predictions, calls, dated, odds or scores): every Why names its source,
  "five_whys": [{"q": "Why ...?", "a": "...", "source": "who said it, dated, or its link"}, ...]
3 to 7 of them (five is the target, never padded); fewer than 3 only when the last carries the "stop" that ended the
ladder (evidence_exhausted, motive_not_mechanism, restatement, abstraction_drift, out_of_scope or cap). Its arc lands
instead of telling anyone what to do: "landing" names the card (or cards) for what this shows, ending on the open
question handed to the viewer ("?"), never a lesson or an action for business people, and each reader's read-back
answers "landing" in place of "do":
  "arc": {"what": 1, "happened": [1, 2], "why": 3, "so_what": [5, 6, 7], "landing": [8, 9]}
A carousel-deck/1 deck keeps its five whys with no source each and its "do" step.

What it refuses (each is what a Git deck of 12 or 13 Nov got wrong; docs/CAROUSEL-STANDARD.md, "The ten-second swipe"):
  - no five whys asked before writing, or no card for what it is, what happened, why, the wider trend or what to do,
    or those steps out of order;
  - a wider-trend card with no evidence from outside the story ("source");
  - more than 10 cards, the cover and the last card included, or a last card that is not the brand palette's close
    (house_close_slide: the piece's takeaway as its headline, then "Follow for more" with the wordmark centred under it; Ruling, Krish, 2026-11-18); a deck marked "good_news": true keeps his fixed good-news close instead;
  - a cover headline over 12 words, or a body card whose headline is not one full plain sentence a stranger can follow
    cold (8 to 20 words, ending . ! ?, with a verb; 15 Nov 2026), so no card leads with a label such as "CODE CHANGES
    ANTHROPIC MERGED PER DAY" or shorthand such as "12x more code in four months.": no bare multiplier ("12x", write
    "12 times"), a number always with its unit or comparator and its cause, no opening on So, But, And, Then, Or or
    Because, no "it", "they" or "this" standing in for a name at the start, and no stacked fragments ("Doing got faster.
    Checking didn't.");
  - headlines that together run past what one plain sentence a card allows (over 160 words across the deck);
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT = Path(__file__).resolve().parents[1]
WORDS = ROOT / 'config' / 'carousel-plain-words.json'
HEADLINE_WORDS = (3, 12)          # the cover
BODY_HEADLINE_WORDS = (8, 20)     # one full plain sentence a stranger can follow (Ruling, Krish, 2026-11-15); the same
                                  # range as Growth's carousel lint (growth-makeyourmindup #119)
DECK_HEADLINE_WORDS = 160         # one sentence of up to 20 words on each of at most 8 cards after the cover
MAX_CARDS = 10            # the cover and the call-to-action card included (Krish, 2026-11-13)
ARC = ('what', 'happened', 'why', 'so_what', 'do')
ARC_SAYS = {'what': 'what the thing is, in plain words', 'happened': 'what happened', 'why': 'why it happened',
            'so_what': 'the wider trend it points to, with evidence from outside the story', 'do': 'what a business person should do'}
LINE_WORDS = 20
READERS = 2
SCHEMAS = ('carousel-deck/1', 'carousel-deck/2')
LADDER_WHYS = (3, 7)      # carousel-deck/2: the why-ladder's 3 to 7 rungs, five the target (packages/contracts/src/whys.ts)
# carousel-deck/2 lands on what this shows plus an open question, never what to do (the why-ladder's landing).
LADDER_ARC = ('what', 'happened', 'why', 'so_what', 'landing')
LADDER_ARC_SAYS = dict(ARC_SAYS, landing='what this shows, ending on the open question handed to the viewer')
# The stops a why-ladder may end on (packages/contracts/src/whys.ts WHY_STOPS).
LADDER_STOPS = ('evidence_exhausted', 'motive_not_mechanism', 'restatement', 'abstraction_drift', 'out_of_scope', 'cap')
# A landing that tells business people what to do: a lesson, a should or must, or a sentence that opens on an order.
LESSON = re.compile(r"\b(?:lessons? for (?:leaders|executives|ceos|founders|boards|managers|business(?:es)?)|"
                    r"the real question for leaders|(?:leaders|executives|ceos|founders|boards|managers|businesses|"
                    r"companies|business people|teams|you) (?:should|must|need to|have to|ought to))\b", re.I)
ORDER = re.compile(r"^(?:ask|audit|build|buy|check|cut|find|fix|hire|invest|keep|look|make|map|measure|move|plan|put|"
                   r"read|review|set|sell|spend|start|stop|switch|tell|train|try|use|watch|write)\b", re.I)
ASKS = re.compile(r'\?["’\')]*$')


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9][A-Za-z0-9'’,.%+×-]*", text or '')


# Followable cold (Ruling, Krish, 2026-11-15). Plain heuristics a writer can satisfy by writing a whole sentence.
MULTIPLIER = re.compile(r'\b\d+(?:\.\d+)?\s?[x×]\b', re.I)
NUMBER = re.compile(r'\b\d[\d,.]*\b|%|\b(?:times|twice|double|half|percent)\b', re.I)
UNIT_OR_COMPARATOR = re.compile(
    r'\b(?:per|a|an|each|every)\s+(?:second|minute|hour|day|week|month|quarter|year)s?\b|\bthan\b|\bcompared\b|'
    r'\bfrom\b.+\bto\b|\bin\s+(?:19|20)\d\d\b|\bsince\b|\bof\s+(?:all|every|the)\b|%|\bpercent\b|\bout of\b|'
    r'\b(?:dollars?|pounds?|euros?|people|engineers|workers|users|customers|jobs|companies|firms|hours|days|weeks|months|years)\b', re.I)
CAUSE = re.compile(r'\b(?:because|as|since|after|thanks to|due to|by|so|from|driven by|with|when|while|for)\b', re.I)
OPENS_ON = re.compile(r'^(?:so|but|and|then|or|because)\b', re.I)
VAGUE_START = re.compile(r'^(?:it|they|them|this|these|those|that|one)\b(?!\s+(?:of|in)\b)', re.I)
AUX = set('am is are was were be been being has have had do does did can could will would shall should may might must '
          "isn't aren't wasn't weren't hasn't haven't didn't doesn't don't can't won't couldn't wouldn't it's they're "
          "we're you're that's there's".split())
VERBS = set('ask build builds built buy buys bought break breaks broke broken bring brings brought catch caught change changes '
            'check checks come comes came cut cuts do find finds found fix fixes get gets got give gives gave go goes went '
            'grow grows grew keep keeps kept know knows knew lead leads led lose loses lost make makes made move moves need '
            'needs pay pays paid put puts read reads run runs ran save saves say says said see sees saw sell sells sold send '
            'sends sent set sets ship ships spend spends spent start starts stop stops take takes took tell tells told think '
            'thinks thought try tries use uses wait waits want wants watch watches win wins won work works write writes '
            'wrote written cost costs rise rises rose fall falls fell earn earns hire hires fire fires replace replaces '
            'learn learns plan plans let lets look looks mean means show shows hold holds held leave leaves left'.split())


def has_verb(sentence: str) -> bool:
    for w in words(sentence.lower()):
        w = w.strip(".,'’%")
        if w in AUX or w in VERBS or (len(w) > 4 and w.endswith('ed')) or w.endswith("n't"):
            return True
    return False


def followable_problems(n: int, head: str, line: str) -> list[str]:
    """Why a body card is not one full plain sentence a stranger follows cold."""
    out = []
    if MULTIPLIER.search(head):
        out.append(f'card {n}: "{MULTIPLIER.search(head).group(0)}" is shorthand; write it out ("12 times"), a stranger '
                   'does not read a bare multiplier')
    if not has_verb(head):
        out.append(f'card {n}: the headline has no verb ("{head[:60]}"): a label, not a sentence a stranger can follow')
    if OPENS_ON.match(head):
        out.append(f'card {n}: the headline opens on "{OPENS_ON.match(head).group(0)}", so it leans on the card before '
                   'it; each card is followed alone')
    if VAGUE_START.match(head):
        out.append(f'card {n}: the headline opens on "{VAGUE_START.match(head).group(0)}" with no name for it on the '
                   'card; say who or what')
    sentences = [x for x in re.split(r'(?<=[.!?])\s+', head) if x.strip()]
    if sum(1 for x in sentences if len(words(x)) <= 3) >= 2:
        out.append(f'card {n}: stacked fragments ("{head[:60]}"): one full sentence, never two clipped ones')
    both = f'{head} {line}'
    if NUMBER.search(head):
        if not UNIT_OR_COMPARATOR.search(both):
            out.append(f'card {n}: a number with no unit or comparator ("per month", "than", "of all ..."): a stranger '
                       'cannot tell what it counts')
        if not CAUSE.search(head):
            out.append(f'card {n}: a number with no cause in its sentence ("because ..."): say why it moved')
    return out


# The last card is the brand palette's close (config/brand-palette.json, house_close_slide): the piece's takeaway, then
# "Follow for more" with the Make Your Mind Up wordmark centred under it (Ruling, Krish, 2026-11-18: "The last card of
# the carousel should always have the "Make Your Mind Up" word mark centred under the "Follow for more" text, as opposed
# to the word mark in the bottom-right corner and an amateur call to action"; it replaces the 14 Nov "Subscribe free"
# close). Saturday's good news keeps his fixed close (good_news_close).
HOUSE_CLOSE = 'Follow for more'
GOOD_NEWS_CLOSE = 'If this inspires you to MAKE THE WORLD BETTER by combining your ideas + AI, follow for more'


def close_problems(deck: dict, cards: list, ladder: bool = False) -> list:
    last = cards[-1] if cards and isinstance(cards[-1], dict) else {}
    foot = ' '.join(str(last.get(k) or '') for k in ('line', 'cta')).lower()
    if deck.get('good_news') is True:
        if GOOD_NEWS_CLOSE.lower() not in foot:
            return [f'the last card is the good-news close: "{GOOD_NEWS_CLOSE}" over the centred mark']
        return []
    out = []
    if not str(last.get('headline') or '').strip():
        out.append('the last card leads with the piece\'s landing as its headline (house_close_slide)' if ladder
                   else 'the last card leads with the piece\'s takeaway as its headline (house_close_slide)')
    if 'follow for more' not in foot:
        out.append(f'the last card ends on the palette\'s close: the takeaway, then "{HOUSE_CLOSE}" with the wordmark '
                   'centred under it (house_close_slide)')
    if 'subscribe free' in foot:
        out.append('the last card says "Follow for more" over the centred wordmark, not "Subscribe free" (Krish, 18 Nov '
                   '2026: "an amateur call to action")')
    return out


def _sourced(source) -> bool:
    """A Why's source: its words (who said it, dated) or its link, or {"label"/"url": ...}."""
    if isinstance(source, dict):
        return any(str(source.get(k) or '').strip() for k in ('label', 'url', 'name'))
    return bool(str(source or '').strip())


def ladder_problems(deck: dict) -> list[str]:
    """carousel-deck/2: the why-ladder before any card, every Why with its question, its answer and its source; 3 to 7
    of them, fewer than 3 only when the last says why the ladder stopped (its "stop"), never padded to five."""
    whys = [w for w in (deck.get('five_whys') or []) if isinstance(w, dict)]
    if not whys:
        return [f'climb the Whys before writing a card ("five_whys": {LADDER_WHYS[0]} to {LADDER_WHYS[1]} of '
                '{"q", "a", "source"}; five is the target)']
    out = []
    if len(whys) > LADDER_WHYS[1]:
        out.append(f'{len(whys)} Whys: merge sub-steps so the ladder climbs {LADDER_WHYS[1]} at most (five is the target)')
    if len(whys) < LADDER_WHYS[0] and not str(whys[-1].get('stop') or '').strip():
        out.append(f'{len(whys)} Whys: fewer than {LADDER_WHYS[0]} needs the "stop" that ended the ladder on the last one '
                   '(evidence_exhausted, out_of_scope and so on), never padding')
    for n, w in enumerate(whys, 1):
        if not str(w.get('q') or '').strip():
            out.append(f'Why {n} has no question ("q")')
        if len(words(str(w.get('a') or ''))) < 4:
            out.append(f'Why {n} has no answer of at least 4 words ("a")')
        if not _sourced(w.get('source')):
            out.append(f'Why {n} names no source: on a carousel-deck/2 every Why carries its "source"')
        stop = str(w.get('stop') or '').strip()
        if stop and stop not in LADDER_STOPS:
            out.append(f'Why {n}\'s stop is "{stop}", not one of {", ".join(LADDER_STOPS)}')
        if stop and n < len(whys):
            out.append(f'Why {n} stops the ladder ({stop}) but Why {n + 1} climbs past it')
    return out


def landing_problems(deck: dict, cards: list) -> list[str]:
    """carousel-deck/2: the landing card says what this shows and hands the viewer an open question, ending "?", and
    never tells business people what to do."""
    arc = deck.get('arc') if isinstance(deck.get('arc'), dict) else {}
    out = []
    if 'do' in arc:
        out.append('a why-ladder deck lands on what this shows and an open question, never what to do: name the card '
                   '"landing" in the arc, not "do"')
    at = arc.get('landing')
    at = [i for i in (at if isinstance(at, list) else [at]) if isinstance(i, int) and 1 <= i <= len(cards)]
    if not at:
        return out
    landed = [cards[i - 1] if isinstance(cards[i - 1], dict) else {} for i in at]
    if not any(ASKS.search(str(c.get(k) or '').strip()) for c in landed for k in ('headline', 'line')):
        out.append('the landing hands the viewer no open question: the landing card ends on a question ("?")')
    for i, card in zip(at, landed):
        for k in ('headline', 'line'):
            for sentence in re.split(r'(?<=[.!?])\s+', str(card.get(k) or '').strip()):
                if not sentence or ASKS.search(sentence):
                    continue
                said = LESSON.search(sentence) or ORDER.match(sentence)
                if said:
                    out.append(f'card {i}: the landing tells business people what to do ("{said.group(0)}"): land on '
                               'what this shows and an open question for the viewer, never a lesson or an action')
    return out


def problems(deck: dict) -> list[str]:
    out: list[str] = []
    if deck.get('schema') not in SCHEMAS:
        out.append('not a carousel-deck/1 or carousel-deck/2 file')
    cards = deck.get('cards')
    if not isinstance(cards, list) or len(cards) < 2:
        return out + ['a deck needs a cover and at least one card after it']
    if len(cards) > MAX_CARDS:
        out.append(f'{len(cards)} cards: at most {MAX_CARDS}, the cover and the call-to-action card included')
    # The story route (Krish, 2026-11-13: "Nobody knows what Git is. No one knows why Anthropic did this. No one knows
    # why it's important to basic people or what could change as a result ... Ask why five times"; "the 'so what' is
    # missing ... That's where the gold dust lies"): five whys first, then a card for each step, in order.
    ladder = deck.get('schema') == 'carousel-deck/2'
    steps, says = (LADDER_ARC, LADDER_ARC_SAYS) if ladder else (ARC, ARC_SAYS)
    if ladder:
        out.extend(ladder_problems(deck))
    else:
        whys = [w for w in (deck.get('five_whys') or []) if isinstance(w, dict) and str(w.get('q') or '').strip() and len(words(str(w.get('a') or ''))) >= 4]
        if len(whys) < 5:
            out.append(f'ask why five times before writing a card ("five_whys": five questions with their answers; {len(whys)} given)')
    arc = deck.get('arc') if isinstance(deck.get('arc'), dict) else {}
    placed = []
    for step in steps:
        at = arc.get(step)
        at = at if isinstance(at, list) else [at]
        at = [i for i in at if isinstance(i, int) and 1 <= i <= len(cards)]
        if not at:
            out.append(f'no card says {says[step]} ("arc": {{"{step}": <card number>}})')
        else:
            placed.append((step, min(at)))
    order = [step for step, _ in sorted(placed, key=lambda x: x[1])]
    if order != [step for step, _ in placed]:
        out.append('the story runs out of order: what it is, what happened, why, the wider trend, then '
                   + ('what this shows and its open question' if ladder else 'what to do'))
    so = arc.get('so_what')
    so = so if isinstance(so, list) else [so]
    if not any(isinstance(i, int) and 1 <= i <= len(cards) and str((cards[i - 1] or {}).get('source') or '').strip() for i in so):
        out.append('the wider-trend card names its evidence ("source" on that card): a trend is shown, never asserted')
    if ladder:
        out.extend(landing_problems(deck, cards))
    out.extend(close_problems(deck, cards, ladder))
    jargon = json.loads(WORDS.read_text(encoding='utf-8'))['jargon'] if WORDS.is_file() else []
    explained = {k.lower() for k in (deck.get('explains') or {}) if str((deck.get('explains') or {})[k]).strip()}
    total = 0
    for n, card in enumerate(cards, 1):
        card = card if isinstance(card, dict) else {}
        head = str(card.get('headline') or '').strip()
        count = len(words(head))
        total += count
        line = str(card.get('line') or '').strip()
        if n == 1 and not HEADLINE_WORDS[0] <= count <= HEADLINE_WORDS[1]:
            out.append(f'card {n}: the cover headline has {count} words; a cover reads in a glance, '
                       f'{HEADLINE_WORDS[0]} to {HEADLINE_WORDS[1]}')
        if n > 1 and not BODY_HEADLINE_WORDS[0] <= count <= BODY_HEADLINE_WORDS[1]:
            out.append(f'card {n}: the headline has {count} words; a card carries one full plain sentence of '
                       f'{BODY_HEADLINE_WORDS[0]} to {BODY_HEADLINE_WORDS[1]} words a stranger can follow, never a '
                       'paragraph (Ruling, Krish, 2026-11-15)')
        if n > 1 and not re.search(r'[.!?]["’\')]*$', head):
            out.append(f'card {n}: the headline is not a whole sentence ("{head[:60]}"): a label is not a story')
        if n > 1:
            out.extend(followable_problems(n, head, line))
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
        out.append(f'the headlines total {total} words; at most {DECK_HEADLINE_WORDS}, one plain sentence a card')
    told = [r for r in (deck.get('read_back') or []) if isinstance(r, dict) and str(r.get('reader') or '').strip()
            and all(len(words(str((r.get('answers') or {}).get(step) or ''))) >= 3 for step in steps)]
    if len(told) < READERS:
        out.append(f'{READERS} fresh readers must see only the headlines, in order, once, and answer in their own words '
                   'what it is, what happened, why, why it matters to them and '
                   + ('what it shows and the question it leaves them with' if ladder else 'what to do')
                   + f' ({len(told)} given)')
    return out


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--cards']:
        import carousel_layout
        found, cards = carousel_layout.problems(argv[1:])
        for p in found:
            print(f'carousel_check: {p}')
        if not found:
            print(f'carousel_check: the {len(cards)} cards pass the cover, space, centring and richness bars '
                  '(proxies: look at them at full size and at phone size before calling them done)')
        return 1 if found else 0
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
