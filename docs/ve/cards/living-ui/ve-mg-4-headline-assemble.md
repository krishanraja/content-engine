---
card: ve-mg-4-headline-assemble
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-mg-4-headline-assemble
write_allow: [apps/renderer/src/engine/devices/headline/*]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/headline/**, apps/renderer/src/engine/kit/reveal.ts, apps/renderer/src/engine/clock.ts, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# headline: the words assemble into the line

## Goal
Amend device `headline` (apps/renderer/src/engine/devices/headline). Add an optional param `reveal: 'assemble'` (the schema refuses any other value). Without it the headline draws exactly as now, through the shared reveal in kit/reveal.ts; with it, the param wins over a motion style's type reveal.

1. `enter` with `reveal: 'assemble'`: each word lands in its own place. It starts at no more than 1.3x scale, up to 24 px off its place toward the line's centre, at opacity 0, and settles to 1x in 7 frames with ENTER easing (clock.ts). Words start in reading order, the last no more than 3 frames after the first, so the whole headline is assembled by enter + 10 frames and holds. One move, once: no bounce after it. The swipe word and the dek follow as now, after the assembly.
2. `exit`: as now.

The same rule on 9:16 and 16:9. Keep fixture.json and kit/reveal.ts as they are; test the new reveal with objects of its own.

## Tests (device.test.ts)
- with no reveal param the markup is identical to today's at every frame
- every word starts at no more than 1.3x and is exactly 1x from enter + 10
- a reveal value other than 'assemble' is refused
- both shapes render

## Contract
Device rules (apps/renderer/src/engine/devices/CONTRACT.md): a pure function of its props; state only from stateAt(events, object.obj, frame); motion only from progress(), drift() and MOTION in clock.ts and the helpers in kit/verbs.ts; colours only from tokens (raw hex refused); type only from HOUSE_FONTS; no Math.random, no frame modulo, no wall clock, no fetch; useCurrentFrame only in clock.ts. Every move runs once and holds: no spinner, pulse or loop (ve qc motion.periodicity). No per-piece code. houseGolden.json must pass unchanged.

## Motion style: Living UI screencast (living-ui, untested)
The real product rebuilt or captured so the camera can zoom in and the interface can act on cue.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- captured or rebuilt from the real interface, with source label and date; never a made-up screen
- zoom to the one element that proves the words, 1.5x to 3x, eased with the utility bezier
- cursor and typing act on his words, not on a timer
- everything outside the proof dims to 40%
Never:
- a fake interface passed off as real
- scrolling a whole page with no focus
- tiny unreadable screenshots

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/headline
npx vitest run apps/renderer/src/engine/houseGolden.test.ts
npx tsc --noEmit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-mg-4-headline-assemble", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
