# Handover: cost guards phase 2, done (18 October 2026)

Krish's instruction: "complete phase 2, complete and merge to main".

## Built and merged
- **G12**: Perplexity (fact check, challenge, enrich, dive-deeper, harness) and OpenAI embeddings metered in
  `meter_daily`. A fact-check run's calls are also stamped with the piece and the run in `meter_events`
  (`meterScope` in `api/_meter.ts`), and `lastFactRunCost()` reads that run's own total. Tests:
  `tests/control-plane/meter-runs.test.ts`.
- **G14, skills split**: make-piece 39.9 to 33.4 KB, produce-video 47.2 to 40.2 KB; references under
  `.agents/skills/*/references/`; `scripts/check_skill_core.py` (in `npm run verify`) passed against the pre-split
  commit.
- **G9**: main already had it (996544a, used for Friday). This branch's version was withdrawn before the merge.
  Difference for Krish: main's lets him sign off a line the evidence contradicts; the withdrawn one refused that.

## Not built, waiting on Krish
- **Migration** `supabase/migrations/20261024090000_meter_events.sql`: written, NOT applied. Until it is, the
  per-run rows are off and the estimate is the day average (tested both ways).
- **G13**: making the nightly judge sweep batch-only conflicts with his ruling in `api/judge/sweep.ts`
  (2026-09-24, fast turnaround). With one tick a day an idea takes 4 to 8 days; the saving was about $95 a year.
- **Live proof**: the next real fact-check run, with his approval for the spend.

## Verified on the merged tree
Typecheck, `npm run test` (139 files pass, including the style-references test, now fixed on main), every other
check in `npm run verify`, skills:validate, check_failures (29 guarded, 0 open).

## Left for the next session
The merge commit is on branch `claude/token-efficiency-content-dfb8q7`. If `main` does not yet hold it, push
it: `git push origin claude/token-efficiency-content-dfb8q7:main` (merge main in first if it has moved). One check
was cut short by the context ceiling: confirm that every line removed from the two skills since `origin/main` is
in their `references/` files (the moved sections came from the pre-merge files; main's merge applied cleanly).
