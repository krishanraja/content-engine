---
card: ve-fwp-rebuild-1
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 180
max_calls: 220
cwd: /home/user\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fwp-rebuild-1
write_allow: [apps/renderer/src/engine/stills/split/**, apps/renderer/src/Root.tsx]
read: [apps/renderer/src/**, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json, config/brand-palette.json, config/logo-registry.json, config/channel-safe-zones.json, docs/ve/styles/**, docs/ve/design/**, docs/ve/MOTION_STANDARD.md, docs/plans/2026-11-11-wednesday/**, docs/plans/2026-10-26-monday/**]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-with-proof key frames rebuilt from AI music and Character.AI: eight stills for his Gate 2

## Goal
Krish, 17 Nov 2026: "character.ai or ai music are good". 18 Nov: "either ai music or character.ai is fine - both are good for different reasons. DELETE THOSE FRAMES FOREVER. you need to rebuild everywhere it was to be 10X better using those two new references".

The old face-with-proof key frames are deleted for good and their hashes barred (config/ve/design-lock.json, drafts.face-with-proof.retired): a cream stage over 40% of the frame, five white logo tiles, slabs that spelled the caption, a mascot filling space. Never read, copy or imitate them or the Thu 5 Nov piece.

Build Remotion composition `SplitKeyFrame`, 1080x1920, one frame, in apps/renderer/src/engine/stills/split/, registered in apps/renderer/src/Root.tsx as StyleStill is. Props: {variant: 'slam' | 'receipt', beat: 'hook' | 'face' | 'proof' | 'close', plateSrc: string, series: string, caption?: string}: eight frames. Claude renders them with a real frame of his take as plateSrc, a separate reader judges them, and Krish presses Gate 2 on one still per beat (he may mix).

Two variants, both measured; read the files, not memory:
- slam: docs/ve/styles/ai-music-slam.card.json (Wed 11 Nov): ink stage over about 64% of the frame (y 0 to about 1236), real proof slamming onto it, two materials only (mint for what a human made, hatched ink for what the machine made), the series pill on every split frame. His cut-out is not buildable in ve yet: his band is the camera plate, hard-edged.
- receipt: docs/ve/styles/character-ai-receipts.card.json (Mon 26 Oct). A lit ink desk over 52% (panel y 10 to 1000 under a 10 px series-colour hairline), a hard edge to a still face band, no divider, no camera, proof objects that print on their word, a faint cream grid (54 px cells, 4%), a series-colour glow top left and a mint glow bottom right.

Beats (docs/ve/design/formats/F-anatomy.md): hook is frame 0 in the brand's dress with logo and series tag in their corners (may take the whole frame, as both references' title and end cards do); face is where he carries the line, with a label adding the number, name or date the voice does not say; proof is the evidence the line names; close is one calm close, held to be read. For each beat and variant pick the moment in that style card that does the job best, draw its layout with its materials, and name it in a data-reference attribute on the frame root ("ai-music 57.27 s verdict card slam"). Invent no layout the card does not show. Words and numbers come from the two pieces (docs/plans/2026-11-11-wednesday and 2026-10-26-monday, read-only), never placeholders.

10X better, measured: (1) stage, a hairline included, at least 1000 px (52%) tall, its ground with depth, never a flat field except a reference's own title or end card; (2) at least 80% of the stage outside the caption used (design lock fill_min_pct), one focal point; (3) a real object per proof frame (receipt, chart, screen, real mark), never typeset words alone; (4) stage words add a source, date, number or name and never repeat the caption; (5) his whole head, crown to chin, inside the band (Krish: "so much of my head cut off"), the caption astride the seam, his eyes clear of it.

## Contract
Never: the words "Proactive AI is coming", "It doesn't spend my money", "Amazon for your groceries", "Ibiza", "no spending" or "no sending" in any case; a row or grid of logo tiles in white squares; the cursor mascot as filler; a cream or flat stage; stage words repeating the caption; a divider between stage and band (receipt); a camera move on the band.
Measured: text at least 30 px; header per design lock zones.header (logo left, series tag right); the house caption chip (HOUSE.caption, apps/renderer/src/house/geometry.ts) astride the seam inside the safe column x 60 to 860 and above y 1320 (config/channel-safe-zones.json); key content 72 px from every edge, left of x 960 (zones.platform.right_x) and clear of every zone in config/channel-safe-zones.json; the band is the camera plate at the full 1080 width, object-fit cover.
Build: devices only from config/ve/devices.json, as they are, scaled by a wrapper transform only; official marks only from config/logo-registry.json; colour and type only through tokens; pure functions of props, no Math.random or wall clock. plateSrc is a real frame of his take supplied at render time, never drawn, generated or committed.
Test (stills/split/split.test.ts) renders all eight to static markup and asserts: stage at least 1000 px tall; band hard-edged; no Never string; text at least 30 px; a data-reference, distinct within a variant; logo and series tag in the header; caption inside the safe column.
If a rule cannot be met, name it in open_questions; ship no caveat.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills/split
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fwp-rebuild-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
