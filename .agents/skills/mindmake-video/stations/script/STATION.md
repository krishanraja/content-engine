---
station_id: script
station_version: 3
status: active
---

# Script station

## Responsibility
Create exact spoken wording from the approved brief. Own the narrative sentence sequence, not the underlying idea, evidence verdict or visual execution.

## Inputs
Use the brief artifact, confirmed voice rules, public format contract and approved evidence boundaries.

## Outputs
Produce a versioned script artifact with an opening, mechanism, honest payoff and strong ending that Krish can actually say.

## Quality gates
Hard-block invented facts, collapsed nuance, confidentiality failures and canonical naming errors. Soft-block generic AI language, hollow commands, false urgency, weak specificity and endings that merely trail off. The first sentence should confirm the promise of the approved title, make clear why this narrator holds the claim, and leave a question the rest of the script answers; the candidates station enforces the first of those three.

The story check (Krish, 2026-10-06, walk log F75: "they need to actually make sense to humans"; of a script that "just ends randomly on 85%, with nothing after that, no outro"). Every script is one story from question to answer:

1. Open on one clear question, said out loud in the first beat, that the whole script answers.
2. Every beat sets that question up or answers it.
3. Every claim is set up before it is judged; no term the listener has not heard explained.
4. Each takeaway follows from a beat already told.
5. The ending answers the opening question out loud, then the call, then, for a script of a minute or more, a short spoken outro: what this was, where the full piece is, and Krish signing off. It never ends on the number.

Never read the article's headings or stamps aloud (REAL, THEATRE, "One: the billion."). `storyArcIssues` in `packages/core/src/editorial.ts` refuses a short-native script that misses the parts a rule can see (points 1 and 5, spoken stamps, unchecked facts); points 2 to 4 need a reader, so read the script aloud once before handing it on. The same rule is the content engine's house rules FOR_THE_EAR and STORY_ARC and the post pack's `story_check.py`.

## Failure and fallback
Return the sharpest diagnosis and a source-grounded alternative. If the brief cannot support a strong script, return it upstream instead of polishing weakness.

## Handoff
Short-native candidates inherit the exact script. Recording guidance cannot paraphrase or silently alter it.

## Learning boundary
Apply only active scoped voice rules. Treat edits and praise as evidence for confirmation, never as automatic global taste.

## Change control
Any change to truth or voice gates needs regression cases and a station version increment.
