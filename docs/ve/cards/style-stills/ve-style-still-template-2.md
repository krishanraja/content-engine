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
Krish, 16 Nov 2026: "I should be showing shop window examples of how that element looks"; "what cover art would you use to represent that entire motion style, so someone is inspired to pick it from a lineup?" Each still is that style's cover, at its very best, beside the others.

The first pass (ve-style-still-template-1) was rejected. Fix each fault:
- Four scenes reused across every style, so covers looked alike (the receipt look and character-ai-receipts were one picture; all 27 captions sat on one scene).
- The bottom half of most covers was empty.
- The three styles measured from his cuts ignored their measured layouts.
- The caption overlapped its device.
- Only 5 motion styles and 4 looks were drawn.

Build Remotion composition `StyleStill`, 1080x1920, one frame, in apps/renderer/src/engine/stills/, registered in apps/renderer/src/Root.tsx. Props: {layer: 'treatment' | 'motion' | 'captions', id: string}. Each cover is its own composition, one subject, one idea, readable at thumbnail size, using the whole frame. Shared only: brand tokens, the design lock's safe zones, the style's name small at the foot. Inside, the style's signature dominates: its device at its most telling moment (config/ve/devices.json, the bank entry's ve_route in config/style-references.json), ground, colours, type.

Subjects come only from the work he praised ("the production standards, and the script for the AI music video (the Rat Tails video), and the characters of the AI video"): beats, numbers and lines of the Wed 11 AI music piece (docs/plans/2026-11-11-wednesday) and the Fri 13 Rat Tails piece (docs/plans/2026-11-09-week/fri-preproduction, docs/plans/2026-11-13-friday), and his drawn character (config/ve/character.json) wherever a person belongs. No placeholder words. No two covers in a layer use the same beat.

- motion, all 14: ai-music-slam, character-ai-receipts, eating-jobs-ladder, dark-keynote, data-story, full-visual, hud-terminal, line-boil, living-ui, paper-cutout, riso-halftone, single-line-drawing, swiss-kinetic-type, vertical-captions. The three in docs/ve/styles/*.card.json are drawn exactly to their layout_frame_use, palette_use and ground (ai-music-slam: ink stage y 0..1236, cream band below, mint human, hatched-ink machine; character-ai-receipts: hairline, ink panel y 10..1000, his drawn character in the band below; eating-jobs-ladder: the ladder and hero number on the vignetted ink desk). The rest each get a scene of their own.
- treatment (formats.production), all 7: face-with-proof, voice-led-pictures, data-story, fry-talking-head, scoreboard-test, kinetic-movement, receipt-animation. Each look's layout from its modules; a look never borrows a motion style's picture.
- captions, all 27 (captions/names.ts CAPTION_THEMES): the caption is the hero, large mid-frame, each on a different script line, over a backdrop that never crosses it.

Export `coverPlan(layer, id)` -> {scene, beat, zones: [{name, x0, y0, x1, y1}]} and `stillIds()`; a cover it cannot draw returns null and is left out. Tests in apps/renderer/src/engine/stills prove from coverPlan: scene keys unique within motion and within treatment, none shared between them; no two covers in a layer share a beat; every cover's zones reach y <= 120 and y >= 1800; a caption zone never intersects a device zone; the measured styles' zones match their cards; stillIds holds all 14 motion styles, 7 looks and 27 caption themes.

## Contract
Never use or read anything of the Thu 5 Nov No Spending piece (docs/plans/2026-11-05-thursday-no-spending, its take or its frames): he rejected it and it is never an example. No photograph, recording or real face: drawn only, his drawn character allowed. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock, no network, no media files. Colour roles from tokens, never raw hex. Type roles from the design lock. Reuse the library devices and caption themes as they are; never fork one.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-still-template-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
