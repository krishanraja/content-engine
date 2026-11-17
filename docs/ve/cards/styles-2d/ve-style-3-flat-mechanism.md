---
card: ve-style-3-flat-mechanism
motion_style: flat-vector-explainer
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-3-flat-mechanism
write_allow: [apps/renderer/src/engine/devices/flat_mechanism/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, config/ve/pace-references.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# flat_mechanism: how a thing works, part by part, on flat brand shapes

## Goal
Krish, 17 Nov 2026, on the motion styles ve cannot draw yet: "Mark them and build all nine." One STAGE device, `flat_mechanism`: a mechanism (a pipeline, a market, a process) built from flat brand-colour shapes, each part carrying a real picture from `params.images`. `params`: `parts` ({id, image?, label?}), `links` (part to part), `dataset`. `enter`: the frame of the mechanism slides in. `add`: a part springs into place (overshoot 6% at most, at rest by frame 10). `move` with toState part id: a token travels along the links to it. `fill`: a part's level rises. `highlight`: the part doing the work turns mint and the rest dim. `count_to`: a number on a part rolls to the dataset figure, its producer shown. `exit`: parts leave in reverse order.

His floor (python3 scripts/floor.py --format motion): every state change is motion that changes the object, never a thing that arrives and sits, a crossfade or a drawn arrow; every picture is real, passed in `params.images` (a logo, a dated screenshot, a photo from the piece's evidence) and set in brand colours, never an icon set, clipart figure or emoji; no words that repeat what he says (numbers and short labels from `dataset` and `params` only). Captions are their own layer: the device draws no caption box. Where the style's own rules below differ (an icon family), this floor wins.

Pace and room (his reference cuts, config/ve/pace-references.json: about 3 to 4.6 events a second, half the gaps under 0.3 s, 80% of the frame in use): every verb lands in 0.6 s or less, the device never rests between events (drift above 0), and it fills its box: tall, from y 270 down the whole slot; nothing that must be read right of x 860 or below y 1320 (config/channel-safe-zones.json).

## Rework
The first build is on main and works (checked 17 Nov, drawn in brand colours, tall and wide); change only this. The count it rolls to is drawn 36 px in a card's corner, so the figure the beat is about cannot be read; the links are inkSoft on the ink ground and barely show; the token is a 14 px dot. Make the count the size of its point (at least a third of its part's height, inside x 60 to 860 and above y 1090 on a tall frame), and the links and token plainly visible on the ground. Edit the device in place.

## Tests (`device.test.ts`, stills from `fixture.json`)
- the count's type is at least a third of its part's height; links and token are drawn in a token that is not the ground's
- nothing before `enter`; after three `add`s exactly three parts, each holding its image
- `move` puts the token on the named part within 0.6 s and it never jumps
- a part with no image draws its label, never a stand-in icon
- between events the scene still moves (two frames 6 apart differ)
- the same frame twice renders identical pixels; no colour outside tokens; tall and wide stills render

## After it builds (Claude, not Codex)
Claude re-runs the acceptance, renders a test cut on the house take, measures it with `ve pace`, gets a `ve-critic` verdict and puts it to Krish at Gate 2. Only his yes takes `needs_device` off and adds the motion profile.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `flat_mechanism` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, add, move, fill, highlight, count_to, exit; update `verbs.test.ts`. Draw in SVG and canvas from the frame alone; any texture or noise is seeded by the frame number, never random. Reuse packages/moves, never copy a move. Add no motion profile and leave apps/renderer/src/engine/kit/motion-profiles.json untouched: profiles hold drawable styles only (kit.test.ts), and this style stays `needs_device` until Krish's yes, when Claude adds it.

## Motion style: Flat vector explainer (flat-vector-explainer, untested)
Flat geometric shapes and icons that move with a little spring, showing how a thing works.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- flat fills from brand roles only, no gradients, no outlines thicker than 4 px
- one idea per shot; the object that does the work is mint
- spring settle on arrival: overshoot no more than 6% then rest by frame 10
- icons from one family and one stroke weight
- every panel changes state at least once (the motion floor)
Never:
- clip-art people with tiny heads
- bouncing everything at once
- arrows that arrive and sit still
- stock corporate illustration

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/flat_mechanism
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/kit
python scripts/ve/check_route.py
npx tsc --noEmit

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-3-flat-mechanism", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
