# History log

Newest first. Entries are written by the docs steward (see the steward link in
`NOW.md`) and by people doing the same job by hand. Nothing in this file
describes current behaviour; `NOW.md` and `docs/CAROUSEL_ENGINE_STATE.md` do.
Files moved here keep their body verbatim under a Historical banner.

## 2026-09-21

- reconciled at `c62ac34`: three non-steward commits since `c8fdee3`, all in
  `apps/control-plane`, the editorial spine rather than the Video and Carousel
  Studio this file describes. `061d6fd` fixed a meter that swallowed its own
  write failures (`meter_add`'s returned error was discarded in a try/catch,
  so every Anthropic agent in `meter_daily` went dark on 2026-09-15 while the
  cron-written rows carried on, and the dashboard read "we spent nothing"
  instead of failing loudly) and ported prompt caching from control-center,
  opt-in per call site because a cache write costs more than an ordinary
  input token and pays off only when a prefix is genuinely re-sent inside the
  TTL. `67c3299` gave the AEO research engine a measured spend path through
  the same `anthropicCall` primitive rather than a second price table, adding
  `calls` and `day` so a batched reporter cannot make `runs` read 1 against a
  correct dollar total. `2ad04fd` fixed the same discarded-error shape in both
  `content_edit_events` writes, the PATCH choke point that is the only place
  the product sees a person's edit over the machine's, and unpinned
  `check-judges` from the literal wording of a comment, the same class of
  fault named in `AGENTS.md` that had already kept main red once this month.
  `c62ac34` is the merge of all three onto `main`.
- no "What changed recently" bullet, same reasoning as 2026-09-17, 2026-09-19
  and 2026-09-20: no document under this repo's `docs_roots` describes that
  subsystem.
- `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`,
  flagged again by the digest; no commit in this range touches carousel or
  video engine code or config, so the stamp was left as is rather than
  bumped without a check.

## 2026-09-20

- reconciled at `c8fdee3`: three non-steward commits since `2b3ddb2`, all in
  `apps/control-plane`, the editorial spine rather than the Video and Carousel
  Studio this file describes. `5a9fb88` stopped `research-topic` writing new
  rows in retired vocabulary: reads already resolved a retired slug to its
  live one before use, so a write in the retired spelling looked fine on
  every read afterwards while breaking the house rule that an unknown slug
  fails the write rather than degrading; fixing it also exposed that the
  research queries branched on the literal string `paid`, which a live slug
  can no longer match, so mind.the.gap would have been researched as a
  teardown with no dig of its own, and that `corpusForChannel` did not know
  the two renamed formats, so a piece written under a new name would have
  fallen through to the whole-corpus synopsis instead of its playbook.
  `d0513bc` fixed the reason main had been red since 2026-09-19:
  `check-inspiration-lane` asserted the exact wording of a status message
  instead of the invariant behind it, so the message's own improvement (
  distinguishing a quiet folder from an unreadable one, both of which used
  to report as one hedged sentence) broke the guard that was supposed to
  protect it. `c8fdee3` is the merge of both onto `main`.
- no "What changed recently" bullet, same reasoning as 2026-09-17 and
  2026-09-19: no document under this repo's `docs_roots` describes that
  subsystem.
- `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`,
  flagged again by the digest; no commit in this range touches carousel or
  video engine code or config, so the stamp was left as is rather than
  bumped without a check.

## 2026-09-19

- reconciled at `2b3ddb2`: three non-steward commits since `a32d571`, all in
  `apps/control-plane`, the editorial spine rather than the Video and Carousel
  Studio this file describes. `f413109` made an aborted investigation say why
  (`classifyRun` had discarded a reason the run already carried, so 2026-09-10
  recorded `http_200` while the body said no claim survived G3) and made a
  systemic composer failure fail the run instead of becoming a per-arc skip.
  `3007ec5` gave the engine the retry policy and the `app_secrets` key fallback
  the dashboard already had. `2b3ddb2` made the inspiration scan distinguish a
  quiet Drive folder from an unreadable one: both listed zero and the job had
  been printing one hedged sentence covering both for eleven days.
- no "What changed recently" bullet, same reasoning as 2026-09-17: no document
  under this repo's `docs_roots` describes that subsystem. That is now recorded
  as a standing gap in "Do not trust" rather than re-derived each time.

## 2026-09-17

