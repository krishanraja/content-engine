# Current state

Status: Current
Owner: Krish Raja
Last verified: 2026-11-12 against `main` at `02184d34` (the code, `apps/control-plane/vercel.json` and
`.github/workflows/`), GitHub Actions' own run records, and a read-only readback of the shared Mindmaker OS database
between 11:00 and 12:00 UTC the same day; the board's contract, the full verify, the engine's runs and what waits on
Krish rechecked against `main` at `3064e769`, the live view and the database between 13:30 and 14:30 UTC; the
workflows, the board's contract, the full verify and the week of 9 Nov's ideas rechecked on 16 Nov against `main` at
`4fcf48fb` (the code), GitHub's run and issue records and the live view between 08:30 and 09:30 UTC

`NOW.md` is the short version and says what is next. This page holds only what was checked on the day above, and
each line names where. The page it replaced (its 4 November list, the 19 October board cutover and a body last
verified on 25 September) is kept whole in `docs/history/2026-11-12-STATE-before-recheck.md`; read it as history.
When this page and the code disagree, the code wins: fix this page.

## What runs

- **The content engine** (`apps/control-plane`) runs on the Vercel project `content-engine` with 25 crons
  (`apps/control-plane/vercel.json`), each recording its runs in `content_engine_runs`. In the eight days to
  12 Nov every cron job wrote run rows. Their last results are under "Broken or risky".
- **GitHub Actions** (`.github/workflows/`, 20 workflows) holds this repository's scheduled jobs outside Vercel; no
  Claude routine or claude.ai schedule runs any of them (Ruling, Krish, 2026-10-29). On a schedule: `docs-steward.yml` (20:30 UTC nightly), `full-verify.yml`
  (03:23 UTC nightly, on a push to `main`, and started by `auto-merge.yml` after every merge), `engine-learning-weekly.yml` (Sundays 19:37 UTC), `sunday-ideas.yml`
  (Saturdays 12:17 and 20:47 UTC), `watch-cloud.yml` (every 15 minutes), `branch-sweep.yml` (Sundays 03:17 UTC: deletes
  branches whose work is on main and lists the rest) and `standards-checkin.yml` (Sundays 07:00 UTC, code only: the
  weekly standards check-in's data, `docs/STANDARDS-CHECKIN.md`). On events: `ci.yml`,
  `auto-merge.yml` (merges a pull request on green CI, then folds the closeout notes into `NOW.md`),
  `harness-repository-context.yml` and `now-trim.yml`. By hand or by dispatch only: `make-piece.yml`,
  `inspiration-piece.yml`, `produce-day.yml`, `place-takes.yml`, `repair-round.yml`, `offday-revise.yml`,
  `saturday-goodnews.yml`, `maxine-trial.yml` and `signoff-apply.yml` (started by his Approve or Not this on a video
  sign-off card; it writes the configs his presses name). `board-rebuild.yml` was removed with the old boards on 13 Nov.
- **The publish board.** The one live board is Control Centre's Content tab (`config/boards.json`,
  `live_board.url`; `python3 scripts/post-pack/live_board.py <Monday> [day]`), drawn from this engine's view
  (`GET /api/board/<Monday>/view`, `apps/control-plane/api/board/_view.ts`). The view's contract is 1.17.0
  (`VIEW_CONTRACT_VERSION`, `_viewContract.ts`; pull request #745, 16 Nov 2026: a prompt's notes and an open in Claude
  Code, a press's `after`, stills on style options and `model.repeats`; the live view answered 1.17.0 on 16 Nov 2026).
  Control Centre pins 1.17.0 from its pull request #926 (merged 16 Nov; its `tests/fixtures/board-view/PIN.json`, the
  schema and fixture byte for byte this engine's; 1.16.0 from its board's change of 15 Nov before it). The engine's own old pages at content.krishraja.com/board/<Monday>
  are retired for good (Ruling, Krish, 2026-11-13): every old address answers a permanent redirect (308) to the live
  board at the same week (`apps/control-plane/api/board/_handler.ts`, `OLD_PAGES`). How to use the board:
  `docs/PUBLISH_BOARDS.md`.
