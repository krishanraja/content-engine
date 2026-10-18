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

## Krish's answers, 18 October 2026 (after the merge)
- "apply the meter_events migration": approved, for `supabase/migrations/20261024090000_meter_events.sql` on
  Supabase project `gojpffsrxybbpbdzzrvs` (Mindmaker OS) only. NOT applied yet: the cost gate (300k context
  ceiling) blocked the call. Next session: apply that file, read back `information_schema.columns` for
  `meter_events`, record it in `docs/COST_GUARDS.md` (G12 status) and the commit body.
- "keep the judge sweep, and yes":
  - G13: keep the nightly judge sweep live (his 2026-09-24 ruling stands). Mark G13 "Dropped (Krish, 2026-10-18)".
  - G9: "yes" answers "should a line the evidence contradicts be refused at sign-off?" Change main's `signOff` in
    `apps/control-plane/api/_factGate.ts` to refuse a `contradicted` line (only `unverified` may be signed off),
    with a test; commit body: `Ruling (Krish, 2026-10-18): a contradicted line cannot be signed off`. First list
    any existing `meta.fact_check.signed_off` entries with verdict `contradicted` and report them; do not rewrite
    them without his word.

## Verified on the merged tree
Typecheck, `npm run test` (139 files pass, including the style-references test, now fixed on main), every other
check in `npm run verify`, skills:validate, check_failures (29 guarded, 0 open).

## Left for the next session
The merge commit is on branch `claude/token-efficiency-content-dfb8q7`. If `main` does not yet hold it, push
it: `git push origin claude/token-efficiency-content-dfb8q7:main` (merge main in first if it has moved). One check
was cut short by the context ceiling: confirm that every line removed from the two skills since `origin/main` is
in their `references/` files (the moved sections came from the pre-merge files; main's merge applied cleanly).
