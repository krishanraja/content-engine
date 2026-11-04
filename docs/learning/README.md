# The failure loop

Krish, 2026-11-04: "how can your system autonomously understand the difference between a repeated failure, why it
happened, what was being done when the failure occurred and how it was being done, and start to strengthen recurring
failures AND trace them back to why it actually kept occurring (i.e the creative brief was not strong enough, the
session did not check in on a specific skill or standard before starting, etc) ... all of this stuff should feed an
intelligent system that automatically gets more intelligent every week, not just pile up loads of individual feedback
for me to sift through". Then: "yes, build part 1 and the weekly loop".

So the engine keeps one record of every failure at the moment it happens, with what the session had read first, and
once a week works out which failures are repeats, why they kept happening, and makes the guard on each repeat one rung
stronger. Krish sees at most three proposals a week, each with its evidence, never a pile.

## Part 1: capture

**The preflight receipt.** Before a session makes anything for a piece it reads the standards, and each read is now
recorded as a receipt `{check, format?, name?, version_or_hash, at, by}` on the piece's making record
(`meta.making.preflight`) and in its `ve/ledger.jsonl`:

| Check | Command | Version |
|---|---|---|
| floor | `python3 scripts/floor.py --format <maker> --piece <plan folder or uuid>` | hash of `config/rejection-floor.json` |
| failures | `python3 scripts/check_failures.py --piece <piece>` | hash of `config/failures.json` and `config/learnings.json` |
| skill | `python3 scripts/preflight.py <piece> --skill <name>` | hash of `.agents/skills/<name>/SKILL.md` |
| taste | `python3 scripts/preflight.py <piece> --taste <hash or count>` | what `get_approved_taste` returned |

`PREFLIGHT_PIECE` names the piece when `--piece` is not given. From 9 Nov 2026 `ve brief` and `ve render` refuse a
piece whose floor receipt for its maker (long_video, short_video) or failures receipt is missing or older than the
file now (`scripts/velib/preflight.py`), naming the command to run. The make-piece, produce-video and ve skills run
the preflight first.

**Incidents.** `engine_incidents` (migration `20261123090000_engine_incidents.sql`, service role only) holds one row
per failure: when, the piece, the stage (brief, script, storyboard, style, proof, cut, package, post, board, session),
who made it, the kind, the skill, the artifact and its hash, his words (only on his own reject), the preflight receipt
as it stood, the brief's score, floor groups and failure ids. Writers:

| Kind | Written by |
|---|---|
| krish_reject | his Reject asset, Reject proof and "None of these" styles presses (`apps/control-plane/api/board/_presses.ts`, `pressIncidents`) |
| second_round | a new proof press after a rejected one (`_presses.ts`), and `rounds` rising to 2 or more on the making record (`api/content-ideas/[id]/making.ts`) |
| critic_block | a Critic verdict with a block finding (`scripts/velib/verdict.py`) |
| override | each beat a spec silences a lint on with `override_reason` (`scripts/ve.py lint`) |
| guard_fired | a guard's behavioural test failing under `check_failures.py --run` |

The server writers never block the press: a failed write is logged and the press answers as before. The Python writers
go through `POST /api/learning/incidents` (`scripts/incidents.py`); offline they wait in `.cache/incidents.jsonl` and
the next write, or `python3 scripts/incidents.py flush`, sends them. Each carries a `client_ref`, so a press saved again
or a lint run twice files once. ve files incidents only for pieces under `docs/plans/`, never for test fixtures.

## Part 2: the weekly loop

`.github/workflows/engine-learning-weekly.yml`, Sunday 19:37 UTC, on Krish's subscription
(`CLAUDE_CODE_OAUTH_TOKEN`, never an API key; zero Claude routines). A hand run is a dry run unless `dry_run` is
unticked.

1. **Gather and cluster** (`scripts/learning/cluster.py`). The week's incidents with the registers' history (every
   failure, learning and floor rejection) are grouped into failure modes. A mode's key is its stage, its floor group
   (`config/floor-groups.json`, else the floor's theme) and its normalised what (the three words its items share
   most). A **repeat** is an item dated after the mode was first guarded: a linked failure entry guarded, or a linked
   learning encoded.
2. **Trace the causes** (`scripts/learning/causes.py`), deterministically first, each citing the field it rests on:
   `standard_not_read` (no receipt, or no floor or failures read), `check_missing` (the entry is open or guarded by
   markers alone), `brief_gap`, `standard_missing`, `handoff_loss`, `tool_limit`, `taste_new`. Only a repeating mode
   none of these explains goes to the model, and its answer is kept only when it quotes an incident field word for
   word.
3. **Climb the ladder** (`scripts/learning/ladder.py`): prose, checklist, lint_warn, lint_refuse, gate. A repeat climbs
   one rung. The register change (`mode`, `recurrences`, `causes`, `guard_level` on the entry in
   `config/failures.json`, checked by `check_failures.py`) is written by the loop; the concrete check or skill line is
   a work order the Claude step makes on the branch. A mode already at the gate is put to Krish.
4. **Report** (`scripts/learning/report.py`): the repeat rate (incidents on already-guarded modes over all incidents),
   rounds per piece, week on week (`docs/learning/metrics.json`, which the first weekly run writes), and at most three
   proposals of class `engine_quality` or `taste` into `mindmake_studio_learning_proposals` through
   `POST /api/learning/incidents`, each with its evidence count, incident ids and cause. It writes
   `docs/learning/<date>.md` and one NOW.md line, and the whole lands as a pull request that merges itself on green CI.

Run any stage by hand: `python3 scripts/learning/loop.py weekly deterministic`, then `weekly finish` (add `--apply` to
post proposals). The backfill over the registers' whole history is `python3 scripts/learning/loop.py backfill --out
docs/learning/<date>-backfill.md`; it proposes nothing to his list. The first is `2026-11-04-backfill.md`.

A single failure Krish names is traced by hand into the same registers: `docs/learning/2026-11-04-thursday-killed.md`
(the killed Thursday 5 Nov short: F31 to F39, the guards in `scripts/velib/guards.py`, and his answers of 4 Nov to the
six questions it put to him).

## What it cannot do yet

- Modes are matched by shared words, not meaning: two failures worded differently can sit in two modes, and the report
  says so. The Claude step and Krish read each before relying on it.
- Before 4 Nov 2026 no receipts existed, so the history cannot show `standard_not_read`; only incidents from now on can.
- `brief_score` is carried when a writer gives it; no writer scores the brief yet.
- `taste_new` compares his words with the floor's standards by shared words.
