# The Video and Carousel Studio

Status: Current
Owner: Krish Raja
Last verified: 2026-09-25 against `main` at `fd467e1` (code read, no live run)

Scope: the Studio half of this repository: `packages/`, `apps/runner`,
`apps/renderer`, `config/`, `scripts/`, `.agents/skills/`. The content engine
in `apps/control-plane` is described in `docs/CONTENT_ENGINE.md`. How the two
fit together is in `docs/SYSTEM_MAP.md`; why either exists is in
`docs/NORTH_STAR.md`.

## What it is

The Studio turns an approved editorial brief into a finished Short or a swipe
carousel. It is deterministic: every stage writes content-addressed artifacts
into a job folder, every gate binds Krish's approval to an exact artifact
hash, and a changed input invalidates everything downstream of it. It renders
with Remotion, transcribes with a hash-locked Python runtime, and runs
unattended on Krish's Windows machine as a Scheduled Task that takes commands
from Control Center. It never publishes: YouTube upload is private-only, and
LinkedIn, TikTok and Instagram output stays a local package for a person to
post.

As of 2026-09-25 two Studio jobs exist in the database, no Short has a
recorded final approval, package or upload, and the runner is built and
merged but not verified installed (`docs/STATE.md`).

## Series and subchannels: two vocabularies, both live

Read this before touching any name.

- **The publication** routes pieces to three subchannels: follow.the.money,
  mind.the.gap and under.the.hood (`venture_formats`, read by
  `apps/control-plane/api/_subchannels.ts`).
- **The Studio** knows five series since 2026-09-26 (Krish: teach the video
  side the three names). The three live ones, `follow_the_money`,
  `mind_the_gap` and `under_the_hood`, and the two retired ones,
  `money_of_ai` and `built_with_ai` ("The Money of AI", "Built With AI"),
  which stay valid for good because they sit inside hashed and signed
  records (briefs, jobs, projections, render manifests) that are re-parsed
  strictly. The set is defined once in `packages/contracts/src/series.ts` and
  pinned on `video_studio_jobs` by a check
  (`supabase/migrations/20260926090000_video_studio_series_live_subchannels.sql`).
  `paid` and `built` remain the Studio's import aliases.

Each retired id is the past name of a live subchannel: `money_of_ai` of
follow.the.money, `built_with_ai` of under.the.hood (`SERIES_LINE`). Rules,
treatment presets and visual devices approved for a retired id serve its
successor, and a list naming both retired ids serves all three; every old job
matches exactly what it matched before. follow.the.money and under.the.hood
take their predecessors' formats; mind.the.gap has none yet, so its briefs
name no format and its carousels (which need one) wait for one. A piece on a
live subchannel gets a brief in its own name; a piece on a retired slot keeps
its retired id.

Still Krish's: **wordmarks.** A production render must carry the series'
official mark, pinned by hash in `config/studio.json`, and never recreated as
text. The three live subchannels have none yet, so everything up to the
branded render works for them (brief, job, script, plan, captions), and the
branded render refuses in plain words until he approves their marks.

### Taking live-name briefs on the Windows runner

The runner declares the series it can parse on each brief claim, and the
control plane hands a live-name brief only to a runner that declared it. An
older runner is only ever given the retired pair, so it keeps working, and
the cloud and the runner can update in either order. To take live-name
briefs, update the runner's checkout to `47f3944` or later, following
`docs/DEPLOYMENT.md`:

1. In the dedicated `runner-source` checkout: `git fetch`, then
   `git switch --detach <commit>`, then `npm ci`.
2. If `MINDMAKE_SOFTWARE_COMMIT` is set, set it to that commit or remove it.
3. Run `scripts/verify-runner-source.ps1 -RequirePersistentLocation`.
4. Restart the Scheduled Task and prove its lifecycle as `docs/DEPLOYMENT.md`
   describes (stop, read-only preflight inactive, start, healthy status).

No credential or signing key changes.

## The V2 stage graph

Defined in `packages/core/src/stage-graphs.ts`, mirrored in
`packages/contracts/src/v2.ts`. Three source modes: `extract`, `solo` and
`short_native`. Two purposes: `production` and `calibration` (analysis only:
unbranded previews, no masters, packages or uploads).

