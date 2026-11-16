---
card: ve-style-still-template-3
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 180
max_calls: 220
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-still-template-3
write_allow: [apps/renderer/src/engine/stills/**, apps/renderer/src/Root.tsx]
read: apps/renderer/src/engine/**, apps/renderer/src/Root.tsx, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json, config/ve/character.json, config/style-references.json, config/caption-themes.json, config/brand-palette.json, docs/ve/styles/**, docs/plans/2026-11-11-wednesday/**, docs/plans/2026-11-09-week/fri-preproduction/**, docs/plans/2026-11-13-friday/**, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# StyleStill, third pass: the six motion covers, the seven looks and the 27 caption styles that were held back

## Goal
Krish, 16 Nov 2026: "what cover art would you use to represent that entire motion style, so someone is inspired to pick it from a lineup?" Eight motion covers of the second pass are live on his board: ai-music-slam, data-story, eating-jobs-ladder, full-visual, hud-terminal, riso-halftone, single-line-drawing, swiss-kinetic-type. Leave their drawing exactly as it is (their recorded files must still match). A separate reviewer held back everything else. Fix each fault named here, in apps/renderer/src/engine/stills/.

Motion:
- paper-cutout: several layers of real cut paper, each with a cut or torn edge and a 2-4px drop shadow, not one flat tilted rectangle.
- line-boil: a hand-drawn line drawing of a thing from the stories (a rat, a tail, a singer), the line visibly wobbly from three seeded jittered strokes laid over each other; not a smooth curve, and not the squiggle the looks use.
- dark-keynote: one giant number, the whole of it inside the frame (the % ran off), under a single soft light sweep, on grain.
- living-ui: a real interface (Suno create, as the AI music piece showed it) zoomed 1.5x to 3x onto the one element that proves the point, the cursor on that element, its source label and date at the foot.
- vertical-captions: bold word-by-word captions stacked up the frame, the active word highlighted; no waveform.
- character-ai-receipts: the receipt is the hero, two thirds of the frame, its lines printed with the one figure in the accent; one source line, not two.

Looks (formats.production in config/style-references.json; each cover shows its format, not type on a flat field):
- face-with-proof and fry-talking-head: a face, large: his drawn character (config/ve/character.json). face-with-proof is the face band with a proof cutaway beside or above it; fry-talking-head a close face with kinetic subtitles and drawn annotations.
- voice-led-pictures: a full-bleed picture with the line it proves. data-story: one big sourced number drawn as a chart. scoreboard-test: a screen with a live scoreboard and a verdict. kinetic-movement: a fast phrase in motion, a story no other cover uses. receipt-animation: a long thin till receipt printing, perforated, unlike the character-ai-receipts cover, its label legible.

Captions, all 27: drop every decoration (the second pass cut its shapes flat about 270px down on 18 tiles). Each caption is set as it plays in a cut: large (text block at least 300px tall), over a neutral video frame of its own (his drawn character on a soft ground, or a quiet room), each on a different line from the scripts, legible on its ground. They differ by their own theme, nothing else.

No two covers anywhere may share a story beat or a waveform strip. Keep coverPlan and stillIds. Tests in apps/renderer/src/engine/stills prove: the eight live covers' plans unchanged; every caption zone at least 300px tall and inside the frame; no caption backdrop element drawn past its box; no two covers share a beat; face-with-proof and fry-talking-head draw the character.

## Contract
Never use or read anything of the Thu 5 Nov No Spending piece (docs/plans/2026-11-05-thursday-no-spending, its take or its frames): he rejected it and it is never an example. No photograph, recording or real face: drawn only, his drawn character allowed. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock, no network, no media files. Colour only from stills/palettes.ts. Reuse the library devices and caption themes as they are; never fork one.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-still-template-3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
