---
name: carousel
description: "Make any makeyourmindup carousel (off-day utility, AI tips, Saturday good news, a series piece's carousel) to a guaranteed floor that every past failure is folded into, with the creative freedom to beat it above that floor. The floor is checked, never trusted: the deck check, the drawn-card check, two cold readers, the 10/10 judges and a full look at phone size. Use whenever a carousel is made, redrawn or reviewed, by any session, Growth's included. Not for covers or thumbnails (cover-art), memes (meme) or Notes images."
model: opus
---

# Make a carousel

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

**Imagery: never bland**

6. Every card shows its point as a picture of real size (at least 12% of the card), never type on plain ground; the
   page is used centrally, no empty band over 12%, nothing outside the safe box. `carousel_check.py --cards`.
7. An original visual idea per story, real-world texture over a headline on a square. Real logos only for companies
   the card names, monochrome or on a light tile when dark. Real people in a generated picture recognisable, from
   their real photos as references; a generated robot is only the house felt robot (`cover_scene.py check`).
8. Body type at least 35 px of ink on the 1080 card. `carousel_check.py --cards`.

**Cover: grabs the thumb** (15 Nov: "the front cover card does not look like a front cover")

9. Card 1 is a full-bleed scene of one funny, specific moment that carries the idea at a glance; never a headline on
   plain ground, a logo row or a chart. Its headline at least 1.3 times the body cards' and its layout different in
   two of three ways. `carousel_check.py --cards`.
10. Card 1 says in plain words what happened and why it matters; nothing cryptic. Before showing Krish, look at it at
    phone size beside the last approved covers: if it would not stop a thumb, it is not ready.

**Brand and close**

11. Colours, type and marks only from `config/brand-palette.json`; no series colour or name unless the carousel
    carries that week's series piece. The mark is the official file, small in a bottom corner, never type.
12. The last card is the palette's close: the takeaway, one picture, "Subscribe free (makeyourmindup.ai)", the
    wordmark small bottom right. Saturday good news keeps its own fixed close. `carousel_check.py`.
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
3. Write the Codex card (`ve card`, kind `carousel`, with `references`, `date`, `deck`) and dispatch it.
4. Verify: `carousel_check.py --cards`, the judges, a full-size and phone-size look. Fix and recheck the whole arc.
5. File through `send.py` to `3 Posts`, report on the board, send Krish the cards, and record his words.
