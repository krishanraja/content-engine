---
card: ve-style-7-pixel-stage
motion_style: pixel-retro
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-7-pixel-stage
write_allow: [apps/renderer/src/engine/devices/pixel_stage/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# pixel_stage: big pixels, a small palette and sprite loops, like an old game

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." One STAGE device, `pixel_stage`: real pictures from `params.images` reduced to big pixels in the brand palette (down-sampled and mapped to tokens, never drawn sprites), on a 2-frame loop. `params`: `sprites` ({id, image, at}), `dataset`. `enter`: the screen boots in. `add`: a sprite pops onto the grid. `move`: a sprite steps to a cell, on twos. `count_to`: a score counter rolls to the dataset figure. `highlight`: a sprite flashes mint. `exit`: the screen powers down.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Rework
The first build (checked 17 Nov in a real browser) cut each picture to 24 by 24 samples, so a screenshot drew 144 px across a tall frame, unrecognisable, on an empty screen (Krish, 13 Nov: "the use of the screen space is terrible"). Keep the 320 by 180 stage (180 by 320 tall) at x6, one sample per logical pixel, but one sprite spans at least 60% of the stage's width or 70% of its height, whichever its shape reaches first; several share the stage; `at` cells are the stage divided by the sprite size. tsc must pass: put `// @ts-ignore shared move library` above the `@mymu/moves/_kit.mjs` import.

## Tests (`device.test.ts`, stills from `fixture.json`)
- every pixel is a token colour; the pixel size is constant across the frame
- a sprite moves on whole cells only
- one sprite spans at least 60% of the stage's width or 70% of its height in both shapes, measured from the layout SVG and canvas share
- the count and producer label sit inside x 60 to 860 and above y 1090 on a tall frame
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## After it builds (Claude, not Codex)
`ve verify-card`, then a test cut of the house test take in this style, measured with `ve pace` beside his references and watched at speed beside one, a `ve-critic` verdict, then Krish's Gate 2. On his yes Claude takes `needs_device` out of the `pixel-retro` entry's `ve_route` in config/style-references.json (a guarded file: his yes, in person) and out of `needs_device` in apps/renderer/src/engine/kit/motion-profiles.json and adds its profile there, then records its StyleStill cover (docs/ve/cards/style-stills/ve-style-still-template-*) with `record_still`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `pixel_stage` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, add, move, count_to, highlight, exit; update `verbs.test.ts`. Draw in SVG and canvas from the frame alone; any texture or noise is seeded by the frame number, never random. Reuse packages/moves, never copy a move. Add no motion profile and leave apps/renderer/src/engine/kit/motion-profiles.json untouched: profiles hold drawable styles only (kit.test.ts), and this style stays `needs_device` until Krish's yes, when Claude adds it.

## Motion style: Pixel art and retro game (pixel-retro, untested)
Big pixels, a small palette and sprite loops, like an old game.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- render at 320x180 and scale by 6 with nearest neighbour
- palette from brand roles only
Never:
- real game characters or art
- a whole piece in pixels
- using it for a serious finance claim

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/pixel_stage
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py
npx tsc --noEmit

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-7-pixel-stage", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
