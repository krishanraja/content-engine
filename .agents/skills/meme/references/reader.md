# A meme's reader, and the Library it is made in

Read from the `meme` skill (`SKILL.md`, lines 8 and 10).

## The reader's world (Ruling, Krish, 26 November 2026)

His words: "Make sure all the good news suggestions and meme suggestions are also aligned to the new positioning, as
well as the carousels." The reader is the North Star line in `config/beat.json` `reader` (his "I approve the lines",
26 Nov): people who make the calls or make the work in the creative, arts, music, entertainment, media and sports
industries. A meme's subject is `config/beat.json` `offdays.meme`; read it there, never from a copy:

- AI in their world: the studio, the label, the session, the shoot, the edit, the gallery, the stage, the tour, the club,
  the league, the matchday, the creator's channel, and the AI hype around them;
- never office or enterprise AI: the inbox, the spreadsheet, the meeting, the boss, the copilot at work. A caption that
  only lands in an office is rewritten into their world or not made;
- the joke is aimed at the AI or the hype, never at the reader, an artist or a fan.

His own caption is the one used, and text he puts in quotation marks is printed verbatim; when his caption is set in
another world, it is his call, not this file's. The ideas gate holds the suggestions to this from the story score's board
(`board_feed.py gate`, code `off_beat`).

## The v5 Library is the only artwork

The v5 Library is locked (26 Nov 2026; Krish approved the cover systems: "I approve the new cover thumbnail systems,
go"). Once it is on this checkout, a static meme is made only from its templates:

    python scripts/library/make_piece.py <piece> --set meme

and a cover or thumbnail only from `python scripts/covers/make_covers.py <piece> --out <folder>`. No second renderer and
no per-piece look: the Library replaces the Codex card of line 8. Its rules hold: headlines in Fraunces (Anton only as
one cover kicker), no badges, labels, pills or toasts anywhere, sources as plain links and credits as quiet captions, a
licensed photo of a named person in their own story first, then the real object, company or venue, then a photoreal
still of the specific thing (no generated people, no readable logos or text).

When `scripts/library/make_piece.py` is not on the checkout, stop and say "the v5 Library is not on this checkout yet";
never fall back to a Codex card, a Higgsfield picture or any other renderer. A meme video (a template reskin) stays on
the ve route of lines 1 to 7.