- reconciled at `a32d571`: the only non-steward commit since `915d697` fixed a production incident in `apps/control-plane` ("stop the weekly surfacing killing itself on its own bulk upsert": every weekly arc-card write since 2026-08-26 died on a not-null violation caused by PostgREST's key-union behaviour on a bulk upsert, and a 200 response with `ok: false` and no `error` field was misreported to Krish as the literal string `http_200`). That subsystem is the editorial spine (`content-ideas`, `arcs`, `shifts`, the weekly brief) moved into this repo from `krishanraja/control-center` in PR #42, not the Video and Carousel Studio that `NOW.md`, `README.md`, `AGENTS.md` and `docs/CAROUSEL_ENGINE_STATE.md` describe; no doc in this repo's `docs_roots` names `arc_cards`, `classifyRun` or the weekly surfacing job, so no prose or stamp needed a change. `NOW.md` gained no "What changed recently" bullet for this reason. Moved `head` from `915d697` to `a32d571`, `as_of` to 2026-09-17 and the "Where it is right now" heading to match. `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`, flagged again by the digest; the commit touches no carousel code or config, so the stamp was left as is, same reasoning as 2026-09-13 and 2026-09-15. The repeated `SKILL.md` and `STATION.md` basenames the digest lists as duplicate candidates are one file per skill or per station by the repo's own directory convention (`.agents/skills/mindmake-video/stations/`), not an unlabelled duplicate of a single current file; no move.

## 2026-09-15

- reconciled at `915d697`: `NOW.md` carried `head: 5f2db20` and `as_of: 2026-09-13` while PR #70 ("Prove station artifact handoffs", `aaf97d5`, `d03e27c`, `39ee455`, merged `915d697`) had already landed as non-steward commits, failing the validator's ancestor check. Moved `head` to `915d697`, `as_of` to 2026-09-15 and the "Where it is right now" heading to match. Added a "What changed recently" bullet and a "Where it is right now" bullet for the new station artifact topology check (`external_inputs`, `terminal_outputs`, one producer per artifact, no orphaned output) and the ingest station's new `recording_brief_artifact` input, both read from `packages/core/src/station-harnesses.ts`, `packages/contracts/src/station-harness-v1.ts` and the PR body. Updated the Verification bullet with the PR's reported 62 test files, 575 tests, and noted the CI toolchain change (FFmpeg now downloaded from this repository's own authenticated release mirror rather than the upstream BtbN autobuild, `.github/workflows/ci.yml`). Reconciled `docs/ARCHITECTURE.md`, "Station machinery": added one paragraph describing the artifact topology check, since `npm run check:stations` now does more than the paragraph described. Checked `docs/OPERATIONS.md` and `.agents/skills/mindmake-video/SKILL.md` for FFmpeg or station-registry claims that the code changed; both already describe the machinery generically and needed no edit. `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`, flagged again by the digest; no commit in this range touches carousel-engine code or config, so the stamp was left as is rather than bumped without a check.

## 2026-09-13

- reconciled at `5f2db20`: `NOW.md` carried `as_of: 2026-09-13` and `head: 34a085a` while the "Where it is right now" heading still read "(as of 2026-09-07)", failing the validator's heading check. Moved `head` to `5f2db20` and the heading to 2026-09-13. Updated the art director bullet in "What changed recently" from "awaiting PR" to its merge (PR #68, `e33c181`) and added a bullet for PR #69 ("govern production as station harnesses", `20bf147`, `c51f080`, merged `5f2db20`), which carries Krish's 2026-09-13 ruling that production machinery must use independently governed station harnesses rather than one accumulating Markdown file. Added matching items to "Where it is right now" and "Read next" for the new `.agents/skills/mindmake-video/stations/` cards and `docs/ART_DIRECTOR_REPERTOIRE.md`. Checked the changed skill references (`SKILL.md`, `production.md`, `asset-safety.md`, `visual-direction.md`) and `docs/ARCHITECTURE.md`/`docs/OPERATIONS.md` against the PR diffs: already reconciled by the PR authors, no drift found. `docs/CAROUSEL_ENGINE_STATE.md` carries a `Last verified: 2026-09-07` stamp that the digest flags as older than the newest code change; no commit in this range touches the carousel engine, so the stamp was left as is rather than bumped without a check.

## 2026-09-07

- reconciled at `c90397b`: `NOW.md` carried `head: 8477f04` while `867a88e` (portable confirmation refs at every gate, radar as importer, one carousel doc) and `8e42b15` (a test fix) had already landed on `main` as non-steward commits, so the validator's ancestor check was failing. Both commits had already reconciled `NOW.md`, `README.md`, `docs/CAROUSEL_ENGINE_STATE.md`, `docs/DEPLOYMENT.md` and `docs/ENGINE_SESSION.md` by hand; this run added the missing "What changed recently" bullet for PR #40, noted the portable confirmation extension in "Where it is right now", moved the `docs/CAROUSEL_ENGINE_STATE.md` verification stamp to `c90397b` after checking its confirmation_ref and appendix claims against `packages/core/src/carousel.ts` and `packages/contracts/src/carousel.ts`, and moved `head` from `8477f04` to `c90397b` (`as_of` stayed 2026-09-07, the same day).
- folded (2026-09-07): `docs/CAROUSEL_DECISIONS.md`, `docs/CAROUSEL_FEEDBACK_PROPOSALS.md` and `docs/CAROUSEL_RESET_TRACE.md` were merged into `docs/CAROUSEL_ENGINE_STATE.md` as Appendix A (Decisions), Appendix B (Feedback proposals) and Appendix C (Reset trace), every fact and date kept verbatim, and the three files were deleted. The `indexed` lines below name those files at their former paths. Same change: radar became a feed importer only (`rankRadarOpportunities`, `selectWeeklyBrief` and `RankedOpportunity` removed because they hard-coded `editorial_eligible: false`), the dead `cadence` block left `config/studio.json`, every approval gate accepts `studio-user-confirmation:<client>:<gate>:<hash>:<receipt>` beside the legacy prefixes through one shared `confirmationRefMatches` helper, and carousel approvals now require a `confirmation_ref` bound to the same gate and story hash.
- decision (Krish, 2026-09-07): the docs steward is adopted for this repo. `NOW.md` at the root is the one file agents are promised is current at its `head`; this log is the repo-wide chronology and where superseded material goes instead of being deleted. Procedure: control-center `docs/steward/RUNBOOK.md`. This repo's own rules (`CLAUDE.md`, `AGENTS.md`, `docs/ENGINE_SESSION.md`) outrank it.
- indexed: `docs/CAROUSEL_DECISIONS.md`, the append-only carousel decision record (seven decisions, all dated 2026-09-07, from "shared engine, separate director" to "publisher signature moved left"). Not superseded and not moved; it stays beside the state doc as the model for any future decision record in this repo.
- indexed: `docs/CAROUSEL_RESET_TRACE.md`, the dated trace of visual reset `2026-09-07-01`: rejected `built-editorial-gates-v1`, three generators, two blinded judges, selected `built-approval-interlock-v2`. Not superseded; scoped to the carousel engine only.
- reconciled at `efb3f80`: `docs/CAROUSEL_ENGINE_STATE.md` gained one `Last verified` line because it declares itself the single current-state artifact. Its body was checked against `config/carousel-visual-direction.json`, `docs/CAROUSEL_DECISIONS.md` and PR #36 and found accurate. No other document in this repo carries a date stamp and none was added; the repo describes status by contract and gate.
- reconciled at `efb3f80`: `README.md` said rendering "remains policy-blocked until Remotion licence eligibility is explicitly recorded". That sentence was written in PR #1 (2026-08-28) before PR #7 recorded the eligibility in `config/studio.json` the same day. It now describes the check as `packages/core/src/doctor.ts` performs it: rendering fails closed unless the record is present, and `studio doctor` reports the check.
- note: this bootstrap also adds `.github/workflows/docs-steward.yml` (a copy of control-center `docs/steward/caller-workflow.yml`, cron 20:30 UTC) and `.steward/` to `.gitignore`. Both are outside the steward's `**/*.md` allowlist and were added by hand, once, for the bootstrap.
- reconciled at `8477f04`: `origin/main` moved to PR #39 ("Consume approved Control Center production briefs") while the bootstrap was written against `efb3f80`. The bootstrap commit was rebased onto it; `NOW.md` now carries `head: 8477f04`, a bullet for #39 and the runner intake path in "Where it is right now". #39 changed `docs/OPERATIONS.md` (new "Control Center production intake" section, typical runs start from a brief) and two bullets in `.agents/skills/mindmake-video/SKILL.md`; both were read and neither contradicts the state doc or README. The `Last verified` line on `docs/CAROUSEL_ENGINE_STATE.md` was moved to `8477f04` because its body is unchanged by #39.
