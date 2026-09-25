# Current state

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `fd467e1`, the Vercel production
deployment and a Supabase readback the same day

The deepest current-state document for the whole repository. `NOW.md` is the
short version. Every claim points at code, a migration, a readback or a log.
When this file and the code disagree, the code wins; fix this file.

## In one paragraph

The engine is building. The half that chooses what to write is live and runs
around the clock: 20 crons, a judge panel that has run 243 times, and 93
routed ideas waiting. The half that turns a chosen idea into a finished piece
was walked end to end for the first time on 2026-09-24, and on the way the
backend got ten fixes (H1 to H10 in the walk log). No piece has ever been
published. One is in review, waiting on Krish's verdict. The Studio is built
and tested but has never produced a Short or carousel that reached final
approval, and its runner is not recorded as installed.

## Live and verified

Readback 2026-09-25 unless a date is given.

- **Production.** The control plane deploys from `main` to the Vercel project
  `content-engine`; the last walk fix (`b61a461`, H9 and H10) was verified live
  on 2026-09-24 by running the same draft through the checks before and after.
- **Crons.** All 20 in `apps/control-plane/vercel.json` have
  `content_engine_runs` rows in the last seven days. `judge_sweep` ran 59
  times.
- **Ideas.** `content_ideas`: 56 live `seeded`, 49 live `researching`, 1 live
  `review`, 80 `dropped`, 0 `published`. 93 live ideas are routed to one of the
  three subchannels.
- **Judging.** 243 panel runs. `judge_calibration` has 7 settled rows, all from
  Krish's decision on piece 1 on 2026-09-24, the first since the view was
  built on 2026-09-09.
- **Ledger.** 55 `content_edit_events` rows, 37 of them Krish's. Every row an
  agent session has written since H6 is `observation_only` (sequences 46 to
  63); sequence 45 predates the fix and wrongly reads `actor 'Krish'`, and the
  table is append-only, so it stays (walk log, H6).
- **Subchannels.** Three active in `venture_formats`, plus the `general` and
  `either` holding rows; `money_of_ai` and `built_with_ai` inactive, mapped
  through `format_aliases`.
- **The voice rule R2.** "Cut it everywhere" is active in the house rules, the
  deterministic voice check, the stored voice block and the channel corpus
  (walk log, H7 and H8), and in Control Center's composer presets
  (control-center `d15ad25`, on `main` since 2026-09-25).
- **Studio.** Two `video_studio_jobs` rows; `runner_watch` runs daily.
  `mindmake_studio_learning_proposals` is empty.

## Built but unproven

- **The Windows runner.** Merged and tested; `docs/DEPLOYMENT.md` says the
  repository does not install the Scheduled Task, and nothing records the
  seven-step live readback. `docs/ENGINE_SECRETS_HANDOVER.md` says it is
  installed; treat that as unverified.
- **Studio output.** No Short or carousel has a recorded final approval,
  package or upload. The carousel's brand placement still waits on Krish's
  review of the rendered set (`docs/CAROUSEL_ENGINE_STATE.md`).
- **From a routed piece to the Studio.** The production-brief bridge accepts
  only `money_of_ai` and `built_with_ai` (`apps/control-plane/api/_productionBrief.ts`),
  so no piece routed to a live subchannel can become a Studio job
  (`docs/STUDIO.md`, "Series and subchannels").
