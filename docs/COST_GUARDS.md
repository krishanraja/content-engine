# Cost guards: engine upgrades so a session cannot run up a huge bill

Krish, 2026-10-18, on the six habits from `docs/COST_AUDIT_2026-10-18.md`: "They should all become standing
rules." Then: "one for the upgrades to the engine that don't let me do things that are going to create huge
cost outlays."

The audit's finding: one six-day session read 1,086M tokens because every step re-read a context that sat at a
median of 459k tokens. Separately, four fact-check reruns on one article cost $4.07 of API credits, about $1 a run,
against an estimate of 20 cents.

## The quality test every guard passes

Krish, 2026-10-15, agreeing to cut cost: "yes, if you are 110% sure this does not degrade the quality of the
output - this cannot happen." (`config/learnings.json`, `cost-never-costs-quality`.) So every guard is one of
three kinds, and nothing else is built:

- **Same input, fewer re-reads.** Caching, carry-forward, fresh sessions, a shorter start. The model reads the
  same thing for the same decision, so the output cannot move.
- **Mechanical work on a cheaper model, held by deterministic checks.** Renders, packs, filing, board rebuilds,
  each already checked by `--verify`, frame checks, loudness and `story_check`. Writing, titles, judgment and
  fact reading stay on the strongest model.
- **Refusals.** A paid run or a giant read is stopped before it starts; nothing made changes.

Out, because they would change what a decision reads: fewer judges, smaller source sets per claim, lower effort
on writing, padding judge prompts to make them cacheable (tried; JSON broke, `_judges/panel.ts`). And a cost
change is measured first: caching the draft, channel-cut and package calls was dropped on 18 October because the
meter showed $0.40 of spend in 60 days and no retries, so it would only have added the cache-write premium.

## The six standing rules (in force now, AGENTS.md "Cost: six standing rules")

1. **One fresh session per job.** A day's piece, the board, one fix. Start from the job's handover file, stop when
   the job is done.
2. **Switch topics by handing over.** Write the handover, start a new session.
3. **Fewer, bigger steps.** One script that does five things, never five commands.
4. **Keep big outputs out of the chat.** The board is read by the builder from a saved file, never into the
   conversation. One contact sheet per output. Logs quiet, no full tracebacks.
5. **Sonnet for production work** (renders, packs, filing, board rebuilds); Opus for writing and judgment.
6. **Agents and workflows only for work that needs a separate reader.**

## The guards (status 18 October 2026, phase 2 merged the same day)

