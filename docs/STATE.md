# Current state

Status: Current
Owner: Krish Raja
Last verified: 2026-11-12 against `main` at `02184d34` (the code, `apps/control-plane/vercel.json` and
`.github/workflows/`), GitHub Actions' own run records, and a read-only readback of the shared Mindmaker OS database
between 11:00 and 12:00 UTC the same day; the board's contract, the full verify, the engine's runs and what waits on
Krish rechecked against `main` at `3064e769`, the live view and the database between 13:30 and 14:30 UTC

`NOW.md` is the short version and says what is next. This page holds only what was checked on the day above, and
each line names where. The page it replaced (its 4 November list, the 19 October board cutover and a body last
verified on 25 September) is kept whole in `docs/history/2026-11-12-STATE-before-recheck.md`; read it as history.
When this page and the code disagree, the code wins: fix this page.

## What runs

- **The content engine** (`apps/control-plane`) runs on the Vercel project `content-engine` with 25 crons
  (`apps/control-plane/vercel.json`), each recording its runs in `content_engine_runs`. In the eight days to
  12 Nov every cron job wrote run rows. Their last results are under "Broken or risky".
- **GitHub Actions** (`.github/workflows/`, 18 workflows) holds this repository's scheduled jobs outside Vercel; no
  Claude routine or claude.ai schedule runs any of them (Ruling, Krish, 2026-10-29). On a schedule: `docs-steward.yml` (20:30 UTC nightly), `full-verify.yml`
  (03:23 UTC nightly, on a push to `main`, and started by `auto-merge.yml` after every merge), `engine-learning-weekly.yml` (Sundays 19:37 UTC), `sunday-ideas.yml`
  (Saturdays 12:17 and 20:47 UTC) and `watch-cloud.yml` (every 15 minutes). On events: `ci.yml`,
  `auto-merge.yml` (merges a pull request on green CI, then folds the closeout notes into `NOW.md`),
  `harness-repository-context.yml` and `now-trim.yml`. By hand or by dispatch only: `make-piece.yml`,
  `inspiration-piece.yml`, `produce-day.yml`, `place-takes.yml`, `repair-round.yml`, `offday-revise.yml`,
  `saturday-goodnews.yml` and `maxine-trial.yml`. `board-rebuild.yml` is kept as a record; its first step stops it.
- **The publish board.** The one live board is Control Centre's Content tab (`config/boards.json`,
  `live_board.url`; `python3 scripts/post-pack/live_board.py <Monday> [day]`), drawn from this engine's view
  (`GET /api/board/<Monday>/view`, `apps/control-plane/api/board/_view.ts`). The view's contract is 1.10.0
  (`VIEW_CONTRACT_VERSION`, `_viewContract.ts`; the live view answered 1.10.0), and Control Centre pins 1.10.0 (its
  `tests/fixtures/board-view/PIN.json` on `main`, the schema and fixture byte for byte this engine's at #597). The engine's own pages at content.krishraja.com/board/<Monday>
  are the read-only archive: a press made there is refused with 423 `archive_read_only`
  (`apps/control-plane/api/board/_readOnly.ts`, `_handler.ts`). How to use the board: `docs/PUBLISH_BOARDS.md`.
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

## Broken or risky

- **Full verify on `main`** was red from 12 Nov 09:53 UTC (issue #589, closed 12:24 UTC): the Windows suite failed
  `tests/control-plane/inspiration-actions.test.ts` on CRLF output, and the board's phone check failed because a
  long subscribe link widened the run-sheet past 390px. Both were fixed in pull request #592, and the full verify on
  `3064e769` (13:26 UTC) is green.
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
- **His answers on the week of 9 Nov's ideas board** (the live view, 13:30 UTC on 12 Nov): Thu 12's
  `beststicker` ("Your AI thinks it's the best. Guess who told it.", signed off in a session and filed in 3 Posts, so
  it waits on his Approve on the live board, the one press that puts it on the day) and `otherside`; Wed 11's
  `tablefortwo`; one option on Fri 13; Sat 14's `goodnews` and `spotai`. Thu 12's `agentnotsetup` is one post with Tue
  17's `povteach`, approved on Tue 17; his Approve on Thu 12 would move it there.
- **Friday 13 Nov's creative sheet.** `docs/plans/2026-11-09-week/fri-preproduction/creative.json` has `signed: null`;
  nothing in its "after sign" list starts before he signs it.

## Where the history is

`docs/history/LOG.md` is the dated record; superseded documents sit beside it under `docs/history/`, each with a
banner naming its replacement. `docs/walks/2026-09-three-piece-walk.md` is the full engineering record of the first
live walk.
