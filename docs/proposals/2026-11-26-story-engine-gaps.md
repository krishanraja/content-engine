# Story engine v5: the gaps, and what was checked before building (26 Nov 2026)

Status: Research only. Nothing here changes behaviour. It is the step 1 output of the story engine v5 plan
(branch `story/engine-v5`) and the readiness check (commit 0) that comes before any build.

## The ask

Krish wants every content type to start from the biggest, most important, most absurd, funniest or most interesting
story, with a unique angle that holds the 5 Whys and is fun to make and to read, for the narrowed reader: people who
make the calls or make the work in the creative, arts, music, entertainment, media and sports industries.

Rulings this session (Krish, 26 Nov 2026):

- His taste is a floor only. His rejections refuse a story; they never become a score, and the judge wall stays.
- The proof run may spend at most $10.
- The North Star reader lines are approved: "I approve the lines".

## The gap list

### Dull "anything about AI" gets through

1. `apps/control-plane/api/_relevance.ts` (line 117) keeps "ANYTHING about AI" and says advertising and adtech are
   in bounds. Its buyer test (about line 127) still pictures the old reader, a commercial leader who might hire Krish
   for thirty days. The buyer test is recorded, not enforced.
2. `_judgmentLens.ts` `isOnDirection` is a keyword count, so a story that says "AI" and "workflow" passes.
3. The `off_beat` gate refuses only the avoid list. A dull story on a neutral subject passes.
4. The Ideas tab shows options in the order the plan-week session wrote them. The 8-judge panel's `judged_best` is an
   input to that session, not an order.
5. Nothing scores scale, absurdity, whether the story holds five whys, or whether it is fun to make. The `fun` judge
   runs only on `content_ideas` rows, and it mixes fun to read with fun to make.
6. `humour_check.py ideas` is optional. The `aim` check only asks that a `funny` line exists. The humour engine's
   audience is hard-coded as "Leaders and operators who follow AI news".
7. Good news, explainers (there is no how-to type yet) and the weekly edition's news items get structural checks only.
8. `rank1_picked` is 0 on both scored weeks (9 and 16 Nov): Krish never picked the board's first option.
9. Of 26 hero options on the 16 and 23 Nov boards, none is in the creative or sports sectors.

### A story that cannot hold five whys gets through

10. At the idea stage, the only check is a regex that the `research_prompt` mentions the 5 Whys, and only on the
    cover (`scripts/post-pack/idea_checks.py`, line 599).
11. The why-ladder is built after he picks (`apps/control-plane/api/board/_research.ts`, `_whys.ts`), and the lock
    check runs after the pick too.
12. `_publishChecks.ts` (line 249) passes a piece with no ladder at all. The contract minimum is 3 rungs
    (`packages/contracts/src/whys.ts`), and the production brief drops the landing without saying so.

### Also found

- `kill_list_vetoes` (`idea_checks.py`, line 1749) runs node without `encoding='utf-8'`, so on Windows an em dash
  slips past the kill list.
- The header of `apps/control-plane/api/_taste.ts` names `scripts/check-taste-reader.ts`, which does not exist. The
  real wall is `apps/control-plane/scripts/check-judges.ts`, section 4 (`TASTE_READ`), and it covers TypeScript only.
  (Fixed in commit 1 of this branch.)

## Readiness check (commit 0), all at no cost

### What a judged divergent score costs

Read from Control Center `api/_divergent.ts` (krishanraja/control-center at `0d173189`, 25 Nov) and the
divergence engine it imports (`divergent-thinker` at `8544b8d`, `src/engine.ts`).

- `score` with `obvious` given and no `judge` makes no model call. It is free and not capped.
- `score` with `judge: true` is a generating call. It is checked against the caller's daily caps before it runs,
  with an up-front estimate of **$0.10** (`ESTIMATE_USD.score`).
- It does **not** count against the 20 quick ops a day (`QUICK` is provoke, challenge and map only). It counts against
  the **$5 a day** dollar ceiling per caller (`DIVERGENT_CAPS.usd`), and content-engine's calls also sit inside its
  $15 weekly chain cap.
- One score call is metered on its own budget of at most **4 model calls** (`new MeteredProvider(provider, 4)`): one
  call to find the obvious answers when `obvious` is not given, then one judge call per chunk of 12 ideas
  (`JUDGE_CHUNK = 12`). With `obvious` given, one call judges up to 48 ideas; past that the engine stops and returns
  what it has judged.
