---
name: hannah-fry
description: "Hold every video script to Hannah Fry's teaching craft, as measured from her Short 'Could Alzheimer's start in our nose?': before writing, plan the breakdown on her shape (the whole claim first, the known version moved aside, the one thing to know as pictures, a ladder of evidence with a refrain, the claim back bigger, delight); after writing, a separate reader checks the words against her eight moves and names the line where curiosity drops. Runs automatically and silently on every script any session writes (make-piece's Scripts step, off-day voiceovers, features, directed shoots), or when Krish asks for a script to be checked against Hannah Fry. A validator after the writer: it never writes the script, never overrides a house rule and never holds his own Approve scripts press."
model: opus
---

# Teach it like Hannah Fry

Krish, 2026-11-17: "I really like her teaching style, her fluency of speech, how she doesn't talk down to anyone, but
how she makes boring things so interesting." This skill makes that a standard every script is checked against. It is
built from her Short he chose, "Could Alzheimer's start in our nose?", read with content-watcher from his upload
(timed transcript, pace, pauses, shots). Every move is shown in her own words, with times, in
`.agents/skills/hannah-fry/references/breakdown.md`.

It is a validator, stacked after the writer. `make-piece` ("The Scripts step") writes the scripts and owns the order
of the checks. This skill adds one planning read before the words are written and one separate reader after. Where
her habits and Krish's house rules disagree, his rules win; "Where it meets Krish's house rules" in the breakdown
lists every known clash and how it resolves.

## Before writing: plan the breakdown

Read the breakdown once per session. Before the first word of either cut, write the plan in six lines at the top of
your working notes (never in the script file):

1. **The claim**, the surprising thing, said whole, which is the first sentence.
2. **The known version**, what the viewer may already half-know, which the claim goes beyond.
3. **The one thing to know**, the background the viewer needs, as one or more pictures, with the term after them.
4. **The rungs and the refrain**, each piece of evidence closer to the viewer's own life, and the short line each one
   ends on.
5. **The claim back bigger**, "So here is ...", numbered if it has parts, and how it changes the opening.
6. **The delight**, one self-aware aside and the one moment of "this is fascinating".

The short cut uses one rung only (ONE_STORY_SHORT). The long cut climbs two or three, inside his four-beat intro, the
map and the recap ("How each cut uses it").

The style bank's nine Fry modules (`config/style-references.json`, bank) come from her stamp duty Short and are still
untested by Krish. Propose them through the Style recipe row with his yes in words. This plan is the teaching shape
every script follows, whatever recipe he picks.

## After writing: the teaching check

Run it after `story_check.py` and `humour_check.py` pass and before the three-reader read-back, for each cut.
`.agents/skills/hannah-fry/references/reader-prompt.md` holds the reader's prompt word for word and what to do with
its answer. A fail is rewritten and read again by a new reader. A pass is filed as `teaching-check-<cut>.md` in the
piece's plan folder, bound to the script's sha256.

**Automatic and silent** (Krish, 2026-11-18: "The Hannah Fry skill should invoke automatically but silently behind
the scenes"). It runs on every script any session writes: both cuts of a series piece, a feature, an off-day voiceover
and a directed shoot's lines. Nobody asks for it, and it never asks him anything. It never appears on the board, in a
board prompt or in a message to him. A fail is fixed before he sees the words, and the file stays in the plan folder.
His own Approve scripts press sends his exact words at once (F49). If the check has not run on those words, it runs
after the send, files its verdict in the plan folder for the next script to learn from, and never holds, changes or
reports on his words.
