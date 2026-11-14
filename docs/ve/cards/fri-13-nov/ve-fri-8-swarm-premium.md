---
card: ve-fri-8-swarm-premium
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-8-swarm-premium
write_allow: [apps/renderer/src/engine/devices/agent_swarm/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/agent_swarm/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/house/geometry.ts, config/ve/brand-tokens.json, docs/ve/MOTION_STANDARD.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Agent swarm, premium rebuild: ten agent windows fanning out round one comment, nothing fixed

## Goal
Krish, 10 Nov: "these animations do not look very premium". Bar: config/reference-cuts.json. 16:9 first: box 1920x1080, face window bottom right (1452,676,400,340) kept clear; tall second.

Every state:
a. Fill at least 80% of the box width.
b. A lit stage: inkDeep to ink radial light from upper left, soft floor shadows, SVG film grain at 3% re-seeded every 2 frames.
c. A camera: push 1.00 to 1.06 over the device's life, background parallax 0.5x, house easing from clock.ts, overshoot at most 4%.
d. Always alive: no frame repeats for more than 15 frames while on screen.
e. Type: numbers and the headline in Anton 120 px+, human words Fraunces semibold 56 px+, Plex Mono only for a source line 28 px+; at most two labels; no axis zeros or titles.

The story, in states (verbs unchanged): enter, the comment arrives as a large cream chat card at the centre of the frame (Fraunces 64 px, typed on word by word, a hard house shadow, 6 degrees of perspective); add, ten agent windows (ink terminal cards, mint status dot, three moving cream code lines, no readable words) fly in on curved paths and fan out round the card in a shallow 3D arc, each with a soft trail; fill, every window works: lines scroll, dots pulse out of phase, faint coral threads connect each window to the card, and 'AGENTS' over a big Anton counter climbing to params.agents sits to the right; mark, a thick hand-drawn coral strike crosses the card over 10 frames, the windows dim to tokens.inkSoft one by one, and params.annotation sets in Fraunces italic 48 px under the card. Drop the robot glyphs. The rank chip draws only when rank.from differs from rank.to.

## Contract
Change only the agent_swarm device and its fixture and tests; verbs and params keep their meaning. Colours only from tokens. Keep existing tests passing and add: ten windows each at least 120 px wide on 16:9; no text under 28 px; no readable words inside the agent windows; no two consecutive identical frames for more than 15 frames between enter and exit; the rank chip is absent when rank.from equals rank.to.

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
npx vitest run apps/renderer/src/engine/devices/agent_swarm
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-8-swarm-premium", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
