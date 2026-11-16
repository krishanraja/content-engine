---
card: ve-style-still-template-2
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 180
max_calls: 220
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-still-template-2
write_allow: [apps/renderer/src/engine/stills/**, apps/renderer/src/Root.tsx]
read: apps/renderer/src/engine/**, apps/renderer/src/Root.tsx, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json, config/ve/character.json, config/style-references.json, config/caption-themes.json, config/brand-palette.json, docs/ve/styles/**, docs/plans/2026-11-11-wednesday/**, docs/plans/2026-11-09-week/fri-preproduction/**, docs/plans/2026-11-13-friday/**, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# StyleStill, second pass: a distinct cover for every look, motion style and caption style, using the whole frame

## Goal
Krish, 16 Nov 2026: "what cover art would you use to represent that entire motion style, so someone is inspired to pick it from a lineup?"; of the first pass: "Is everything supposed to look so similar to each other?"; and "A style may bring in its own colours and theming as long as it doesn't end up looking like a clown's apron. I want to experiment with variety, colour, and visual styles."

The first pass (ve-style-still-template-1) was rejected: one frame on every cover (the same headline, type, label and four pictures), the bottom half empty, the measured styles off their layouts, captions on one scene, 9 of 21 styles drawn.

Build Remotion composition `StyleStill`, 1080x1920, one frame, in apps/renderer/src/engine/stills/, registered in apps/renderer/src/Root.tsx. Props: {layer: 'treatment' | 'motion' | 'captions', id: string}. Each cover is the style at its best and nothing else: its own composition, type, texture and colour, from its bank entry's how and rules (config/style-references.json) and its device. No shared frame: only the style's name, small at the foot. A riso cover is two offset inks and halftone; paper-cutout is cut paper with edges and shadow; hud-terminal is mono type with a bracket locked on one value; dark-keynote is one giant number under a light sweep; line-boil is a hand-drawn line. Fill the whole frame.

Colour: a style may bring its own palette and theming. Define each once in stills/palettes.ts as named roles, at most four colours plus a neutral, chosen to sit together (never a clown's apron); no colour code anywhere else.

Subjects only from the work he praised ("the production standards, and the script for the AI music video (the Rat Tails video), and the characters of the AI video"): Wed 11 AI music (docs/plans/2026-11-11-wednesday), Fri 13 Rat Tails (docs/plans/2026-11-09-week/fri-preproduction, docs/plans/2026-11-13-friday), his drawn character (config/ve/character.json) wherever a person belongs. No placeholder words; no two covers in a layer on the same beat.

- motion, all 14: ai-music-slam, character-ai-receipts, eating-jobs-ladder, dark-keynote, data-story, full-visual, hud-terminal, line-boil, living-ui, paper-cutout, riso-halftone, single-line-drawing, swiss-kinetic-type, vertical-captions. The three in docs/ve/styles/*.card.json keep their measured layouts.
- treatment, all 7: face-with-proof, voice-led-pictures, data-story, fry-talking-head, scoreboard-test, kinetic-movement, receipt-animation. A look never borrows a motion cover.
- captions, all 27 (captions/names.ts CAPTION_THEMES): the caption large, as it plays in a cut, over a backdrop of its own that never crosses it.

Export `coverPlan(layer, id)` -> {scene, beat, layout, type, palette, zones: [{name, x0, y0, x1, y1}]} and `stillIds()`. Tests in apps/renderer/src/engine/stills prove: within a layer no two covers share scene, layout, type or palette; no treatment reuses a motion scene; zones reach y <= 120 and y >= 1800; a caption zone never meets a device zone; every palette has at most five colours; stillIds holds 14 + 7 + 27.

## Contract
Never use or read anything of the Thu 5 Nov No Spending piece (docs/plans/2026-11-05-thursday-no-spending, its take or its frames): he rejected it and it is never an example. No photograph, recording or real face: drawn only, his drawn character allowed. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock, no network, no media files. Colour only from stills/palettes.ts. Reuse the library devices and caption themes as they are; never fork one.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-still-template-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
