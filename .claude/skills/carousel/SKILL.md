---
name: carousel
description: "Make any makeyourmindup carousel (off-day utility, AI tips, Saturday good news, a series piece's carousel) to a guaranteed floor that every past failure is folded into, with the creative freedom to beat it above that floor. The floor is checked, never trusted: the deck check, the drawn-card check, two cold readers, the 10/10 judges and a full look at phone size. Use whenever a carousel is made, redrawn or reviewed, by any session, Growth's included. Not for covers or thumbnails (cover-art), memes (meme) or Notes images."
model: opus
---

# Make a carousel

**Every carousel is filled from an approved Library carousel set**, never drawn freehand: `python3
scripts/library/make_piece.py docs/plans/<plan> --set <set>` (sets: piece, good-news, simple-advice, how-to, explainer,
quiz, meme; `docs/ve/cards/library/library.json`, `carousel_sets`). Read `docs/ve/cards/library/ART-DIRECTION.md`
first, then `LIBRARY-GUIDE.md`, `PRODUCTION-PLAYBOOK.md` and `CAROUSEL-FORMAT.md`. The piece supplies every slot's
words in its cover facts (`"library": {"<template id>": {"<slot>": "words"}}`) and its pictures (`"images"`, made per
piece as IMAGERY.md says); make_piece refuses a slot the piece did not fill, and a template whose data device still
carries the Library's sample numbers. The floor below still applies to what it renders.

Krish, 2026-11-17: "we essentially need one skill the system uses by guarantee to meet minimum standards but can still
use its creative freedom to improve upon and experiment with." So this skill has two halves. **The floor** is every
lesson a past carousel paid for; each item names the check that enforces it, and no carousel ships with one unmet.
**The freedom** is everything above it, where each carousel should try something new and say what it tried. The
full rules and their history are `docs/CAROUSEL-STANDARD.md`; read it once per session, it wins where this differs.

## The floor (guaranteed; each line is checked)

**Story: understood cold, card by card** (his words, 13 Nov: "a complete layperson is swiping through these cards at
light speed and needs to be able to follow the story within 10 seconds. This cannot ever happen again").

1. Ask why five times and find the wider trend, proved from outside the story; then tell it in order: what the thing is,
   what happened, why, the trend, what to do this week. `carousel_check.py DECK.json` (five_whys, arc, source).
2. Every card after the cover is one full plain sentence of 8 to 20 words that a stranger follows **with zero context
   from any other card**: it names its subject, has a verb, gives a number its unit and cause; no "it", "they" or
   "this" for a name; no opening on So, But, And, Then, Or, Because; no "12x" (write "12 times"); no fragments; no
   jargon a layperson lacks (`config/carousel-plain-words.json`). Cover 3 to 12 words; at most 160 in the deck.
   `carousel_check.py`.
3. Two fresh readers see only the headlines, once, and say what it is, what happened, why, why it matters and what to
   do; every stall is fixed before drawing. The deck's `read_back`.
4. At most 10 cards including cover and close. No card numbers anywhere. `carousel_check.py`.
5. Off-day carousels give real utility at the level of his Instagram inspo sheet: a scroll-stopping headline and cover,
   cards the reader can use the same day (`aim: utility`, the ideas gate). Copy, branding and imagery are always ours.

**Imagery and cover (checks 6 to 10)**

Read `.agents/skills/carousel/references/imagery-and-cover.md` before sourcing pictures or drawing card 1.
Apply its safe box, picture and type measurements to every card with `carousel_check.py --cards`. Compare
the cover with the last approved covers at phone size before showing Krish.

**Brand and close**

11. Colours, type and marks only from `config/brand-palette.json`; no series colour or name unless the carousel
    carries that week's series piece. The mark is the official file, small in a bottom corner, never type.
12. The last card is the palette's close: the takeaway, one picture, then "Follow for more" with the wordmark centred
    under it, no corner mark (Krish, 18 Nov). Saturday good news keeps its own fixed close. `carousel_check.py`.
13. No footnotes, source strips, dates or tiny URLs on the art; sources go in the caption.
14. An approved track from its group (`trackGroup`: good news funky house, tips and explainers gym), picked by Krish.

**Proof, not receipts**

15. The 10/10 judges pass it, shown every card (`POST /api/board/<Monday>/judge`). Then a look at every card at full
    size and at phone size by this session. Codex's own report is never proof.
16. Read `python3 scripts/floor.py --format carousel` before the brief and check the finished cards against it.

## The freedom (expected, not optional)

Above the floor, each carousel should try one thing the last ones did not: a new visual device, a new card rhythm, a
bolder cover idea, a different way to show a number, a format borrowed from the inspo sheet and made ours. Name the
experiment in one line in the deck (`experiment`) and in the report to Krish, with what it is meant to improve. Never
experiment with the floor itself; if an experiment needs a floor line broken, ask him first.

## Steps

1. Read the brief, the standard, the floor and the inspiration cards he ticked (F26).
2. Write the deck (`carousel-deck/1`), run the cold read, pass `carousel_check.py DECK.json`.
3. Pictures for every card, real-world first: a real photo, screen or document the story names; else one photoreal
   scene per card on Higgsfield (`gpt_image_2_6`, 4:3, about 0.25 credits each; say the cost first), never a robot:
   the felt robot is retired with v5 (`docs/ve/cards/library/FLOOR.md`). The company's official wordmark from Brandfetch when the story names one.
4. Fill the set: `python3 scripts/library/make_piece.py docs/plans/<plan> --set <set> --out <work folder>` with the
   deck's words and the pictures in the cover facts' `"library"` block. It writes `carousel/slide-NN.png` and
   `post-pack-files.json`. Codex makes only the per-piece pictures the slots take (a `ve card` for the plates).
5. Verify: `carousel_check.py --cards`, the judges, a full-size and phone-size look. Fix and recheck the whole arc.
6. File through `send.py` to `3 Posts`, report on the board, send Krish the cards, and record his words.
