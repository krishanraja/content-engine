---
card: ve-fri-4-wall-screen
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-4-wall-screen
write_allow: [apps/renderer/src/engine/devices/wall_screen/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/devices/scribble/**, apps/renderer/src/engine/devices/hand_phone_stage/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/design-lock.json, config/ve/devices.json, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Wall screen: a real page on the office wall, flown into full frame, its line marked, flown back

## Goal
Fri 13 Nov 5-minute cut: a real page (Shopify, Duolingo, Fortune, CIO, the study) on the 2026 office wall zooms to full frame, its line is marked, it shrinks back.

1. `params`: `image` (a real page screenshot, path from the spec's assets), `wall` {x, y, w, h, skew?} the screen's place in the footage frame (normalised 0..1), `line` {x, y, w, h} the box of the line to mark (normalised in the image), `source` (PRODUCER · DATE, shown at the foot in IBM Plex Mono), `logo?` (a real logo asset shown once at the size of a part).
2. `enter`: the screen lights on the wall (8-frame glow).
3. `move` with `toState` = 'full': the camera glides from the wall to the page until it fills the box (18 frames, ease in-out), footage behind blurs and darkens.
4. `mark`: the line is marked with a highlighter stroke (12 frames, series colour, low opacity), then a hand-drawn underline.
5. `move` with `toState` = 'wall': the camera glides back, the page shrinking into the wall.
6. `exit`: the screen goes dark.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in devices/registry.ts and config/ve/devices.json with exactly enter, move, mark, exit; update verbs.test.ts. A real page is shown as itself, never redrawn or recoloured; text only from params. Draw inside the box only. Colours only from brand tokens. Tests (device.test.ts, stills at frames from fixture.json): nothing before enter; after move 'full' the page fills the box within 4%; mark draws only inside the line box and only after `mark`; after move 'wall' the page sits back on the wall box; the source line is always visible once full; tall and wide both render.

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
npx vitest run apps/renderer/src/engine/devices/wall_screen
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-4-wall-screen", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
