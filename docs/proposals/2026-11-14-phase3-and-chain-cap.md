# Proposals for Krish's ruling, 14 Nov 2026: ve's Phase 3 test, and what the $15 chain counts

**Status: PROPOSAL. Neither is a rule until Krish rules on it in his own words.** Nothing here changes code, a cap or a
route. Written by the fleet audit's content-engine fix session (findings ve-3 and content-engine-4).

## 1. Phase 3: when ve replaces quick-edit

Today every document says "quick-edit stays the fallback until ve passes Phase 3", and none says what passing means
(`docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md` name Phases 1 and 2 only). With no exit test, both routes stay alive.

Proposed test. ve passes Phase 3 when **three consecutive series cuts** (any of Monday, Wednesday or Friday, long or
short) each meet all five of the following:

1. **Made on ve end to end.** Built from one signed `creative-direction.json` (`schema_version: 2`), with no quick-edit
   step and no hand-built composition, and filed with `ve file`.
2. **His Approve cut press** is on that cut's exact bytes. The Critic's verdict alone never counts.
3. **Pace inside his house band.** `ve pace` puts the cut inside the band in `config/ve/pace-references.json` for its
   shape.
4. **Clean `ve qc`, nothing beneath the floor.** No refusal from `ve qc`, nothing beneath
   `python3 scripts/floor.py --format long_video` (or `short_video`), and none of his standing nevers.
5. **Heard and watched.** The non-producer review (`ve-critic`) watched it at full size and heard it against its script
   (`config/failures.json`, `cut-called-done-unheard`).

If any cut fails, the count goes back to zero. Once ve passes, quick-edit stays only as a read-only fallback for one
more week, then is retired by his word.

Questions for him: is three the right number? Should both cuts of a piece count as one?

### Also proposed for this test (the repair lane, 14 Nov 2026)

Three points the test above leaves open, also for his ruling and not in force:

- **Rounds.** Each cut reaches his Approve within two full-cut rounds (`ve packet`'s round count); a third round
  resets the count.
- **No quick-edit rescue.** A cut that reached him and was then re-made on quick-edit does not count.
- **Pace as a watch, not a refusal.** A cut below every kept reference on both events per second and active frame is
  watched side by side with the slowest reference before it reaches his board; it is never refused on the number
  alone (THE_BAR). The pace line it would use already prints in `ve styles`, `ve lab render` and `ve packet`
  (`pace.beside_references`).

## 2. The $15 a week chain: which unit keys count

AGENTS.md and `docs/COST_GUARDS.md` set the cap (Krish, 2026-10-29: "happy with $15 a week") for "the engine's Vercel
crons, inspirationhouse's daily runs, the fact gate". No code reads it, and no list says which `meter_daily` rows
belong to it.

Proposed chain: `unit_kind = agent`, any model provider, with a `unit_key` in one of these families:

| Family | Unit keys |
|---|---|
| inspirationhouse daily runs | `inspirationhouse-*`, `inspiration-scan` |
| the engine's Vercel crons | `editorial-radar-*`, `judge-*`, `ladder-*`, `briefs-assemble`, `arcs-*`, `shifts-*`, `investigations`, `standards`, `feed-ingest`, `spine-check` |
| the fact gate | `fact-gate-*` (Anthropic and Perplexity) |

Proposed to leave out, each with its reason:

- **`aeo-*`**: AEO-Engine is a specialist with a spend cap of its own (fleet audit aeo-2).
- **Apify actors**: a pay-as-you-go ceiling pool, never a target (Control Center protocol, `credit_mode`).
- **Control Center's own agents**: `daily-move`, `ai-mirror`, `nell-*`, `network-intent` and the `n8n/*` nodes are its
  agents, not this chain.
- **Claude Code on his subscription**: tokens with no dollar amount.

What that chain cost, summed from `meter_daily` on 14 Nov 2026 (weeks start Monday; this week runs to Saturday):

| Week | Chain (proposed) | Of which inspirationhouse | Everything metered |
|---|---|---|---|
| 26 Oct | $15.45 | $1.68 | $39.80 |
| 2 Nov | $14.52 | $5.06 | $43.50 |
| 9 Nov (to 14 Nov) | $19.00 | $7.05 | $61.95 |

The biggest movers this week are `inspirationhouse-*` (mostly `inspirationhouse-tag`) and the fact gate's return
($3.13).

Proposed enforcement, once he rules, with no new table and no new cron:

- `_meter.ts` gains a weekly sum over these families, next to `lastFactRunCost`.
- The existing daily sweep skips optional runs (inspirationhouse tagging first) once the week passes $15.
- The sweep writes one board item saying so. It never stops the fact gate on a piece he picked.

Questions for him: is this the right list? Should the fact gate count inside the $15, or sit beside it?
