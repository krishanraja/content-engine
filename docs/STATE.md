# Current state

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `a5c5ab3`, the Vercel production
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
approval. Its Windows runner is installed on a primary machine, with a cold
standby on a second machine, both at `cc0657e` since 2026-10-02 (below).

## The Studio's runners, 2026-10-02

Krish's session on the Windows machines reported, at about 09:40 UTC:

- **Both checkouts upgraded** from `6bf7862` to the same commit, with the
  role tables and fence functions present, the primary active, the standby
  standby, the runner-roles route live and guarded, no commands or briefs
  waiting, and local status active, ready, clean and conflict-free.
- **The Studio MCP token** (`studio-mcp-token-v2`) stored on both machines
  (`docs/ENGINE_SECRETS_HANDOVER.md`, "The Studio MCP token"); on the standby
  through `scripts/standby-studio-mcp-token.ps1`.

Read back from the cloud at 09:44 UTC: the primary's row `656ae98c` is
`active`, idle, commit `cc0657ea55c8` (`main`, deployed to production), Drive
ready, 0 pending receipts, 2 seconds old; 0 queued or leased commands (the one
`attention` row from 2026-09-05 is unchanged). The standby's task is disabled,
so its row `e4e562cc` still shows its last drill (`6bf7862`, 2026-09-28); its
new commit is Krish's report until the next drill. Not yet proved: a tracked
`studio.session.open` from either machine, and the first real job leased to
the primary. Both wait for the first Studio render, which needs an approved
piece's production brief (`docs/STUDIO.md`, "Switching it on").

## The Studio's runners, 2026-09-28

What changed on the Windows machines, as Krish's session on them reported it,
checked the same day against a read-only Supabase readback (18:23 UTC).

- **Upgraded and pinned.** Both runners moved from `c13561b` to
  `6bf78628a481a61bf16ea3b4deec0d326281eee6`, the merge of PR #72 (credential
  targets rotated to v3), and stay pinned there while `main` takes docs-only
  commits. Both report source provenance `verified` at that exact commit from
  clean detached checkouts in the dedicated `runner-source` location.
- **Credentials.** The four v3 targets are installed on both machines as
  LocalMachine credentials, each matching its Vercel Secret, and each machine
  generated its own approval key (`docs/DEPLOYMENT.md`, "Secrets";
  `docs/ENGINE_SECRETS_HANDOVER.md`, "Every runner machine").
  `inspect-credentials.ps1 -EnforceActiveContract` passes on the standby and
  `npm run probe:runner-credentials` returns "runner bearer and signing
  credentials accepted by production". The retired `-v2` targets and the three
  quarantined names still sit in the standby's store, unread.
