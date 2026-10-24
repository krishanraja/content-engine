# Codex brief: Friday 23 October, "two passports" (mind.the.gap)

Piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`. Written 24 October 2026 by the Claude session that locked every word
and picture. Krish, 24 October: "the copy of the article and what goes in the visuals etc is all Claude
responsibility", and he wants these produced "in a world-class capacity that I'm not going to need to iterate for 30
hours".

**Gate: start only after Krish has signed off the storyboard in words** (`storyboard-signoff.md`; his words are
recorded in that file's "Signed off" line and on the piece). Until then, only step 0 below.

## The rule

You make the four videos and the final Friday board **only** from the files in this folder. You invent no copy, no
fact, no number, no picture choice and no label. If something you need is not here (a beat with no picture that
works, a value you cannot trace, a tool that cannot do a move), stop and send it back to Claude through
`WORKBENCH.md` and the piece's board row; never improvise and never drop a picture silently.

## The locked files (this folder)

| File | What it holds |
|---|---|
| `script-vo-5min.md`, `script-cam-5min.md`, `script-vo-90s.md`, `script-cam-90s.md` | The words Krish said in each take, beat by beat, with the take's file and sha256, and the audio edits to make |
| `timings.json` (from `beats.py`) | Each beat's start and end in seconds of the raw take. Re-run `beats.py` on the edited audio's words after the edits |
| `visual-copy.json` (from `visual_copy.py`) | For every beat: surface, pictures in order, every word on screen, the source label, the highlighted sentence, numbers with sources, and the on-camera use |
| `assets.json` | Every asset: the evidence captures and test screenshots in the library, Krish's two screen recordings, the marks, the objects to build |
| `motion-system.md` | The look and the motion grammar ("Border Control"): two surfaces, the cast of objects, type, colour, timing |
| `storyboard.py` | The storyboard Krish signed (one frame per beat). Your frames must match it |

## The four videos

| Video | Take (`recording.py get "<file>"`) | Shape | Picture |
|---|---|---|---|
| 5-minute voiceover | `slice_FC18A811-B2D8-44A1-9CFF-CA579835B370_1.m4a` (323 s) | 16:9 | Pictures only, every beat, motion-system.md in full |
| 5-minute on camera | `Fri 23 Oct - 5-minute - Two passports~2.mp4` (327 s, portrait selfie, rotation -90) | 16:9 | Portrait panel left, stage right; cutaways full frame |
| 90-second voiceover | `slice_7C38672A-B9E8-46D3-A454-284B913D6D74_1.m4a` (84 s) | 9:16 | Pictures only |
| 90-second on camera | `Fri 23 Oct - 90-second - Two passports~2.mp4` (103 s, portrait selfie, rotation -90) | 9:16 | Face with full-frame cutaways |

Also: `xinxiang.mp4` and `turkmenistan.mp4` (Krish's screen recordings, 24 October), the evidence captures under
`3 Posts/2026-10-23 Fri mind.the.gap - Two passports/2 Covers and images/Evidence/` and the test screenshots under
`.../AI test screenshots/` in the library.

## Steps

0. **Study the reference first.** Fetch and study the Anthropic and GitHub clip in Video Engine > Inspiration
   (`python scripts/quick-edit/references.py fetch "SaveClip.App_AQP6P-DCy7NO_pjNElKDguG_v7k6eDrPLbpSrLvvT_GvZqgKE7uRcpc5VXFzMOQWFweCOjXoGXxg1nPYaOc3FiiPLJDNalps77vPHVo.mp4"`,
   then `references.py study` on it). Write `reference-notes.md` here: how its motion carries the explanation, and
   which of the moves in `motion-system.md` it improves. Colours, type and logos stay ours. If it has still not
   reached the library, say so and go on without it.
1. **Audio.** Make the edits listed in each locked script, at the word edges in the take's words file. Listen to every
   join at full volume. Then transcribe the edited audio (`make.py`'s `transcribe`) and re-run
   `python docs/plans/2026-10-23-friday/locked/beats.py <dir>` so the times match the edited audio.
2. **Build the objects once** (motion-system.md, "The cast of objects"): passport, evidence sheet, route, tile field,
   chat window (with the deletion replay), split, checklist. Both sizes. Fields and words come from
   `visual-copy.json` as data.
3. **Cue every beat** to `timings.json`: each move lands on the word that names it (word start minus 3 frames).
   `kit.py` must pass: nothing missing, nothing uncued, nothing smaller than 39 px (tall) or 21 px (wide).
4. **Brand and sound:** the approved story intro and outro (`config/story-intro-outro.json`), the licensed bed from
   `config/music-library.json`, low under the voice. Through `.agents/skills/produce-video` for the sting, music,
   thumbnails, filing and the making record.
5. **Thumbnails:** wait for the thumbnail words Krish picks (house rule TITLES_AFTER_RECORDING); Claude puts them in
   this folder as `titles.json`. Do not write your own.
6. **Watch each video at full size with sound against its take**, every frame against `visual-copy.json` and the
   signed storyboard (`config/failures.json`, `cut-called-done-unheard`). Fix anything that does not prove its line
   before Krish sees it.
7. **File** each video and thumbnail in the archive and the post's library folder (`produce-video` does it) and
   record them on the piece.
8. **The final Friday board.** Feed it, never shape it (`docs/PUBLISH_BOARDS.md`): the videos as materials, the
   channel copy and article from `board-copy/` here (Claude writes them; do not edit), through
   `docs/plans/2026-10-19-week/update_friday_23oct.py` (snapshot, then `--build`). Publish with
   `board_web.py publish-web` only when the build prints `same_panels` all true, `assets_absent` empty and `verify`
   empty, `npm run check:board-layout` passes, and Krish has said yes to that publish.

## Done means

- Four videos, each watched full size with sound against its take, every frame matching `visual-copy.json` and the
  signed storyboard, every audio edit inaudible, `kit.py` exit 0.
- Every source label, number and name on screen traceable to `visual-copy.json`; nothing generated stands in for
  evidence; no personal details in any screen recording.
- Thumbnails from Krish's words; videos and thumbnails filed and on the making record.
- The Friday board rebuilt through the feeder and published on Krish's yes, readback verified.
- Anything you could not do is listed in `WORKBENCH.md` with the smallest change that would fix it.
