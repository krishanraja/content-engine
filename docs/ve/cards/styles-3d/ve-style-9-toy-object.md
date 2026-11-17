---
card: ve-style-9-toy-object
motion_style: toy-3d
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-9-toy-object
write_allow: [apps/renderer/src/engine/devices/toy_object/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md, apps/renderer/src/engine/devices/three_smoke/**]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# toy_object: one hero object, soft studio-lit like a toy, clay or candy

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." One STAGE device, `toy_object`: one hero object in soft studio light (clay or candy material, tokens only), its label or face a real picture from `params.images`. `params`: `object` (kind), `parts`, `dataset`. `enter`: the object drops onto the set and settles. `count_to`: parts light up one by one to the dataset figure. `add`: copies drop beside it. `move`: the camera turns to a side in 1.1 s, drifting between moves. `highlight`: a part turns mint. `exit`: it falls away.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Rework
The first build (checked 17 Nov, rendered through Remotion at full size) has framing faults. Wide: the capsule is scaled to 85% of the frame width, so it runs off the top and bottom and the copies `add` drops land off frame. Tall: a dropped copy is half off the bottom-left edge and the count label sits on the row of studs. Both: the picture is a flat card laid over the canvas at fixed percentages, not on the object, and it does not turn with it. Fix: the hero fits the slot in both shapes (tall at least 80% of the width, wide fitted by height), copies land inside the frame, the label clears the studs, and the picture sits on the object's front face (a texture, kept upright) so it turns with it. Its tests check the scene and its projected layout without launching a browser, as ladder_stage and living_screen do: the build machine cannot start the renderer's browser, and Claude renders its stills.

## Tests (`device.test.ts`, stills from `fixture.json`)
- in both shapes the hero, every copy and the label project inside the slot, and the label's box clears every stud
- the picture is a texture on the hero's front face, so its projected corners move with a `move`
- the camera is never still: two frames 6 apart differ
- the object fills the tall slot's width (at least 80%)

## After it builds (Claude, not Codex)
Claude re-runs the acceptance, renders a test cut on the house take, measures it with `ve pace`, gets a `ve-critic` verdict and puts it to Krish at Gate 2. Only his yes takes `needs_device` off and adds the motion profile.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `toy_object` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, count_to, add, move, highlight, exit; update `verbs.test.ts`. Draw with three.js through @remotion/three (card ve-style-0-three-and-moves), from the frame alone. Reuse packages/moves, never copy a move. Add no motion profile and leave apps/renderer/src/engine/kit/motion-profiles.json untouched: profiles hold drawable styles only (kit.test.ts), and this style stays `needs_device` until Krish's yes, when Claude adds it.

## Motion style: Toy and material 3D (toy-3d, untested)
Soft studio-lit objects that look like toys, clay or candy, for one hero object.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- one hero object per shot, studio light, soft shadow on an ink floor
- materials tinted from brand roles; the object that matters is mint
- slow turntable at no more than 20 degrees a second, or a drop with the drop token
Never:
- shiny chrome
- many objects bouncing
- generic 3D stock

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/toy_object
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py
npx tsc --noEmit

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-9-toy-object", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
