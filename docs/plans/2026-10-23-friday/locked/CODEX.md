# Codex brief: Friday 23 October, "two passports" (mind.the.gap)

Piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`. Written 24 October 2026 by the Claude session that locked every word
and picture. Krish, 24 October: "the copy of the article and what goes in the visuals etc is all Claude
responsibility", and he wants these produced "in a world-class capacity that I'm not going to need to iterate for 30
hours".

**Gate: met.** Krish signed off the storyboard, titles, outline and prediction on 24 October ("signed off, keep, all A";
`storyboard-signoff.md`). On the same day he answered the length question for the two vertical cuts: "Cut the recap
(Recommended)", then "Speed both to 1.12x (Recommended)", and warned: "last time Codex glitched a bunch of words on the
speedup and also misaligned the captions". The cuts and the speed are in `script-cam-90s.md` and `script-vo-90s.md`;
how to speed without glitches is the section of that name below. It is not optional.

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
5. **Thumbnails and titles:** Krish has picked them; they are in `titles.json` (thumbnail words "EVERY COUNTRY WANTS
   ITS OWN AI", the title card "Why every country wants its own AI"). Use them exactly. Do not write your own.
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

## Speed without glitches (the two vertical cuts)

Krish, 24 October: "last time Codex glitched a bunch of words on the speedup and also misaligned the captions". The
recorded causes (`config/failures.json`, `cut-called-done-unheard` and `lip-sync-drift`): captions and cut points came
from a words file made before the speed-up, on the wrong clock; and a cut built from 62 separately encoded parts lost
668 ms, so sound and picture drifted. So:

1. **One speed-up, of one continuous file, once.** Use the engine's own path: the episode config's `"speed"` with the
   factor 1.12 and the `krish` words given in the script (`scripts/quick-edit/episode.py`, `speed_settings`). It speeds
   picture and sound together with pitch kept. Never speed parts one by one, never speed twice, never re-encode the
   sped file in parts.
2. **A fresh transcript of the sped take, then cut on it.** Transcribe the sped file (`make.py`'s `transcribe`, the
   same model as the take's) and find every cut in the script by its words in that new transcript, not by the raw
   times in the script (those are the unsped clock; divided by 1.12 they are only a guide). `quality.py` refuses a
   words file with the wrong source, speed, clock or transcriber: never get round it.
3. **Clean joins.** Cut in the silence between words, never inside one; keep at least 40 ms of room on each side and a
   10 ms crossfade at each join. Then render the whole cut as one file.
4. **No captions in the picture.** The signed storyboard has no subtitles of what he says. Set `"captions": false`, so
   the caption file goes to the platform instead. Make that file from a fresh transcript of the finished file, never
   from any earlier words file.
5. **Prove it before anyone sees it.** Transcribe the finished file and compare it word by word with the script's words
   minus the cuts: every word present, in order, none clipped. Listen to every join at full volume. On the on-camera
   cut, check lip sync at the start, the middle and the end (within 40 ms). Check the caption file against the
   finished file's audio at five points, not against the script.
6. **Sped cuts need more picture** (Krish, 19 October, `config/learnings.json` `sped-cut-visual-density`): at least 90% of
   his speech covered by a picture, no uncovered stretch over 1.5 s, at least 20 meaningful changes a minute, and every
   essential word at least 48 px high at 1080 wide (stricter than the 39 px in `motion-system.md`; for the vertical cuts
   48 px wins). `quality.py` `coverage_problems` checks it.
7. **Length.** The whole finished vertical file, with the 3.5 s intro and the 6 s outro, must run under 89 s
   (`produce_day.py` `SHORT_MAX_SECONDS`): about 87 s for the on-camera cut and 84 s for the voiceover cut.

## What went wrong last time (read before you start)

- **Wednesday 21 October:** Krish published the long video and then heard random small cuts and chopped words in it;
  he scrapped the short and the article (`docs/plans/2026-10-21-wednesday/FAILURE_REPORT_2026-10-24.md`). Technical
  checks passed and were wrong. Listen like a viewer.
- **Friday 16 October:** a 90-second cut called 10/10 from proxy checks; Krish: "about a 3/10", garbled captions and
  chopped words. Never call a video done from a contact sheet or timings.
- Shorts over 89 s were cut off on Instagram (`config/failures.json` `reels-cut-off`).

## How to show Krish

Once all four pass your own full playback, put them on the Friday board as materials marked `review` (step 8, a
review round), with one line each on what you checked. His comments come back through `board_web.py read`. Only after
he accepts them do you build the final board with the copy and ask for his yes to publish.

## Done means

- Four videos, each watched full size with sound against its take, every frame matching `visual-copy.json` and the
  signed storyboard, every audio edit inaudible, `kit.py` exit 0.
- Every source label, number and name on screen traceable to `visual-copy.json`; nothing generated stands in for
  evidence; no personal details in any screen recording.
- Thumbnails from Krish's words; videos and thumbnails filed and on the making record.
- The Friday board rebuilt through the feeder and published on Krish's yes, readback verified.
- Anything you could not do is listed in `WORKBENCH.md` with the smallest change that would fix it.
