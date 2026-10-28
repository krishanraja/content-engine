# Codex brief: Monday 26 October, "Disney, Google and Character.AI" (follow.the.money)

Piece `b358e788-209f-427b-a84d-1f79a8ebb430`. Written by Claude, 26 October 2026.

**Gate: met for the videos.** Krish signed the storyboard on 26 October ("Yes to all four, recommended title"):
`creative-direction.json` carries his words and both scripts' hashes, and
`python3 scripts/post-pack/creative_direction.py check docs/plans/2026-10-26-monday/creative-direction.json --for-render --script long=docs/plans/2026-10-26-draft-script.md --script short=docs/plans/2026-10-26-draft-script-90s.md`
prints "direction ready to render". `kit.py` and `make.py` check the same thing and refuse anything else.

**Still with Krish (do not wait on this for the cut; leave its slot):** the fact check's last lines. The six chapter
headings and the cover words are picked and drawn: the cards (`title.png`, `ch1.png` to `ch6.png`, drawn by Claude with
`scripts/pages/video_card.py docs/plans/2026-10-26-monday/cards.json`) are in `.cache/pages/mon/cards/` and in the post's
library folder `3 Posts/2026-10-26 Mon follow.the.money - Disney, Google and Character.AI/2 Covers and images/`
(`card-title.png`, `card-chapter-1.png` to `card-chapter-6.png`), beside the five covers and both thumbnails.

## The rule

You make; you never write. Every word on screen, every number, label and picture comes from the files below. If a beat
cannot be built as written, stop and write which beat and why in `WORKBENCH.md` for Claude. Never improvise a word, a
number, a label or a picture, and never drop a beat silently.

## The files

| File | What it is |
|---|---|
| `creative-direction.json` | The signed direction: 38 beats (5-minute) and 10 beats (90-second), each with its exact words, the point it makes, the picture, its source, the source label, the words on screen, the modules, the move and its time in the take. `take_edits` is his ruling on what may be cut. |
| `receipts.md` | The motion system, "Receipts": two till receipts and an empty box on the ink desk. The objects, the moves, the colours (mint only for money that moved) and the framing. |
| `storyboard-signoff.md` | The storyboard Krish signed, beat by beat. Your cut must match it. |
| `takes/long.words.json`, `takes/short.words.json` | Word timings of both takes (faster-whisper medium.en, 26 Oct); `takes/*.diff.md`, what he said against the script. |
| `logos/` and `logos/SOURCES.md` | Official logos as SVG, with a cream twin for the ink desk. Use `disney-script*` for Disney (the corporate wordmark reads too small). `characterai*` may be the 2023 wordmark: use it unless the company's current SVG is available. |
| `sources.json` | The pages each document or screen beat shows (all filed on the piece as verbatim sources). Capture each page live, highlight the proving words exactly as the beat says, label it with the beat's `source_label`. |
| `cover-facts.json`, `cover-facts-wide.json` | The words on the covers and thumbnails, already drawn and on the board. `cover-facts.json`: the thumbnails (`GOOGLE PAID $2.7B FIRST`) and the square and vertical covers (`DISNEY IS EATING THE SCRAPS / OF BANKRUPT CHARACTER.AI`). `cover-facts-wide.json`: the wide covers (1200 x 630, 1200 x 675 and the 3:2), `GOOGLE PAID $2.7B FIRST`. Use the drawn files; never redraw them. |
| `cards.json` | The title card and the six chapter cards (headings picked, cards drawn). |

## The two videos

| Cut | Take (fetch with `python scripts/post-pack/recording.py get "recordings/<sha256>.mp4"`) | Shape | Frame |
|---|---|---|---|
| 5-minute, on camera | `recordings/8ec9a1fc6af437a36413bd8e1109631d92510caab23365510e75a2f4d53d1bab.mp4` (278.7 s, portrait selfie, rotation -90) | 16:9 | His portrait in a full-height panel left, the desk right; cutaways full frame (as Friday) |
| 90-second, on camera | `recordings/d6b2913957a2b0ab3ebd1d32f87b54f4e68f8862e69b8ec519c2eb7f2544825b.mp4` (79.4 s, portrait selfie, rotation -90) | 9:16 | His face full frame; cutaways full frame. No speed-up: it already runs under 89 s. |

Both takes are on the piece's record, stamped with the scripts' hashes.

## Steps

1. Read `AGENTS.md`, run `python scripts/check_failures.py`, then this file, `docs/CREATIVE_DIRECTION.md`, the files
   above and `.agents/skills/produce-video/SKILL.md`.
2. **Audio, as he said it.** Krish, 26 October: "That's just how I talk." Keep every word he said. The only cut is
   "which is fair enough" (5-minute, about 2:13), and only if it cuts in the silence between words without a trace; if
   it does not cut cleanly, keep it. Check by ear the places the transcriber may have misheard (`take_edits`); cut
   nothing there. Listen to every join at full volume.
3. **Treat the room.** His hotel room is behind him: darken and soften it (`treated-background`), never cut him out.
4. **Build the objects once** (`receipts.md`): the two receipts, the void receipt, the empty box, the money map, the
   prediction card, the four question cards, the end card. Both sizes.
5. **Cue every beat** to the take's word times: each move lands on the word that names it (word start minus 3 frames).
   Your face share must match the direction (5-minute 12 of 38 beats, 90-second 2 of 10).
6. **Brand and sound:** no intro sting (`config/intro-sting.json` is still a candidate); the licensed bed from
   `config/music-library.json`, low under the voice, through `produce-video`.
7. **Captions burned into every cut** (Krish, 2026-10-27: captions burned into every cut): the house captions in
   `creative-direction.json` `brand.captions` (`"caption_style": "house"` in each make.py config). The caption file
   (`.srt`) still comes from a fresh transcript of the finished file only.
8. **Prove it before anyone sees it.** Transcribe each finished file and compare it word by word with what he said
   (minus the one cut): every word present, in order, none clipped. Lip sync within 40 ms at the start, middle and
   end. The automated media reviewer is **not** qualified (it invented speech in silent files,
   `docs/plans/2026-10-26-quality-evidence/README.md`): a person, or a reviewer that did not make the cut, watches at
   full size with sound against the signed storyboard. Report fact, transport and editorial status separately.
9. **File** each video and its thumbnail through `produce-video` (archive, the post's library folder, the making
   record: `making.py --by Codex b358e788-209f-427b-a84d-1f79a8ebb430 video long|short ...`).

## How to show Krish

Put both videos on Monday's tab of https://content.krishraja.com/board/2026-10-26 as materials marked `review`, with
one line each on what you checked, through `week_board.py`'s `--materials` and `board_web.py publish-web --assets`
(feed it, never shape it: `docs/PUBLISH_BOARDS.md`). Never publish anywhere public, never sign in to a platform. Update
`WORKBENCH.md` with where every file is, commit on a branch, `npm run verify`, push, open a pull request.

## Done means

Both cuts match the signed storyboard beat for beat; every word he said is there except the one clean cut; no joins
you can hear; the receipts print on their words; `kit.py` exit 0; a reviewer who did not make them has watched and
listened to both at full size; both are on the record and on the board for Krish.
