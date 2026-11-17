---
card: ve-style-5-iso-world
motion_style: isometric-world
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-5-iso-world
write_allow: [apps/renderer/src/engine/devices/iso_world/**, apps/renderer/src/engine/kit/motion-profiles.json, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# iso_world: a small diorama builds block by block, so a whole system can be seen at once

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." One STAGE device, `iso_world`: an isometric diorama on a 2:1 grid. `params`: `blocks` ({id, cell, height, image?}), `routes`, `dataset`. Each block's face carries a real picture (a logo, a screen) from `params.images`. `enter`: the ground plate lands. `add`: a block drops onto its cell with weight. `fill`: a block grows to a height. `carry`: a token travels a route. `move`: the view slides to a block. `highlight`: a block turns mint. `exit`: blocks sink in reverse.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Tests (`device.test.ts`, stills from `fixture.json`)
- blocks sit on their cells on the 2:1 grid in both aspects; nothing overlaps out of depth order
- `carry` moves the token along its route only
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## After it builds (Claude, not Codex)
`ve verify-card`, then a test cut of the house test take in this style, measured with `ve pace` beside his references and watched at speed beside one, a `ve-critic` verdict, then Krish's Gate 2. On his yes Claude takes `needs_device` out of the `isometric-world` entry's `ve_route` in config/style-references.json (a guarded file: his yes, in person) and out of `needs_device` in apps/renderer/src/engine/kit/motion-profiles.json, then records its StyleStill cover (docs/ve/cards/style-stills/ve-style-still-template-*) with `record_still`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `iso_world` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, add, fill, carry, move, highlight, exit; update `verbs.test.ts`. Draw in SVG and canvas from the frame alone; any texture or noise is seeded by the frame number, never random. Reuse packages/moves, never copy a move. Add the `isometric-world` profile to apps/renderer/src/engine/kit/motion-profiles.json inside the signed floor (the kit tests check it) and leave the style under `needs_device`.

## Motion style: Isometric miniature world (isometric-world, untested)
A small diorama builds block by block so a whole system with parts can be seen at once.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- orthographic camera at true isometric angles; tiles on one grid
- blocks drop in with the drop token, one actor at a time, in the order he names them
- flat brand fills with one light direction; the part that matters is mint
- labels float as Plex Mono tags pinned to their block
Never:
- a busy city with no focus
- cute characters
- camera spinning around the model

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/iso_world
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-5-iso-world", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
