# The cover and thumbnail standard (headline first, fewest parts)

Status: approved. Krish, 2026-11-09: "approve the cover standard as written". It binds every cover and thumbnail made
from now on. It reaches the rejection floor (`floor.py --format cover`) through the Rejections engine
(krishanraja/inspirationhouse), which alone writes `config/rejection-floor.json`; the cover drawer's defaults
(`scripts/pages/receipt.py`, the skins) follow it from branch `claude/mon-9nov-covers` once the freeze lifts (16 Nov).

Applies to: series covers and thumbnails (16:9 long, 9:16 tall, Substack cover, share card, square) and the first frame
of every tall cut. Carousel card 1 keeps its own rule ("the cover card is a scene, not a slide",
`docs/CAROUSEL-STANDARD.md`), with points 1, 5 and 6 below added.

## Why

- Krish, 9 Nov, on Monday's first neon set: "these look terrible. There are so many components here. The headline
  should take precedence. We don't need Warner, Universal, and OpenAI logos anywhere on here. We don't need the badge
  that says "the court filing." The "Follow the Money" badge doesn't need to be that big."
- Krish, 7 Nov: "I also think that the thumbnails need to be managed better. You can see that the Chinese AI thumbnail
  is not really at the top of its game." (dark stock photo, low-contrast headline, top line cut by the Instagram grid.)
- What did well: on the 7 Nov grid, the bright tiles with one big headline and one real thing (Monday 2 Nov's chart,
  the "What could you hand to AI this week?" carousel) beat the dark photo covers.
- Cause: the cover drawer adds every logo, a proof tag and a large series pill by default. Nothing asked for the
  headline to lead or for each part to earn its place.

## The standard

1. **The headline leads.** It is the largest thing on the cover and readable in under a second at grid size
   (about 130 px wide on a phone). At most 7 words; one word may be picked out in the series colour.
2. **At most three parts besides the headline**, chosen from: one picture (the real artifact or a scene), up to three
   logos, the series label. The default is fewer: anything that does not make the headline land faster is left off.
3. **Logos only for the companies the headline or the picture names.** Never a logo for a company the story only
   mentions in passing (so Google, Disney and Character.AI on 9 Nov; never Warner, Universal or OpenAI). Always the
   product's own mark, never a parent company's (already approved). Logos sit below the headline, smaller than it.
4. **No badges or proof tags on a cover** ("the court filing", "source", "exclusive"). The proof is in the piece.
5. **The series label is quiet:** small, in the series colour, at most about 4% of the cover's height, never a large pill.
6. **Bright and high-contrast over dark and muddy.** The house ground or the series colour, the headline at full
   contrast. No dark stock photo behind the headline.
7. **Checked where it will be seen** before Krish sees it: the Instagram profile grid crop (3:4 of the tall cover) and
   account row, the caption zone, and a YouTube results row, using `scripts/channel_safe.py`. Nothing important under
   a button or cut by the crop, including the logo row.
8. **Two or three options, never one,** each shown in a mock of his grid beside the last five posts.

## What changes in the drawer if approved

- `receipt.py` defaults flip: no proof tag, quiet series label, headline first, logos only from a `named` list in the
  cover facts (empty by default). The Monday covers session already wrote this on branch `claude/mon-9nov-covers`
  (commit 798e155, unmerged under the freeze): `show_tag`, `quiet_pill`, `headline_first`.
- The tall safe box moves the logo row out of Instagram's caption zone (found on every tall thumbnail, 9 Nov).
- `channel_safe.py` gains the grid crop check (the on-screen checks merged 7 Nov list it from 14 Nov).

All of this lands after the freeze (from 16 Nov) unless he says otherwise.

## One older approval this narrows

On 10 Oct he said: "I love it, but we need to add all the logos of the busineses that are related to what we are
talking about." Point 3 narrows "related" to the companies the headline or picture names. If he wants the wider rule
kept for some formats, say which.

## His answer

Approved as written, so the ceilings stand: 7 words (point 1) and three logos at most (point 3).