- The model is `claude-opus-5-5` (`DIVERGENT_MODEL`), priced at $4 a million input tokens and $20 a million output
  tokens (`_prices.ts`). The ledger (`divergent_runs.cost_usd`) records the metered cost, not the estimate.
- So a batched judged score of one day's pooled angles (well under 48 ideas, `obvious` from `worn(sources)`) is one
  model call. At the plan's estimate it is a few cents to about $0.30 a call; the plan's proof budget allows $1.80 for
  all judged scores.
- `scripts/post-pack/divergent.py` already marks a judged score as paid (`spends()`), and its `PAID` row for `score`
  gives no price. Commit 6 should add one ("one model call per 12 ideas, estimate $0.10") so the ledger line is honest.

### Whether the council can be run by this engine

Read from ai-harness `skills/council/SKILL.md` (krishanraja/ai-harness at `d25eef3`, 25 Nov), "When it runs":

> In two cases only: when Krish explicitly asks for the council or a council read, or names one of the five seats;
> and when krishanraja/strategist convenes it, once a week as Krish's board and at once when any repository in the
> fleet reaches U5 (Ruling, Krish, 2026-11-23).

The story engine is neither case. An automated close call on the Sunday board is not Krish asking, and the engine is
not the strategist. The "When it does not run" table also routes "a general should I, ranking, or kill or double
down, with no ask for the council" to `krish-principles`.

So, until Krish says otherwise:

- A close call (the top two within `close_margin`) shows on the card as **"close call, your pick"**. It is never a
  silent pass, and the council is not convened.
- If Krish wants the council on close calls, the change starts in ai-harness with his say: a separate draft pull
  request adding the story engine's close calls as a third case under "When it runs". Not opened from this branch.

### The humour engine

`python scripts/post-pack/humour_check.py doctor` (no model call) on this machine, 26 Nov:

```
token: NOT SET. ENGINE_OPERATOR_TOKEN is the engine's operator key (a GitHub Actions secret and on each runner; docs/INTEGRATIONS.md)
package: NOT INSTALLED. pip install -r requirements-humour.txt && pip install --no-deps -r requirements-humour-engine.txt
ready: NO. Every read will say unavailable, never pass
```

This is the local checkout, not a runner. The humour reads in the proof must run where the token and the package are
present (the Actions runner or the worker), and `doctor` must say ready there before the proof's first paid call. An
unavailable read is never a pass.

## What follows

Commit 1 narrows the reader everywhere it is written (`config/beat.json` reader row, `docs/NORTH_STAR.md`,
`_relevance.ts`, the reader and buyer judges, the humour audience). Commits 2 to 9 build the floor, the blind score,
the whys probe, the gate wiring and the proof scaffolding, as the plan sets out.

## Krish's rulings, 26 Nov

His words: "Newgate, 30th of November. On questions 1 and 3 I need your judgement in detail. I want a high-quality
flexible engine that has learned from all its past mistakes and is upgraded now." Built on `story/rulings-30nov`:

- **The gate starts on the board of 30 Nov.** `config/story-score.json` `from` is 2026-11-30, so the Sunday 29 Nov run
  is the first one gated (ruling `gate_from`).
- **The buyer judge is kept, as the paying reader.** No other judge tests whether these industries would pay to read;
  the reader judge tests whether they read it free. The old thirty-day buyer stays retired. The key stays `buyer`, its
  label says Paying reader, and its question asks whether someone who makes the calls or makes the work would pay for
  this because it tells them how their work makes money in a way they could not get free elsewhere this week. Every
  judge's rank of his picks is now recorded on the scorecard (`judge_rank_of_pick`), and after 4 scored weeks a judge
  no better than chance gets a review line, "retire or rewrite" (`config/judges.json`). Reported only.
- **The three demoted floors are hard again, each made honest** (ruling `floors_honest_and_hard`, learning
  `floors-honest-and-hard`). A hero is in a focus sector (fit 7, read only in the topic sentence that carries the fact,
  with named entities per sector and keyword stuffing taken out; a wildcard needs fit 4); a hero has a primary source,
  now defined as the actor's own site, a filing or official data host, or where the fact was first reported, never an
  aggregator; a short and a meme are on the beat (fit 4), and a good-news carousel is at least half in the sectors.
  A thin week carries two passing options with a line on the card; the floors are never relaxed. The Sunday gather
  reads the daily news hub's week of stories, or says why it could not.
- **No floor survives on faith.** Every hard floor names a ruling or a recorded failure
  (`tests/story_floor_rules_test.py`); a floor with neither is a note and says so.
