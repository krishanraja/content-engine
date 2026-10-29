# Handover: Waves 2 and 3, worker B (board, publish manifest, Drive, docs), 29 October 2026

Session: claude.ai/code session_01JRhKytbX5BWpyjUcyYSXRa. Stopped by cost guard G1 at 674k tokens with every package
pushed. Orchestrator: session_01JRhKyrvZVBC6wX9CHa6R6i (growth-makeyourmindup). Worker A (gates, overnight, ve):
session_01JRhKyr4DLZsJQieLe5D33B.

## Pull requests

| PR | Package | State | Next step |
|---|---|---|---|
| #246 | W2.1 Archive, layout v3, Scores press, piece_scores migration (not applied), publish-watch schedule match | merged | none |
| #247 | W2.8 piece manifest (draft, seal, dispatch with per_item_review on every slot) | CI was queued | merge with a merge commit once green |
| #250 | W2.9 snackable cuts, Growth growth-offdays/1 Off days, off-day presses on any day | CI was queued; main merged in | merge once green |
| #252 | W2.10 only the eight nevers block; one-sitting sort proposal | CI almost green | merge once green |
| #256 | W2.11 config/studio.json local_roots, paths.ts readers, produce-video skill | CI re-running after a fix | merge once green (worker A's readers are #249) |
| #259 | W2.12 NOW.md history moved verbatim, NOW.md and skill-core byte caps, G8 proposal | CI was queued | merge once green |
| #261 | W2.12 Codex card max_minutes and max_calls (ve) | CI was queued | Krish's hand merge after green; never auto |
| #262 | W3.5 post folders bound to pieces, frozen at first send; test posts and renders outside 3 Video refused | CI was queued | merge once green |

W3.3 is worker A's #245 (merged); no second hook. W3.9 was read only (below).

## Things learned that the next session needs

- `packages/core/src/media-quality.ts` hashes config/studio.json into MEDIA_STANDARD_HASH. A new studio.json key voids the
  reviewed media rollout. #256 hashes studio.json without `local_roots` (byte-identical to the reviewed hash, checked).
- Repo map: run `npm run repo-map` after `git add` of new files; it lists tracked files only.
- Locally, `tests/quick-edit-mix.test.ts` fails on this container's ffmpeg 6.1 (`-/filter_complex`); CI is green on it.
- Main moves fast: merge origin/main into a branch before merging it; week_board.py and PUBLISH_BOARDS.md conflict often.

## Waiting on Krish (one line each)

1. Yes to the Wave 2 migration batch, which includes `20261118090000_piece_scores.sql`.
2. About 10 minutes of hindsight scores once it is applied (Archive tab, from the board of 9 November).
3. Add the 6 October Launch (`/p/welcome-to-my-new-ai-media-channel`) as a published record? (docs/plans/2026-11-07-wave-2-reconcile.md)
4. Is the 24 October Muse/Grok video the 21 or the 23 October piece?
5. Where did the 23 and 26 October pieces go live, if they did? Neither is on Substack.
6. The one-sitting floor sort: "never N", "aim" or "drop" for each of 30 patterns (docs/proposals/2026-10-29-floor-one-sitting.md).
7. G8: "Opus now", "measure first" or "keep Sonnet" for produce-video (docs/proposals/2026-10-29-g8-produce-video-model.md).
8. Hand-merge #261 after green CI.
9. Growth: which post is the manifest's single `youtube` entry, the long video or Shorts?

## W3.9, held for Krish (no changes made)

- `config/title-verdicts.json`: the lesson "First person beats explaining: put Krish in it (I tried, I tested, I scored)"
  now conflicts with articles speaking as "we"; it needs his rewording.
- `apps/control-plane/api/_mission.ts`, read by the judges: MISSION says "sell it at scale with my name on it" and FACE
  names "leaders ... Krish already knows", while no public word may name him.
- The database voice block names him 56 times and says "in his/my voice" once; the corpus names him 40 times and says
  "first person" twice. Counts only: the voice block's text is never published.

## Not done

- The weekly spread report (W3.5) is a command, not scheduled: no engine route lists every library file yet.
- Control Center #/week showing the scores belongs to the Control Center worker.
