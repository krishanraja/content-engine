# Story score: floor, probe, score and order

Kept here, not in `.agents/skills/plan-week/SKILL.md`, so the core stays under its byte cap
(scripts/check_skill_core.py). The core points here. The full Sunday procedure (floor, shortlist, angles, the blind
score, humour reads, council on close calls, order) is added to this file as the story engine lands; this first part
is the pre-pick whys probe.

Rulings behind it: the signature format is the 5 Whys, with nothing that suggests predictions, calls, dates, odds or
scores (Krish, 2026-11-24); his taste is a floor only, never a score, and the judge wall stays (Krish, 2026-11-26).

## The whys probe (before he picks)

Every option that survives `story_floor.py` on a hero day (Mon, Wed, Fri) gets a probe: one blind subagent per option
reads that option's own sources and climbs as many Whys as the evidence holds. It runs in-session, so it costs
nothing. The probe is judged by the same reader as the post-pick ladder, so a story that cannot hold the whys is found
before the board, not after.

1. For each option, start one `whys-prober` subagent with the brief below. Fill in only the option's id, its
   "what happened" line and its source links. Give it nothing else.
2. It writes `docs/plans/<Monday>-week/probe/<option_id>.whys.json` and caches every page it read under
   `docs/plans/<Monday>-week/probe/pages/`.
3. Run `npx tsx scripts/whys-probe-check.ts <Monday>` (or `<Monday> <option_id>` for one). It prints, per option,
   `{documented, inferred, sites, mechanism_rungs, counter_rungs, landing_ok, unreadable[], problems[]}`.
4. `story_score.py` reads that output for the `whys` axis and the hero floors in `config/story-score.json`
   (at least 3 documented, at least 5 documented plus inferred, landing ok). Do not apply the floors by hand.
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