- **The weekly compiler.** Runs Sundays. Its last run (2026-09-20) was
  skipped: "only 1 edit events in 28 days: too thin to propose anything". The
  ledger has grown since (37 of Krish's rows), so the next run is the first
  that may propose.
- **The fact gate** (walk log H12). No piece on a live subchannel reaches
  review, approval or publication until every checkable claim in its exact
  body is verified. Built and tested; its first live runs are on pieces 1
  and 2. Only an agent session can run a check until Control Center has the
  button and the claim table.
- **Remote Studio sessions.** The OAuth connector for Claude.ai and ChatGPT is
  not released, so those clients are `read_only_untracked`.

## Broken or risky

Engine:

- **Unauthenticated write routes.** About a dozen routes use `preamble`, which
  checks nothing: `shifts/[id]` (dismiss deletes a shift), `shifts/[id]/write`,
  `content-decisions/*`, every `briefs/[week]` route including `revise`
  (spends on Anthropic) and `push` (fires the n8n factory), `briefs/notes`,
  `content-creators`, `aeo/subjects`, `aeo/digest`, `aeo/queries`
  (`docs/CONTENT_ENGINE.md`, "The guards").
- **Guards that fail open.** `guard` and the POST arm of `guardCronRoute`
  admit everyone when `ACCESS_CODE` is unset; `discover-lens-radar` admits
  everyone when `LENS_RADAR_SECRET` is unset.
- **CI on `main` cannot be green.** `check-run-recovery` (the replay registry
  lacks `judge_sweep` and `judge_ladder`) and `check-cache-metering` (two judge
  modules read cache token fields directly) fail, so `npm run verify` fails.
  Two media tests also fail where FFmpeg is absent; CI installs it.
- **Retired names still drive whole paths.** The editorial radar and
  `editorial-route` know only `money_of_ai` and `built_with_ai`; `save-draft`
  and brief push map only the old factory channels; `deepen` accepts only
  `paid` and `built`; `synthesize` stores any `lane_slot` it is sent.
- **Recent cron failures.** The last runs of `briefs_assemble` and
  `shifts_detect` (2026-09-18), `creator_posts` (2026-09-22) and
  `investigations` (2026-09-24) failed; their failure artifacts are in
  `content_engine_run_artifacts`.
- **Smaller faults.** `content-engine/health` probably selects the wrong
  heartbeat columns; `chat` meters as `unattributed`; `AEO_ENGINE_SECRET` is
  missing from `.env.example`; the humour rewrite path ignores the mandate;
  mind.the.gap has no playbook in the corpus; no subchannel has a wordmark.

From the walk, still open (`docs/walks/2026-09-three-piece-walk.md`, F-table):

- F2: select-and-rewrite splices back whatever the model returns (a lost
  heading marker, a duplicated sentence, meaning drift).
- F3: a rewrite once wrote the instruction into the piece.
- F4: an invented attribution passed every check.
- F6: the final pass's verdict swings between runs of the same piece.
- F7: the idea's title and thesis go stale as the piece changes.
- F10: research calls cap at 1,200 tokens and rewrite the whole `meta`.
- F12 (fixed 2026-09-25 by H11): research the engine fetched was presented to writers and checkers as
  "materials Krish provided".
- DecideCard's reroute does not write `lane_slot`.

## Waiting on Krish

- **Piece 1** ("Same agent, opposite answers", follow.the.money, in review):
  opening B, the Call at 70% and the panel-stamp answer are his (2026-09-25).
  Waiting on his go for the reading-age-12 rewrite, then the fact gate, then
  approval, which is the first decision the calibration view can learn from at
  the draft stage.
- **Piece 2** (mind.the.gap, "Every AI lab now sells a menu..."): v2 drafted
  at about grade 8, angle A agreed. Waiting on his pick of a look for the
  futures graphic, the Call's confidence, and the fact gate.
- **The Studio's series.** Whether and when to rename `money_of_ai` and
  `built_with_ai`, which needs wordmarks for the subchannels first.
- **The creative identity** (`docs/CREATIVE_IDENTITY_UPGRADE.md`, section 8):
  the makeyourmindup masthead, subchannel wordmarks and type system (to approve
  from rendered territories); adding the Call to all three mandates; where
  CTRL's lead-magnet door goes now that makeyourmindup.ai is the publication's
  cover page. The publication's name is settled: makeyourmindup (2026-09-25).
- **Credentials.** Four credentials pasted into a chat on 2026-09-24 need
  rotating. The fate of `ENGINE_OPERATOR_TOKEN` after the walk. Whether the
  autoscore trigger gets a credential in Supabase Vault.
- **Rules.** R1 (argue from labelled hypotheses when evidence is thin) is in
  trial; R3 (signature sections and a signature visual per subchannel), R4
  (openings hook on consequence) and R5 (mind.the.gap's timeline forks into
  scenarios, a mandate change) are proposed.
- **The register.** Krish, 2026-09-25: the whole channel reads at a reading age of
  12, with a huge sense of humour, fun and personality, and a bold, colourful
  look ("everything is so boring and Bloomberg right now"). Piece 1 v10 reads at
  about grade 10.5.

## Where the history is

`docs/history/LOG.md` is the dated record; superseded documents sit beside it
under `docs/history/`, each with a banner naming its replacement.
`docs/walks/2026-09-three-piece-walk.md` is the full engineering record of the
first live walk.