| # | Guard | Where | What it does | Status |
|---|---|---|---|---|
| G1 | Context ceiling | `scripts/hooks/cost_gate.py` (`UserPromptSubmit`, `PreToolUse`) | Past 200k of context each prompt is told to hand over; past 300k only the handover and its commit run. Krish lifts it for one session in `.cache/context-ceiling-said.txt`. | Built |
| G2 | Paid run against a budget from the meter | `scripts/engine.py`, `lastFactRunCost()` in `api/_meter.ts`, the fact check's free GET (`last_run_cost`) | A fact-check POST without `--budget=USD`, or one whose last measured run cost more; `--despite-precheck` without `said`. | Built |
| G3 | Rerun ceiling per piece per day | the fact-check route (`rerunCeiling`, `countRun`) | A third paid run on a piece in one day without `said` (409 `rerun_ceiling`), before any model call. | Built |
| G4 | Carry settled sentences past every paid step | `settledLeftovers()` in `api/_factGate.ts`; the warm cache in `fact-check.ts` | The second look reads only open sentences (a test proves verdicts identical). The first on-file check runs alone so the rest read its cached sources: on 18 October about 8 cache writes a run were $2.90 of the day's $3.95. | Built; the claim lister still reads the whole body (to keep its context) |
| G5 | No full board in the chat | `scripts/hooks/cost_gate.py` | An `Artifact read` of any link in `config/boards.json`. | Built |
| G6 | Agent and workflow gate | `scripts/hooks/cost_gate.py` | An Agent call that does not name its separate reader; a Workflow without `said:`. | Built |
| G7 | Quiet scripts | `scripts/quiet_errors.py` in `engine.py`, `send.py`, `working.py`, `making.py`, `week_board.py` | A traceback in the chat: one line, the rest in `.cache/logs/`. `send.py` retries by itself. | Built |
| G8 | Model per job | `produce-video` frontmatter `model: sonnet`; `.codex/config.toml` `[profiles.production]` | Production on the strongest model. A one-week trial from 18 October: any rework ends it. | Built, on trial |
| G9 | Sign-off of named lines | the fact-check route (`signOff`, `stillBlocking`, `carrySignOffs` in `api/_factGate.ts`); Control Center's button still to come | Krish passes a line the checker cannot match (an analogy, "last month") in his own words, so no paid rerun chases it. `POST .../fact-check` with `{ action: 'sign_off', decided_by: 'Krish', lines: [{ sentence, said }] }` stores `meta.fact_check.signed_off`; it refuses a line that is not blocking, a line without his words and a check of an older body, and calls no model. A rerun keeps a sign-off only while its exact sentence still blocks. | Built (main, 996544a) |
| G10 | Image gate | none | Dropped: an image costs about width × height / 750 tokens, capped by the API's resizing, so a few thousand at most. The 400k-character figures in the transcript were base64 in the log, not tokens. | Dropped (measured) |
| G11 | Lean start | `scripts/check_workbench.py` in `npm run verify` | `WORKBENCH.md` over 64 KB, or "Latest handoff" holding more than its newest entry. It was 227 KB (181 KB of old handoffs); now 50 KB. | Built |
| G12 | Meter what is missing | `api/_meter.ts` (`perplexityCall`, `openaiEmbeddingCall`, `meterScope`), `api/_prices.ts`, `supabase/migrations/20261024090000_meter_events.sql` | Every Perplexity call (fact check, challenge, enrich, dive-deeper, harness) and OpenAI embedding is in `meter_daily`. A fact-check run's calls also land in `meter_events` with the piece and run, and `lastFactRunCost()` reads that run's own total (`basis: 'run'`). | Built; the migration is written and NOT applied (needs Krish's approval). Until then the per-run rows are off and the estimate is the day average, now with web checks |
| G13 | Timer judges at half price | `api/judge/sweep.ts`, `_judges/batch.ts` | Would make the nightly judge sweep batch-only. | Not built: it conflicts with a standing ruling in `api/judge/sweep.ts` (Krish, 2026-09-24: "fast turnaround and cost efficiency both, and six to eighteen hours of latency does not buy either"). With one cron tick a day an idea needs 4 to 8 ticks in batch mode, so judging would take days instead of minutes, for about $95 a year measured then. Waiting on Krish's choice; batch stays the explicit catch-up mode |
| G14 | Lean skill start | `.agents/skills/make-piece`, `.agents/skills/produce-video`, `scripts/check_skill_core.py` in `npm run verify` | Steps and gates in `SKILL.md`, long reference sections in `references/*.md`, each named by the step that needs it. A house rule a reference carries must be named in the core. make-piece 39.9 to 33.4 KB, produce-video 47.2 to 40.2 KB. | Built |

## The environment is the floor: a setting only Krish can change

A fresh session in this cloud environment read **110k tokens on its first call** before any work (18 October;
the audit measured 55k on 12 October). The repository's part is about 22k (AGENTS.md, CLAUDE.md, the start-up
files). The rest is the environment: about 30 connectors' instructions, some 120 sales, marketing, data, design
and productivity skills, and thousands of deferred tool names, sent on every call. A content session needs
GitHub, Supabase, Google Drive, Teleprompter and Claude Docs. Turning the others off for the content engine's
environment (connectors at https://claude.ai/customize/connectors; the plugins in the same settings) changes
nothing the work reads and roughly halves the floor of every call. Measure with
`python3 scripts/session_token_audit.py --line` (first call's context) before and after.

## Measuring

`python3 scripts/session_token_audit.py --line` prints a session's calls, tokens read and first and last
context; every handover carries that line. The engine's own spend is `meter_daily` (stage per `unit_key`).
