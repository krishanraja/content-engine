---
card: ve-style-still-template-1
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 120
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-still-template-1
write_allow: [apps/renderer/src/engine/stills/**, apps/renderer/src/Root.tsx]
read: apps/renderer/src/engine/**, apps/renderer/src/Root.tsx, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json, config/style-references.json, config/caption-themes.json, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# StyleStill: one neutral template frame each look, motion style and caption style is drawn on

## Goal
Krish, 16 Nov 2026: "I should be able to hover over the captions, look, and motion style and see a templated screenshot of what it might look like. No need for a video, just a still." The first stills were frames of his Thu 5 Nov No Spending take, which he hates: "Please don't tell me this is going on the board as an example or a gold standard template". So no recording, no face, no person, no real brand or company logo, ever.

Build a Remotion composition `StyleStill`, 1080x1920, one frame, in apps/renderer/src/engine/stills/, registered in apps/renderer/src/Root.tsx. Props: {layer: 'treatment' | 'motion' | 'captions', id: string}. It draws a neutral house template that is the same for every style: the design lock's canvas, grid and zones (config/ve/design-lock.json), the brand tokens (config/ve/brand-tokens.json), placeholder words (headline "YOUR AI, EXPLAINED", a caption line "This is what the words look like.", one number "42%"), and a plain shape where a person or a screen would be (a soft silhouette block, never a face). On it, the one style:
- motion: the style at its most telling moment, using its own device from config/ve/devices.json (the module's ve_route in config/style-references.json bank, layer motion);
- captions: the caption theme (captions/names.ts CAPTION_THEMES) on the caption line;
- treatment (looks, config/style-references.json formats.production): the look's layout from its modules, e.g. a proof card beside the silhouette for face-with-proof, a pictogram frame for voice-led-pictures, one big number for data-story, a lit silhouette with kinetic serif captions for fry-talking-head, a screen and a scoreboard for scoreboard-test, bounced words for kinetic-movement, the receipt_print device for receipt-animation.
Export `stillIds()` listing every {layer, id} it can draw, and draw nothing (null) for one it cannot, so the list says which.

## Contract
One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock, no network, no media files: the frame is drawn, never filmed. Colour roles from tokens, never raw hex. Type roles from the design lock. No person, no face, no real logo. Reuse the library devices and caption themes as they are; never fork one.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-still-template-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
