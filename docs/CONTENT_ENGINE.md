# The content engine (`apps/control-plane`)

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `fd467e1`: every route file read,
crons and run ledger read back from the database, guards run locally.

Scope: the editorial half of this repository, everything under
`apps/control-plane/`. The Studio half is in `docs/STUDIO.md`. Why either
exists: `docs/NORTH_STAR.md`. Terms: `docs/GLOSSARY.md`. Current state and
open problems: `docs/STATE.md`.

## What it is

A Vercel serverless project (`content-engine`, production alias
`content-engine-flame-nu.vercel.app`) over the shared Supabase database. It
holds every route, cron and structural guard behind the Content tab in
Control Center: collecting ideas, judging and routing them, drafting and
rewriting pieces, cutting them for channels, handing approved pieces to the
Studio, and recording what Krish decided so the engine can learn from it.

It moved here from `krishanraja/control-center` in PR #42, by Krish's decision
recorded as ADR-019 (control-center, `docs/DECISIONS/019-content-engine-owns-the-control-plane.md`,
2026-09-08): "The routes, the crons and the structural guards move to
`content-engine/apps/control-plane`, deployed as its own Vercel project.
Control Center reaches them through rewrites." Control Center kept the desk:
the Content tab, the composer, the mobile deck, the Studio reviewer, and the
hooks that read the database directly.

It has no UI of its own and no local dev server. 89 route files and 91 shared
modules live under `apps/control-plane/api/`.

## How callers reach it

| Caller | How | Auth |
|---|---|---|
| Control Center (Krish in a browser) | `controlcenter.krishraja.com/api/...`, rewritten by control-center's `vercel.json` to this project, same path | the `cc_access` cookie (sha256 of `ACCESS_CODE`), so `ACCESS_CODE`, `APP_ORIGIN` and the CSRF secret must be byte-identical on both projects |
| Vercel cron | this project's own `vercel.json` crons | `Bearer CRON_SECRET` |
| An agent session with no browser (Claude Code, Codex) | straight to this project's URL | `Bearer ENGINE_OPERATOR_TOKEN` on the routes behind `guardEngine` |
| The Windows runner | `/api/video-studio/runner/*` via Control Center's origin | `Bearer VIDEO_STUDIO_RUNNER_TOKEN`, receipts HMAC-signed |
| The Studio MCP gateway | `/api/video-studio/mcp` | `Bearer VIDEO_STUDIO_MCP_TOKEN` |
| The AEO engine (GitHub Actions) | `/api/aeo/ingest`, `/api/aeo/context`, `/api/aeo/meter` | `Bearer AEO_ENGINE_SECRET` |
| A Postgres trigger (autoscore) | `POST /api/content-ideas/:id/score` with exactly `{model:'haiku'}` | none, by a narrow exception that refuses anything else |

Not every path is rewritten by Control Center: `/api/judge/*`, `/api/learning/*`,
`/api/inspiration/*`, `/api/trends/*` and `/api/claims/*` are reachable only on
this project's own URL.

### The guards (`api/_auth.ts`, `api/_videoStudioAuth.ts`, `api/_videoStudioMcpAuth.ts`)

| Guard | Admits | If its variable is unset |
|---|---|---|
| `guardEngine` | the cookie, or `Bearer ENGINE_OPERATOR_TOKEN` | refuses |
| `guardCronRoute` | GET: `Bearer CRON_SECRET` only. POST: the secret or the cookie | the POST arm lets everyone in when `ACCESS_CODE` is unset |
| `guard` | the cookie | lets everyone in when `ACCESS_CODE` is unset |
| `guardOperatorOrCron` | the cookie or `Bearer CRON_SECRET` | refuses |
| `guardSensitiveRead` | the cookie or `Bearer VIDEO_STUDIO_EXPORT_TOKEN`, 60 a minute | refuses |
| `guardBearerExport(ENV)` | `Bearer $ENV`, 60 a minute | refuses |
| `preamble` (`api/_content.ts`) | anyone; it only checks the method | no auth at all |
| Studio read and mutation | the cookie; a mutation also needs Origin equal to `APP_ORIGIN` and an HMAC CSRF header | 503 |