- **Video.** `scripts/ve.py` (ve) is the video engine and `scripts/quick-edit/` the fallback until ve passes
  Phase 3 (`docs/ve/STATUS.md` says what ve can do today). ve's design lock (`config/ve/design-lock.json`) is
  frozen for face-with-proof at 9:16; its 16:9 draft is "awaiting Gate 2".
- **The Studio's job route** (`packages/`, `apps/runner`, `/api/video-studio/*`) is not how videos are made today.
  Its database holds two `video_studio_jobs`, both retired on 7 September as a synthetic validation, and twelve
  `video_studio_commands`, the newest from 5 September. The runner's latest heartbeat (12 Nov, 11:51 UTC) reports
  commit `cc0657e`, status `degraded` and its Drive `unavailable`, with no receipts pending.
- **Ideas and pieces** (`content_ideas`, 12 Nov): 160 seeded, 83 researching, 21 drafting, 1 approved,
  12 published and 194 dropped; 3 were published in the seven days to 12 Nov, the source of the North Star number in
  `NOW.md`. The judge panel has 2,907 `panel_runs`.
- **Subchannels** (`venture_formats`): follow_the_money, mind_the_gap and under_the_hood are the active
  `subchannel` rows, beside `general` (a holding row) and `either`. `money_of_ai` and `built_with_ai` are retired
  and inactive; `format_aliases` maps them, `paid`, `built` and the two names retired on 2026-09-25 (`docs/GLOSSARY.md`, "Names") to the live
  subchannels, and `mindmaker_live`, `techonomic` and `builder_economy` to `general`.
- **Krish's rulings in code.** `apps/control-plane/api/_houseRules.ts` holds 59 house rules: 57 live and 2 on trial (`HOUSE_RULES`).
- **The failure loop.** `engine_incidents` holds 3 rows; the weekly job (`engine-learning-weekly.yml`) reads it with
  the failure and learning registers (`docs/learning/README.md`).

## On branch `story/engine-v5`, not on `main` (checked 26 Nov 2026 against `46bb11bc`)

Each line names the commit or file it was checked in; none of it is live until the branch merges.

- **The reader.** `config/beat.json` carries sports as a focus sector (25 Nov) and the `reader` row with the North Star
  line Krish approved on 26 Nov ("I approve the lines"; `docs/NORTH_STAR.md`). `_relevance.ts`, the reader and buyer
  judges (`panel-v3`) and `humour_check.py` read it (`5ca87d1b`).
- **The story engine.** The floor (`1c89d076`), the blind score's rubric and core (`b5646db0`, `ac1c1411`, `a8089bd9`),
  the pre-pick whys probe check (`f0c6ee1d`), the Sunday gate's `story` and `story_floor` codes from the rubric's `from`
  date, 2026-12-07 (`18602a2a`), close calls on the option card (`76d1a43a`), the off days on the reader's beat
  (`4a027b9d`, `7976f8ab`) and a checked wildcard on every Monday, Wednesday and Friday (`5a36cb70`). The procedure is
  `.agents/skills/plan-week/references/story-score.md`, wired into `sunday-ideas.yml`.
- **The blind proof.** Harness and protocol committed before any paid call (`e42ab3cd`;
  `docs/plans/proofs/2026-11-26-story-engine-v5/PROTOCOL.md`, frozen SHA `5a36cb70`). No paid run has been made: the
  proof's cache holds the two weeks' pools and old picks only, and no sheet has gone to Krish. Since the freeze,
  `46bb11bc` changed three engine files (`idea_checks.py`, `story_score.py`, `config/story-score.json`), so a real run
  refuses until the frozen SHA is moved again or that change is taken out.
- **The production cycle.** `config/cycle.json` and `scripts/post-pack/touch.py` (`e8c56bdc`, `84c6a18e`); connector
  touches queue in `.cache/touch/outbox.jsonl` while `CC_HARNESS_KEY` is unset, and the two workflows pass the secret
  through once it exists.
- **The kill list on Windows.** `idea_checks.kill_list_vetoes` passes `encoding='utf-8'` to node (`1c89d076`), so an
  em dash is vetoed on Windows too (`test_the_real_kill_list_runs`; `config/failures.json`
  `kill-list-windows-encoding`).
- **Every asset made here.** `config/asset-routes.json` and `asset_routes.py`, the captions step, the make flow's own
  judges, the Saturday Note, manifest schema 1.1 and the cycle's Growth rows (`b8721b05` to `a8db096f`), and the
  carousel format enforced as refusals (`46bb11bc`). Each Library call refuses with "the v5 Library is not on this
  checkout yet" on a checkout without it; the Library is on main (#984) and merged into this branch.

