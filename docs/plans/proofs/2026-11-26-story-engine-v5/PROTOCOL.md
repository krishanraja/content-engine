# Story engine v5: the blind proof protocol

Written and committed on 26 Nov 2026, before any paid call. Nothing in this file changes after the first paid call. A change after that point is a new proof with a new protocol file.

Frozen engine SHA: `313eef68db0db3e7f27a1e220cecd17ced03bbc4`

This is the head of `story/engine-v5` with the engine complete (commits 0 to 8). The proof harness (`scripts/post-pack/story_proof.py`, `config/story-proof.json`) lands in the commit that carries this file. A real run (`story_proof.py run` without `--dry`) refuses if any engine file differs from the frozen SHA. The engine files are listed in `config/story-proof.json` `engine_files`: `story_score.py`, `story_floor.py`, `whys-probe-check.ts`, `config/story-score.json`, `config/story-floor.json` and `config/beat.json`.

## What is being tested

The question is whether the story engine chooses stories Krish would rather make and read than the ones the old board led with or the ones he picked. The test is blind, run on two past weeks, with the thresholds below fixed in advance.

## Pools

Each week is read as it stood just before his first press on its own options (`scripts/post-pack/ideas_history.py` `FIRST_PRESS`, read from git), and only what was known before the board counts (`BOARDS`):

| Week | Known before (gather) | Board as pressed at | Board options (Mon/Wed/Fri) |
| --- | --- | --- | --- |
| 16 Nov | 2026-11-07T23:59:59 | 2026-11-09T13:05:00 | 4 / 4 / 4 |
| 23 Nov | 2026-11-16T12:54:11 | 2026-11-19T09:57:00 | 4 / 4 / 5 |

- On 23 Nov, the outcome rows before 19 Nov are a piece placed from the 16 Nov board and an off-day approval that moved with it. They are not presses on this board. His Friday pick was added on 17 Nov, so the board he pressed is the one that stood on 19 Nov.
- `story_proof.py pool` strips every option and pool story through `story_score.blind_view`. It stops if any key in `config/story-proof.json` `taste_keys` survives, at any depth.
- Pool stories created after the gather cutoff are dropped.

## Arms

- **Arm S, full selection.** Each hero day keeps its board options and adds pool stories:
  - its series pool's best stories, by the deterministic shortlist (fit plus named_thing, no call), up to `shortlist_per_day` (4);
  - then the stories with no series (unassigned), best first, filling the places left on Monday, Wednesday and Friday in turn.

  In the 16 Nov gather the series pools were empty, so its pool stories are all unassigned ones. Off days and Saturday have no pool lane, so Arm S re-ranks their board options only.
- **Arm R, re-rank only.** The old board's options, scored and ordered by the same engine.

Each arm runs the full engine in a working copy under the gitignored `.cache/proof/story-engine-v5/live/arm-<S|R>/`:

1. the floor (`story_floor.floor`);
2. `story_score.py angles --provoke --judge`;
3. `humour`;
4. `score` with the floor;
5. `order --fresh --write`.

The session supplies the blind judges (`story/judged.json`, from `story_score.py brief`) and the whys probes (`story/probes.json`, from the blind prober and `scripts/whys-probe-check.ts`), exactly as on a Sunday. A pool story that is still a bare headline is written up by the session as a full option (a sourced fact and its own angle) from its source, before scoring, with the same brief as the Sunday run and no sight of the board. A run without them exits 2 and spends nothing.

The engine's choice for a slot is the first option of the day as ordered. On an off day or a Saturday, that means the first option that is not a weekly series.

## Pairing

The old picks come from his final picks document (`picks/<day>`, the last press on it, a press taken back leaving nothing), by idea_id. They are read once, read-only, from `GET /api/board/<Monday>/outcomes`, or given as a picks file (`old --picks`). Where `scorecard.json` disagrees, the final picks document holds, and the conflict is listed.

The pairs are:

- **per hero slot (Mon, Wed, Fri of each week)**:
  - the engine's choice against the board's lead (the first option as he saw it), `hero_vs_lead`;
  - the engine's choice against his pick, `hero_vs_pick`;
- **per off day (Tue, Thu)**: the engine's choice against the board's lead, `offday_vs_lead`;
- **Saturday**: the engine's first non-weekly Saturday option against the board's, `saturday_vs_lead`. The weekly good-news carousel keeps its place in both arms.

That makes 18 pairs by design. Some pairs are not shown:

- **The same story on both sides**: a tie, not shown. It counts as `=` (0.5).
- **His pick is the board's lead**: the same pair as `hero_vs_lead`. It is shown once and not counted twice.
- **No pick on the board he pressed**, or **nothing to pair** (no non-weekly Saturday option): no pair, so the count falls.

Three of the 18 cannot form on these weeks, whatever the engine chooses (read from the picks and the boards with `old`):

- **16 Nov Friday, `hero_vs_pick`.** His final Friday pick (c00cd4e0) is the board's lead, so it is the same pair as `hero_vs_lead`.
  - `scorecard.json` says fri-4 (b019dbf8), written before he moved the pick on 13 Nov. The final picks document holds.
- **16 Nov Saturday.** At his first press, Saturday held only the weekly good news, so there is nothing to pair.
- **23 Nov Monday, `hero_vs_pick`.** No Monday pick is on the board he pressed: the Monday piece was placed from the 16 Nov board.