Routes still on `preamble`, which therefore accept writes from anyone who
knows the URL: `shifts/[id]` (dismiss deletes a shift), `shifts/[id]/write`,
`content-decisions/[id]` and `likely-reasons`, every `briefs/[week]` route
(including `revise`, which spends on Anthropic, and `push`, which fires the n8n
factory), `briefs/notes`, `content-creators`, `aeo/subjects`, `aeo/digest` and
`aeo/queries`. `discover-lens-radar` is open when `LENS_RADAR_SECRET` is unset.
This is recorded as an open risk in `docs/STATE.md`.

## The pipeline, stage by stage

Models are named by constant (`api/_models.ts`): `SYNTHESIS_MODEL` and
`UTILITY_MODEL` are `claude-sonnet-5`, `JUDGE_MODEL` is `claude-haiku-4-5`,
`LADDER_MODEL` is `claude-opus-4-8`. The agent key in brackets is the
`unit_key` the call is metered under in `meter_daily`.

### 1. Ideation: collect and research

| Route | What it does | Model and external services |
|---|---|---|
| `POST /api/content-ideas` | capture: dedup, relevance gate for non-manual sources, enrich, embed, insert as `seeded` | Haiku relevance [`relevance-classifier`], Sonnet enrich [`cleo`], OpenAI embeddings |
| `POST /api/content-ideas/voice` | transcribe a spoken idea | OpenAI `gpt-4o-transcribe` |
| `POST /api/content-ideas/research-topic` | research a topic Krish names; inserts a `drafting` row with a live `lane_slot` | Perplexity `sonar-pro`, then Exa, then Brave; Sonnet [`cleo-research-topic`] |
| `/api/content-ideas/[id]/materials` | list, attach or remove `meta.materials` | none |
| `/api/feed/ingest` (cron) | two days of the CTRL corroborated-headlines pool through the beat gate and relevance classifier; every story to `trend_observations`, survivors to `content_ideas` as news that expires at the Monday purge | CTRL Supabase, Haiku [`feed-ingest`] |
| `/api/discover-lens-radar` (cron) | Exa search by theme and creator; writes candidates to `lens_seed_candidates`, never ideas | Exa |
| `/api/discover-creator-posts` (cron) | Apify LinkedIn scrape, extracts the transferable move, at most 3 ideas a run | Apify (charge cap $0.25), Sonnet [`creator-scout`] |
| `/api/discover-build-signals` (cron) | Krish's GitHub commits per repo-week become `build_signal` ideas | GitHub |
| `/api/inspiration/drive-scan` (cron) | reads screenshots and documents from a Drive folder with a vision model; upserts seeds | Google Drive, Sonnet [`inspiration_scan`] |
| `GET /api/content-seed-candidates` | the composer's seed rail | none |
| `/api/aeo/ingest`, `/api/aeo/context` | the AEO engine lands packets and reads context; recommendations become `aeo_signal` ideas | none |
| `/api/investigations/run` (cron), `anchor`, `[run_id]/draft-check`, `[run_id]/trace` | the weekly investigation: anchor, decompose, climb the why-ladder, run budgeted harnesses, gates G1 to G6; attaches an evidence manifest | Sonnet and Opus [`investigations`], Perplexity `sonar` |

### 2. Curation: judge, repair, route, rank

