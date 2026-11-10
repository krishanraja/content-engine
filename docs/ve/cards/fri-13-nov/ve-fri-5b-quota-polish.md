---
card: ve-fri-5b-quota-polish
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-5b-quota-polish
write_allow: [apps/renderer/src/engine/devices/quota_chart/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/quota_chart/**, apps/renderer/src/engine/devices/leaderboard/**, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/house/geometry.ts, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Quota chart polish: fill the frame, bold type, a junk third you can see

## Goal
The quota_chart device (built, on this branch) works but reads as a small default chart: in 16:9 it uses about a quarter of the box, labels are about 12 px, the junk hatch is nearly invisible and the annotation draws a stray diagonal line across the bars. Krish's bar: "world-class motion animation"; every picture makes its point at a glance on a phone.

1. Layout: the chart fills the box (about 86% width, 70% height, centred) in both aspects; in 9:16 the histogram sits above the sales pair, stacked.
2. Type: axis and labels in IBM Plex Mono at 34 px tall / 30 px wide minimum; the +7% and any number in Anton at 140 px or more; one short annotation in Archivo semibold 40 px.
3. Target line: 6 px dashed coral with a solid coral label chip ('Target: 200') that slides with the line on `move`.
4. Junk: the junk share of each bar is a clearly visible diagonal hatch in coral on ink (not grey on grey), and on `move` it drains downward bar by bar, staggered 3 frames.
5. Annotation: a short leader (under 120 px) from the label to the hatch, never across other bars.
6. Sales pair: two wide bars (old target, half target) with Plex Mono labels under them; the second grows taller in mint and '+7%' counts up and slows hard into its value.
7. Fixture: real values from the study (bins bunching at 200, target 200 to 100, junkShare 0.31, salesLift 0.07, source 'GONG ET AL. · ARXIV 2609.32859').

## Contract
Change only the quota_chart device and its fixture/tests; verbs unchanged. Colours only from tokens. Keep every existing test passing and add: chart bounding box covers at least 80% of the box width in both aspects; no text under 30 px; hatch area after mark equals junkShare within 2%; after move no hatch remains.

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

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-5b-quota-polish", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
