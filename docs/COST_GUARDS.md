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

## The guards (status 18 October 2026, phase 2 merged the same day; G1, G8 and G11 updated since, rechecked 4 November)

| # | Guard | Where | What it does | Status |
|---|---|---|---|---|
| G1 | Context nudge | none | Removed (Ruling, Krish, 2026-11-03: "Remove that stupid fucking limit as well. You waste my life whinging about limits when you're only at 52% context"). No context nudge and no handover prompt: a session finishes the job he asked for, so the job is finished first and the handover written after (Krish, 2026-10-21: "just get it all done now, to full completion"). Nothing is refused for the size of the context, and no rule refuses a database tool (`NEVER_BLOCKED`). | Removed (Krish, 2026-11-03) |
| G2 | Paid run against a budget from the meter | `scripts/engine.py`, `lastFactRunCost()` in `api/_meter.ts`, the fact check's free GET (`last_run_cost`) | A fact-check POST without `--budget=USD`, or one whose last measured run cost more; `--despite-precheck` without `said`. | Built |
| G3 | Rerun ceiling per piece per day | the fact-check route (`rerunCeiling`, `countRun`) | A third paid run on a piece in one day without `said` (409 `rerun_ceiling`), before any model call. | Built |
| G4 | Carry settled sentences past every paid step | `settledLeftovers()` in `api/_factGate.ts`; the warm cache in `fact-check.ts` | The second look reads only open sentences (a test proves verdicts identical). The first on-file check runs alone so the rest read its cached sources: on 18 October about 8 cache writes a run were $2.90 of the day's $3.95. | Built; the claim lister still reads the whole body (to keep its context) |
| G5 | No full board in the chat | `scripts/hooks/cost_gate.py` | An `Artifact read` of any link in `config/boards.json`. | Built |
| G6 | Agent and workflow gate | `scripts/hooks/cost_gate.py` | An Agent call that does not name its separate reader; a Workflow without `said:`. | Built |
| G7 | Quiet scripts | `scripts/quiet_errors.py` in `engine.py`, `send.py`, `working.py`, `making.py` | A traceback in the chat: one line, the rest in `.cache/logs/`. `send.py` retries by itself. | Built |
| G8 | Model per job | `produce-video` frontmatter `model: sonnet`; `.codex/config.toml` `[profiles.production]`; in Claude Code the session default `opus` (`.claude/settings.json`) and the `executor` subagent on Sonnet, `repo-scout` on Haiku, `reviewer` on Opus (`.claude/agents/`) | Writing, judgment and fact reading on the strongest model; mechanical production work (renders, packs, filing, board rebuilds) on Sonnet in Claude Code and at low reasoning effort in Codex; `produce-video` stays on Sonnet by Krish's ruling of 29 October (`docs/proposals/2026-10-29-g8-produce-video-model.md`). | Built |
| G9 | Sign-off of named lines | the fact-check route (`signOff`, `stillBlocking`, `carrySignOffs` in `api/_factGate.ts`); Control Center's button still to come | Krish passes a line the checker cannot match (an analogy, "last month") in his own words, so no paid rerun chases it. `POST .../fact-check` with `{ action: 'sign_off', decided_by: 'Krish', lines: [{ sentence, said }] }` stores `meta.fact_check.signed_off`; it refuses a line that is not blocking, a line the sources contradict (only an `unverified` line may be signed off; Krish, 2026-10-18), a line without his words and a check of an older body, and calls no model. A rerun keeps a sign-off only while its exact sentence still blocks. Three sign-offs made before that ruling are on contradicted lines (piece `904658db`, 18 October); they are left as they are until he says. | Built (main, 996544a; contradicted lines refused from 18 October) |
| G10 | Image gate | none | Dropped: an image costs about width × height / 750 tokens, capped by the API's resizing, so a few thousand at most. The 400k-character figures in the transcript were base64 in the log, not tokens. | Dropped (measured) |
| G11 | Lean start | `scripts/check_workbench.py` in `npm run verify` | `WORKBENCH.md` over 64 KB, `NOW.md` over 14,000 bytes (W2.12), or "Latest handoff" holding more than its newest entry. `WORKBENCH.md` was 227 KB on 18 October (181 KB of old handoffs) and 60 KB on 4 November. | Built |
| G12 | Meter what is missing | `api/_meter.ts` (`perplexityCall`, `openaiEmbeddingCall`, `meterScope`), `api/_prices.ts`, `supabase/migrations/20261024090000_meter_events.sql` | Every Perplexity call (fact check, challenge, enrich, dive-deeper, harness) and OpenAI embedding is in `meter_daily`. A fact-check run's calls also land in `meter_events` with the piece and run, and `lastFactRunCost()` reads that run's own total (`basis: 'run'`). | Built; the migration was applied on 18 October to Supabase project `<project-ref>` with Krish's approval ("apply the meter_events migration"), read back from `information_schema.columns` (10 columns as written) with row level security on. Per-run rows start with the next fact-check run |
| G13 | Timer judges at half price | `api/judge/sweep.ts`, `_judges/batch.ts` | Would make the nightly judge sweep batch-only. | Dropped (Krish, 2026-10-18: "keep the judge sweep"): the nightly sweep stays live under his 2026-09-24 ruling in `api/judge/sweep.ts` ("fast turnaround and cost efficiency both, and six to eighteen hours of latency does not buy either"). Batch-only would have made judging take 4 to 8 days for about $95 a year. Batch stays the explicit catch-up mode |
| G14 | Lean skill start | `.agents/skills/make-piece`, `.agents/skills/produce-video`, `scripts/check_skill_core.py` in `npm run verify` | Steps and gates in `SKILL.md`, long reference sections in `references/*.md`, each named by the step that needs it. A house rule a reference carries must be named in the core, and every skill core has a byte cap (`CORE_CAPS`, W2.12). On 18 October make-piece went from 39.9 to 33.4 KB and produce-video from 47.2 to 40.2 KB. | Built |

