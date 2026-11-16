---
card: ve-style-still-template-4
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 180
max_calls: 220
cwd: /home/user/ve-wt\content-engine\ve-card\ve-style-still-template-4
write_allow: [apps/renderer/src/engine/stills/**, apps/renderer/src/Root.tsx]
read: apps/renderer/src/engine/**, apps/renderer/src/Root.tsx, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json, config/ve/character.json, config/style-references.json, config/caption-themes.json, config/brand-palette.json, docs/ve/styles/**, docs/plans/2026-11-11-wednesday/**, docs/plans/2026-11-09-week/fri-preproduction/**, docs/plans/2026-11-13-friday/**, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# StyleStill, fourth pass: the sixteen covers a reviewer still holds back

## Goal
Krish, 16 Nov 2026: "Just do it all now." Thirty-two covers are live on his board; leave their drawing exactly as it is (motion: ai-music-slam, data-story, eating-jobs-ladder, full-visual, hud-terminal, riso-halftone, single-line-drawing, swiss-kinetic-type, dark-keynote, living-ui; looks: scoreboard-test, kinetic-movement, receipt-animation; captions: all but the eight below). Keep CaptionSample, which fits each caption large over the talking head. Fix each fault a separate reviewer named, in apps/renderer/src/engine/stills/.

Motion:
- paper-cutout: irregular torn edges, soft offset shadows (blurred, 4-8px), a paper grain; no strip cut off by the frame edge.
- line-boil: a rat anyone recognises, drawn in curved strokes (no straight segments), three passes offset 1-2px so the line visibly boils, its tail attached. (Built at 3px offsets on 3px strokes, 16 Nov: 1-2px merges into one line in the half-scale still.)
- vertical-captions: heavy bold words stacked down most of the frame, the active word in a tight box around that word only.
- character-ai-receipts: a torn receipt with the tear across the whole bottom edge; the hero figure at 4.5:1 or more against the paper.

Looks:
- face-with-proof: the proof card carries its source line (publication and date), as every claim cover does.
- voice-led-pictures: a full-bleed drawn picture of the line it carries (Hanoi, 1902: people bringing rat tails to be paid), not abstract bars.
- data-story: one big sourced number with its source label, its chart labelled; no word printed twice.
- fry-talking-head: a close-up (the head fills the top two thirds), plainly unlike face-with-proof's mid shot, with drawn annotations (arrows, circles, handwritten notes) beside kinetic subtitles.
Every look's style label at the foot reads at 4.5:1 or more.

Captions (each shows its own move in the still; reuse the theme, never fork it: pick the frame where the move shows, or lay two or three of its frames over each other as a trail):
- art-directed: the caption as large as the others, its ghost word legible behind.
- cinematic: solid numerals, nothing showing through them.
- slam: the impact visible (the hit, the shake), unlike beast; every word 4.5:1 or more.
- stair-flash: the stair steps and the flash visible.
- slot-roll: words caught mid-roll in their slots; one space between words.
- flip-hinge: a word caught mid-flip on its hinge, unlike pop.
- slice: the cut through the word clean, no line drawn over another.
- ink-block: the block wholly inside the frame, 40px or more from each edge.

Tests in apps/renderer/src/engine/stills prove: the thirty-two live covers' plans unchanged; fry-talking-head and face-with-proof use different layouts; every caption cover's zone inside the frame with a 40px margin; no word repeated on data-story; no two covers share a beat.

## Contract
Never use or read anything of the Thu 5 Nov No Spending piece (docs/plans/2026-11-05-thursday-no-spending, its take or its frames): he rejected it and it is never an example. No photograph, recording or real face: drawn only, his drawn character allowed. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock, no network, no media files. Colour only from stills/palettes.ts. Reuse the library devices and caption themes as they are; never fork one.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/stills
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-style-still-template-4", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