## Broken or risky

- **Full verify on `main`** is red from 16 Nov 08:08 UTC (issue #746, open): its `board-web` job ("Board sessions on a
  real Postgres") fails on `708dddd` and again on `4fcf48fb` with "db.from(...).select(...).gte(...).lt is not a
  function". The view's new read of the pieces of the 14 days before the week (`apps/control-plane/api/board/_view.ts`)
  calls `.lt`, which the query builder in `tests/integration/board-sessions-e2e.ts` did not have. The pull request that
  carries this page adds `lt`, `gt` and `in` to that builder; the next full verify on `main` says whether it is green.
  (The red of 12 Nov, issue #589, was fixed in pull request #592.)
- **The weekly failure loop's first pull request** (#743, the week to 15 Nov) is red and open: its NOW.md line takes
  `NOW.md` to 14,100 bytes, over the 14,000 that `check:workbench` allows, so `verify:quick` fails and it cannot merge
  itself.
- **`claims_resolve` failed every day** (5 to 12 Nov, every run): "there is no unique or exclusion constraint
  matching the ON CONFLICT specification". Its upsert named `onConflict: 'claim_id'`, and the only unique index on
  `claim_resolutions.claim_id` is partial (`claim_resolutions_one_due`, `WHERE event = 'came_due'`), which an
  `ON CONFLICT (claim_id)` cannot use, so no claim that came due was noticed. Fixed in code on 12 Nov
  (`apps/control-plane/api/claims/_notice.ts`, a plain insert); not yet proved live: the next run is 07:00 UTC.
- **`investigations`** failed its last weekly run (5 Nov): "grounding failed twice".
- **`learning_compile`** skipped its last weekly run (8 Nov): "only 0 edit events in 28 days: too thin to propose
  anything".
- **`editorial_radar`** (`/api/content-opportunities/refresh`, scheduled daily) wrote three run rows in the eight
  days to 12 Nov, the last at 12:00 UTC on 12 Nov (ok).
- **The Studio runner** reports itself degraded with its Drive unavailable (above).

The `taste_*` rows in the same run ledger are inspirationhouse's runs (`krishanraja/inspirationhouse`,
`src/runs.ts`), not this engine's.

## Waiting on Krish

Each is checked in the record that holds it; only his own words or presses close them.

- **A sound-effect set.** `config/sfx-approved.json` approves none yet.
- **Golden frames.** All 10 slots in `config/ve/golden-frames.json` are empty; at least 5 are wanted, and only his
  words naming a moment fill one.
- **Gate 2 on face-with-proof at 16:9** (`config/ve/design-lock.json`, `drafts`).
- **His answers on the week of 9 Nov's ideas board** (the live view, 16 Nov): Thu 12's `otherside` and one option on
  Fri 13 are still open; Wed 11's `tablefortwo`, Thu 12's `agentnotsetup` and Sat 14's `goodnews` and `spotai` are held,
  not approved by him. `beststicker` is approved, and the view shows it on Fri 13.
- **The `CC_HARNESS_KEY` secret** (branch `story/engine-v5`): Control Center's harness key as an Actions secret here, so
  the cycle's connector touches are sent, not queued in the outbox.
- **The blind proof** (branch `story/engine-v5`): his yes to the paid run (at most $10) once the frozen SHA question
  above is settled, then his answers on the sheet (`A++`, `A+`, `=`, `B+` or `B++` per pair) before the reveal.
- **The buyer judge** (`config/beat.json` `reader.judges.buyer.flag`): keep its rewrite for the v5 reader, or retire it.
- **Merging** `story/engine-v5` (origin/main and its v5 Library are merged in) and Growth's pull request 145.
- **Friday 13 Nov's creative sheet.** `docs/plans/2026-11-09-week/fri-preproduction/creative.json` has `signed: null`;
  nothing in its "after sign" list starts before he signs it.

## Where the history is

`docs/history/LOG.md` is the dated record; superseded documents sit beside it under `docs/history/`, each with a
banner naming its replacement. `docs/walks/2026-09-three-piece-walk.md` is the full engineering record of the first
live walk.
