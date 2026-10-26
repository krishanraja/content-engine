# Handover: publish board part 2, Sunday's ideas from every source and a Queue that suggests combinations

Written 21 October 2026 by the session that built part 1 (PR #126, the fixed layout). Start a fresh session from
this file (cost guard G1: that session passed 500k tokens).

## Where things stand

- Part 1 is PR #126: one fixed board layout from the week of 26 Oct (Ideas, Queue, Mon, Wed, Fri; in each day Brief,
  Drafts, Record, Publish), phone layout, the lock (`verify()`, `npm run check:board-layout`, `board-ui-guard.mjs`),
  and house rule FEATURE (90-second and 5-minute videos; a 15-minute feature only when Krish calls one). Krish asked
  for it merged to main once green, then "start part 2 once it's merged".
- Krish's decisions for part 2 (21 Oct): his taste steers idea sourcing and ranking only, the judges stay blind;
  nothing in the queue is combined without his word; it should be ready for Sunday 25 Oct.
- Learning `queue-consolidation-and-fresh-sunday-ideas` (open) holds his words.

## First commands

```
python3 scripts/check_failures.py
git fetch origin main && git checkout -B claude/content-publish-board-ux-4dl7ai origin/main   # part 2 is a new PR
sed -n '/^## The fixed layout/,/^## Finished files/p' docs/PUBLISH_BOARDS.md
```

Then raise the blocker below with Krish before building "his ideas first".

## Live findings (read-only Supabase, Mindmaker OS project `gojpffsrxybbpbdzzrvs`, 21 Oct)
- **His ideas are not reaching the engine.** `content_ideas` holds one `source_type='manual'` row ever, from 23 Sep. `said_parts` and `tasks_inbox` are empty, and there are no `said-` board items. Ideas he drops in Control Center's content tab are not landing as `manual` rows. Part 2 must find where the content tab writes (control-center repo) before "his ideas first" can work. This is a blocker to raise with Krish, not to guess at.
- **Inspo folder ideas** are `source_type='inspiration_sweep'`: 211 rows in total, 49 in the last 14 days, the latest today, and 45 of the 49 embedded. So the Drive scan works.
- **Engine sources over the last 14 days:**
  - `pool_headline`: 33
  - `synthesis_hypothesis`: 12
  - `aeo_signal`: 6
  - `lane_sourcing`: 5
  - `week_research`: 2
- **The queue** has 4 rows, all `synthesis`, all embedded. Verdicts: story ×1, angle ×2, curious ×1. Enough to test "could combine" for real.

## Part 2 design

### A. The engine gathers every source and the taste evidence (`apps/control-plane`)

1. **`GET /api/week/options?week_start=&include=sources`** extends `apps/control-plane/api/week/options.ts`, so no new function is needed. It adds a `sources` block built by a pure, unit-tested `apps/control-plane/api/_weekSources.ts`:
   - **`his`**: `source_type='manual'` rows since the Monday before. These carry the `said:` ref, from Control Center's content tab and his spoken ideas.
   - **`inspo`**: rows the Drive scan wrote (`api/inspiration/_scan.ts`, `upsert_inspiration_seed`) in the last 14 days.
   - **`engine`**: every other source, `seeded`/`researching` from the last 14 days, with its ladder score.
   - Each entry carries `id, idea, thesis, lane_slot, source_type, source_url, created_at, score`. Excluded: buried, absorbed, library, and anything already scheduled or published.
   - **`taste`**: evidence only, never a model:
     - his `story` and `angle` verdicts and their angles (`meta.queue.triage`)
     - his picks (rank-1 week options and scheduled pieces)
     - A/B wins (`meta.queue.beat`/`lost_to`, today read only by `nextPair` in `_ideaQueue.ts`)
     - his `drop` verdicts
   - For each candidate, `why_here` names the nearest idea he liked, by embedding cosine of at least 0.75, reusing `parseVec` from `content-ideas/cluster.ts`. Example: "close to your Story mark on '...'". A candidate close to a `drop` gets a `near_drop` flag.
   - Ranking within each series: his ideas first, then candidates near something he liked, then ladder score. The judge ladder is untouched, and `scripts/check-judges.ts:602` keeps it blind.
2. **`GET /api/idea-queue?combine=1`** extends `apps/control-plane/api/idea-queue.ts`. It returns `combine` groups: two to five queued, non-dropped ideas joined by single-link cosine of at least 0.72. A pure `combineCandidates()` in `_ideaQueue.ts` uses the stored embeddings, so no model call is made. Each group carries its member ids, series and the members' so_what.
3. **Combining clears the queue.** `content-ideas/synthesize.ts` today flips sources to `absorbed` and leaves `queued_at`. When a source is queued, it should also clear `queued_at` and record `meta.queue.absorbed_into` and `combined_by: 'Krish'`, with his `said`. The route is only called after his Combine tap or words.

