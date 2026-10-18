# Cost guards: engine upgrades so a session cannot run up a huge bill

Krish, 2026-10-18, on the six habits from `docs/COST_AUDIT_2026-10-18.md`: "They should all become standing
rules." Then: "one for the upgrades to the engine that don't let me do things that are going to create huge
cost outlays."

The audit's finding: one six-day session read 1,086M tokens because every step re-read a context that sat at a
median of 459k tokens. Separately, four fact-check reruns on one article cost $4.07 of API credits, about $1 a run,
against an estimate of 20 cents.

## The six standing rules (in force now, AGENTS.md "Cost: six standing rules")

1. **One fresh session per job.** A day's piece, the board, one fix. Start from the job's handover file, stop when
   the job is done.
2. **Switch topics by handing over.** Write the handover, start a new session.
3. **Fewer, bigger steps.** One script that does five things, never five commands.
4. **Keep big outputs out of the chat.** The board is read by the builder from a saved file, never into the
   conversation. One contact sheet per output. Logs quiet, no full tracebacks.
5. **Sonnet for production work** (renders, packs, filing, board rebuilds); Opus for writing and judgment.
6. **Agents and workflows only for work that needs a separate reader.**

## Upgrades to build (each one refuses, so a rule cannot be skipped)

| # | Guard | Where | What it refuses |
|---|---|---|---|
| G1 | Context ceiling | a Claude Code hook (`UserPromptSubmit` and `PreToolUse`) in `.claude/settings.json`, reading the transcript's last `usage` | Past 200k tokens of context: tells the session to write its handover and stop; past 300k: refuses every tool but writing the handover and committing. |
| G2 | Paid rerun estimate from the meter | `scripts/engine.py` (beside the fact-check pre-check) | A `POST .../fact-check` without `--budget USD`; it prints the last run's real cost from `meter_daily` and refuses when that is above the budget. No estimate from sentence counts. |
| G3 | Rerun ceiling per piece per day | the fact-check route | A third paid run on the same piece in one day, unless the request carries Krish's words (`said`). |
| G4 | Second look carried forward | `api/_factGate.ts` | Re-reading a leftover sentence whose words and sources are unchanged: it keeps its last reading, as passed sentences already do. (Saves about a third of each rerun.) |
| G5 | No full board in the chat | the `artifact_gate` hook | An `Artifact read` of a board link whose result would enter the conversation; the builder reads the saved copy (`week_board.py --previous`). |
| G6 | Agent and workflow gate | a `PreToolUse` hook on `Agent` and `Workflow` | Starting one without a one-line reason naming what a separate reader is for; a workflow also needs Krish's words. |
| G7 | Quiet scripts | `scripts/engine.py`, `send.py`, `working.py` | Printing full tracebacks: one line saying what failed, the rest to a log file. |
| G8 | Model per skill | `produce-video`, the pack and board steps | Running on Opus: their skill files name Sonnet. |
| G9 | Sign-off of named lines | the fact-check route (built 2026-10-18); Control Center's button still to come | Lets Krish pass a line the checker cannot match (an analogy, "last month") in his own words, so no paid rerun is spent chasing it. `POST .../fact-check` with `{ action: 'sign_off', decided_by: 'Krish', lines: [{ sentence, said }] }` stores `meta.fact_check.signed_off`; it refuses a line that is not blocking, a line without his words and a check of an older body, and calls no model. A rerun keeps a sign-off only while its exact sentence still blocks. |

Order to build: G1, G2, G9, G4, then the rest. G1 and G2 stop the two bills measured in the audit.