```text
extract, solo:  ingest -> normalize -> transcript -> source_analysis -> candidates
                -> claims -> visual_plan -> assets -> styleframes -> animatic
                -> treatment -> render -> qa -> package
                (brief, script and recording_brief start as skipped)

short_native:   brief -> script -> candidates -> claims -> recording_brief
                -> ingest -> ... -> package
```

Approval gates, in order: `angle`, `visual_plan`, `evidence`, `storyboard`,
`animatic`, `treatment`, `final`, `package` (`config/studio.json`). Each takes
a confirmation bound to the gate and the exact artifact hash, in the portable
form `studio-user-confirmation:<client>:<gate>:<hash>:<receipt>`; the older
`codex-user-confirmation:` and `control-center-confirmation:` forms remain
valid for records already made (`docs/ENGINE_SESSION.md`).

The V1 graph still exists only so V1 jobs can resume. New work is V2.

## What each part does

| Part | What it does | Where |
|---|---|---|
| Contracts | zod schemas for every artifact, gate, brief and runner message | `packages/contracts` |
| Core | the job store, stage logic, editorial gates, evidence, art director, feedback, runner protocol | `packages/core` |
| CLI | the `studio` command; `studio --help` and `studio v2 --help` print the machine-readable groups | `packages/cli`; `scripts/studio.ps1` on Windows |
| Runner | a Windows daemon: heartbeats, Drive Inbox discovery, claims queued commands and approved production briefs from Control Center, writes signed local decisions | `apps/runner`, logic in `packages/core/src/runner.ts` |
| Renderer | Remotion compositions `MindmakeStoryV2` (1080x1920), `MindmakeCarouselSlide` (1080x1350) and the V1 `MindmakeShort` | `apps/renderer` |
| Carousel director | authored swipe stories of 5 to 10 slides; PNG for Instagram, PNG plus PDF for LinkedIn | `packages/core/src/carousel.ts`, `config/carousel-visual-direction.json` |
| Station harnesses | a typed boundary (`station.json`) and a judgement card (`STATION.md`) per stage; checked for parity with the stage graph by `npm run check:stations`. Nothing reads them at runtime | `.agents/skills/mindmake-video/stations/` |
| Art director | one governed registry of visual devices with fail-closed eligibility and scoring | `config/techniques.json`, `docs/ART_DIRECTOR_REPERTOIRE.md` |
| Learning | local feedback lifecycle (`observed` to `active`); a rule is active only when it is in reviewed Git config; cloud session and learning tables | `packages/core/src/feedback.ts`, `config/studio.json`, `supabase/migrations/20260907091923_studio_session_learning_spine.sql` |

The CLI groups: `doctor`, `status`, `resume`, `index rebuild`; `carousel
method|validate|render|package`; and under `v2`: `production-brief
import|materialize`, `identity`, `job create|status|resume`, the stage commands
(`ingest`, `transcribe`, `candidates`, `recording-brief create`, `stage
import`, `source analyze`), `repertoire`, `visual-plan`, `assets`,
`styleframes`, `animatic`, `treatment`, `render`, `qa`, `approve`, `feedback`,
`package create|archive`, `publish youtube` (private only), `magic`, `inbox`,
`runner once|status|resolve-project-conflict|project|daemon`, `analytics
import` and `experiment`. Stdout is JSON; diagnostics go to stderr.

## How it connects to the rest

- **Production briefs.** Control Center approves a brief built by the content
  engine (`api/content-ideas/[id]/production-brief.ts`). The runner claims it:
  a short-native brief becomes a job at once, an extract or solo brief waits at
  `awaiting_source_bundle` for a reviewed Drive source, and a carousel-only
  brief is recorded without a video job. The carousel director does not read
  briefs; carousel stories are authored separately.
- **Runner protocol.** The runner POSTs only to the runner routes (`claim`,
  `heartbeat`, `complete`, preview upload and retention, `project`, brief claim
  and complete) under `/api/video-studio/runner`. Its default base URL is
  Control Center's origin (`packages/core/src/runner.ts`), which rewrites the
  path to this repository's control plane, where
  `apps/control-plane/api/video-studio/` serves it. Cloud state is a redacted projection;
  the local job folder and its append-only ledger are the truth for media.
