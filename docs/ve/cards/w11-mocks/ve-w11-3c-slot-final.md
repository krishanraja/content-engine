---
card: ve-w11-3c-slot-final
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 60
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-3c-slot-final
write_allow: [apps/renderer/src/engine/devices/slot_machine/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/slot_machine/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Slot machine, round 3: typed text never cropped, a cabinet that reads on ink

## Goal
Round 3 of slot_machine (rounds 1 and 2 built; Claude reviewed round 2's stills on 10 Nov). Two faults remain, fix only these:
1. Typed text is cropped at the left edge at G1 and G2 (e.g. 'm movin' to the su' with the first letters cut). The zoom must keep the WHOLE typed line visible: compute the typed line's width at the zoomed size; if it fits in the box minus 6% margins, centre the camera on the line; if it does not, follow the caret but clamp so the line's first character never leaves the left margin, and wrap the text inside the box (the lyrics box shows up to 4 lines) instead of letting it run off.
2. After `pick` the cabinet disappears on an ink background (ink on ink). Draw the cabinet in `cream` with a 3 px `ink` outline and the house card shadow; the reel window stays ink with cream waveform tiles; the lever arm cream, its ball `mint`; the payout tray mouth a mint line. It must read as a slot machine at phone size on both a cream and an ink stage.
3. Fixture: add a still at the moment the lever is at its lowest (G4) where the lever and ball are clearly visible, and keep G1-G6.
Change nothing else: verbs, timing and state stay as they are.

## Contract
Change only `devices/slot_machine/*` and its houseGolden entry (VE_WRITE_HOUSE_GOLDEN=1, no other entry changing). Tokens only, no raw hex.

## Tests (`device.test.ts`), add to the existing ones
- G1 and G2: the first typed character's left edge lies at or right of 6% of the box width; no typed character lies outside the box
- after `pick`, the cabinet's fill is the cream token and it carries an ink outline
- G4: the lever angle is at least 60 degrees and the ball is drawn inside the box

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
npx vitest run apps/renderer/src/engine/devices/slot_machine
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-3c-slot-final", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