## Scheduled Claude runs and the $15 a week

Three scheduled jobs run Claude Code, each inside GitHub Actions on Krish's subscription (`CLAUDE_CODE_OAUTH_TOKEN`),
never an API key, so none adds API spend (`tests/no-claude-routines.test.ts` refuses any other):

| Workflow | When (UTC) | What it does |
|---|---|---|
| Sunday ideas (`sunday-ideas.yml`) | Saturday 12:17, and 20:47 as the second try | the week's ideas, Saturday's five good-news stories included (Ruling, Krish, 2026-11-11: the ideas board fills once a week in full, Saturday's good news included; the Thursday good-news schedule is retired); its guard does nothing once the week is built |
| Engine learning weekly (`engine-learning-weekly.yml`) | Sunday 19:37 | the self-improving failure loop: the week's incidents clustered into failure modes by code first, then Claude Code only for what the fields could not explain and the ladder's work orders (`docs/learning/README.md`) |
| Docs steward (`docs-steward.yml`) | every day 20:30 | the fleet's docs steward, ai-harness's reusable workflow pinned by commit |

The good-news job (`saturday-goodnews.yml`) stays, by hand only: capped at 150 turns and 120 minutes, one week's five
stories, and its guard does nothing once the stories are live. None of these makes a paid API call (no fact-check POST,
no Perplexity, no generation), so the chain stays inside his $15 a week (Krish, 2026-10-29: "happy with $15 a week"); a
run that would need one stops and says so.

What counts against the $15 is measured by its own unit keys, never by everything metered (Ruling, Krish, 2026-11-14:
the chain cap as proposed in `docs/proposals/2026-11-14-phase3-and-chain-cap.md`; his words: "I agree with everything
else until Batch 6"). The families live in `config/chain-cap.json` (inspirationhouse's daily runs, the engine's Vercel
crons, the fact gate, and divergent-thinker's calls for the ideas board, which Control Center meters as agent
`divergent-content-engine` (Ruling, Krish, 2026-11-18: content-engine's divergent calls count inside its $15 weekly chain
cap; `scripts/post-pack/divergent.py` refuses its paid calls, the wildcard and the at-will `map`, `provoke`, `challenge`, `diverge` and an unanchored or judged `score` (`docs/DIVERGENT.md`), once the week is over); `unit_kind` agent only), and `chainWeekSpend()` in `apps/control-plane/api/_meter.ts` sums them
for the week from Monday 00:00 UTC (`tests/control-plane/chain-cap.test.ts`). Left out, each with its reason in that
file: `aeo-*`, Apify actors, Control Center's own agents and Claude Code on his subscription. Measured on 14 Nov 2026:
$15.45 (week of 26 Oct), $14.53 (2 Nov), $19.64 (9 Nov, to 14 Nov).

The weekly meme-template read (Ruling, Krish, 2026-11-17: "run Apify weekly in the Sunday ideas run") is one Apify run a
week in `.github/workflows/sunday-ideas.yml`: at most 30 TikTok template videos from `clockworks/tiktok-scraper`, its
results per hashtag split so 30 is the total, under Apify's own charge cap of $0.50 (the lowest it accepts). The first
run, 17 Nov 2026, read 30 for about $0.09 at the Bronze tier's $0.003 a result and $0.001 a start, so about $0.40 a
month. It sits with the other Apify actors outside the $15 chain cap. `scripts/post-pack/meme_templates.py` refuses
`--apify` without `--max-items` (at most 30), `--i-approved-spend` and the key.

The cap is enforced, as the proposal said, with no new table and no new cron (`apps/control-plane/api/_chainCap.ts`):

- The existing daily sweep, the triage sweep (`api/triage/sweep.ts`, 03:00 UTC), reads the week's chain spend and
  records its verdict in the run ledger as job `chain_cap`: `skipped` once the week passes $15 (the reason names the
  spend and what is skipped, the counts carry each family's dollars and `skip_<unit key>` = 1 for each skipped run),
  `ok` under it, `failed` when the meter cannot be read. A dry run is `POST /api/triage/sweep {"action": "chain_cap",
  "dry_run": true}`.
- Over the cap it skips the optional runs `config/chain-cap.json` lists in `skip_when_over`, in order, inspirationhouse
  tagging (`inspirationhouse-tag`) first: inspirationhouse's daily run (05:17 UTC) already writes this ledger, reads
  this week's newest `chain_cap` row before it tags, and skips its tagging while that row is `skipped` and carries
  `skip_inspirationhouse_tag`. No row this week, or a failed one, skips nothing: unknown never stops a run.
- It writes one board item a week saying so (`chain-cap-<Monday>`, in progress, never on Krish), which closes itself by
  the existing `job_ok` check on the first `chain_cap` run that is `ok`: the next week's first sweep.
- It never stops the fact gate on a piece he picked: `chainAllows` answers that first, whatever the list says, and the
  fact gate is not on the list.

## The judges on every carousel and Short

Every carousel and Short is judged by the draft judges' panel before it is handed to Growth (Ruling, Krish,
2026-11-12: "Judge them; count passes."; `apps/control-plane/api/board/_judge.ts`). Since 26 Nov 2026 content-engine
makes every asset, so its make flow asks itself (`scripts/post-pack/judge_assets.py ask`, on the engine operator's key;
Ruling, Krish, 2026-11-26). Free checks run first and fail a post without a model call; a post judged before answers
from `asset_judgements` and pays nothing; at most `DAILY_CAP` (40) panels a day are paid for, then the route answers 429,
the step exits 2 and the slot is held, never passed. Each row records its `cost_usd`.

## The story score's ledger and the blind proof's ceiling (branch `story/engine-v5`)

The Sunday story engine's paid calls (divergence-engine `provoke` and judged `score`, the humour engine's reads, the
council on close calls) go through one spend ledger per week, `.cache/story-score/<Monday>.jsonl` (gitignored;
`config/story-score.json` `files.ledger`), written by `scripts/post-pack/story_score.py` and `scripts/post-pack/touch.py`:

