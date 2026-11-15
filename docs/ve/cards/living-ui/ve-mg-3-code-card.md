---
card: ve-mg-3-code-card
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-mg-3-code-card
write_allow: [apps/renderer/src/engine/devices/code_card/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/devices/focus.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json, config/ve/style-distinct.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/kit/verbs.ts, apps/renderer/src/engine/kit/focus.ts, apps/renderer/src/engine/devices/focus.ts, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/FormatMaster.tsx, config/ve/style-distinct.json, config/ve/brand-tokens.json]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Real code, typed line by line, with the camera on the typed line

## Goal
Build device `code_card`: real code typed on his words, reporting the typed line to the camera so the living-ui zoom follows it. Needs kit/verbs.ts (card ve-kf-2) on main.

params: `file` (the real file's path, revision and date, its source label in HOUSE_FONTS.data at 24 px or more); `lines` ([{id, text, typed}], copied verbatim from that file at that revision, never written for the cut; `typed: true` lines start empty). In HOUSE_FONTS.data at 44 px or more on 9:16 on an inkDeep ground: numbers inkSoft, text cream, strings mint, comments inkSoft. At most 10 lines; a line over 30 characters on 9:16 or 56 on 16:9 is refused by its id, never shrunk or wrapped.

1. `enter`: the card rises in; typed lines are empty.
2. `type` (toState: a line id): the line types with typeOn, 25 to 40 characters a second, a solid cream caret at its end while it types (no blink); a later line starts once the earlier one is whole.
3. `highlight` (toState: a line id): that line's band lights mint at 18% and every other line dims to 40%, held.
4. `exit`.

Focus: export codeFocus, the same shape as bubbleFocus in typing_bubble: the typing line, else the highlighted one, with `from` the line before, so the camera travels line to line. Add `code_card: codeFocus` to FOCUS in devices/focus.ts, and code_card to effects.zoomToFocus.devices and effects.brackets.devices in config/ve/style-distinct.json.

## Tests (device.test.ts)
- a typed line is empty before its event and whole by its end; the caret never blinks
- codeFocus follows the typing line with `from`, and is undefined before enter
- highlight leaves its line full and the others at 40%
- a 31-character line is refused on 9:16, naming its id
- the 9:16 and 16:9 fixtures render

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
npx vitest run apps/renderer/src/engine/devices/code_card
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit/strongStyles.test.ts
npx vitest run apps/renderer/src/engine/houseGolden.test.ts
npx tsc --noEmit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-mg-3-code-card", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
