---
card: ve-mg-1-answer-stream
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-mg-1-answer-stream
write_allow: [apps/renderer/src/engine/devices/answer_stream/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/kit/verbs.ts, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, config/ve/brand-tokens.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# A real captured answer streams in, a citation pops, its real source lights up

## Goal
Build device `answer_stream`. It shows the captures themselves and never re-types their words (ve lint real.retyped); the only text it draws is `label`. Needs kit/verbs.ts (card ve-kf-2) on main.

params: `answer` and `source` ({src, pixelWidth, pixelHeight}: the real answer and the real page it cites); `blank` ({x, y, w, h} in answer pixels: a patch of the answer's own background); `lines` ([{x, y, w, h, chars}], its text lines in reading order); `citation` and `passage` (boxes in answer and source pixels); `label` (where and when each was captured, HOUSE_FONTS.data, at least 24 px). A line drawn under 40 px tall on 9:16 is refused by its index: crop tighter, never shrink.

1. `enter`: the answer rises in, every line covered by `blank` stretched over it (the capture's own ground, never a token or a drawn box).
2. `type` (toState `answer`): the lines uncover in order, left to right, in steps every 2 frames of 2 to 6 characters (from a hash of line and step), averaging 30 a second (25 to 40), faster only to finish by the object's next event.
3. `mark` (toState `citation`): the citation's own pixels pop once, up to 1.25x and back in 8 frames (overshootEase), and a mint ring draws round it once.
4. `light` (toState `source`): the source comes in (below the answer on 9:16, beside it on 16:9; the answer steps aside), a mint frame draws once round `passage` over a 20% mint wash, the rest of the source dims to 40%, and a mint hairline draws once from the citation to the passage (drawPath).
5. `exit`.

## Tests (device.test.ts)
- every line is covered before `type`, whole by its end, and never covered again
- the steps are the same across two renders
- the citation pops once and settles at 1x; the ring and hairline only grow
- after `light` the passage is mint and the rest of the source is at 40%
- the 9:16 and 16:9 fixtures render (no image committed)

## Contract
Device rules (apps/renderer/src/engine/devices/CONTRACT.md): a pure function of its props; state only from stateAt(events, object.obj, frame); motion only from progress(), drift() and MOTION in clock.ts and the helpers in kit/verbs.ts; colours only from tokens (raw hex refused); type only from HOUSE_FONTS; no Math.random, no frame modulo, no wall clock, no fetch; useCurrentFrame only in clock.ts. Every move runs once and holds: no spinner, pulse or loop (ve qc motion.periodicity). No per-piece code. Files: index.tsx, schema.ts (zod, strict), state.ts, fixture.json ("aspects": ["9:16", "16:9"]; the 1080x1920 and 1920x1080 slots authored apart, never one scaled into the other), device.test.ts. Register it in devices/registry.ts (one line) and config/ve/devices.json with exactly the verbs above, and add its line to verbs.test.ts. Add only your own keys to apps/renderer/src/engine/houseGolden.json (VE_WRITE_HOUSE_GOLDEN=1 npx vitest run apps/renderer/src/engine/houseGolden.test.ts); every other key stays byte-identical.

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
npx vitest run apps/renderer/src/engine/devices/answer_stream
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/houseGolden.test.ts
npx tsc --noEmit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-mg-1-answer-stream", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
