# Render Friday's deep cut (16 Oct, mind.the.gap) on Krish's PC

Paste everything below the line into Codex on Krish's home computer, in `C:\Users\krish\dev\content-engine`
(outside the sandbox: it needs the engine key, H: and the internet). Then start one short Claude Code session for
the boards (the last section).

---

Render the deep cut (the 14-minute long cut, 16:9) for piece `904658db-4df2-4537-a0ed-ebe93e081db7` with
`.agents/skills/produce-video`. Everything below was planned and checked in the cloud on 18 Oct; the cloud container
restarted three times before the 3.5-hour final step could finish, so this machine renders it.

1. `git pull --ff-only`. Set `$env:MAKING_BY = "Codex"`.
2. Work folder `W = .cache\produce\2026-10-16-904658db`. Take: `python scripts\post-pack\recording.py get --sha256
   ee91ab41bc6ff0e25c2d7c2039c0bd55131ce7630110668c826e191605f0fd9f --out W\takes` (or copy it from the Inbox; it must
   be named `Fri 16 Oct - 3-minute - Soon you won't pick your AI.mp4`, as the config's `source` says).
3. Cards and kit: `python scripts\post-pack\working.py fetch "2026-10-16 Fri mind.the.gap - Why so many AIs" --out
   W\working`. Then copy into `W\kit`: every file of `working\3 Video\working 17 Oct\kit`; into `W\kit\panels`:
   every file of `working\3 Video\working 17 Oct\video panels`, then every file of `working\3 Video\working 18 Oct\
   long cards` (the 18 Oct cards replace the 17 Oct ones of the same name). Copy
   `docs\plans\2026-10-09-friday\words\long.words.json` to `W\words\`.
4. Config: copy `docs\plans\2026-10-09-friday\long-cut\long.json` to `W\kit\long.json` and set `"intro":
   {"16x9": "../story/intro-16x9.mp4"}`, `"endcard": {"16x9": "../story/outro-16x9.mp4"}` and `"intro_override"` to
   `"Krish, <approved.on>: <approved.words>"` from `config\story-intro-outro.json`. Every one of its 51 cue panels
   must exist under `W\kit\panels` (16x9).
5. Story clips: `python scripts\quick-edit\story_io.py props --plan docs\plans\2026-10-09-friday --out
   W\story\props.json`, then `render --piece-props W\story\props.json --out W\story --only intro-16x9,outro-16x9`.
   In the cloud they came out with sha256 `defbe557...` (intro) and `29880628...` (outro).
6. Music: `python scripts\quick-edit\music.py fetch` (or the music folder on H:). The approved track's licence is
   never asked about again (Krish, 18 Oct).
7. `python scripts\quick-edit\make.py W\kit\long.json --out W\long --only 16x9 --plan`: expect 13 min 41 s total
   (3.5 s intro, 798.3 s main, 19 s close), music `no-curves-instrumental`, no missing cues, no warnings beyond the
   intro override and the episode bed. Then the same with `--share-mib 29` in place of `--plan`.
8. Check before calling it good (the skill's first rule): one contact sheet at a frame a second, and every quarter
   second of the intro and the outro; every word inside the frame; no bare score said or shown without its scale.
9. Thumbnail: the wide one is already drawn and in the library (`3 Video/Why so many AIs - wide 16x9 -
   thumbnail.jpg`); draw it again with `scripts\pages\build.py docs\plans\2026-10-09-friday\cover-facts.json
   --thumbs --out W\thumbs` (it comes out pixel-identical) so `making.py` has its receipt.
10. Send and record: `send.py` the finished cut and thumbnail into `3 Posts/2026-10-16 Fri mind.the.gap - Why so many
    AIs/3 Video`, then `making.py 904658db-... video long "Deep cut, 16:9" "3 Video/<file>" --seconds <total>
    --thumb "3 Video/Why so many AIs - wide 16x9 - thumbnail.jpg" --thumb-file W\thumbs\thumb-wide-1280x720.jpg
    --music no-curves-instrumental`. Commit nothing but notes; never commit media.

## Then, in Claude Code (one short session): the boards

In `docs/plans/2026-10-09-friday/words.json` remove `long_waiting`, add the deep cut's Drive link under `links`
(checked by folder and size), rebuild the publish page, pack and board (`docs/handovers/2026-10-18-friday-after-
publish-board.md` and `HANDOVER.md` have the commands), test the board in a browser as Krish opens it, and publish
the same file to both links in `config/boards.json` with his yes.
