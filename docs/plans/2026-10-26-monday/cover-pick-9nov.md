# Monday 9 Nov covers and thumbnails: Krish's pick

Piece b358e788 (follow.the.money, "Why is Disney eating the scraps of bankrupt Character.AI?"), moved from 26 Oct to
Monday 9 Nov. This week's series skin is neon (`scripts/pages/skins`, the first week of the rotation).

## The options he saw (7 Nov 2026)

Three options per surface, all drawn by `scripts/pages/build.py --cover --thumbs` in the neon skin. Every headline
is a set of words he had already picked for this piece on 26 Oct (`config/title-verdicts.json`). The drawer refuses
words he has not picked, so no new words were drawn.

| Option | Facts | Thumbnails (wide and tall) | Article cover set |
|---|---|---|---|
| A | `cover-facts-9nov-a.json` | DISNEY IS HIRING CHARACTER.AI'S TEAM, over the court filing | DISNEY IS EATING THE SCRAPS OF BANKRUPT CHARACTER.AI, over the court filing (Disney ringed) |
| B | `cover-facts-9nov-b.json` | GOOGLE PAID $2.7B FIRST, over the paper-trail timeline | the same words and timeline |
| C | `cover-facts-9nov-c.json` | GOOGLE PAID $2.7B FIRST, over the renting-to-owning figure | the title words, over the same figure |

Each was shown to him in a mock Instagram profile grid (3:4 tiles, beside the last five posts: Sat 7, Fri 6, Thu 5,
Wed 4 and Mon 2 Nov, from their 3 Posts folders), a YouTube results row (beside Wed 4 and Mon 2) and the tall
cover with every channel's buttons and text shaded (`config/channel-safe-zones.json`).

## His pick

He chose "B thumbs + A article (Recommended)" (7 Nov 2026, in answer to a question in the session).
`cover-facts-9nov.json` is that pick: the cover set from A and the thumbnails from B. A fresh draw from it gave the
same bytes as the options he saw:

| File | sha256 |
|---|---|
| cover-1200x630.png (Substack upload) | 3d55409edc654f273c8d5d14981b8cc94e42d712746fe46d2ed340453d0e451a |
| cover.png (feed, 1200x800) | 3e332c296a2e63266093eb7b126fead0200f6b1f9e026c9d8e7593e691fcaf09 |
| cover-1200x675.png (share card) | a12e015c8db5bbe154e1fa8b4572efbb95d5e162883729e4c62162a9207e7890 |
| cover-1080x1080.png (square) | 259c7d78e996cb6f2e4843b73ae3cbafdbf1c5aded6a2eca32c775376b9c01e5 |
| cover-1080x1920.png (vertical cover) | 33258ee27de84676187e8fcbfc0ac877696fc71b95aabf1a908de36f26e29a27 |
| thumb-wide-1280x720.jpg | cb660fe5a690aaf73fa375220880122b1ad255cc7ae510d0ba1daca1419e410c |
| thumb-tall-1080x1920.jpg | 57cdfb6be06836e58a9d1b3acceacdcb61eebe2b18391ca5c2ea364400e5bc2b |

## Checks

- Grid crop: no word on the tall thumbnail or the vertical cover is cut by, or outside, Instagram's 3:4 grid crop
  (y 240 to 1680), read with tesseract.
- `scripts/channel_safe.py`: the vertical cover (A) is clear. On the tall thumbnail (B) the headline, wordmark and
  pill are clear of every zone; two words are flagged: small print inside the timeline figure under Instagram's
  like rail, and the logo strip's small print under the caption area (y 1320 and below). The tall design's safe box
  (`receipt.SHAPES['tall']`, y 260 to 1660) is drawn for the grid tile, not for the Reel's own buttons, so the
  logo strip always lands in Instagram's caption zone. That gap is for the guards session, not fixed here.
- Option A's tall thumbnail put its second headline line under Instagram's action rail; it was not picked.

## Not done: filing

The files are not in the post's 3 Posts folder and not on Monday's board. A cloud session reaches Drive only
through the connector, which needs each file's bytes inline (4.3 MB for the set), and the engine API answers 401
here, so the board cannot be written either. Krish has the seven files in the session. Next, on a home computer:

1. `python scripts/pages/build.py docs/plans/2026-10-26-monday/cover-facts-9nov.json --out <scratch> --cover --thumbs`
   and compare against the hashes above (fonts can differ by machine; if a hash differs, look at it beside the
   one he saw before filing).
2. File them in `3 Posts > 2026-11-09 Mon follow.the.money - Disney, Google and Character.AI`: the covers in
   `2 Covers and images`, the thumbnails in `3 Video`, under the names its READ ME uses; read them back.
3. Point `mon-thumb-wide` and `mon-thumb-tall` in `docs/plans/2026-11-09-week/board-assets.json` at the new files
   and their hashes, and rebuild the board through `week_board.py`.