| Route | What it does | Model |
|---|---|---|
| `POST /api/content-ideas/[id]/judge` | puts one piece before the panel. Idea gate: 9 judges (novelty, evidence, consequence, reader, buyer, connection, fun, standing, prosecutor). Draft gate: 7 (hook, clarity, personality, evidence_integrity, voice, channel_fit, prosecutor), which read the subchannel's mandate and the sources on file. Free deterministic judges run first. The panel reports and never changes state | Haiku [`judge-<key>`] |
| `/api/judge/ladder` (manual) | expand the seed, judge, repair with research and re-judge, then route. Score is the lower median judge: 7 or more is `ready`, 5 or 6 `repairable`, below 5 `weak`. Nothing is buried. Sets `lane_slot` only when it is empty and the router's pick is uncontested | Sonnet [`ladder-expand`, `ladder-repair`], Haiku panel and [`ladder-router`] |
| `/api/judge/sweep` (cron, every 10 minutes) | runs the ladder over the backlog; optional batch mode at half price | as the ladder, plus the Anthropic Batches API |
| `/api/content-ideas/[id]/score` | the Five Standards gate (unique, researched, thoughtful, kind, helpful) | Sonnet, or Haiku on the autoscore path [`standards`] |
| `/api/content-opportunities/refresh` (cron) | the editorial radar. Two lenses only, `money_of_ai` and `built_with_ai` | Sonnet [`editorial-radar-*`] |
| `POST /api/content-ideas/[id]/editorial-route` | approves a radar lens into a child idea with `lane_slot` `money_of_ai` or `built_with_ai` | none |
| `/api/triage/sweep` (cron) | deterministic grader; buries idle agent-created rows in five tables and soft-drops content buried over 15 days | none |
| `/api/content-ideas/cluster` (cron) | embeddings backfill, then clustering at cosine 0.78 or more | Haiku [`cleo-cluster`] |
| `/api/content-ideas/archive-stale` (cron) | archives idle ideas | none |
| `/api/shifts/detect` (cron), `/api/shifts/[id]` | proposes shifts over a 21-day corpus through a deterministic gate; Krish's rulings on them | Sonnet [`shifts-*`] |
| `/api/arcs/surface` (cron) | composes, lints and scores arc cards; surfaces 7 | Sonnet [`arcs-*`] |
| `/api/content-decisions/[id]`, `likely-reasons` | resolves a weekly queue card; predicts reject reasons | Haiku [`content-decisions`] |

### 3. Drafting and iteration

