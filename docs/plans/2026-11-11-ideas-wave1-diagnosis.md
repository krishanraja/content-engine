# Why the ladder scores nothing, and why deep research aborts (the ideas quality plan, item 13)

Diagnosis only, 11 November 2026, from read-only reads of the live tables. Nothing was changed, paused or re-run, and
nothing was spent. Each cause below is **suspected** until a run proves it; the evidence is what the tables hold.

## The judge ladder: 0 of the 95 ideas created since 2 Nov carry a ladder score

- The daily judge sweep (`/api/judge/sweep`, 05:00 UTC) runs one sweep at a time. The one running now was created on
  30 Oct (`judge_sweeps` 8903e989), pinned its idea set then (80 ids, ideas made 23 to 29 Oct; 48 of them still exist),
  and has been `running` for 13 ticks. `loadRunning` returns it every morning, so no new sweep is created and **no idea
  made after 30 Oct is ever selected**. Read: `select ... from judge_sweeps order by created_at desc`.
- In live mode a sweep is done only when a walk reaches the end of its list before its clock (`done = live ?
  !report.ran_out_of_time : !ref`, `api/judge/sweep.ts` line 420). The breaker that fails a sweep after `MAX_TICKS`
  (20) counts only in batch mode (`overrun = Boolean(ref) && ...`), and live mode never has a `ref`. So a live sweep that
  runs out of time every morning stays `running` for good.
- It runs out of time because it re-judges the same few ideas every morning: on 11 Nov it judged six (ab8b41c2,
  003b202c, 0f12efb2, 5364a969, aaf688c7, 0fabec46) that already had a band, and skipped 40. An idea is judged again
  when the hash of its idea and thesis no longer matches its ladder record (`artifactOf`, `api/judge/ladder.ts` line 95),
  so something rewrites those ideas' text between sweeps; suspected: the repair step's own thesis rewrite, or another
  writer. Each re-judging spends (the plan's $5.75 over 4 to 11 Nov) and adds no new idea to the pool's scores.
- What would prove it, at no cost: compare the six ideas' `meta.ladder.artifact_hash` with the hash of their current
  idea and thesis, and read which writer last changed `thesis`.

## The weekly deep-research route: 8 of its last 9 runs aborted

- 7 of the 8 aborts (weeks 38 to 42, 44 and 45) say "grounding failed on both attempts (100% of claims unfound in
  source)". In every one of them the grounding gate logged **no claim at all** (`investigation_gate_log`, gate
  `G2_grounding`: 0 rows, against 4 in the one complete run, week 43). The decompose step returned no parseable claim on
  either attempt, and `_investigation.ts` (line 520) counts an empty list as a 100% failure
  (`failRate = grounded.length ? ... : 1`), so the reason names the wrong fault.
- Suspected cause: the anchor's own page text does not reach the decompose prompt. Its source text is the headline and
  snippet plus `stored.find(s => s.url === anchor.url)?.pageText`; the aborted runs used 3,500 to 9,800 input tokens
  across all their calls against 18,700 in the complete run, so the page text was missing or tiny, and the prompt allows
  "an empty list is a valid and respected answer". A second possibility: replies near the 2,600-token cap cut off the
  JSON (weeks 39 and 40 used about 2,300 output tokens a call).
- The eighth abort (week 37) is a real verdict: "no claim survived the interestingness gate".
- What would prove it, at no cost: log whether `anchorPage` was found and the decompose reply's length and parse
  result on the next scheduled run (Thursday 21:00 UTC), or replay a stored run's prompt with `dry_run` once its cost
  is approved.

Pausing the ladder judges goes against the 18 Oct ruling "keep the judge sweep" (COST_GUARDS G13), so it is put to Krish
as a change to that ruling, with this diagnosis, and nothing is paused here.
