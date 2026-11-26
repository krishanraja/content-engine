# A carousel's reader, and the Library it is made in

Read from the `carousel` skill (`SKILL.md`, its opening and steps 1 and 3).

## The reader's world (Ruling, Krish, 26 November 2026)

His words: "Make sure all the good news suggestions and meme suggestions are also aligned to the new positioning, as
well as the carousels." The reader is the North Star line in `config/beat.json` `reader` (his "I approve the lines",
26 Nov): people who make the calls or make the work in the creative, arts, music, entertainment, media and sports
industries, reading on what AI is doing to how their work makes money. Read the lines in `config/beat.json` `offdays`,
never a copy:

- **Off-day utility, AI tips and how-tos** (`offdays.carousel`): a tool, a deal, a price or a move someone in those
  industries can use in their own work this week, named in their terms (a session, a release, a rights deal, a matchday,
  a channel), never a generic office tip. Pick the sheet carousels to model on with that reader in mind.
- **Saturday good news** (`offdays.good_news`): people in those industries doing, earning or making more with AI, named,
  with the number that shows it where there is one. A hospital, a farm or a council story is not this reader's good news.
- **A series piece's carousel**: the piece's own story, already on the beat (`config/beat.json` `focus_sectors`).
- The tone is `config/beat.json` `tone`: what AI lets makers, performers and the businesses around them do, earn and
  express, with the economics inside. Governance, security, breaches and enterprise productivity with no creative angle
  are off the beat.

The ideas gate holds the suggestions to this from the story score's board (`board_feed.py gate`, code `off_beat`); a
carousel made from an approved option still checks its own words against it before drawing.

## The v5 Library is the only artwork

The v5 Library is locked (26 Nov 2026; Krish approved the cover systems: "I approve the new cover thumbnail systems,
go"). Once it is on this checkout, a carousel is made only from its templates, one set per kind
(`library.json` `carousel_sets`: `piece`, `good-news`, `simple-advice`, `how-to`, `explainer`, `quiz`, `meme`):

    python scripts/library/make_piece.py <piece> --set <set>

and its cover and thumbnails only from `python scripts/covers/make_covers.py <piece> --out <folder>` (it writes
`covers.json`, which post-pack reads as `cover_set`). That replaces steps 3 and 4 (the Higgsfield scenes and the Codex
card): no second renderer, no per-piece look. Its rules hold: headlines in Fraunces (Anton only as one cover kicker), no
badges, labels, pills or toasts anywhere, sources as plain links and credits as quiet captions, and the imagery order: a
licensed photo of a named person in their own story (never beside an accusation against their company), then the real
object, company or venue, then a photoreal still of the specific thing (no generated people, no readable logos or text).

Every carousel goes through `python3 scripts/carousel_make.py <piece> --set <set> --deck DECK.json --out <folder>`,
which holds the deck and the drawn slides to the 3-second format (`config/carousel-format.json`; Krish, 26 Nov 2026:
"Tell the Content-engine story intelligence for makeyourmindup v5 session that it is to enforce carousel formatting")
and calls both Library commands by path. When `scripts/library/make_piece.py` is not on the checkout it stops and says
"the v5 Library is not on this checkout yet"; never fall back to a Codex card, a Higgsfield picture or any other
renderer. The deck check of step 2 still applies.
