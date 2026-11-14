---
card: ve-through-line-1
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /home/user/ve-wt/ve-through-line-1
write_allow: [apps/renderer/src/engine/devices/through_line/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json]
read: apps/renderer/src/engine/**, docs/ve/MOTION_STANDARD.md, config/ve/design-lock.json, config/ve/recipes/data-story.json, docs/plans/2026-11-02-monday/motion-system.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# through_line: one object that persists across beats and changes state with what he says

## Goal
ve draws devices inside one beat; Krish's favourite cut (Monday 2 Nov, The Ladder, docs/plans/2026-11-02-monday/motion-system.md) was one object across the piece. Build that object.

1. New device `through_line` in apps/renderer/src/engine/devices/through_line/ (index.tsx, state.ts, schema.ts, fixture.json, device.test.ts), per devices/CONTRACT.md. Its state at any frame is folded from every event on it so far, so it keeps its parts and numbers across beats.
2. Parts: an ordered list (rungs, bars or unit marks), each with an optional number {value, unit, producer, date}; the producer credit draws at the foot in the mono role.
3. Verbs (EngineEventSchema in props.ts, config/ve/devices.json): count_to, thin, grow, multiply, drop, light, connect, rest_on (the camera eases onto one part and holds).
4. Unit marks draw as a dot grid, so a count keeps its meaning on the same object (F06).
5. Entrances settle in 4 to 7 frames, ease-out; colour roles only.

Fixture: Monday's moves 1 to 6 on one object over six beats (27 to 9 with the junior rung thinning; agent hours growing to six times staff; 20 marks losing 7 then copying to 43% more; the ladder back with no bottom rung, the camera resting on the gap; 2030 lighting the top rung with a line to the gap). device.test.ts asserts the state at the frames that matter and that it is one object in every beat.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Every number carries its producer.

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
npx vitest run apps/renderer/src/engine/devices/through_line
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-through-line-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
