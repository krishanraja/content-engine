---
card: ve-fri-5-quota-chart
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-5-quota-chart
write_allow: [apps/renderer/src/engine/devices/quota_chart/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/leaderboard/**, apps/renderer/src/engine/devices/stat_strip/**, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/design-lock.json, config/ve/devices.json, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Quota chart: questions bunch at the target, the junk thins, the target halves, sales rise

## Goal
Fri 13 Nov 5-minute cut, the payoff: a medical-equipment firm set a monthly AI question target; most asked just enough to hit it; about a third were junk; some sales offices got half the target (A/B); junk vanished, useful questions stayed; those staff sold 7% more.

1. `params`: `bins` (questions per person, 8-16 values 0..1 for a histogram), `target` (0..1 position on the x axis), `junkShare` (0..1, e.g. 0.33), `halfTarget` (0..1), `salesLift` (e.g. 0.07), `labels` {questions, target, junk, sales}, `source` (PRODUCER · DATE).
2. `enter`: axes draw on.
3. `fill`: the histogram bars grow; they visibly bunch in a spike just over the target line.
4. `draw`: the target line draws dashed, labelled.
5. `mark`: the junk share of each bar fades to a struck, greyed hatch (one third), one short annotation points at it.
6. `move` with `toState` = 'half': the target line slides to halfTarget (18 frames); the spike follows; hatched junk drains, the solid part stays.
7. `count_to`: a two-bar sales comparison grows beside it, old target vs half target, the half-target bar ends (1+salesLift) taller, its label counting up, in mint, last.
8. `exit`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in devices/registry.ts and config/ve/devices.json with exactly enter, fill, draw, mark, move, count_to, exit; update verbs.test.ts. Bars from zero; every number from params; source at the foot in Plex Mono. Draw inside the box only. Colours only from brand tokens (coral target, mint sales). Tests (device.test.ts): nothing before enter; after fill the tallest bar sits at the target bin; after mark the hatched share equals junkShare within 2%; after move the target line sits at halfTarget and the hatched area is gone; after count_to the second sales bar is (1+salesLift) of the first within 1%; tall and wide render.

## Motion style: Data story (data-story, untested)
Real numbers drawn mark by mark, with the source on screen and one annotation that says what changed.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- every number comes from a named source shown in IBM Plex Mono with its date
- axes start at zero for bars; the scale is linear unless the point is growth
- marks draw in order of the argument, the deciding mark last and in mint
- one annotation per chart, at most 6 words, pointing at the mark that matters
- a count is plain: win, lose or draw with numbers, never a vague word
Never:
- invented or rounded-up numbers
- 3D charts
- legends the viewer has to decode
- a chart that holds still

## Recipe: The Ladder: one object, every number on it
One object carries the whole piece, and every number is drawn on, beside or instead of a part of it, so the viewer always knows what a number is about. Krish, on the chart: "The chart makes a boring research report instantly understandable."
Invariants:
- One through-line object for the whole piece, decided before the storyboard (spec style.idea.object); it never morphs into a different object.
- One number per frame, on the object; the number that matters most takes the series colour as its underline only.
- Every number carries its producer at the foot of the frame, in the mono face: PRODUCER · DATE.
- Real logos appear once, at the size of a part of the object, never redrawn; a real page is shown as itself, its one line highlighted, with a slow push.
- Every move means something: the object changes state to say what the voice says (a count, a thinning, a growth, marks lost or copied, a light, a line, the camera resting on a gap).
- Scenes that step away from the object end by turning back into it, changed.
Signature devices (one or two a beat):
- the count on a part: a number counts down or up in one second while its part thins or grows (Monday's 27% to 9% on the junior rung)
- two bars side by side, one growing to its multiple (Monday's agent hours against staff hours)
- unit marks: a field of marks loses or gains some, or copies itself (Monday's 20 tellers to 13, then 43% more branches)
- the missing part: the object returns with a part gone and the camera rests on the gap (the frame the cover echoes)
- the line: one part lights and a line runs to another (2030's top rung to the missing junior rung)
Worked example: Who trains your 2030 seniors (Monday 2 Nov 2026), cuts mon02-wide, mon02-tall (config/ve/recipes/data-story.json).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/quota_chart
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-5-quota-chart", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
