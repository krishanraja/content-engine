# The three-piece walk

A live log of taking one ready idea per subchannel from "judged ready" to the
edge of publishing, driven from a Claude Code session straight against the
engine's API rather than through Control Center. The point is to harden the
backend first and to leave durable knowledge for the front-end work that
follows, so nobody has to sift a chat transcript to learn what the engine
actually does.

Started 2026-09-24. Pieces are walked in series: the first finds the
structural holes, the second shows which were one-offs, the third proves the
path repeats.

**How to read this.** Four running sections sit above the per-piece logs and
are kept current as the walk goes:

1. *What the backend actually does*: verified behaviour, route by route, with
   the evidence. Code that was read counts as a claim until a live call has
   confirmed it, and each entry says which.
2. *Hardening*: every engine change made during the walk, with its commit.
3. *Front-end implications*: what Control Center must change, and why, stated
   so a front-end session can act on it without this conversation.
4. *Open questions for Krish*: decisions that are his, never settled here.

Each step in a piece's log records one of three outcomes: **works** (note it),
**missing** (build it), **wrong** (fix it).

---

## 1. What the backend actually does

Sources: every handler under `apps/control-plane/api/content-ideas/` read on
2026-09-24, Control Center's calls into it, live probes, Vercel runtime logs
and the database. **Read** means the code says so; **live** means a call or a
query confirmed it.

### Reaching it

- Control Center has no content routes of its own. `control-center/vercel.json`
  rewrites `/api/content-ideas/:path*`, `/api/content-edits`, `/api/video-studio/:path*`
  and a dozen other trees to the engine's production host. The browser calls
  relative paths and sends only `Content-Type` plus whatever cookie the domain
  holds; `apiFetch` adds no auth header. (read)
- **Auth is split in two, and most of the idea surface has none.** (read, live)
  - `guard()` in `api/_auth.ts` checks the `cc_access` cookie (a sha256 of the
    dashboard access code) and fails open only when the code is unset. It is
    set in production: a POST to `judge` for a nonexistent id returned 401.
    Used by `judge`, `editorial-route`, `production-brief`, and
    `/api/content-edits`. `archive-stale`, `cluster` and `triage/sweep` use
    `guardCronRoute` (bearer cron secret, or the cookie on POST).
  - `preamble()` in `api/_content.ts` checks only the HTTP method and sends
    `Access-Control-Allow-Origin: *`. **No auth.** Used by `challenge`,
    `channel-cut`, `chat`, `final-pass`, `revise`, `save-draft`, `schedule`,
    `score`, `research-topic`, `synthesize`, `voice`. `deepen`,
    `dive-deeper`, `materials` and `video-script` set CORS inline and check
    nothing either. So does the bare `/api/content-ideas` POST and PATCH,
    which can set `state`, `body` and `published_url` on any row.
  - 22 engine files use `preamble()` in total; only the idea routes are in
    scope for the walk.
- **The browser path through a guarded route is unproven.** In the 7 days to
  2026-09-24 the engine logged no browser call to any idea route at all, and
  no request ever reached `/api/content-edits`: every ledger row in
  `content_edit_events` came from the triage desk (direct SQL) or the open
  PATCH. Whether the rewrite carries the cookie, and whether both projects
  hold the same access code, has never been observed. The decide card built
  on 2026-09-24 records through `/api/content-edits`, so this is the first
  thing to confirm once a person uses it. (live)
- No n8n workflow and no engine code calls the idea routes, so gating them
  affects only the browser path. (read)

### Models and spend

- `claude-sonnet-5` for drafting-class calls ($2 in, $10 out per million
  tokens), `claude-haiku-4-5` for judges ($1, $5), `claude-opus-4-8` only for
  `revise` in humour mode ($5, $25). Temperature is never sent to sonnet-5 and
  thinking is disabled. (read, `api/_models.ts`, `api/_prices.ts`)