- **Tracked sessions.** An agent that wants to act on the Studio opens a
  session through the `mindmake-studio` MCP server (`.mcp.json`,
  `.codex/config.toml`). The proxy is Windows-only and reads its token from
  Windows Credential Manager, so a cloud session is `read_only_untracked`.
  The gateway grants read, feedback and learning-read capabilities only.
  `docs/ENGINE_SESSION.md` is the contract.

## Rules that hold everywhere in the Studio

- Nothing publishes itself. YouTube is private-only; other platforms get local
  packages.
- Brand marks are the official files from a pinned `krishanraja/mindmake`
  commit, SHA-256 verified. If no placement keeps the series lettering at 50
  render pixels or more without covering Krish or the story, rendering and QA
  fail; the mark is never shrunk or retyped.
- Rendering fails closed unless Remotion licence eligibility is recorded in
  `config/studio.json`; `studio doctor` checks it.
- Evidence is its own gate: sources must be authoritative, fresh and specific,
  and every screenshot is approved against its file hash.
- Captions are deletion-only, in the original spoken order. Synthetic speech
  is prohibited. Generated imagery is illustration only and must say so.
- Krish is always named Krish.
- Media, credentials, OAuth state, job data and derived indexes never enter
  Git.

## Quick start (Windows)

```powershell
npm ci
.\scripts\migrate-runner-runtime.ps1
npm run bootstrap:python
.\scripts\studio.ps1 doctor
.\scripts\studio.ps1 v2 job create --series money_of_ai --mode extract --source-bundle "C:\media\episode.source-bundle.json"
.\scripts\studio.ps1 v2 ingest --job <job-id>
```

The Python runtime and a shared headless Chrome live under the Windows runtime
root, so disposable checkouts and the Scheduled Task share them. In a new Codex
chat, the complete first message `Video engine` launches the operator workflow
(`.agents/skills/video-engine/SKILL.md`); nothing else does.

## The detailed Studio documents

Each is current for the Studio except where the note says otherwise
(audited 2026-09-25).

| Document | What it settles | Known stale |
|---|---|---|
| `docs/ENGINE_SESSION.md` | the tracked session contract and what may be captured | nothing |
| `docs/ARCHITECTURE.md` | state model, media decisions, learning boundary, runner protocol | short-native now starts only from `ProductionBriefV1`; "Inter 800" is V1 only; the radar section predates import-only; says "Codex authors" where any client may |
| `docs/OPERATIONS.md` | setup, typical runs, recovery, failure codes | examples use the legacy `codex-user-confirmation:` prefix; "never creates a job automatically" predates brief intake; "16 scheduled jobs" is now 20; "podcast" is not a mode |
| `docs/DEPLOYMENT.md` | secrets, runner install, the shipped versus installed boundary | treats Control Center as the API host (the routes moved to `apps/control-plane`, ADR-019); upstream review order and rollout checklists are historical; omits the MCP token |
| `docs/ENGINE_SECRETS_HANDOVER.md` | the Windows credential contract | says the runner is installed, which nothing else records |
| `docs/CAROUSEL_ENGINE_STATE.md` | the carousel engine's gate and decision record | last verified 2026-09-07; calls the repo `mindmake-video-studio`; its test counts are old |
| `docs/ART_DIRECTOR_REPERTOIRE.md` | the visual device registry and the sharp-alternative path | nothing |
| `docs/OPENING_LOOP_CALIBRATION.md` | the opening contract (promise match, open question) | nothing |
| `docs/REFERENCE_VIDEO_CALIBRATION.md` | the calibration record behind the active preferences | nothing |
| `docs/REFERENCE_INSTAGRAM_AD.md` | a reference Krish liked (proof panels, split frame), proposed and not confirmed; two conflicts with the confirmed standard await his ruling | nothing |
| `docs/FILM_CREATIVE_JURY.md` | the film jury; it lives in `apps/control-plane/api/_judges/film.ts` | nothing |