- **Reserve before the call.** Each call reserves its unit cost (`unit_costs`: provoke $0.15, judged score $0.30, free
  score $0, humour read $0.005, council read $0.25) before its transport is touched, and is refused when it would pass
  the week's `budget_usd` ($10), the day's $5 or the day's 18 divergent operations (`spend`), all read from that ledger.
- **The chain first.** A divergent call is checked against the $15 weekly chain (`config/chain-cap.json`) before it is
  made; over any cap the call is refused and the step is reported skipped, never passed.
- **Settle to what was metered.** A served divergent call is settled to the route's own cost figure, else the chain's
  change over the call when that is more than the reservation, never less; a settled cost over its reservation counts
  at once. `python3 scripts/post-pack/story_score.py ledger [<Monday>]` prints the week.
- **The blind proof's ceiling.** The proof of the engine spends at most $10 in all, through its own ledger
  (`.cache/proof/story-engine-v5/spend.jsonl`, read whole), and only after its protocol is committed (Ruling, Krish,
  2026-11-26, `spend_ceiling` in `config/story-score.json`; `config/story-proof.json` `budget_usd`;
  `docs/plans/proofs/2026-11-26-story-engine-v5/PROTOCOL.md`). `story_proof.py run --dry` spends nothing. No paid proof
  call has been made as of 26 Nov 2026.
- **The cycle's paid touches** (a divergence-engine `challenge`, a credit reservation for a generation) reserve through
  the chain cap and the same ledger first, and are skipped over either (`touch.py`).

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

Codex work is measured from its own logs with `--codex` (`~/.codex/sessions`, read for numbers only, never
words): per thread its model and tool calls, input (cached included), cached, output and reasoning tokens, wall
and active hours, and the weekly limit and credits at its start and end. `--session ID --children` adds the
thread's child agents; `--since`, `--until` and `--cwd-contains` pick the threads; `--json` is the interface
`ve ledger` wraps. It reproduces the Friday 23 October production measured on 27 October: the main thread
188.3M input tokens, 256.6M with its 19 child agents, 97.7% of it cached.