### B. The board shows them (`week_board.py`, guarded; Krish approves each edit)

1. **Idea cards** (`read_ideas`, `ideas_panel`) accept:
   - `source_kind`: `his`, `inspo` or `engine`, shown as a chip ("Your idea", "From your inspo folder", "Engine research")
   - `why_here`: the taste evidence line
   - `beats`: 3 to 5 beats of the narrative sketch, as asked in `docs/prompts/sunday-ideas-tab.md`

   In fixed-layout weeks, `source_kind` is required. Every other existing check stays: so_what, story, why_now, fact, https source, no title, at least 4 ideas per day.
2. **Queue tab "Could combine" slot**: `--combine combine.json`, a list of `{members:[queued ids], series, thesis, joins:[3 to 5 beats]}`. Each group is shown as one card with its members and a **Combine these** button. The button saves `queue/combine-<n>` with `{combine:true, members, at}` through the existing queue store.
   - `apps/control-plane/api/board/_contracts.ts` `validBody('queue')` must accept that body: a members array of uuids, `combine:true`, and `pick` = the doc id.
   - The tap only records his choice; the next session runs synthesize.
   - `week.js` gets the one handler, and the existing toast and state line are reused.
3. Update the layout snapshot (`check_board_layout.py --update`) to the new slot contents. Krish approves this, and the fixtures gain one combine group and the new card fields.

### C. One gather step, then judgment in the session

- **`scripts/post-pack/board_feed.py gather WEEK`** is read-only through `making._engine_call`, the engine key, with no spend.
  - It calls the two endpoints above and writes `docs/plans/<Monday>-week/sources.json`: the pool by series, with `his`/`inspo`/`engine`, `why_here`, the queue, and combine groups.
  - It prints counts per source, and says which source is empty and why. An empty inspo pool means no scan this week, or the Drive connector is needed.
- **plan-week skill** (`.agents/skills/plan-week/SKILL.md`, steps 1 to 3b and 7, then `--sync-claude`):
  - Run `gather` first.
  - Write `ideas.json` from the pool. His ideas come first, then inspo, then engine. Each idea is fact-checked as today, and gets `source_kind`, `why_here` and `beats`.
  - Write `combine.json`, the thesis and joining beats for each group worth combining. Drop groups that do not thread into one higher-level argument, and say why in the session reply.
  - Build with `--ideas --queue --combine`.
  - Copy his Combine taps with `synthesize` (decided_by Krish), exactly as the queue marks are copied today.
- **Learnings:** `queue-consolidation-and-fresh-sunday-ideas` moves from open to encoded, with markers in `_weekSources.ts`, `combineCandidates`, `board_feed.py` and the plan-week step.

### Reuse

- From the idea queue (`_ideaQueue.ts`): `present`, `parseTriage` and `nextPair`'s beat/lost_to data.
- From the ideas routes: `cluster.ts` `parseVec`, the cosine and its union-find shape, and `synthesize.ts` as is apart from the queue clearing.
- From the board: `queue_panel` and `ideas_panel` in `week_board.py`.
- `making._engine_call` for reads.

### Out of scope

- The Drive scan's 8,000-character cut and Word skip (`NOW.md:163`). The session reads the folder through the Drive connector, as the skill already says. This is noted, not changed.
- No scheduled task builds a board (AGENTS.md); Sunday's session runs it.

## Verification

- Vitest units for `_weekSources.ts`:
  - each source lands in its pool
  - scheduled and absorbed rows are excluded
  - `why_here` points to the nearest liked idea, and `near_drop` is set
  - his ideas rank first
  - the judges' inputs are unchanged, which `check-judges.ts` confirms
- Vitest units for `combineCandidates`: groups of 2 to 5, drops excluded, no model call. A synthesize test: a queued source is unqueued, with `combined_by: 'Krish'`.
- `week_board.py --self-test`: cards show their source chip, why line and beats; `source_kind` missing in a fixed week is refused; Combine cards render, and a combine doc passes `_contracts`.
- Run `tests/board-db.mjs` against the new queue body.
- `check_board_layout.py --browser` on the updated fixtures: no sideways scroll, 44px targets. Tapping Combine saves `queue/combine-1` in the runtime test.
- `board_feed.py gather 2026-10-26` against the live engine, read-only. It writes `sources.json` with non-zero `his`/`engine` counts, or names the empty source.
- `npm run verify`, `check_failures.py` and the full CI. Then a new PR; merge it when green, as Krish asked for part 1.
