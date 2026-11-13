---
card: ve-gap-slam-word-1
motion_style: character-ai-receipts
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /home/user/ve-wt/ve-gap-slam-word-1
write_allow: [apps/renderer/src/engine/devices/slam_word/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json]
read: apps/renderer/src/engine/**, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md, config/ve/design-lock.json, docs/ve/styles/character-ai-receipts.card.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# slam_word: one word scaled 250% to 100% in 3 frames, with caution tapes and a confetti burst

## Goal
From the Character.ai cut. Build device `slam_word`: one word lands from 250% to 100% in 3 frames, two caution tapes in the series colour (tokens.channel) with mono text drift across behind it, a seeded burst of mint, cream and series-colour slips fires on the landing, and the whole fades to 30% before the cut. Verbs: enter, exit. Seeded by object id only. Fixture and test: the landing frame, the tape drift and the 30% fade.

Per devices/CONTRACT.md: index.tsx, state.ts, schema.ts, fixture.json, device.test.ts; register in registry.ts and config/ve/devices.json.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Every number carries its producer. In a layout region (kit/layout.ts isRegion, kit/staging.ts) the device lays out at its natural size and grows to fill the region (kit/regionFit.tsx).

## Motion style: Receipts on the ink desk (from the Character.ai cut) (character-ai-receipts, untested)
Evidence prints onto a lit ink desk above a still face band: receipts, money maps, logo rows and checklists rise into place under a fade, each line printing on the word that names it, the figure landing on a mint fill; a device changes state by dissolving, never by a camera move.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- the panel is an ink desk with a series-colour glow top left and a mint glow bottom right, slowly drifting
- proof objects rise into place under a fade with no overshoot; type only fades or blurs in, one word or line at a time
- every line, chip and figure lands on the word that names it; the figure lands on a mint fill
- a device changes state by an 8-frame dissolve: the old layout ghosts under the new
- no camera move on the panel or the face; at most one slam (caution tape and confetti) in a piece
Never:
- camera pushes or punch-ins
- overshoot or bounce on any entrance
- an on-screen label repeating the spoken line
- more than one slam in a piece

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/slam_word
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-gap-slam-word-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
