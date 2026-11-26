---
name: carousel
description: "Make any makeyourmindup carousel (off-day utility, AI tips, Saturday good news, a series piece's carousel) from the locked v5 Library, held to the 3-second carousel format as a refusal floor, with creative freedom only above it. The floor is checked, never trusted: the deck check, the one make route, the drawn-slide check, the 10/10 judges and a full look at phone size. Use whenever a carousel is made, redrawn or reviewed, by any session, Growth's included. Not for covers or thumbnails (cover-art), memes (meme) or Notes images."
model: opus
---

# Make a carousel

Krish, 2026-11-26, relayed verbatim: "Tell the Content-engine story intelligence for makeyourmindup v5 session that it
is to enforce carousel formatting." Sessions do not go off piste. **The floor** is the 3-second format: rows in
`config/carousel-format.json` (from the Library's `CAROUSEL-FORMAT.md`, `TITLES.md` and `library.json`), each a
refusal that fails the run, never a warning. **The freedom** is everything above it. The reader and the Library rules
are `references/reader.md`; read it once per session.

## The floor (refused by `scripts/carousel_check.py`, never waived)

1. **4 to 7 slides**: the cover, 3 to 5 inside, the close, in the Library set's registry order (`library.json`
   `carousel_sets`: piece, good-news, simple-advice, how-to, explainer, quiz, meme). The piece carousel is 6: cover,
   chart (slide 2 carries the answer on its own), document, why-3, why-1, close. Good news carries 4 items.
2. **The cover** comes only from `make_covers.py`: a headline of 10 words or fewer and 50 characters or fewer, in one
   of his title shapes (`TITLES.md`), 120 px or more at 1080 wide; one dominant hero visual plus the wordmark.
3. **Each inside slide**: one glance line of 8 words or fewer at 96 px or more; 15 words at most on the slide, 50
   across all inside slides; one dominant visual on at least half the slide; a statement, never a question (the quiz
   set's question slide is the one exception). Slide 2 stands alone: never opens on "this", "it" or "as above".
4. **The close**: the takeaway (44 characters or fewer, two lines, its payoff in mint), the S3h wordmark and the site.
   Never "Follow for more": the follow ask goes in the caption.
5. **How-to**: one step a slide, 5 at most, the real screenshot as the dominant visual, an overlay prompt of 5 words
   or fewer.
6. **Nothing below 34 px anywhere.** No badges, labels, pills or toasts; no em dashes or exclamation marks; never his
   name, mind/make, Mindmake, CTRL or "AI Brain".
7. **The Library is the only artwork.** Headlines in Fraunces (Anton only as one cover kicker); imagery in the
   Library's order: a licensed photo of the named person in their own story, the real thing, then a photoreal still
   (no generated people, no readable logos or text).

When `docs/ve/cards/library/library.json` is on the checkout the check reads its slot limits too and takes the
stricter; `tests/carousel_format_test.py` fails if the rows and the Library disagree.

## The freedom (expected, above the floor only)

Each carousel tries one thing the last ones did not, inside the format: a sharper title shape, a better proof crop, a
bolder number, a different hero. Name the experiment in one line in the report to Krish. If an idea needs a floor
line broken, ask him first; a new device goes to the Library first, never into one piece.

## Steps

1. Read the brief, the reader (`references/reader.md`), the inspiration cards he ticked and
   `python3 scripts/floor.py --format carousel`.
2. Write the deck as `carousel-deck/3` (the schema is in `scripts/carousel_format.py`); offer him title options in his
   shapes; pass `python3 scripts/carousel_check.py DECK.json`. The two older deck schemas are retired and refused.
3. Make it only with `python3 scripts/carousel_make.py <piece> --set <set> --deck DECK.json --out <folder>`: it
   checks the deck, calls `scripts/library/make_piece.py <piece> --set <set>` and `scripts/covers/make_covers.py`
   by path, checks the drawn slides and writes `carousel-receipt.json`. Absent Library: stop and say "the v5 Library
   is not on this checkout yet"; never another renderer, never a Codex carousel card (`ve card` refuses the kind).
4. Verify: `python3 scripts/carousel_check.py --cards --deck DECK.json <slides>`, the 10/10 judges
   (`scripts/post-pack/judge_assets.py`), a look at every slide at full size and at phone size.
5. The manifest draft carries the passing receipt (`carousel_receipt`); a carousel that fails is not approvable.
   File through `send.py` to `3 Posts`, report on the board and record his words. Nothing is posted without his yes.
