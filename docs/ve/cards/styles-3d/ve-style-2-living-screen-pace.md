---
card: ve-style-2-living-screen-pace
motion_style: living-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-2-living-screen-pace
write_allow: [apps/renderer/src/engine/devices/living_screen/**, apps/renderer/src/engine/kit/motion-profiles.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md, docs/ve/FAILURE_2026-11-13_3d-styles.md, lab/styles/living-screen/**]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# living_screen, again: the whole frame, a moving camera and a beat every few tenths of a second

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." His words on the first cut, 13 Nov: "the motion is 10X too slow, not immersive and engaging at all"; the bar is docs/ve/FAILURE_2026-11-13_3d-styles.md, "The bar for the next attempt". Rework `living_screen` to it. Remove the plain caption box and the small band: the interface fills the tall frame from y 270 down and the camera moves through it every moment. Add the small motions of a working interface between his words (a cursor, a row updating, a chart ticking), so a 54 s cut carries 150 events or more. Numbers still land on the spoken word.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Tests (`device.test.ts`, stills from `fixture.json`)
- the interface covers at least 80% of the tall frame below y 270 at every frame after `enter`
- the camera moves between any two frames 6 apart
- no caption box is drawn
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## After it builds (Claude, not Codex)
`ve verify-card`, then a test cut of the house test take in this style, measured with `ve pace` beside his references and watched at speed beside one, a `ve-critic` verdict, then Krish's Gate 2. On his yes Claude takes `needs_device` out of the `living-screen` entry's `ve_route` in config/style-references.json (a guarded file: his yes, in person) and out of `needs_device` in apps/renderer/src/engine/kit/motion-profiles.json, then records its StyleStill cover (docs/ve/cards/style-stills/ve-style-still-template-*) with `record_still`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. `living_screen` keeps its verbs (enter, count_to, add, move, fill, highlight, exit). Draw with three.js through @remotion/three (card ve-style-0-three-and-moves), from the frame alone. Reuse packages/moves, never copy a move. Keep the `living-screen` profile inside the signed floor (the kit tests check it) and under `needs_device`.

## Motion style: The Living Screen (living-screen, liked)
The numbers live in the cards of a working interface rebuilt in 3D, in a dark room lit by neon streaks, and the camera locks onto the card being spoken about, close enough to read, then pulls back.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- the interface is the evidence: every number sits in a card or a chart of the screen
- the camera reads for the viewer: a 1.0 s locked zoom on the hero curve to the part being spoken about, then a pull back
- a cursor does what a person would do: clicks the tab, hovers the number
- the screen stays crisp; bloom only on the streaks, in the series colour and mint
- keep the pace of animation up: something on the screen moves on every sentence
- tall: the credit starts under the channels' top bar and the panel stays short of the action rail
Never:
- a flat UI on flat ink
- a real screen recording passed off as the rebuild
- a camera that holds still
- a panel with nothing moving in it

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/living_screen
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-2-living-screen-pace", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
