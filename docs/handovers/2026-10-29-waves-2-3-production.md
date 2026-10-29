# Handover: Waves 2 and 3, production gates, overnight run and ve (worker A, 29 Oct 2026)

Krish asked for "All of Waves 2 and 3" on 29 Oct 2026. Briefs: growth-makeyourmindup
`docs/briefs/waves/2026-11-07-wave-2.md` and `2026-11-14-wave-3.md`. The orchestrator is session
`session_01JRhKyrvZVBC6wX9CHa6R6i` (growth-makeyourmindup). This session handled the content-engine
production packages. Worker B (session `session_01JRhKytbX5BWpyjUcyYSXRa`) handled the board, the manifest,
Drive and docs.

Everything below is built and tested on synthetic fixtures. None of it has run on a real take.

## Merged to main (merge commits, CI green)
- #245 W3.3: the chat backstop on SessionEnd (`scripts/taste_backstop.py`, local outbox `.scratch/`).
- #248 W2.3: place-takes.
  - `.github/workflows/place-takes.yml` runs on dispatch only.
  - `recording_match.py --clock` builds each take's word clock.
  - Duplicates are reported and kept; nothing is moved.
- #249 W2.11: the `local_roots` readers and `npm run check:local-paths`.
- #251 W2.6: the overnight run.
  - It starts on the titles press, and the standby machine makes the shorts.
  - The Codex tool profile is in place, and `production-asked-to-publish` is guarded.
  - The Critic is separate from the repairer.
  - The Monday board's held cuts ride the existing `--materials` input.
  - `repair-round.yml` runs on dispatch only.
- #253 W2.4: the calibrated gates (`scripts/cutgates`).
  - Words lost on every aligner block on both routes.
  - Joins must sit in agreed gaps of 80 ms with 30 ms clearance.
  - Captions are checked on clock truth and renderer truth.
  - Receipts are bound to the file's hash.
  - Joins and caption checks hold a cut for posts from 16 Nov.
- #254 W2.5: the floor in the tools.
  - Lip sync gate, logo registry gate, privacy crop.
  - Loudness and share-copy lines, chapter lifts, stabilisation measured.
  - The sound slot refuses everything until he approves a set.
- #260 W3.1 and W3.8: the six device cards (not dispatched), `scripts/ve/check_route.py`, and `ve sprint`.

## Open at handover, to merge with a merge commit when CI is green (Krish authorised: "merge all the unmerged")
- #255 W2.7: ve conform, ingest, file and brief; face-with-proof drafts; golden-frame slots.
  - Its join gaps use the `cutgates` rule.
  - Ingest refuses a paid aligner.
- #257 W2.4: the gates on the ve route.
- #258 W2.6: the credit caps come from Control Center's `get_engine_credits` answer for
  `growth-makeyourmindup`, saved with `ve budget pull --read FILE`.
  - Missing, held, unknown or stale credit state holds, with the reason.
  - A provider with no pool placed holds, by name.
  - No number is typed anywhere.
- #265: the paid second aligner is removed (Krish, 29 Oct: "do not use eleven labs for this").
- The closeout PR from `claude/w2-worker-a-closeout` (this file and NOW.md).

Each of these touches `tests/ve.test.ts` or `docs/ve/*`. After each merge, merge main into the next PR and
resolve by keeping both sides. Run `npx vitest run tests/ve.test.ts` and `npm run check:repo-map`, then push.

## Known
- `tests/quick-edit-mix.test.ts` fails only in cloud containers that have ffmpeg 6.1.1. CI uses 8.1 and passes.
- Control Center places only the `elevenlabs` and `apify` pools on the publication. The credit gate maps
  Codex to `codex` and `codex-credits`, Runway to `runway` and Higgsfield to `higgsfield`. Until those pools
  exist, Codex card dispatch holds.
- `FLOOR_PROPOSE_ENABLED` is not set in this repository or in any Vercel project. Inspirationhouse reads it,
  and its value there is unverified.

## Answered on 29 October 2026

Krish's answers, typed to the orchestrator in person ("1. yes. 2. yes. 3. yes. 4. yes"), to these exact questions:

1. "Does your Epidemic Sound plan allow sound effects (not just music) in videos you publish?" Yes. Recorded in
   `config/reference-cuts.json` (`big_moment_sound`) and `config/sfx-approved.json`. The small set still goes to him
   to hear before any sound is used.
2. "When a video shows a company's logo, is it OK to recolour it in our cream?" Yes. Recorded on
   `config/reference-cuts.json` ruling 6 as `answered_2026_10_29`: the official shape, unedited, may be set in house
   cream. Not applied yet, and to change together in one build: the bar page (`docs/production/THE_BAR.md`), ruling
   6's production line, `tests/floor_bar_test.py`, and `scripts/post-pack/logo_gate.py`, which registers only
   `full_colour` and `one_colour` and refuses a recoloured variant.
3. "OK to install two free checking tools on both home computers? One checks lip-sync (SyncNet), the other reads
   on-screen text (tesseract)." Yes. Approved for the next session on each home computer; nothing installed from the
   cloud. Steps below.
4. "Will you leave one home computer on overnight on Sunday 8 Nov, for the first overnight run?" Yes. The
   primary/standby setting is approved for the next home-computer session; not set from the cloud. Steps below.

Defaults the orchestrator set, which Krish agreed need not wait on him (defaults, not his rulings):
- No `PLACE_TAKES_DISPATCH_TOKEN`: place-takes starts the way it does today.
- Placed takes stay where they are in the Inbox; nothing moves to `Inbox/used/`.
- The hazard tape is house cream.

## For the next session on each home computer (approved 29 October)

1. tesseract: install it so `tesseract` is on PATH (Windows: the UB Mannheim build, then add its folder to PATH),
   and check with `tesseract --version`. The caption and composition checks (`scripts/cutgates/captions.py`,
   `scripts/velib/qc_captions.py`, `qc_composition.py`) then run instead of reporting not_run.
2. SyncNet: clone `joonson/syncnet_python` at the revision pinned in `config/lipsync.json` (`syncnet_revision`),
   fetch its model, check the model's sha256 against `model_sha256` there, and set `MINDMAKE_SYNCNET_ROOT` and
   `MINDMAKE_SYNCNET_MODEL` (user scope). `scripts/quick-edit/lipsync_gate.py` refuses a model whose digest differs.
3. Then run `python3 scripts/cutgates/calibrate.py` and the Critic calibration, and keep both reports.
4. Overnight role: set the user setting `MINDMAKE_OVERNIGHT_ROLE` to `primary` on one computer and `standby` on the
   other (Windows: `[Environment]::SetEnvironmentVariable('MINDMAKE_OVERNIGHT_ROLE','primary','User')`); the upload
   task reads it on its next pass. Run `scripts/overnight/preflight.ps1` on both and read their blocks.
5. Sunday 8 November: the primary stays on and signed in overnight for the first run.

## Waiting on Krish (one line each)
- By ear: approve the levels on Monday 26's 16:9 cut with the chapter lifts.
- By ear: the small sound-effect set, before any is used.
- Gate 2 on the face-with-proof key frames, and on each of the six devices once Codex builds them.
- His 5 to 10 golden frames from Production Inspo.
- 20 minutes on 9 Nov to score the shadow cuts side by side.
- Control Center needs to place `codex`, `runway` and `higgsfield` pools on the publication (ai-harness or
  Control Center owns that).
