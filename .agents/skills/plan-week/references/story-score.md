# Step 6d: score, floor and order (the story score)

Kept here, not in `.agents/skills/plan-week/SKILL.md`, so the core stays under its byte cap
(scripts/check_skill_core.py). The core keeps step 6d and points here. This file is the whole Sunday procedure: it
replaces the old funny-lines step (`.agents/skills/plan-week/references/funny-lines.md`, kept for history), whose
humour reads now run inside step 8 below.

Every content type starts from the biggest, most important, most absurd, funniest or most interesting story, with a
unique angle that holds the 5 Whys and is fun to make and to read, for the reader in `config/beat.json` (`reader`).
Three stages, every number a row in `config/story-score.json` (`rubric_version` `story-score/1`), never in code:

1. **The floor** (`scripts/post-pack/story_floor.py`): the only code that reads his recorded rejections. It says pass
   or refused, with the reasons, and never gives a number.
2. **The blind score** (`scripts/post-pack/story_score.py`): eight anchored 0 to 10 axes (scale, absurdity_humour,
   unique_angle, whys, fit, named_thing, fun_consume, fun_produce), weighted per type (Mon, Wed and Fri heroes, the
   off-day short and meme, the good news, the explainer) to a total out of 100, with hard floors per type.
3. **The council**, on close calls only (a slot's top two within `close.margin`, or the fun-against-weight fork).

Rulings behind it: his taste is a floor only, never a score, and the judge wall stays (Krish, 2026-11-26); the
signature format is the 5 Whys, with nothing that suggests predictions, calls, dates, odds or scores (Krish,
2026-11-24); the beat is AI in media, entertainment, arts, music, sports and creator tech (Krish, 2026-11-24).

## The wall: what no judge, subagent or score ever sees

His rejections are a floor only; never a score. So nothing below passes a judge, a lens, a prober or the council his
picks, his words, his presses, `why_here`, `recommended`, `source_kind`, `from`, `taste_rules`, feedback cues, style
verdicts (`krish_verdict`, `krish_said`, `what_i_like_sheet`), a scorecard or the triage readback. Give a subagent
only what its brief below says. `story_score.py` sees each option through `blind_view()` (config `blind_view`), and
`tests/story_wall_test.py` holds the code to that. His option goes first only at equal totals, and that is the one
place where an option came from is read.

## Where it runs in the Sunday procedure

Steps 1 to 3 run once the gather's pool is in (steps 1 to 3 of the core, before you write options). Steps 4 to 11 run
once `ideas.json` holds the week's options (step 4 of the core), and step 12 is the core's step 7. All working files
go in `docs/plans/<Monday>-week/` (`story/` for the score's own, `probe/` for the whys probes); the spend ledger is
`.cache/story-score/spend.jsonl`, gitignored.

1. **Gather.** `board_feed.py gather` and `cover`, as the core says. Nothing here changes what is read.
2. **The floor.** `python3 scripts/post-pack/story_floor.py <Monday> --pool --json`. Leave out every candidate it
   refuses, and say how many and why in one line each on the run's summary. Once the options are in `ideas.json`, run it
   again without `--pool` and write its JSON, as printed, to `docs/plans/<Monday>-week/story/floor.json`. Exit 2 means a
   check did not run: say which, and never call a candidate it did not read a pass.
3. **The deterministic shortlist.** Write the floor's survivors into `ideas.json` as the day's draft options and run
   `python3 scripts/post-pack/story_score.py score <Monday> --floor docs/plans/<Monday>-week/story/floor.json`. At this
   stage it exits 2, since nothing is judged yet: read only `fit`, `named_thing` and the `primary_sources` check in
   `docs/plans/<Monday>-week/scores.json`. Keep for each hero day the candidates that clear the hero floors those give (fit at least 7,
   named_thing at least 5, at least one primary source), up to the day's option count plus two. A candidate that fails
   them is replaced from the pool, not argued for.
4. **The whys probe**, below: one blind `whys-prober` subagent per hero candidate and per off-day short (a short's floor
   needs one documented why). It costs nothing.
5. **The probe check.** `node --import tsx scripts/whys-probe-check.ts <Monday>`, and write its JSON, as printed, to
   `docs/plans/<Monday>-week/story/probes.json` (the score reads it from there). A hero that holds fewer than 3
   documented whys, or fewer than 5 documented plus inferred, or whose landing fails, is under its floor: replace it, or
   probe another source for the same story. The gate refuses a hero with fewer than 3 sourced whys.
6. **The angles.** Start three blind lens subagents, one per lens in config `angle.lenses` (`series`, `funniest_true`,
   `most_absurd_true`), each with the lens brief below and every option's key, sourced fact and links. Write what they
   return, with each option's own `funny` line as one more angle (lens `funny`), into `docs/plans/<Monday>-week/story/angles.json` as
   `{"options": {"<day>/<option id>": [{"lens", "text", "rests_on"}]}, "obvious": ["<the plain headline of each option>"]}`.
   Then `python3 scripts/post-pack/story_score.py angles <Monday> --provoke --judge --budget-usd 3`: it adds divergent
   sparks (`provoke`, lane `angles`, the worn takes as cliches) for each hero day's top two only, and scores the whole
   pool blind in one batched judged `score`. Paid: about $0.15 a provoke and $0.30 reserved for each judged batch.
7. **The soundness rule** is in the code: an angle counts only when its `rests_on` is quoted word for word from the
   option's sourced fact, the judge found it useful and specific enough, its humour targets no named individual, and on
   a hero the first why climbs. The funniest or most absurd true angle wins only when it is sound and within
   `angle.humour_margin` of the best. Never pick an angle by hand over the code's choice.
8. **The humour reads** (this absorbs the funny lines). `python3 scripts/post-pack/story_score.py humour <Monday>
   --budget-usd 3`: one humour-engine read of each option's plain fact (surface `fact`), each off day's funny line and
   every pooled angle, about $0.005 each. A funny line read as not a joke, not supported or needing explaining is
   rewritten from the sourced fact and read again. A short or meme whose humour was not read is never placed first.
9. **The blind axis judges.** `python3 scripts/post-pack/story_score.py brief <Monday>` writes
   `story/judge-brief.md`. Start one `Task` subagent whose whole prompt is that file, and nothing else. It replies with
   `## <key>` lines and `<axis>: <n>/10 because <evidence>` lines. Write the reply to `story/judge.md` and run
   `python3 scripts/post-pack/story_score.py record <Monday> docs/plans/<Monday>-week/story/judge.md`. A score with no
   evidence after `because` is not counted. It costs nothing.
10. **Score and order.** `python3 scripts/post-pack/story_score.py score <Monday> --floor
    docs/plans/<Monday>-week/story/floor.json`, then `python3 scripts/post-pack/story_score.py order <Monday> --fresh
    --write` on a board he has never seen. On a re-run of some days, order with `--status` and the status file the
    workflow wrote before the run (the run's prompt names it), never `--fresh`: only a day whose options are all open is
    ordered, and an answered day keeps its places (its presses name options by place). If the order moved a publishing
    day, write that day's options again through `/api/week/options` (core step 4) with `rank` as the new place and
    `recommended` on the first, so the engine and `ideas.json` agree.
11. **The council, on close calls only.** `order` prints each close call. While `council.cleared` is false in
    `config/story-score.json` (the ai-harness council's When it runs section admits Krish's ask or the strategist
    only), do not run it: the card says "close call, your pick", and that is the answer, never a silent pass. Once a
    ruling sets it true, for each close call (at most `council.max_per_week`): `story_score.py council-brief <Monday>
    --day <day>` writes `story/council-<day>.md`; WebFetch
    `https://raw.githubusercontent.com/krishanraja/ai-harness/main/skills/council/SKILL.md`, start one `Task`
    subagent with that skill and the brief only, write its reply to `story/council-<day>-reply.md`, run
    `story_score.py council-record <Monday> --day <day> docs/plans/<Monday>-week/story/council-<day>-reply.md`, then
    `order` again. A chair that says unknown leaves the call his.
12. **The board** (core step 7). `board_feed.py gate` refuses, from config `from`, an open option with no story score,
    an open day out of the score's order, a hero under 3 sourced whys (code `story`) and an option under its floor
    (code `story_floor`). Fix what it names and run it again; never edit a score by hand.

## Spend and exit 2

- Paid steps are 6 (`angles --provoke --judge`), 8 (`humour`) and 11 (the council read, once cleared). Steps 2 to 5,
  7, 9, 10 and 12 cost nothing. A normal Sunday is under $2.
- Every paid call is reserved in the ledger before its transport is touched. It is refused past `--budget-usd` (pass
  3 unless Krish names another figure; never above `budget_usd`), past `spend.usd_per_day`, past
  `spend.divergent_ops_per_day`, and past the weekly divergent chain cap (`config/chain-cap.json`), which is checked
  first. `python3 scripts/post-pack/story_score.py ledger` prints what was spent. The ledger is under `.cache/`, so a
  workflow run starts it empty.
- Exit 2 from any step means something was not read: the engine was not served, a cap refused a call, a page could not
  be read, or an option was left unscored. It is never a pass. Carry on with what was read: an unread axis abstains,
  and an option whose read axes weigh under `abstain.min_read_weight` is unscored, so replace it or read it again.
  Never fill a missing read from memory.

## What the run's summary says

One short block: how many candidates the floor refused and why; how many options were probed, with each unreadable
source named apart from a story that could not hold the whys; each day's order and each option's total; each close
call and whether the council read it or it stays "close call, your pick"; every step that exited 2 and what it
skipped; and the ledger's spend against its budget.

## The lens brief (paste as each lens subagent's prompt)

The subagent is blind, like the prober: each story's key, sourced fact and links, and one lens. Nothing else.

```text
You are an angle finder. You get some true news stories and one lens. For each story, write up to three angles
through that lens: one or two plain sentences each, for a reader in creative work, the arts, music, entertainment,
media or sport. You see nothing about who will read the stories or pick them, and you do not rank them.

Lens: <the lens's brief, from config/story-score.json angle.lenses>

For each story:
Story key: <day>/<option id>
What happened: <the option's sourced fact, as written>
Sources: <the option's source links, one per line>

1. Every angle rests on one fact in "What happened". Copy that fact's words exactly into rests_on: never a
   paraphrase, never a detail the story does not give.
2. Funny is welcome when it is true: the joke is in the facts, never at a named person's expense, and it never needs
   explaining.
3. No predictions, odds, calls or dates for what will happen, and no advice.
4. Reply with only JSON: {"<story key>": [{"lens": "<lens id>", "text": "...", "rests_on": "..."}]}

Use British spelling. No em dashes and no exclamation marks.
```

## The whys probe (before he picks)

Every option that survives `story_floor.py` on a hero day (Mon, Wed, Fri), and every off-day short, gets a probe: one
blind subagent per option reads that option's own sources and climbs as many Whys as the evidence holds. It runs
in-session, so it costs nothing. The probe is judged by the same reader as the post-pick ladder, so a story that
cannot hold the whys is found before the board, not after.

1. For each option, start one `whys-prober` subagent with the brief below. Fill in only the option's id, its
   "what happened" line and its source links. Give it nothing else.
2. It writes `docs/plans/<Monday>-week/probe/<option_id>.whys.json` and caches every page it read under
   `docs/plans/<Monday>-week/probe/pages/`.
3. Run `node --import tsx scripts/whys-probe-check.ts <Monday>` (or `<Monday> <option_id>` for one). It prints, per
   option, `{documented, inferred, sites, mechanism_rungs, counter_rungs, landing_ok, unreadable[], problems[]}`.
4. `story_score.py` reads that output from `story/probes.json` for the `whys` axis and the hero floors in
   `config/story-score.json` (at least 3 documented, at least 5 documented plus inferred, landing ok). Do not apply the
   floors by hand.
5. A probe whose pages could not be read is not a story that fails the whys: say which sources were unreadable on the
   run's summary, and try another source for the same story if one exists. Exit 2 from the check (no probe, no ladder)
   is never a pass: say which option was not probed.

How the check counts, so the brief can be honest about it:

- A rung is **documented** only when its quotes are found word for word in the cached pages, on at least two sites
  (ir.label.com and label.com are one site).
- A rung with one verbatim quote, or verbatim quotes on one site only, counts as **inferred**. A paraphrase is
  downgraded; nothing is ever upgraded.
- A rung none of whose quotes is in its page does not count.
- The landing is ok only when it says what this shows and ends on an open question, with no forecast, odds, confidence
  or lesson (`landingVetoes` in `packages/contracts/src/whys.ts`).

### The whys-prober brief (paste as the subagent's prompt)

The subagent is blind. Never add the option's other fields, other options, the reader's or anyone's preferences,
earlier picks, refusals, verdicts, scores, why it was chosen, or what anyone said about it. It sees one story and its
sources, nothing more.

```text
You are a whys-prober. You get one news story and its source links. Your job is to find out how far the story's
evidence goes when you keep asking "why?", and to write that down honestly. You are not judging whether the story is
good, funny or worth making. You see no other story and nothing about who will read it.

Story id: <option_id>
What happened: <one line, as the option states it>
Sources: <the option's source links, one per line>

1. Read each source. Follow a link from a source only when it is the primary record the source cites (a filing, a
   company's own announcement, a court document, the study itself). Do not search the open web for other takes.
2. Save the text of every page you read, as fetched, to docs/plans/<Monday>-week/probe/pages/<short-name>.txt, and add
   it to docs/plans/<Monday>-week/probe/pages/index.json as "<url>": {"file": "<short-name>.txt"}. If a page will not
   load, is behind a paywall or is empty, add "<url>": {"unreadable": "<why, in a few words>"} instead. Never guess
   what an unreadable page says.
3. Start from the plain question the story raises ("Why did X do Y?") and climb one Why at a time. Each Why gets:
   - one answer of 60 words or fewer, in plain words;
   - its evidence: for each source the url, the domain, the page's date, and a quote copied word for word from the
     saved page (never a paraphrase, never stitched from two places);
   - its strength: "documented" when two sources on two different sites say it, "inferred" when the sources point to
     it but do not say it outright, "open" when nothing you read answers it;
   - the strongest counter-evidence you found, or "none found" with the scope you searched;
   - mechanism_type when the answer says how something works (the money, the model, the contract, the rule).
4. Stop where the evidence stops. Five Whys is the target, not a rule: three honest Whys that stop with a reason
   ("evidence_exhausted", "out_of_scope", "motive_not_mechanism") are worth more than five padded ones. Never climb past
   an open Why.
5. Land on what the ladder shows and one open question handed to the reader, ending with "?".
6. Never predict, forecast, give odds or chances, make a call, put a date on what will happen, say how confident you
   are, or tell anyone what they should do. Describe what the sources show, and nothing that has not happened.
7. Write the ladder to docs/plans/<Monday>-week/probe/<option_id>.whys.json in this shape and nothing else:

{
  "schema": "why-ladder/1",
  "question": "Why ...?",
  "rungs": [
    {"n": 1, "question": "Why ...?", "answer": "...",
     "evidence": [{"url": "...", "domain": "...", "date": "YYYY-MM-DD", "quote": "..."}],
     "strength": "documented", "counter": {"text": "..."}, "mechanism_type": "...", "stop": null}
  ],
  "landing": {"shows": "...", "open_question": "...?"}
}

Use British spelling. No em dashes and no exclamation marks. Reply with only the file path and the number of Whys.
```
