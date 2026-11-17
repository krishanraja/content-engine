---
card: ve-style-4-morph-stage
motion_style: shape-morph
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-4-morph-stage
write_allow: [apps/renderer/src/engine/devices/morph_stage/**, apps/renderer/src/engine/kit/motion-profiles.json, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# morph_stage: one shape becomes the next, a before turning into an after without a cut

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." One STAGE device, `morph_stage`: a sequence of states (`params.states`: {kind: shape | image | number, ...}) where each `move` with toState n morphs the current state into state n. Shapes morph by resampling both outlines to the same number of points (no new dependency); a real picture morphs through a mask that changes outline; a number rolls. `enter` draws the first state, `highlight` turns the changing part mint, `exit` collapses to a point.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Tests (`device.test.ts`, stills from `fixture.json`)
- halfway through a `move` the outline is neither state (a true in-between), never a crossfade of two outlines
- a morph lands in 0.6 s or less and holds its drift
- a picture state shows the picture passed in, inside the moving mask
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## After it builds (Claude, not Codex)
`ve verify-card`, then a test cut of the house test take in this style, measured with `ve pace` beside his references and watched at speed beside one, a `ve-critic` verdict, then Krish's Gate 2. On his yes Claude takes `needs_device` out of the `shape-morph` entry's `ve_route` in config/style-references.json (a guarded file: his yes, in person) and out of `needs_device` in apps/renderer/src/engine/kit/motion-profiles.json, then records its StyleStill cover (docs/ve/cards/style-stills/ve-style-still-template-*) with `record_still`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `morph_stage` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, move, highlight, exit; update `verbs.test.ts`. Draw in SVG and canvas from the frame alone; any texture or noise is seeded by the frame number, never random. Reuse packages/moves, never copy a move. Add the `shape-morph` profile to apps/renderer/src/engine/kit/motion-profiles.json inside the signed floor (the kit tests check it) and leave the style under `needs_device`.

## Motion style: Shape morph (shape-morph, untested)
One shape becomes the next, so a before turns into an after without a cut.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- morph between shapes with the same point count, eased with the hero bezier over 18 to 30 frames
- the shape carries meaning at both ends (a tool becomes a cost, a chart becomes a door)
- one morph per beat, held still with ambient drift after it lands
- colour shifts only between brand roles
Never:
- liquid blobs for their own sake
- metaballs and lava-lamp textures
- a morph whose ends mean nothing

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/morph_stage
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-4-morph-stage", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
