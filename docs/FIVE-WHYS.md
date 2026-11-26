# The 5 Whys: the signature format

Status: canonical from 24 November 2026. Every makeyourmindup piece, on every
day and every surface, is built as a why-ladder. It replaces Predictions and
Calls everywhere (Ruling, Krish, 2026-11-24: the signature format is the 5
Whys; get rid of everything that suggests predictions, calls, dated, odds or
scores). The Call (P6 in `docs/CREATIVE_IDENTITY_UPGRADE.md`) is superseded by
this document.

The bar for every rung, device and surface is his: "EVERYTHING must be 10/10
fun to produce and to consume, and genuinely move the needle on people's real
world understanding" (Krish, 2026-11-24). A piece need not reach a
conclusion, but it must end somewhere very insightful.

## What it is

A why-ladder starts from one question about a real story and climbs it one
Why at a time. Each rung asks a Why, answers it in one short paragraph backed
by sources, and ends on the next question. The listener follows the climb
step by step, and the motion on screen matches each step predictably: the
same parts, in the same places, every time. The ladder stops at the first
cause that is changeable, documented and still on the subject, then lands on
what the climb shows and hands the viewer one open question.

Five is the target, never a rule. A ladder has 3 to 7 rungs.

## The contract: `why-ladder/1`

The shape lives in `packages/contracts/src/whys.ts` (schema id
`why-ladder/1`). It replaces `packages/contracts/src/call.ts`, which is
retired. Research returns it as a fenced `why-ladder` (or `json`) block;
`parseWhyLadder(text)` finds that block, and `checkWhyLadder(ladder)` lists
each problem by rung. A piece stores its ladder in `meta.whys`, and the
`WHY_LADDER` publish check runs the same check in code.

```json
{
  "schema": "why-ladder/1",
  "question": "<the title question, one sentence>",
  "series": "follow_the_money",
  "rungs": [
    {
      "n": 1,
      "question": "Why <...>?",
      "answer": "<60 words or fewer>",
      "evidence": [
        { "url": "<url>", "domain": "<domain>", "date": "<yyyy-mm-dd>", "quote": "<verbatim words from the page>", "tier": "<source tier>" },
        { "url": "<url>", "domain": "<a second domain>", "date": "<yyyy-mm-dd>", "quote": "<verbatim words>", "tier": "<source tier>" }
      ],
      "strength": "documented",
      "counter": { "text": "<the strongest competing explanation>" },
      "mechanism_type": "<incentive, constraint, contract, technical, ...>",
      "stop": null
    }
  ],
  "landing": {
    "shows": "<what this shows: the root insight, one or two sentences>",
    "open_question": "<the question handed to the viewer>"
  }
}
```

Each rung holds:

| Field | What it is | Rule |
|---|---|---|
| `n` | the rung's number, from 1 | in order, no gaps |
| `question` | the Why this rung asks | the previous rung's answer leads to it |
| `answer` | the answer, in plain words | 60 words or fewer |
| `evidence[]` | `url`, `domain`, `date`, a verbatim `quote`, optional `tier` | at least 2 items on at least 2 domains for any rung that is not open |
| `strength` | `documented`, `inferred` or `open` | `documented`: the sources say it; `inferred`: the sources support it but do not say it; `open`: no evidence yet |
| `counter` | the strongest competing explanation (`text`), or none found with the scope searched (`none_found_scope`) | never empty: either a counter or the scope that found none |
| `branch` | when the evidence splits: `join` (`AND` or `OR`), the `answers` with their own evidence, and which one was `followed` | at most two branches |
| `mechanism_type` | what kind of cause this is | optional |
| `stop` | why the ladder stops here, or `null` | `evidence_exhausted`, `motive_not_mechanism`, `restatement`, `abstraction_drift`, `out_of_scope` or `cap` |

