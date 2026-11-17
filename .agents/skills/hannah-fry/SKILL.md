---
name: hannah-fry
description: "Hold every video script to Hannah Fry's teaching craft: before writing, plan the breakdown on her shape (a question the viewer did not know they had, the obvious answer said fairly, the turn, one person, one picture, one number after the story, one line of how sure, a close that rewards the question); after writing, a separate reader checks the words against her eight moves and names the line where curiosity drops. Use in make-piece's Scripts step for both cuts, for a ve voiceover script, or when Krish asks for a script to be checked against Hannah Fry. A validator after the writer: it never writes the script, never overrides a house rule and never holds his own Approve scripts press."
model: opus
---

# Teach it like Hannah Fry

Krish, 2026-11-17: "I really like her teaching style, her fluency of speech, how she doesn't talk down to anyone, but
how she makes boring things so interesting." This skill makes that a standard every script is checked against.

It is a validator, stacked after the writer. `make-piece` ("The Scripts step") writes the scripts and owns their
order of checks. This skill adds one planning read before the words are written and one separate reader after. Where
her habits and Krish's house rules disagree, his rules win: `.agents/skills/hannah-fry/references/breakdown.md`, "Where it meets Krish's house
rules", lists every known clash and how it resolves.

## Before writing: plan the breakdown

Read `.agents/skills/hannah-fry/references/breakdown.md` once per session. Before the first word of either cut, write the plan in five lines at
the top of your working notes (never in the script file):

1. **The question** the viewer did not know they had, about their own world, which the title answers.
2. **The obvious answer**, the view a reasonable person already holds, in one fair sentence.
3. **The turn**, the one thing that does not fit.
4. **The person and the picture**, one ordinary person in one moment, and the one everyday image that names how it
   works.
5. **The number and how sure**, the one figure that lands after the story, and one plain line on how strong the
   evidence is.

The short cut uses these five in that order, one story only. The long cut follows the same spine and adds the map, the
signposted sections, any further evidence or counterpoint, the better way and the recap ("How each cut uses it").

The style bank's nine Fry modules (`config/style-references.json`, bank, `"from": "Hannah Fry, stamp duty Short"`)
are still untested by Krish. Propose them through the Style recipe row as before, with his yes in words. This plan
is the teaching shape every script follows, whatever recipe he picks.

## After writing: the teaching check

Run it after `story_check.py` and `humour_check.py` pass and before the three-reader read-back, for each cut:
`.agents/skills/hannah-fry/references/reader-prompt.md` holds the reader's prompt word for word and what to do with its answer. A fail is
rewritten and read again by a new reader. A pass is filed as `teaching-check-<cut>.md` in the piece's plan folder,
bound to the script's sha256.

The check runs on scripts a session writes and sends. His own Approve scripts press sends his exact words at once
(F49). If the teaching check has not run on those words, it runs after the send and its verdict goes to him beside the
other checks. It never holds or changes his words.

## Still to calibrate

The moves come from her stamp duty Short, the engine's measured study of it, and her wider published work. The Short
Krish linked on 17 Nov, "Could Alzheimer's start in our nose?" (youtube.com/shorts/VADONXzhjTc), has not been heard
yet: YouTube refuses cloud addresses. Read it with content-watcher on a home computer (`content-watch` on the link,
which YouTube allows there). Then check each pattern in `.agents/skills/hannah-fry/references/breakdown.md` against her actual lines, quote the
lines that show each move, and correct any move her words do not bear out. Until then, the moves are a working model.
