---
card: ve-thu-6-logo-tiles
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-6-logo-tiles
write_allow: [apps/renderer/src/engine/devices/logo_card/schema.ts, apps/renderer/src/engine/devices/logo_card/index.tsx, apps/renderer/src/engine/devices/logo_card/device.test.ts, apps/renderer/src/engine/devices/logo_card/fixture.json]
read: apps/renderer/src/engine/devices/**, apps/renderer/src/engine/mocks/face-with-proof.tsx, apps/renderer/src/engine/clock.ts, config/logo-registry.json, assets/logos/**, fixtures/ve/design-lock/face-with-proof/**
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# logo_card tiles: five equal marks on white tiles, as the frozen face-with-proof proof key frame

## Goal
['Krish froze the face-with-proof lock on 3 Nov 2026 ("Looks good to me."). Its proof key frame (fixtures/ve/design-lock/face-with-proof/proof.jpg; drawn by the Proof mock in apps/renderer/src/engine/mocks/face-with-proof.tsx) shows Meta, Amazon, Google, xAI and Anthropic on equal white tiles in two rows, 3 then 2, every mark fitted by the approved logo_orbit Mark fitter (apps/renderer/src/engine/devices/logo_orbit/mark.tsx, MARK_BOUNDS) to the same long side, Meta as its infinity symbol. No library device draws that: the mock is an inline SVG and logo_card takes at most 4 logos in one row. Thursday\'s real cut needs it as a device.\n\n1. Add an optional `tiles: true` mode to logo_card\'s params (schema.ts). Without it, logo_card is exactly as today (its existing tests and fixture stay green). With it, logos may number 1 to 6.\n2. Tiles mode draws each logo on a white rounded tile (tile side and gap proportional to the slot, as the proof key frame: 240 px tiles, 60 px gaps, rx 24, on a 1080-wide stage), in rows of 3 then the rest centred beneath, each mark drawn with the logo_orbit Mark fitter at 140/240 of the tile side. The tile fill is a token or white, never a raw hex literal elsewhere.\n3. Enter staggers the tiles in order with the existing house motion (MOTION.staggerFrames, the back easing); `highlight` with a zero-based index lifts that tile as today; exit slides out as today.\n\nTests (in device.test.ts): tiles mode accepts 5 logos and refuses 7; tiles are equal size; rows are 3 then 2 for five logos, the second row centred; every fitted mark\'s drawn long side equals 140/240 of the tile side within 1 px; Meta resolves to its symbol; without `tiles` the output is unchanged for the existing fixture.']

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Change no device.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/logo_card
npx vitest run apps/renderer/src/engine/devices
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-6-logo-tiles", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