- Anthropic spend lands in `meter_daily` per agent key per day (a running
  total, so one call's cost is the difference before and after). Perplexity,
  Exa, Brave, NewsAPI and Apify are not metered. `panel_runs.cost_usd` and
  `judge_verdicts.cost_usd` are always 0. (read)
- **No drafting-class route has been called in 60 days.** `meter_daily` holds
  no row for `cleo-revise`, `cleo-final-pass`, `cleo-deepen`, `cleo-challenge`,
  `standards` or `video` in that window, while the ladder and judges logged
  daily. Stages 3 to 5 have not run at all, not merely failed. (live)

### The path an idea takes, and where it breaks

Intended order, with what each step writes:

0. Protect the row from the Monday purge, which hard-deletes `seeded` and
   `researching` rows past `expires_at` (`api/purge/run.ts`): PATCH
   `{state:'drafting'}`.
1. Research, optional, one call at a time: `dive-deeper`, `deepen`
   (`format` must be passed for any live slug or it 400s), `challenge`,
   `materials`. Only `meta.materials` and `meta.research` feed later steps;
   `meta.challenges` is written and read by nothing.
2. **First draft: no route drafts into an existing row.** `research-topic`
   and `synthesize` create new rows; `revise` rewrites text it is handed;
   `chat` replies. (read) This is the stage-3 hole.
3. Iterate with `revise` (SSE; returns text, writes no body), then PATCH the
   body.
4. Check with `score` (advisory) and `judge {gate:'draft'}` (7 draft judges;
   needs 400+ characters).
5. `final-pass {source_text}`: writes `meta.final_pass`, returns
   `cleaned_text`, writes no body. Instant-fail blocking is client-side only;
   nothing server-side reads `meta.final_pass`.
6. `save-draft`: posts to the n8n content factory with `krish_approved: true`,
   and only if that succeeds writes the body, a Google Doc link and
   `state:'review'`. It demotes an `approved` row back to `review`.
7. PATCH `{state:'approved'}` stamps `meta.production_approval` (body of 200+
   characters required).
8. `schedule {date}` writes `scheduled_for` only.
9. `production-brief`: only for `lane:'publication'` with slot
   `money_of_ai` or `built_with_ai`.
10. PATCH `{state:'published', published_url}` stamps `published_at`. (The
    handover said nothing writes the publish fields; PATCH does. Nothing
    automatic does.)

Known breaks the walk will hit, in order:

- **`lane` is null on every walk piece** (live). The ladder sets `lane_slot`
  and never `lane`, and no route can set `lane` or `lane_slot` on an existing
  row. Downstream, `laneToVenture` sends a null lane to the `dynamic`
  ("Unassigned") final-pass rubric and `laneToCorpusChannel` returns no
  playbook.
- **No stage knows the three live subchannels.** `laneToVenture`,
  `laneToCorpusChannel`, `save-draft`'s channel map, `deepen`'s format check
  and `production-brief`'s series check all speak the retired `paid` /
  `built` / `money_of_ai` / `built_with_ai` keys. `save-draft` also maps
  every non-`built` publication slot to `paid`.
- **Whole-`meta` overwrites.** `final-pass`, `revise`, `challenge` and
  `deepen` read `meta`, wait 30 to 120 seconds on a model, then write the
  stale copy back. Two calls at once lose one of them.
- **Ledger gaps.** A PATCH that only changes state (`published`, `dropped`)
  writes no `content_edit_events` row, so publishing never reaches
  `judge_calibration`. `chat` meters as `unattributed`. Nothing writes
  `composer_sessions`.

## 2. Hardening

| # | Change | Why | Commit |
|---|---|---|---|
| H1 | Every route under `api/content-ideas/` and the bare `api/content-ideas.ts` now calls `guardEngine()` (`api/_auth.ts`): the `cc_access` cookie or `Authorization: Bearer $ENGINE_OPERATOR_TOKEN`, refusing both when unset, origin pinned. `voice.ts` is wrapped rather than changing the shared `_whisper.ts`. `ENGINE_OPERATOR_TOKEN` created on the engine's Vercel project (sensitive, production only). | 13 routes, several of which spend or write, had no auth. The bearer lets a session with no browser drive the engine without holding `CRON_SECRET`. | see git log: `engine: gate the idea routes` |

Checks for H1: `tests/control-plane/engine-auth.test.ts` (9 tests) calls
every idea handler with no credentials and requires a 401, with Supabase
pointed at a dead local address so a missing gate cannot write to production.
Mutation-tested three ways (a route left ungated, fail-open on a missing
access code, the cron secret accepted); each was caught.

**Pre-existing failures, not from the walk** (red on the base commit
`3bb3b49` before any walk change): `check-run-recovery` (`judge_ladder` and
`judge_sweep` are not in `api/content-engine/_jobs.ts`) and
`check-cache-metering` (`api/_judges/batch.ts` and `panel.ts` read cache
token fields directly instead of through `readUsage()`). Two media tests fail
in a container without ffmpeg; they are environmental.

## 3. Front-end implications

- *(pending)*

## 4. Open questions for Krish

- **Rotate four credentials.** A Supabase CLI token, a Vercel access token, a
  GitHub PAT and an n8n API key were pasted into the walk session's chat on
  2026-09-24, so they are in that transcript. None was used. Replacements
  belong in the cloud environment's settings, not in chat.
- **`ENGINE_OPERATOR_TOKEN` after the walk.** Delete it, rotate it, or keep it
  and add it to the cloud environment so future sessions can drive the engine.
- **The browser path through `guardEngine` needs one real visit.** After H1
  deploys, open any idea in Control Center once. A 401 in the engine's logs on
  `/api/content-ideas/*` means the two projects hold different access codes or
  the rewrite drops the cookie; one revert restores the old behaviour.

---

## Piece 1: split.the.bill

`6cb0d213-1aa6-44d3-8dc2-0b91d8dde4df`. "Amazon's takedown of Muse is a
pricing dispute wearing a security notice." Panel 7, three model judges at 8,
lowest model judge 7; the only fault the panel named is the deterministic
voice check (an em dash or banned phrase in the angle).

| Step | Call | Result | Spend | Outcome |
|---|---|---|---|---|
| | | | | |

## Piece 2: mind.the.gap

`904658db-4df2-4537-a0ed-ebe93e081db7`. "Every AI lab now sells a menu instead
of a model, and the menu is the price list." Four model judges at 8; lowest
model judge `consequence` at 3. First live test of the missing mind.the.gap
corpus playbook.

## Piece 3: lift.the.lid

`5255dcd8-3772-420d-994c-6bf2ab5f06e3`. Salesforce's Koa
split. No judge at 8; lowest model judge `novelty` at 6.