- **A primary and a cold standby.** The primary's task is enabled and running;
  its heartbeat row `656ae98c` read idle, Drive ready, commit `6bf7862`, 0
  pending receipts, 5 seconds old. The standby is a second machine with its
  own runtime, runner identity and approval key; its task is installed and
  disabled and its stop preflight reports `"active": false`. Its row is
  `e4e562cc` (idle, Drive ready, `6bf7862`, last heard 17:59 UTC during the
  drill; matched to the standby by timing and never recomputed). A controlled
  failover drill passed with an empty queue (`docs/OPERATIONS.md`, "Primary and
  cold standby"). Nothing was copied between the machines.
- **Stale heartbeat rows.** Four more rows remain and are kept: `8f265fde`
  (`c13561b`, degraded with Drive unavailable, last heard 2026-09-27; the hash
  includes the bearer, so this is probably the primary under the retired v2
  bearer, an inference) and three at `4307daa` (`b62de041` on 2026-09-08,
  `d3e2e922` and `130c98b3` on 2026-09-12).
- **Drive moved from G: to H:** (Krish's decision). H: is the
  krish@themindmaker.ai account; G: had been reporting `drive_mount_offline`.
  Both machines set the three Drive variables to the H: paths, the standby's
  Inbox was rebound with Krish's confirmation to the H: fingerprint, and the
  primary reports the same fingerprint. The G: folder stays as the rollback
  copy. Only the Video Studio moved. The repository defaults followed the same
  day (`config/studio.json`, `.env.example`, `packages/core/src/paths.ts`, the
  launcher skill); the code default is inert on both machines because the
  environment variables are set.
- **Configuration.** `MINDMAKE_CONTROL_PLANE_URL` is Control Center's origin,
  which rewrites the runner routes to this repository's `content-engine`
  project (`docs/DEPLOYMENT.md`, "Independent runner setup");
  `MINDMAKE_PREVIEW_STORAGE_ORIGIN` is the shared Supabase project's origin.
- **Queue at readback.** 0 queued or leased `video_studio_commands`, 0
  production briefs in `content_ideas.transformed_outputs`, and 1 command in
  `attention`: a `magic_edit_prepare` from 2026-09-05 whose five attempts ran
  out and whose direction succeeded on a later retry.

The gaps this left, in order of risk:

- **G1.** Both claim paths (`runner/production-brief-claim.ts` and the
  `video_studio_claim_command` function) lease work to any runner that
  presents the bearer. Only receipt reclaim is tied to one runner.
- **G2.** Nothing records which runner is meant to be active, switches it with
  an audit trail, or says when it has gone silent while work waits.
- G1 and G2 are live since 2026-09-30: runner roles fenced in both claim
  paths and an audited operator switch (`docs/OPERATIONS.md`, "Runner roles";
  migration `20260928120000_video_studio_runner_roles.sql`). Ruling (Krish,
  2026-09-30): "Go runner." Applied in the order in "Seeding the roles and
  the deployment order": the migration (every function body matched the
  repository byte for byte), the control plane deployed at `83d2caa`, then
  the seed at 11:54 UTC with the primary (`656ae98c`) active and the four
  stale runners retired. The primary heartbeated idle and ready under the
  fence 93 seconds later. Still to prove: the first real command or brief
  leased to the primary, which waits for real work. The standby
  (`e4e562cc`) has been marked `standby` since 2026-10-02 (Krish: "Yes, this
  is the standby"), fenced from work like an unassigned runner.
- **G3.** `GET /api/content-engine/health` selects heartbeat columns that do
  not exist (`updated_at`, `status`) and so always reports the runner as
  `never`; `runner_watch` reads the newest row whichever runner wrote it, and
  counts production briefs in `meta.production_brief`, where none are stored.
  Fixed in code the same day, live at the next deploy: both read the active
  runner, list the standby apart, ignore retired rows and count briefs where
  they are stored (`docs/OPERATIONS.md`, "The runner is quiet"), and Control
  Center's alert drawer shows the runners.
- **G4.** Repository defaults pointed at G: (fixed the same day).
- **G5.** No document described the two machines or the failover (fixed the
  same day: `docs/DEPLOYMENT.md` and `docs/OPERATIONS.md`).
- **G6.** The one `attention` command's cause was unrecorded. Read back on
  2026-09-28: `magic_edit_prepare` `033099bb`, on the synthetic validation job
  `20260905-built_with_ai-e999681c` (retired on 2026-09-07 with
  `synthetic_validation_2026_09_05`), `attempts_exhausted` after five leases
  between 02:03 and 02:14 UTC on 2026-09-05, with no receipt. Probable cause
  (inference): the lease-renewal bug fixed by
  `20260905100000_video_studio_heartbeat_lease.sql`, applied live at 02:43 UTC
  that day, which failed every renewal of a long-running command, so each
  attempt lost its lease before it could write a receipt. The same direction
  succeeded on a retry at 02:31 and its review is `superseded`.
  `review_recovery_record` does not apply (it recovers only
  `magic_edit_activate` and `review_decision_record` commands, and this row
  predates `last_lease_owner_hash`), and a retired job is outside the queue
  and the runner watch. Recommendation: leave it as the record of that day.
  Nothing reads it as work waiting.

## Live and verified

Readback 2026-09-25 unless a date is given.

- **Production.** The control plane deploys from `main` to the Vercel project
  `content-engine`; the last walk fix (`b61a461`, H9 and H10) was verified live
  on 2026-09-24 by running the same draft through the checks before and after.
- **The fact gate** (walk log H12 to H14). No piece on a live subchannel
  reaches review, approval or publication until every checkable claim in its
  exact text has been checked twice. Proven on piece 2, which passed on its
  tenth run: 34 facts, 19 confirmed by both checks, 13 word for word in a filed
  source, 2 on the web, 43 sentences set aside as jokes, scenarios or guesses.
  Perplexity is connected as the independent checker. Krish runs it from the
  composer's "Check the facts" strip in Control Center (H18).
- **House rules** (walk log H20 to H22). Krish's thirteen rulings live in
  `api/_houseRules.ts` and reach writers, both judge gates, the joke pass and
  the final pass. Approval also needs the machine checks in
  `api/_publishChecks.ts` (409 `publish_gate`). Read back live on piece 2:
  the facts pass, reading age about 12.5 (a warning), and the only thing
  holding approval is the prediction's confidence, which is Krish's to set.
- **Receipts** (H24). `GET /fact-check` returns the source's own words behind
  each checked claim; 32 for piece 2, read back live. A storyboard of piece 2
  as a Short built from them is with Krish
  (`docs/REFERENCE_INSTAGRAM_AD.md`).
- **The Studio knows the three subchannels** (walk log H26, 2026-09-26). A
  piece on any of them can get a production brief in its own name from
  Control Center; the job table's check admits the five Studio series (read
  back live). Not yet reachable: a branded render for a live subchannel,
  which needs Krish's approved wordmark; a mind.the.gap carousel, which needs
  a format. Live-name briefs need a runner at `47f3944` or later; both
  runners have been at `6bf7862`, which includes it, since 2026-09-28.
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

- **The Windows runner.** Installed, heartbeating and credential-probed on
  2026-09-28 (above), but it has not yet claimed, run and completed a real
  command or brief at `6bf7862`: the queue was empty. The first real piece of
  work is the business proof.
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
- **Web editions** (`editions/`, walk log H19). The first, piece 2's "Who
  picks your AI?", is hand-built in the house style beside the exact text that
  passed the gate; a test fails if the page says anything the gate did not
  check. Nothing is published, and where editions live (makeyourmindup.ai)
  waits on Krish.
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
- **`npm run verify`** passes its 28 control-plane guards again (fixed
  2026-09-25, H16). Two media tests fail where FFmpeg is absent; CI installs
  it.
- **Retired names still drive whole paths.** The editorial radar and
  `editorial-route` know only `money_of_ai` and `built_with_ai`; `save-draft`
  and brief push map only the old factory channels; `deepen` accepts only
  `paid` and `built`; `synthesize` stores any `lane_slot` it is sent.
- **Recent cron failures.** The last runs of `briefs_assemble` and
  `shifts_detect` (2026-09-18), `creator_posts` (2026-09-22) and
  `investigations` (2026-09-24) failed; their failure artifacts are in
  `content_engine_run_artifacts`.
- **Smaller faults.** `content-engine/health` selected heartbeat columns that
  do not exist until the fix of 2026-09-28 is deployed (G3 above); `chat`
  meters as `unattributed`; `AEO_ENGINE_SECRET` is
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
  opening B, the prediction at 70% and the panel-stamp answer are his
  (2026-09-25). It reads at about grade 10.5 and predates R6 and R7, so it
  needs the plain-words, reading-age-12 rewrite and then the fact gate before
  it can be approved. Waiting on his go for the rewrite.
- **Piece 2** (mind.the.gap, now "Who picks your AI?"): v4 passed the fact
  gate. Waiting on the prediction's confidence, his verdict on the page, and
  whether makeyourmindup.ai hosts the full edition with Substack carrying the
  email version.
- **The cover page fix** for makeyourmindup.ai (logo clear space, the mint
  highlight, the line under it), shown to him as before and after on
  2026-09-25; that repository is not reachable from this session.
- **The Studio's series.** Whether and when to rename `money_of_ai` and
  `built_with_ai`, which needs wordmarks for the subchannels first.
- **The creative identity** (`docs/CREATIVE_IDENTITY_UPGRADE.md`, section 8):
  the makeyourmindup masthead, subchannel wordmarks and type system (to approve
  from rendered territories); where
  CTRL's lead-magnet door goes now that makeyourmindup.ai is the publication's
  cover page. The publication's name is settled: makeyourmindup (2026-09-25).
- **Credentials.** The four credentials pasted into a chat on 2026-09-24 are
  rotated (Krish, 2026-10-02: "done"). The fate of `ENGINE_OPERATOR_TOKEN`
  after the walk. Whether the
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
