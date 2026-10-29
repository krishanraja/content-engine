# The Sunday-night run

Reference for the `produce-video` skill, read when his Titles press starts the run
(`.agents/skills/produce-video/SKILL.md`, "The Sunday-night run"). Kept out of the core so a session starts lean
(`docs/COST_GUARDS.md`, G14); the gates it runs are named in the core.

Krish, 2026-10-28: "an overnight Codex run will actually produce me the final assets and the final publish board
first thing Monday morning", with Codex only as "Visual asset maker". Until the overnight runner on the home
computers takes over, the run is this skill in a fresh session. It makes every cut recorded that Sunday for the
week eight days out (`plan-week`, "The Sunday loop"), on the quick-edit route (steps 1 to 9 of the core). No one
is in its chat: whatever it cannot decide is held, with its reason, for the Monday board.

## What starts it, and what 21:30 means

- **His Titles press starts it** (about 15:30; Krish, 2026-10-28: "Sunday evening press"): the press fires this
  skill for the week in a fresh session. Until the board's press can fire it (that lands with the board's own
  change), he starts it as he always has, by telling Claude Code "I've recorded".
- **Nothing starts it at a fixed time.** No scheduled job is approved for it (`AGENTS.md`, "Commit and
  closeout"); a fixed 21:30 start would be a new scheduled job, which is his call.
- **21:30 is only the deadline for his picks.** A surface he has not picked when the run draws its words (the
  thumbnail words, the title card) takes the option ranked first on its tab, drawn last so his pick has the most
  time to land. It is said as that on the record, never recorded as his pick (`title_check.py verdict --picked`
  is for his press only). A pick of his that lands by 21:30, after its surface was drawn, is redrawn before the
  Monday review, and his pick always wins.
- One run takes every day whose takes are placed. A day whose takes land later is cut by the next run, started
  the same way. A cut already filed for its current words is never cut again.

## The run

1. **The floor first:** `python3 scripts/floor.py --format short_video` and `--format long_video`, with the other
   makers the core's "Mandatory quality floor" names, read before the first cut.
2. **The pieces and their takes:** the week's three pieces (`scheduled` in `python3 scripts/engine.py GET
   "/api/week/options?week_start=<Monday>" --full`), each with its takes (step 2). A cut with no take of its
   current words is held: "no take of the current script".
3. **The titles:** his Titles presses, `python3 scripts/post-pack/board_web.py read <Monday> titles`; only
   documents whose `updated_by` is Krish are his. If the board refuses the collection (it is not built yet;
   `plan-week` step 8 said so), every surface takes its top-ranked option, said as that.
4. **Cut on quick-edit**, steps 3 to 5, from his signed creative direction only. A cut whose storyboard he has not
   signed for its exact words is held: "storyboard not signed" (`kit.py` refuses it anyway).
5. **The words gate, blocking**, on every cut before it is filed: `python3 scripts/quick-edit/words_gate.py
   --script <the cut's signed script> --take-words WORK/<cut>/<NAME>.words.json --final
   WORK/<cut>/<NAME>-<shape>.mp4`, with `--edl <its edl json>` when the cut has one. It prints a JSON report; exit
   1 names each content word the cut lost, and the cut is held with those words as its reason: not filed, not
   recorded, never shown as ready. A checkout without `words_gate.py` (it lands with its own pull request) files no
   cut: each is held, "words gate not in this checkout". No repair loop tonight: a held cut gets one bounded
   repair round on Monday morning, or waits for his call.
6. **Every other check is an advisory row** until it is calibrated: the report's numbers (step 6), caption
   timing, the joins, brand and composition, wherever a measure exists (`python scripts/ve.py qc <cut> --format
   <id>` only where a ve format fits the cut). Each is written with its result, or "not run" and why, and none
   holds a cut on its own yet. Every gate this skill already enforces still holds: the story intro and outro, a
   thumbnail of each shape, the visual gate, and the delivery receipt `making.py video` checks.
7. **File what passed** (steps 7 to 9): on a home computer the archive first; on a cloud machine the staged
   folder of both cuts and their thumbnails goes straight to `3 Posts/<post>/3 Video` with `send.py`, the way
   `scripts/produce_day.py` stages it. Then `making.py --by "Claude Code" <uuid> video ...` for each cut.
8. **The records the Monday board is built from.** Each held cut is one board item (step 10), `"lane":
   "in_progress"`, `"closes_on": "video"`, its detail the reason (the lost words, or what else held it). The run's
   report, `docs/plans/<Monday>-week/sunday-night.md`, gives per cut: filed or held and why, the words gate's
   result and each advisory row. Commit it and push the session branch with its pull request (`AGENTS.md`,
   "Commit and closeout"; nothing lives only in this container). The run builds no publish board: the Monday
   final board is built from these records at 06:30 by its own routine (until that routine exists, by the first
   session on Monday, `make-piece`, "Publish board"). Nothing on it is called ready: he watches each cut at full
   size on Monday and approves or rejects it there (`AGENTS.md`, start route, rule 6).
9. A run that cannot finish says what stopped on the week's board item (step 10), in one line.
