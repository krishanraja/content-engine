---
card: ve-style-1-ladder-stage-pace
motion_style: ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-1-ladder-stage-pace
write_allow: [apps/renderer/src/engine/devices/ladder_stage/**, apps/renderer/src/engine/kit/motion-profiles.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md, docs/ve/FAILURE_2026-11-13_3d-styles.md, lab/styles/ladder/**]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# ladder_stage, again: the whole frame, a moving camera and a beat every few tenths of a second

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." His words on the first cut, 13 Nov: "the motion is 10X too slow, not immersive and engaging at all"; the bar is docs/ve/FAILURE_2026-11-13_3d-styles.md, "The bar for the next attempt". Rework `ladder_stage` to it. Remove the plain caption box and the 590 px band: the set fills the tall frame from y 270 down and the camera cranes or orbits every moment. Add the small motions that keep a cut alive between his words (a part settling, a light catching, a copy turning), so a 54 s cut carries 150 events or more. Numbers still land on the spoken word.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Tests (`device.test.ts`, stills from `fixture.json`)
- the set covers at least 80% of the tall frame below y 270 at every frame after `enter`
- the camera moves between any two frames 6 apart
- no caption box is drawn
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## After it builds (Claude, not Codex)
`ve verify-card`, then a test cut of the house test take in this style, measured with `ve pace` beside his references and watched at speed beside one, a `ve-critic` verdict, then Krish's Gate 2. On his yes Claude takes `needs_device` out of the `ladder` entry's `ve_route` in config/style-references.json (a guarded file: his yes, in person) and out of `needs_device` in apps/renderer/src/engine/kit/motion-profiles.json, then records its StyleStill cover (docs/ve/cards/style-stills/ve-style-still-template-*) with `record_still`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. `ladder_stage` keeps its verbs (enter, count_to, add, draw, move, fill, highlight, carry, exit). Draw with three.js through @remotion/three (card ve-style-0-three-and-moves), from the frame alone. Reuse packages/moves, never copy a move. Keep the `ladder` profile inside the signed floor (the kit tests check it) and under `needs_device`.

## Motion style: The Ladder (ladder, liked)
One real object carries the whole piece, built in lit 3D with mass, and every number is a change to it: twenty lit windows are twenty tellers, three branches drop into the street for +43%.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- one object on stage for most of the piece; it changes as the numbers change
- a number is a change to the object, the type confirms it with its producer credit
- mass and light: soft shadows, stucco and paper materials, lit glass that glows, fog to ink
- the camera never rests: a 1.1 s crane on the hero curve between acts, a slow drift within one
- counts run in about 0.6 s and land on the spoken number
- tall: the type starts under the channels' top bar and the object fills the screen below it
Never:
- flat icons or thin line art on flat ink
- more than one object at once
- a chart with axes
- a camera that holds still
- more than about six numbers

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/ladder_stage
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-1-ladder-stage-pace", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
