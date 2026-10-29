# G8: produce-video back to Opus at default effort, unless measured equal (a proposal for Krish)

Wave 2 plan, W2.12: "G8 decision: produce-video back to Opus at default effort unless measured equal." The decision is
yours; nothing below changes the skill's frontmatter or `.claude/settings.json`.

## Where it stands

- Guard G8 (`docs/COST_GUARDS.md`) runs `produce-video` on Sonnet (`.agents/skills/produce-video/SKILL.md`
  frontmatter `model: sonnet`), on a one-week trial from 18 October: "any rework ends it".
- Everything else in a Claude Code session runs on Opus (`.claude/settings.json`), by cost rule 5 and
  `config/learnings.json` `cost-never-costs-quality`.
- Since 18 October the cuts made through this route were reworked more than once: `config/failures.json` holds
  F01 to F18 for Friday 23's cuts and `chopped-words-published` for Wednesday 21's long cut. Those failures are not
  attributed to the model in the record, so the trial has not been measured either way.

## The proposal

Put `produce-video` back on Opus at default effort from the next cut, unless a measured run shows Sonnet equal.

"Measured equal" means this, on the same inputs, with the same gates, and no paid call beyond the subscription:

1. Two runs of `produce-video` on one recorded test take: one on Sonnet, one on Opus at default effort.
2. Both runs pass the same machine gates: the words gate, joins in gaps, captions, loudness and the delivery gates.
3. You watch both cuts side by side at full size, with sound, and score each one out of 10 for production (the Scores
   press, W2.1). Equal means the same score or better.
4. The session token audit (`scripts/session_token_audit.py`) records what each run used, so the saving is a number.

If Sonnet's cut fails a gate that Opus passes, or scores lower, Opus stays. If they are equal, Sonnet stays and the
saving is recorded.

## What it needs from you

One line: "Opus now", "measure first" or "keep Sonnet".