`checkWhyLadder` refuses: fewer than 3 rungs unless a rung sets `stop`; more
than 7; a rung that is not open with fewer than 2 sources or sources on one
domain; an answer over 60 words; and a landing with forecast, odds,
confidence or preaching wording. A failing rung is shown with its reason ("Why
3 needs a second source"); it is never dropped silently.

## How rungs link

Rungs join with **because** or **but**, never "and then". A ladder is a chain
of causes, not a list of events. Each rung ends on the next question, so the
viewer is always one step ahead of the answer and wants it.

- because: this rung's answer is the cause of the last one.
- but: this rung's answer complicates the last one, and the next Why follows
  the complication.

## The landing

The landing is two things, on one card:

1. **What this shows.** The root insight, in one or two sentences: the thing
   the climb uncovered that the viewer did not see at the top.
2. **An open question handed to the viewer.** One question the viewer can
   take into their own world and answer for themselves.

The landing is never a verdict, a forecast, odds, a confidence number, a
lesson for leaders, or "the real question for leaders". The makeyourmindup
kill list blocks those under `preach_pattern`, which cannot be appealed.

## Edge cases

- **A Why with no evidence.** It becomes an "Open question" rung, drawn
  dashed, with `strength: "open"`. Never climb past it: stop there
  (`stop: "evidence_exhausted"`) or take the branch that has evidence.
- **A split Why.** The rail forks into at most two branches. `AND` means both
  causes were needed; `OR` means competing explanations. Follow the
  better-evidenced branch and mark the other "parked", on screen and in
  `branch.followed`.
- **A loop.** When a rung's answer leads back to an earlier rung, draw an arc
  back to it, labelled "feedback loop". The loop can be the insight, and the
  landing may say so.
- **A Why that lands on a person.** Switch the question to "how did this make
  sense to them?" and show their incentives and constraints. Never end on
  blame (`stop: "motive_not_mechanism"` when only a motive is left).
- **Fewer than five rungs.** Land at the first changeable cause and never pad.
  With fewer than 3 rungs, publish the honest stop sentence
  (`terminalStatement`): what the evidence reaches and where it runs out.
- **More than five rungs.** Merge sub-steps into one rung, up to 7 in all
  ("Why 5+"). At 7 the ladder stops (`stop: "cap"`).
- **A Why that leaves the subject** (for example "because capitalism"). Stop
  (`stop: "out_of_scope"` or `abstraction_drift`) and name who owns that
  question.
- **A Why that only repeats the last answer.** Stop (`stop: "restatement"`);
  the ladder has reached its root.

## Before the pick: the whys probe (story engine v5, from the 7 Dec board)

Until the story engine, a ladder was first built after Krish picked a story, so a story that could not hold five whys
reached the board and failed only once he had chosen it. Now every Sunday option is probed before the board is built
(branch `story/engine-v5`; the gap list is `docs/proposals/2026-11-26-story-engine-gaps.md`, items 10 to 12):

- **A blind whys-prober** (a subagent with the option's own sources and nothing else: no picks, no taste, no other
  option) writes an option-level `whys` in the `why-ladder/1` shape above and caches every page it read under
  `docs/plans/<Monday>-week/probe/pages/`. Its brief is `.agents/skills/plan-week/references/story-score.md`,
  "The whys probe (before he picks)".
- **The check holds every quote to its page.** `npx tsx scripts/whys-probe-check.ts <Monday> [<option_id>]` reads the
  probe with the same reader as the post-pick ladder (`checkWhyLadder`, `landingVetoes`, `siteOf` from
  `packages/contracts/src/whys.ts`). A rung counts as documented only when quotes found verbatim in their cached pages
  span at least two sites; one verbatim quote, or one site, makes it inferred; a paraphrase is downgraded, never
  upgraded; a rung whose pages could not be read is reported apart, never as a story that cannot hold the whys. Exit 2
  (no probe, no ladder) is never a pass.
- **The floors.** The blind story score (`config/story-score.json`, `hero_floors`) refuses a Monday, Wednesday or Friday
  hero with fewer than three documented whys, fewer than five documented and labelled-inferred rungs, or a landing with
  a veto; on the hero types the whys axis carries the heaviest weight, level with scale. Per series: Monday needs a sourced money figure,
  Wednesday a mechanism rung, Friday a claim-against-evidence counter.
- **After the pick nothing changes:** the research still files the sourced ladder in `meta.whys`, and `WHY_LADDER`
  still blocks approval without it. The probe only decides which stories reach him.

## Research requirements

Research backs each Why, not the piece as a whole.

- **One sourced answer per Why.** Every rung that is not open carries at
  least 2 verbatim quotes from at least 2 domains, each with its URL and date.
  The insight-desk rule applies to each claim: "because Z", plus the source
  and when it was read, or it is marked as an assumption.
- **Counter-evidence on every rung.** The research names the strongest
  competing explanation for each answer, or says it found none and where it
  looked (`counter.none_found_scope`).
- **The stop rule.** Research stops a ladder for one of the six reasons in
  `stop` and says which. It never pads to five and never climbs past an open
  rung.
- **One research prompt.** The board's research prompt (the Perplexity paste)
  and the engine's own research step ask for the same thing: a fenced
  `why-ladder/1` block first, then the Markdown write-up. Paste research and
  "Research it now" parse the block, check it and store it in `meta.whys`.
- **The lock carries it.** The narrative lock gains a "The Whys" section: one
  Why per beat, each citing its evidence ids. The making check refuses a Why
  with no evidence.
- **The fact gate uses the Why evidence** as filed sources.
- **What would break this Why.** The old falsifier survives only in this
  shape: per rung, the evidence that would knock that answer down. It never
  carries a date.

## Visual grammar

One fixed set of parts across all three days. The final look (type, colour,
texture) is owned by the concept stage and approved by Krish on a rendered
mock; the parts and their jobs are fixed here.

- **Ladder rail.** On the left edge on 9:16, along the top on 16:9. The
  current rung is lit; finished rungs dim to a 2 to 4 word label; future rungs
  are blank. On YouTube each rung is one chapter.
- **Step card.** A small-caps "WHY 3" with the question in an editorial
  serif, held for about 1.5 s.
- **Evidence plates, five types:**
  1. a primary document with one highlight bar
  2. a one-line chart with one note
  3. a map or place
  4. real creative work (a cover, still or performance, with rights)
  5. a quote card with name and role
- **Source line and strength marker** on every plate: where it came from,
  when, and whether the rung is documented, inferred or open.
- **Recap stack.** At rung 3 and at the end: the climb so far as a stack of
  rung labels. The same frame doubles as the carousel cover and the 9:16
  thumbnail.
- **Landing card.** What this shows, and the open question.
- **Motion.** Decelerating moves of about 8 to 12 frames. No bounce, no
  overshoot, no slap. The predictability is the point: the viewer learns the
  grammar on rung 1 and follows the argument, not the effects.

## Lengths

- **Long form.** The full ladder, each rung a chapter, with the recap stack at
  rung 3 and before the landing.
- **9:16.** The title question as the hook in under 3 s, then step cards with
  their evidence plates, then the recap and the landing. 30 to 60 s.
- **Carousel.** `carousel-deck/2`: one rung per card, each with its source,
  plus a recap card. A ladder carousel is a chained deck, the exception to
  "every body card stands alone".

## The three days

The days stay, and the ladder makes them more distinct. The boundary is his
of 24 September: what the reader changes next.

| | follow.the.money (Mon) | under.the.hood (Wed) | mind.the.gap (Fri) |
|---|---|---|---|
| Why 1 asks | who pays, and why the price moved | how it is built, and what broke | where the claim and the reality part |
| Main evidence plate | money flow, contracts, royalty splits | mechanism diagrams; Real or Theatre as an evidence annotation | two columns, belief against evidence; the pattern timeline |
| Lands on | who ends up better or worse off | what is really inside | the pattern |
| Research | deepen's "Paid" columns | deepen's "Built" columns | the contrarian base-rate harness |

Each day gets one accent inside the shared system and its own
`venture_formats` mandate, written as a why-ladder mandate (the mandates live
in Supabase and change only with his yes). Real or Theatre stays as
under.the.hood's device, restyled as a news-style evidence annotation, not a
rubber stamp.

## Earned devices

Nothing from the old kit is banned outright. In his words (Krish, 2026-11-24):

> "I honestly dont mind any of these where they have merit to make a strong visual point that is additive to my narrative point. Remember, EVERYTHING must be 10/10 fun to produce and to consume, and genuinely move the needle on people's real world understanding"

So the old parts stop being house defaults and become **earned devices**: the
drawn faces and the character, the felt robot, stickers, stamps, Anton as a
punch word, absurd covers and pop captions. A device may appear only when it
makes a strong visual point that adds to that beat's narrative point, never as
decoration or a fallback. A beat that uses one says what it adds
(`device_merit`, "adds: ..."), and a reviewer has to agree the line is
additive.

## Fun, voice and register

- The energy comes from real creative work, the ladder's momentum, and dry
  wit (humour-engine on makeyourmindup only, never on Mindmake).
- Delivery stays reflective and documentary, never a "breaking news"
  announcer.
- Voiceover stays third-person documentary.
- Each rung is judged on the three tests: fun to produce, fun to consume, and
  does it move real-world understanding. Each visual is "additive or out".

## What is retired

Gone from published content and its pipeline (Ruling, Krish, 2026-11-24:
"Remove all; rename, don't kill"):

- Calls, dated calls, predictions, forecasts, odds, confidence numbers ("How
  sure we are"), scoring and track records, and the scoreboard that showed
  them.
- The 19 November opt-in prediction path: no piece makes a prediction, even
  on request.
- The call card, the call beat role and the "Our call." band on the web
  edition. The landing card takes their place.
- The prediction-market reads that sat beside a Call.

Kept or renamed:

- The your.call reader device keeps its mechanic under a new name Krish will
  choose.
- Real or Theatre stays, restyled as an evidence annotation.
- The "before it's obvious" tagline is replaced with a 5 Whys line.
- The nine published pieces that carry prediction sections stay as they are,
  as archive.

Not affected: internal confidence columns that are not published content (the
strategist, the revenue desk, the council, the business scorecard and idea
quality). Historical files under `docs/plans/**` and `docs/history/**` are
records and are never edited.

## Where it is enforced

- Contract: `packages/contracts/src/whys.ts` (`WHY_LADDER_SCHEMA`,
  `parseWhyLadder`, `checkWhyLadder`).
- Publish check: `WHY_LADDER`, in the publish checks.
- Learning: `why-ladder-close` in `config/learnings.json`.
- Before the pick: `scripts/whys-probe-check.ts` and the story score's `hero_floors` (`config/story-score.json`),
  held at the board's gate as code `story` from the rubric's `from` date.
- The no-call sweep: no "our call", "how sure", "odds" or "dated call" in copy
  or chrome, outside history files and the internals named above.