So at most 15 pairs form. A tie (the same story on both sides) is not shown and counts 0.5.

The zero-spend dry run (`run --dry` on both weeks and both arms, fake transports, flat middling inputs) runs every step and pairs 11 of the 15. The other four are ties under those flat inputs. Its choices mean nothing; it proves the plumbing only. It reserved $1.45 to $1.71 a run in a throwaway ledger, with 7 divergent ops a run.

## Blinding

- There is one card renderer for both sides (`story_proof.card`). It has four fields:
  - Slot;
  - What happened (the sourced fact, at most 35 words);
  - The angle (the engine's chosen angle, else the option's own, at most 25 words);
  - Source (the site only).
- House labels, board notes (what a card was rebuilt from, which day's question it serves) and a leading "Publication, date:" prefix are stripped from both sides (`config/story-proof.json` `card`).
- The order is a seeded shuffle, with exactly half the pairs New = A (the lower half when the count is odd).
- The key (`key.json`) is sealed in the gitignored `.cache/proof/story-engine-v5/`. The sheet prints only its sha256.
- Before Krish sees the sheet, a fresh subagent with no context gets the tells packet (cards only, `story_proof.py tells`). It must fail to tell new from old: fewer right than the tells bar below. If it can tell, only the renderer is changed (never the engine or the choices), the sheet is made again, and the check is run again.
- The sheet goes to `C:\Users\krish\AppData\Roaming\Claude\side-session-notes\local_6966f40e-b46e-4f8b-90f0-7ef4708dbbf1\story-engine-blind-proof.md`. It never goes to the board (its presses would pollute the scorecard and the learning) and never into an artifact.
- Krish answers each pair `Pnn: A++|A+|=|B+|B++ ; seen before? y/n ; would make A? y/n B? y/n ; note:`.
- `reveal` checks the key against the printed hash and refuses while any shown pair is unanswered.

## Thresholds

```json
{
 "thresholds": {
  "new_preferred": {"of": 18, "at_least": 13, "inconclusive_from": 11},
  "hero_vs_lead": {"of": 6, "at_least": 4},
  "new_on_refused_subject": {"at_most": 0},
  "tells": {"of": 18, "below": 13},
  "equal_counts": 0.5
 }
}
```

- `=` counts 0.5, and so does a tie not shown. A++ and A+ both count only as "A preferred" (B++ and B+ likewise). Strength is recorded but not weighted.
- **Pass.** All three of these hold:
  - New is preferred in at least 13 of 18 pairs;
  - New wins at least 4 of the 6 hero pairs against the board's lead;
  - no New card is on a subject the floor refuses with what was known before the board.
- **Inconclusive.** 11 or 12 of 18. This is not a fail.
- **Fail.** Anything else.
- When fewer pairs form than a bar was written for, the bar scales and rounds up: at least `ceil(13 n / 18)` of `n`, and `ceil(4 m / 6)` of `m` hero-lead pairs. The tells bar scales the same way: fewer than `ceil(13 n / 18)` right.

## Secondary measures (reported, not pass or fail)

- Arm R: the rank of each of his picks when the old options are re-ranked, against the old board's `rank1_picked`. That was 0 on both weeks' scorecards, though the final picks document now puts the 16 Nov Friday pick first.
- The would-make rate, new against old.
- "Seen before", split out, since recognition biases a preference.
- Blind-check accuracy, from the tells check.
- Spend: the ledger total, estimated against metered, and the chain-week change.

## Spend

- **Hard cap: $10** for the whole proof. This is the ledger `.cache/proof/story-engine-v5/spend.jsonl`, `--budget-usd`, never above `config/story-proof.json` `budget_usd`.
- **Estimate: about $1.5 to $1.8 a run**, about $6.6 for both arms on both weeks (dry-run reservations), plus at most $0.25 a council read if the council clears this caller.
- **The humour engine allows 200 reads a day.** The 23 Nov week's two arms need about 206 (115 and 91), so its Arm R runs on a later day.
- **Before each real run** (none spend before this check):
  - the frozen-engine check;
  - the proof budget against the run's estimate;
  - `divergent.chain_week()`, which must show room under the $15 weekly chain for the estimate.
- **The route's $5 a day and 18 divergent ops a day bind** (each run makes 7 divergent ops). So the 16 Nov week runs on one day and the 23 Nov week on the next.

## Limits

- **Hindsight.** He has seen these weeks, so the 30 Nov board is the forward hold-out. Its scorecard's `score_rank_of_pick` is the live measure.
- **Recognition.** He may recognise cards from two or three weeks ago, hence the "seen before" split.
- **Position bias.** The old picks were made on boards shown in the old order.
- **The old beat.** The old pools were gathered for the old "anything about AI" reader. A pool gap is recorded as a loss, never filled by a forced pick.
- **Small sample.** At most 18 pairs, so 11 or 12 is inconclusive, not a fail.

## No tuning on these weeks

- No weight, anchor, floor, keyword or prompt changes on the strength of these two weeks' results, before or after the reveal.
- The rubric is tuned only by Krish, in config rows, never automatically from picks.
- `results.json` is committed beside this file after the reveal. It holds ids, letters and counts only, never his words.
