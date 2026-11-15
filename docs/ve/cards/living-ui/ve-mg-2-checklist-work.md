---
card: ve-mg-2-checklist-work
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-mg-2-checklist-work
write_allow: [apps/renderer/src/engine/devices/checklist/*, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/checklist/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/kit/motionProfiles.ts, config/ve/devices.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# checklist: a row shows it is being worked on, and its tick pops

## Goal
Amend device `checklist` (apps/renderer/src/engine/devices/checklist). Two additions; everything else draws as now.

1. `dim` (toState: a slot id): the row's one-shot `work` state. Its paper and number dim to 42% over 6 frames, and a 2 px mint hairline draws once along the row's foot, left to right, by progress() from the dim to that slot's fill (at most 30 frames; 30 with no fill), then holds.
2. `fill` (toState: a slot id): as now, and the work state lifts as the filled paper dissolves in (the hairline goes with the blank paper); then the mint check pops once: the tick draws on as now, scales up to at most 1.2x and back to 1x in 6 frames (overshootEase in clock.ts), and holds.

Add `dim` to its verbs in config/ve/devices.json (enter, dim, fill, exit) and a line for them in verbs.test.ts.

The house look does not move: the pop is drawn only under a motion style (motionProfile() in clock.ts is set); the work state shows only where a `dim` is cued. Keep fixture.json as it is; test the new states with objects of their own.

## Tests (device.test.ts)
- before a dim the row draws as now; from dim + 6 it is at 42%
- the hairline's length only grows and is full by the slot's fill or dim + 30
- under a motion style the tick reaches at most 1.2x and is exactly 1x from its pop + 6 on; with no style it never scales
- a filled row is at full opacity again

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
npx vitest run apps/renderer/src/engine/devices/checklist
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/houseGolden.test.ts
npx tsc --noEmit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-mg-2-checklist-work", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
