# Handover: Friday "two passports", lock everything Claude owns, then hand video production to Codex

Written 24 October. Krish: "the videos are recorded, can you get the scripts and the visual creative direction locked
so that codex can take over on the video production, and ensure that it does a great job of producing the final
publish board? the copy of the article and what goes in the visuals etc is all Claude responsibility".

## Start the new session with

> Pick up docs/handovers/2026-10-24-friday-lock-for-codex.md. The videos are recorded. Lock the scripts, the visual
> copy and the article, then hand video production and the final publish board to Codex.

Read first: `docs/handovers/2026-10-23-friday-production.md` (where everything is),
`docs/plans/2026-10-23-friday/creative-direction.md` (the four videos, beat tables, asset list, truth rules).

## Who owns what (Krish's split)

- **Claude (this job):** every word. The scripts as recorded, every caption, label, card field and chart number on
  screen, the article, and the copy on the publish board. Nothing Codex makes may carry a word Claude did not lock.
- **Codex (next job):** the four videos and the final publish board, built only from what Claude locks here, through
  `produce-video` and the board feeder. Codex invents no copy, fact or picture choice.

## Claude's steps, in order

1. **The takes.** Fetch all four (`recording.py get`; Video Engine Inbox). Name each (long or short; on camera or
   voiceover) and line it up with its own words (`narration_diff.py`). The Teleprompter scripts were sent by hand, so
   the lane did not stamp them. Where he changed a line, the take wins: update the script file to what he said.
2. **Lock the scripts.** Write `docs/plans/2026-10-23-friday/locked/` with the four scripts exactly as recorded, each
   with its take's file name and duration. These are what Codex cues against.
3. **Lock the visual copy.** `docs/plans/2026-10-23-friday/locked/visual-copy.json`: for every beat of each video, in
   order, with the take's start and end seconds: the picture (asset id from the creative direction's asset list), the
   caption (two or three words), the source label, the exact sentence to highlight, the passport card fields, and
   every chart number with its source. Every value traceable to `research-gaps.md`, `test-results/` or the takes.
   Ask Krish one question: was the DeepSeek moment screen-recorded? (If not: the labelled replay.)
4. **The storyboard, for Krish's sign-off** (his words, 23 Oct: "Once I've recorded show me your creative storyboard
   before I sign that off"). One frame per beat for all four, from real captures, on the Friday tab through the
   feeder. Record his words; nothing goes to Codex before them.
5. **The article.** 1,000 to 1,400 words, from the signed narrative and the test; ends "3 things you can do tomorrow";
   one sharp prediction. Outline (`docs/plans/2026-10-23-outline.md`) approved by Krish, spine judge, `voice_check`,
   `ai_scan`, fact gate (`scripts/engine.py`, estimate cost first). Titles, headlines and thumbnail words now, in one
   round, after recording (house rule TITLES_AFTER_RECORDING).
6. **The board copy.** Everything the Friday publish page will say (channel copy, descriptions, the article HTML), as
   the feeder's inputs, ready for Codex to build.
7. **The Codex brief.** `docs/plans/2026-10-23-friday/locked/CODEX.md`: the four videos to make, the locked files to
   use, the commands (`produce-video` steps; `update_friday_23oct.py` then `--build`, publish only when `same_panels`
   is all true, `assets_absent` empty and `verify` empty), what done means (each video watched full size with sound
   against its take; every frame matches visual-copy.json; the board passes `npm run check:board-layout`), and the
   rule: anything not in the locked files goes back to Claude, never improvised. Then `npm run verify`, push, pull
   request with auto-merge (merge on green), and tell Krish it is ready for Codex.