| Route | What it does | Model |
|---|---|---|
| `POST /api/content-ideas/[id]/draft` | writes a 700 to 1000 word draft to the subchannel's mandate from everything curation left on the row (`api/_curation.ts`); refuses an unrouted idea (409 `no_subchannel`); moves `seeded` or `researching` to `drafting`; keeps the last 10 drafts | Sonnet [`cleo-draft`] |
| `POST /api/content-ideas/[id]/revise` | streams a rewrite preview (tone, length, zoom, feedback, humour; in place when given a selection). Reads the mandate. Never writes `body`; the caller saves an accepted rewrite | Sonnet, or Opus for humour [`cleo-revise`], prompt caching on |
| `POST /api/content-ideas/[id]/final-pass` | the ship-moment rubric: instant fails, autofixes, suggestions, a verify list; judged against the subchannel's mandate, or the investigation rubric when an evidence manifest is attached | Sonnet [`cleo-final-pass`] |
| `POST /api/content-ideas/[id]/fact-check` (`GET` reads the last result) | the fact gate (`api/_factGate.ts`). Lists every checkable claim, sweeps the body so no sentence with a number or a quotation escapes, then checks each claim twice: against the sources on file (the model must quote up to three passages verbatim that carry the claim's numbers, and code confirms them) and independently on the web (Perplexity `sonar-pro`, else Exa or Brave judged), whose verdict counts only when a second model finds its quoted evidence bears it out. One source is enough only when it is a verbatim excerpt (a material filed with `verbatim: true` and its URL); a claim found only in a summary needs the web to agree. Stores `meta.fact_check`, pinned to a hash of the exact body | Sonnet [`fact-gate-*`], Perplexity |
| `POST /api/content-ideas/[id]/dive-deeper` | suggests research questions or runs one scoped dive and files it as a material | Perplexity `sonar-pro`, Sonnet [`cleo-dive-deeper`] |
| `POST /api/content-ideas/[id]/challenge` | steelman, counter-case, sharper take | Perplexity, NewsAPI, Apify, Sonnet [`cleo-challenge`] |
| `POST /api/content-ideas/[id]/deepen` | comparison research. Accepts only `paid` and `built` | Sonnet [`cleo-deepen`] |
| `POST /api/content-ideas/[id]/chat` | conversation with Cleo on a piece | Sonnet, metered as `unattributed` |
| `POST /api/content-ideas/synthesize` | merges 2 to 25 cards into one `drafting` piece and marks the sources `absorbed` | Sonnet [`cleo-synthesize`] |
| `/api/briefs/assemble` (cron), `/api/briefs/[week]`, `revise`, `notes` | the weekly brief: one investigative opinion piece plus its decision cards | Sonnet [`briefs-*`] |

**The fact gate, in practice.** A second model reads every sentence the
claim lister did not cover (twelve at a time, with its section heading), and
a sentence is set aside as a joke, scenario, guess or the piece's own
prediction only when both readings agree; a sentence with a number is never
set aside unless it reads as a forecast. Sources are strongest filed word for
word: `apps/control-plane/scripts/file-verbatim-source.ts` files a page's own
words (title, dates, matching passages) with its URL. Krish runs a check from
the composer's "Check the facts" strip in Control Center. Piece 2 took ten
runs to pass, and the fixes each run forced are in the walk log (H12 to H14).

**The fact gate.** A piece on a live subchannel cannot reach `review`,
`approved` or `published` (through `PATCH /api/content-ideas` or `save-draft`)
until a fact check of its exact current body has passed: every claim verified,
an independent checker connected, and the body unchanged since the check apart
from the dashes `save-draft` swaps for commas. Anything else is a 409
`fact_gate` with a plain reason. Relaying Krish's decision does not skip it.
Krish asked for it on 2026-09-25, after the engine's first draft of a piece
rescaled Cisco's $900 million a year to "close to a million dollars".

**Krish's house rules** (`api/_houseRules.ts`). Every ruling Krish has given
in words is one record: the instruction, his exact words, the date, live or
on trial, and the stages that enforce it. Writers read them through
`VOICE_GUARDRAILS` (the joke pass included), the drafter and rewriter add the
rules scoped to their subchannel, both judge gates put the rules for their
gate in every judge's context, and the final pass builds its absolutes from
them. House rules win over a mandate where they disagree, so every piece
ends with a dated prediction. `tests/control-plane/house-rules.test.ts` fails
when a live rule reaches no stage.

**Before approval** (`api/_publishChecks.ts`). `approved` and `published`
also need the checks a machine can make: the fact gate, no "Not X, Y", no em
dashes, no exclamation marks outside quotes, a reading age of 13 at most (12
to 13 warns), and a prediction with a date and a percentage. Anything else is
a 409 `publish_gate` naming what is left. `GET /fact-check` returns the whole
checklist, whether the piece is `ready`, and its receipts.

**Receipts** (`api/_receipts.ts`). For every claim that passed, the source's
own words the gate found it in, with the page: the proof a Short, carousel or
web edition shows on screen. Only verbatim passages from sources on file;
nothing in a receipt is written by a model.

### 4. Channel selection and per-channel copy

| Route | What it does |
|---|---|
| `POST /api/content-ideas/[id]/channel-cut` | one channel's cut (substack, linkedin, youtube, instagram, podcast, signal_noise) into `transformed_outputs[channel]`; flags any number missing from the source [`cleo-channel-cut`] |
| `POST /api/content-ideas/[id]/video-script` | a 15 second to 20 minute script into `transformed_outputs` [`video`] |
| `POST /api/content-ideas/[id]/save-draft` | sends the draft to the n8n content factory, which makes a Google Doc, and moves the piece to `review`. Its channel map knows `paid`, `built` and older channels only |
| `POST /api/briefs/[week]/push` | pushes an approved brief to the factory, once per channel |
| `POST /api/content-ideas/[id]/schedule` | sets `scheduled_for` |

### 5. Handoff to the Studio

`POST /api/content-ideas/[id]/production-brief` needs state `approved`, a
matching approval hash and `confirm_hard_gates: true`, and writes a
`ProductionBriefV1` with status `ready_for_studio`. It accepts only
`lane_slot` `money_of_ai` or `built_with_ai` (`api/_productionBrief.ts`), so a
piece routed to a live subchannel fails with `canonical_series_required`
(`docs/STUDIO.md`, "Series and subchannels"). The runner then leases and
completes briefs through `/api/video-studio/runner/production-brief-claim` and
`-complete`. The other `/api/video-studio/*` routes serve the runner protocol
(claim, heartbeat, complete, project, preview upload and retention, credential
probe), Krish's review decisions, command queueing and recovery, learning
proposals, and the `mindmake-studio` MCP gateway. None of them calls a model.

### 6. Publishing

Nothing here publishes. `PATCH /api/content-ideas` with `state: 'published'`
records that Krish published a piece (and a ship); it does not post anything.

### 7. Learning

| Route | What it does |
|---|---|
| `POST /api/content-edits` | appends one event to the edit ledger, `content_edit_events` (admission rules in `api/_editEvents.ts`) |
| `PATCH /api/content-ideas` | the single choke point for body edits and state moves; writes `manual_edit`, `approved`, `binned` and `published` events |
| `/api/learning/compile` (cron, Sundays) | the weekly compiler. Proposes, never changes config: presets he never keeps, judges that never change an outcome, hand rewrites after an accepted machine edit. Reads only `actor = 'Krish'` rows that are not `observation_only` |
| `judge_calibration` (a view) | joins each judge's verdict to Krish's decision on the same panel run (`panel_run_id`) |
| `/api/trends/entities`, `/api/trends/metrics`, `/api/claims/resolve`, `/api/claims/rule` | trend tagging and weekly snapshots; claims coming due, and Krish's ruling on each |

**Whose event it is.** A request on the operator bearer acts as itself: its
rows carry `surface 'api'`, its agent client, `actor = <client>` and
`confirmation_state 'observation_only'`, unless the body says
`decided_by: 'Krish'` to relay a decision he made in words. An operator cannot
approve, drop or publish on its own say (403 `a_decision_needs_krish`).
`PATCH` with `edit_source: 'magic'` records no `manual_edit`, because the
accept is recorded by whoever accepted it.

### 8. Operations

| Route | What it does |
|---|---|
| `GET /api/content-engine/health` | commit, auth configured, missing variables, each job's last run, runner state |
| `GET /api/content-engine/ping` | commit and a ready flag, no auth |
| `/api/content-engine/runs/replay` | re-runs a registered job by calling its GET with `CRON_SECRET`; refuses `manual_only` jobs |
| `/api/purge/run` (cron, Mondays), `/api/purge/restore` | exports doomed rows to the `content-engine-archive` bucket and `trend_observations`, then hard-deletes expired news rows; deletes nothing if either copy fails. The engine's only hard delete |
| `POST /api/aeo/meter` | prices the AEO engine's token use into `meter_daily` |

Every scheduled route is wrapped in `withContentRun` (`api/_runs.ts`), which
writes one `content_engine_runs` row per run, and a redacted failure artifact
when it fails.

## Crons (`apps/control-plane/vercel.json`, all UTC)

All 20 have run-ledger rows in the last seven days (read back 2026-09-25).

| Schedule | Job | Route |
|---|---|---|
| every 10 min | `judge_sweep` | `/api/judge/sweep` |
| every 2 h | `inspiration_scan` | `/api/inspiration/drive-scan` |
| daily 02:00 | `trend_entities` | `/api/trends/entities` |
| daily 03:00 | `triage_sweep` | `/api/triage/sweep` |
| daily 04:00 | `content_cluster` | `/api/content-ideas/cluster` |
| daily 06:30 | `runner_watch` | `/api/video-studio/runner/watch` |
| daily 07:00 | `claims_resolve` | `/api/claims/resolve` |
| daily 10:00 | `archive_stale` | `/api/content-ideas/archive-stale` |
| daily 11:30 | `feed_ingest` | `/api/feed/ingest` |
| daily 12:00 | `editorial_radar` | `/api/content-opportunities/refresh` |
| Mon 09:00 | `lens_radar` | `/api/discover-lens-radar` |
| Mon 14:00 | `purge` | `/api/purge/run` |
| Tue 08:00 | `creator_posts` | `/api/discover-creator-posts` |
| Thu 21:00 | `investigations` | `/api/investigations/run` |
| Fri 17:30 | `shifts_detect` | `/api/shifts/detect` |
| Fri 17:50 | `arcs_surface` | `/api/arcs/surface` |
| Fri 18:00 | `briefs_assemble` | `/api/briefs/assemble` |
| Sat 05:00 | `build_signals` | `/api/discover-build-signals` |
| Sat 06:00 | `trend_metrics` | `/api/trends/metrics` |
| Sun 16:00 | `learning_compile` | `/api/learning/compile` |

The replay registry (`api/content-engine/_jobs.ts`) has 20 entries but not
`judge_sweep` or `judge_ladder`, which is why `check-run-recovery` fails. The
dashboard's copy of the schedule is `apps/control-plane/lib/contentEngineSchedule.ts`,
checked against `vercel.json` by `check-content-engine-schedule`.

## Models and spend

- Every Anthropic call is metered into `meter_daily` through the RPC
  `meter_add` (`api/_meter.ts`): one row per agent key per day, with cache
  reads and writes and the uncached price kept separately. Batch calls are
  priced at half. Prices live in one table, `api/_prices.ts`.
- Not metered by this code: OpenAI, and Perplexity, Exa, Brave and NewsAPI
  outside investigations.
- There is no global dollar cap in code. Limits are per run: the investigation
  budget (10 model calls, 8 searches, 24 fetches), Apify's $0.25 charge cap,
  the ladder's 10 ideas by default and 60 at most, the sweep's 80 and 200,
  and small insert governors on every collector.

## Where the data lives

One Supabase database is shared by this engine, Control Center, the Studio
projections and the rest of mind/make OS. `supabase/migrations/ORIGIN.md`
says the schema history up to 2026-09-08 stays in control-center and new DDL
lives here. In practice several tables used after that date have no migration
file here (`venture_formats.mandate`, `format_aliases`, the trend and claims
tables); they were likely applied directly.

The tables this engine lives on:

- **Ideas and pieces:** `content_ideas` (one row per idea or piece; its
  `meta` carries the ladder verdict, research, materials, drafts, revisions,
  final pass and Krish's notes; `transformed_outputs` carries channel cuts and
  production briefs).
- **Publication shape:** `venture_formats` (subchannels and their mandates;
  the authority), `format_aliases` (retired names).
- **Judging:** `panel_runs`, `judge_verdicts`, `judge_sweeps`,
  `judge_sweep_cache`, and the view `judge_calibration`.
- **Learning:** `content_edit_events` (append-only by trigger),
  `composer_sessions`, `mindmake_studio_learning_proposals`.
- **The weekly desk:** `weekly_briefs`, `content_decisions`, `shifts`,
  `shift_evidence`, `shift_beats`, `arc_cards`, `content_themes`.
- **Supply:** `trend_observations`, `lens_seed_candidates`, `content_creators`,
  `creator_moves`, `investigations` and its child tables.
- **Operations:** `content_engine_runs`, `content_engine_run_artifacts`,
  `meter_daily`, `system_config` (the voice block `content_voice_block` and the
  channel corpus `content_corpus`, both read live by every writer).

## Environment variables (names only)

Set on the Vercel project `content-engine`; `apps/control-plane/.env.example`
lists them. Groups: auth shared with Control Center (`ACCESS_CODE`,
`APP_ORIGIN`, `VIDEO_STUDIO_CSRF_SECRET`, `ENGINE_OPERATOR_TOKEN`,
`CRON_SECRET`, `LENS_RADAR_SECRET`); database (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CTRL_SUPABASE_URL`, `CTRL_SUPABASE_SERVICE_KEY`);
models and research (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`PERPLEXITY_API_KEY`, `EXA_API_KEY`, `BRAVE_API_KEY`, `NEWSAPI_KEY`); sources
(`APIFY_TOKEN` and actor names, `GITHUB_TOKEN`, `GITHUB_REPOS`, the Google
service account, `GOOGLE_DRIVE_FOLDER_ID`); the factory
(`N8N_CONTENT_FACTORY_WEBHOOK_URL`); the Studio (`VIDEO_STUDIO_RUNNER_TOKEN`,
`VIDEO_STUDIO_RUNNER_SIGNING_KEY`, `VIDEO_STUDIO_MCP_TOKEN`,
`VIDEO_STUDIO_EXPORT_TOKEN`, `VIDEO_STUDIO_PREVIEW_BUCKET`); AEO (`AEO_REPO`,
`AEO_DISPATCH_TOKEN`, and `AEO_ENGINE_SECRET`, which is missing from
`.env.example`). Never write a value into this repository.

## Checks

- `npm run check:control-plane` runs 28 guards in `apps/control-plane/scripts/`
  (supply, judging, content lifecycle, operations, security and the Studio
  bridge); it is part of `npm run verify` and skipped on Windows. All pass
  since walk log H16.
- `npm run typecheck:control-plane` typechecks the app and its scripts.
- `tests/control-plane/` holds 38 vitest files, run by the root `npm test`.
  A test that imports engine code belongs here: the root typecheck covers
  only top-level `tests/*.ts`, under settings the engine was not written for.
  Tests that call a handler point Supabase at a dead local address, so a
  missing guard fails as a connection error rather than a production write.
- `apps/control-plane/scripts/run-endpoint.ts` runs one handler locally;
  `apps/control-plane/scripts/eval/` is a prompt A/B harness.

## Driving it from an agent session

1. Use the operator bearer from a secret store the session was given; never
   print it, commit it or paste it into chat.
2. Your own calls are observations. Relay a decision only when Krish made it
   in words in the session, with `decided_by: 'Krish'`.
3. Run calls that write `meta` one at a time: most routes read the row, call a
   model, then write the whole `meta` back.
4. Keep spend inside what Krish approved for the session, and read
   `meter_daily` to check it.
5. Write what you find in `docs/walks/` or the relevant document, never only in
   the chat.
6. Before a piece can move on, its facts must pass the gate. File the sources
   you used as verbatim excerpts with `file-verbatim-source.ts` (a summary
   alone never passes a fact), run `POST /api/content-ideas/:id/fact-check`,
   and fix or cut what it lists. Where you attribute words, use the source's
   own words; the piece's house translations ("brain" for model) belong in
   the writer's voice, never inside a quote or a paraphrase of one.
7. A web edition goes in `editions/` with the exact text that passed and the
   gate's record (`editions/README.md`); its test fails if the page says
   anything the gate did not check.
8. When Krish gives a new ruling in words, add it to `api/_houseRules.ts`
   once, with his words and the stages it touches, and let the coverage test
   tell you which stage still ignores it. Never copy a rule into one prompt.
9. After every push to `main`, read `main`'s CI before the next push (walk
   log F20).

## Development notes

- Imports use NodeNext `.js` specifiers.
- No local dev server: use `npm run typecheck:control-plane`,
  `npm run check:control-plane`, the tests and `apps/control-plane/scripts/run-endpoint.ts`.
- `main` deploys to production on push; a branch gets a preview deployment.
