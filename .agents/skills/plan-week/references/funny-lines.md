# Step 6d: the funny lines

Superseded (2026-11-26): step 6d is now `.agents/skills/plan-week/references/story-score.md`, whose step 8 runs
these humour reads through `story_score.py humour`. Kept for history; do not follow it.

Kept here, not in `.agents/skills/plan-week/SKILL.md`, so the core stays under its byte cap
(scripts/check_skill_core.py). The core keeps the step and points here.

6d. **The funny lines** (Krish, 2026-11-17: humour-engine on call). Every option carries its humorous angle in
   `funny` (idea_checks.py checks its shape, not whether it is funny). Before the board, run
   `python3 scripts/post-pack/humour_check.py ideas <the week's ideas.json>` (at most 20 calls): a line flagged "not a
   joke", "does not land" or "needs explaining" is rewritten and read again. Exit 2 (unavailable) never holds the
   board: write the options as they are and say on the run's summary that the funny lines were not read.
