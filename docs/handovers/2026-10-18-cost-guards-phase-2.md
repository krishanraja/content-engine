# Handover: cost guards, what is left (18 October 2026)

Start a fresh session with: "Read docs/handovers/2026-10-18-cost-guards-phase-2.md and build what it lists."
Read `docs/COST_GUARDS.md` first: its quality test decides what may be built. Branch
`claude/token-efficiency-content-dfb8q7` holds everything done so far (G1–G8, G11; G10 dropped, measured).

Session that wrote this: 60+ calls, read about 12M tokens; its three transcript readers read 13.6M more.

## Krish's instruction (18 October 2026)

"complete phase 2, complete and merge to main". So: build items 1 to 4 below, verify, then merge the branch into
`main` and push. His words cover the merge. They do not name applying the migration to the live database: write
it, make the code work whether or not its columns exist yet, and ask him before applying it. G9 is built exactly
as `docs/COST_GUARDS.md` describes it (a line he passes in his own words is set aside with those words on the
piece); it never passes a line without his words.

## To build, in this order

1. **G12, meter what is missing.** Perplexity (`fact-check.ts` web check, `challenge.ts`, `_harness.ts` sonar)
   and OpenAI embeddings (`_embeddings.ts`) through `_meter.ts`; add `piece_id` and `run_id` to meter rows (a
   migration under `supabase/migrations/`; applying it to the live database needs Krish's approval). Then
   `lastFactRunCost()` can read a real per-run cost instead of a day's average.
2. **G13, timer judges at half price.** The scheduled judge sweeps go through `_judges/batch.ts` only. Prompts,
   model and judges unchanged. Read the cron routes first; prove one sweep's result equals the live path's.
3. **G9, Krish signs off named lines.** A line he passes in his own words is set aside with his words, so no
   paid rerun chases it. This touches a hard gate (truth): propose the exact behaviour to him before building,
   and keep the record of his words on the piece.
4. **Skills split** (lean start for production sessions). `make-piece` (40 KB) and `produce-video` (47 KB) keep
   their steps and gates in `SKILL.md`; long reference sections move to `references/*.md`, each step naming
   the one it needs. A script must show every house rule ID named in the old file is still named in the core.
   Run `python scripts/validate-skills.py --sync-claude`.
5. **The one live proof.** After the next real fact-check run (only with Krish's approval for that spend), read
   `meter_daily` for `fact-gate-on-file`: cache writes should be about one source set per run (they were about
   eight), and `fact-gate-second-look` should fall on a rerun.

## Waiting on Krish

- Turn off, for the content engine's environment, the connectors and plugins it never uses (`docs/COST_GUARDS.md`,
  "The environment is the floor"). It is the largest single saving per call and needs nothing built.
- G8 is a one-week Sonnet trial for produce-video: say if any cut needs rework, and it goes back.
