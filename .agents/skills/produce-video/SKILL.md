---
name: produce-video
description: Codex owns video production. From a piece whose making record shows Recorded (piece_id <uuid>), produce the 3-minute long cut and the 90-second short cut with the real logos and the evidence pile-up on screen, pass the visual gate, put them in the pack and record them on the piece so Control Center shows Video assets. Use in Codex on a runner machine when a piece shows Recorded, or when Krish asks to produce a piece's video.
---

# Produce the video

Krish, 2026-10-11: "I'm going to transfer all video production iteration
through to Codex, whilst Claude will remain the overall place for initial
ideation, article creation and publish board building." This is Codex's
step. It starts when the piece's record shows Recorded and ends when both
cuts are on the record as video assets. Nothing before (the article, the
scripts, the pictures) and nothing after (the publish board, the posting) is
this skill's to change.

## Before anything

1. Read `AGENTS.md`, `WORKBENCH.md`, `docs/ENGINE_SESSION.md` and
   `docs/CADENCE.md` ("Who owns what, and where things live").
2. Run outside the Codex sandbox (ask for escalated permissions; Krish
   approves): the engine key lives in Windows Credential Manager and the
   sandbox cannot see it or the internet (`scripts/engine.py` says so when
   it cannot find the key).
3. Read where the piece is: `python scripts/post-pack/making.py <uuid> show`.
   The step now must be Video assets, owner Codex. If it is Record, the
   recordings are not in yet: say so and stop. If it is an earlier step, it
   is Claude's; say so and stop.
4. Record this session on the piece: `making.py <uuid> session <link>`.

## The work

| Do | With | Record |
|---|---|---|
| Fetch both recordings | `python scripts/post-pack/recording.py get "<file name>"` (the recordings lane; never Drive) | the lane recorded them already; if not, `making.py <uuid> recorded long <path>` |
| Produce both cuts, each from its own recording of its own script (house rule TWO_CUTS, Krish, 2026-10-11): the 3-minute long cut (405 to 495 spoken words, 16:9, for Substack and YouTube) and the 90-second short cut (160 to 225 spoken words, 9:16, for YouTube Shorts, TikTok and Instagram Reels). `story_check.py --cut long` and `--cut short` checked each script; a cut that runs well past its length goes back, never sped up | the Studio (`docs/ENGINE_SESSION.md`, `$mindmake-video`), with the real logo of every company the piece names and the evidence pile-up on screen (house rule VISUAL_EVIDENCE). The Studio renders 1080x1920 only, so the 16:9 long cut comes from `scripts/quick-edit/make.py --only 16x9` | |
| Declare and pass the gate | in `post.json`, each video entry carries `"logos": [...]`; `python scripts/post-pack/visual_gate.py post.json` must say ready | `making.py <uuid> visual-gate post.json` |
| Put them in the pack and the library | `python scripts/post-pack/build.py post.json --replace`, then `send.py <pack>` | automatic (post.json carries `piece_id`) |
| Put them on the record | one line per cut, with the Drive link once the library has it. The step is done only when both cuts are on it | `making.py <uuid> video long "Substack video" "3 Video/long.mp4" --url <https>`; same for `short` |

A cut that fails the gate is not a video asset; fix it, never declare a logo
that is not on screen. When the Studio reports `read_only_untracked` or is
unavailable, nothing was produced: say so.

## Walls

Nothing here sends, posts, spends or deletes. The article body, the
approval, the scripts and the channel ticks are never written from here. A
Claude Code session finishes the publish board once Video assets shows.

## Board items about this piece

Every board item you write about this piece carries `"idea_id": "<uuid>"`
and, when one step finishes it, `"closes_on": "<step>"` (WORKBENCH.md, "The
board"). The engine closes it when that step lands, and closes every item
about the piece once its publish step is done (the standing five ticked), so
nothing about a finished piece lingers on Krish's board.

## Before you stop

Update `WORKBENCH.md` and the board (`WORKBENCH.md`, "The board"), and end
every reply with https://controlcenter.krishraja.com/#/board.
