---
card: ve-w11-3b-slot-polish
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 50
max_calls: 70
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-3b-slot-polish
write_allow: [apps/renderer/src/engine/devices/slot_machine/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/slot_machine/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/design-lock.json, config/ve/brand-tokens.json, docs/plans/2026-11-11-wednesday/motion-mocks.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Slot machine, round 2: a real machine, full frame, true copy

## Goal
Round 2 of ve-w11-3-slot-machine (built; reviewed 10 Nov). Keep the verbs; fix the look and the fixture.
1. The panel fills 80% of the box width, centred. Header: the Suno wordmark image (params.logo, fixture may use a placeholder image path 'assets/logos/suno.svg' if absent, drawn as a text fallback 'Suno' in Archivo bold) and the source line params.source in Plex Mono, always visible.
2. Typing zoom: zoom 1.6x but keep the whole typed line inside the box: the camera follows the caret, clamped so no character is cut at any edge.
3. The machine after `pick`: a real slot-machine silhouette: a rounded cabinet in ink, a cream window with two reel cylinders (curved shading top and bottom, tiles bending with the cylinder), a chrome-free lever on the right with a mint ball that swings visibly through `send` (angle 0 to 70 degrees and back), a payout tray mouth at the bottom.
4. Payout cards land fully inside the box, fanned at -6 and +6 degrees, above the tray; titles from params.songs.
5. Fixture: lyrics 'I’m movin’ to the sun' / 'leave the rain behind'; style 'deep house, female singer, summer'; songs 'Movin’ To The Sun (v1)' 3:24 and '(v2)' 3:11; source 'rebuilt from suno.com, Nov 2026'.
6. The morph (G3) must read cleanly: boxes shrink and fade to the header strip before the reels grow, no overlap of text on reels.

Art direction for every frame: fill the box with 6% safe margins on every side; nothing hugs a corner; one clear focal point; cards with 16 px radius and a soft ink shadow (0 18px 40px at 25%); generous type. It must read as a premium, real product at phone size, never a wireframe.

## Contract
Same device, same verbs, same registration; change only its own folder and its houseGolden entry (VE_WRITE_HOUSE_GOLDEN=1, no other entry changing). Tokens only, no raw hex; drift()/progress() only.

## Tests (`device.test.ts`), add to the existing ones
- G1 and G2: every typed character's x lies inside the box
- the source line is in every frame after enter
- payout cards' bounding boxes lie inside the box
- lever angle at G4 is at least 60 degrees

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
{"card": "ve-w11-3b-slot-polish", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
