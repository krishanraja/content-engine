---
card: ve-kf-5-cursor-path
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-5-cursor-path
write_allow: [apps/renderer/src/engine/devices/cursor_path/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/kit/verbs.ts, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json, config/ve/brand-tokens.json, docs/ve/MOTION_STANDARD.md, apps/renderer/src/engine/devices/hand_phone_stage/device.test.ts]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# A real interface used on his words: the cursor waits, presses and glides

## Goal
Build device `cursor_path`: a real interface being used, each act on his word. It needs kit/verbs.ts (card ve-kf-2) on main first.

params: `screen` ({src, pixelWidth, pixelHeight}: a real capture, drawn whole at its own ratio, never redrawn), `targets` ([{id, x, y, w, h, text?}] in capture pixels), `start` ({x, y}, where the cursor rests on enter), `label` (where and when the capture was taken, HOUSE_FONTS.data, at least 24 px). The cursor is the house's own arrow in tokens (cream fill, ink edge), 44 px tall on 9:16, never a captured cursor.

1. `enter`: the screen rises in (house entrance); the cursor appears at `start` and waits, still.
2. `move` (toState: a target id): the cursor glides on an eased arc to the target with cursorPath, arrives settled and waits at least 4 frames before any press.
3. `pick` (toState: a target id): the press. The cursor dips to 0.9x for 2 frames; one mint ripple ring grows from the press point to 56 px and fades by press + 10; the target highlights in mint until the next press.
4. `type` (toState: a target id): the target's text appears with typeOn, 25 to 40 characters a second.
5. `send` (toState: a target id): a press as in `pick`, then the cursor shows it is busy: a mint ring draws round it once by progress(), from the send to the object's next event (at most 45 frames), then holds full.
6. `exit`.

## Tests (device.test.ts)
- the cursor is still before its move, on its target by move + 10, and presses only after a 4-frame wait
- one ripple per press, gone by press + 10; the mint highlight is only on the last pressed target
- typed text is empty before its event and whole by its end
- the busy ring only grows after a send and never repeats
- the 9:16 and 16:9 fixtures render
- the capture is drawn with remotion's Img, which needs a composition, so device.test.ts mocks Img as a plain img exactly as hand_phone_stage/device.test.ts does (vi.mock('remotion', ...)) and renders outside one
- houseGolden.json gains cursor_path's own entries, written with VE_WRITE_HOUSE_GOLDEN=1 npx vitest run apps/renderer/src/engine/houseGolden.test.ts; every existing digest stays exactly as it was (a first build on 15 Nov failed both of these)

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
npx vitest run apps/renderer/src/engine/devices/cursor_path
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/houseGolden.test.ts
npx tsc --noEmit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-5-cursor-path", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
