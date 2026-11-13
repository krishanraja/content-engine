---
card: ve-gap-takeover-1
motion_style: ai-music-slam
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /home/user/ve-wt/ve-gap-takeover-1
write_allow: [apps/renderer/src/engine/devices/takeover/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json]
read: apps/renderer/src/engine/**, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md, config/ve/design-lock.json, docs/ve/styles/ai-music-slam.card.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# takeover: a full-frame title card that removes him mid-cut, with a red/cyan split flicker and a light streak

## Goal
From the AI music cut. Build device `takeover` for a graphics-only STAGE beat: a full-frame title card in the display role that arrives with a 3-frame red/cyan channel-split flicker (offset copies in tokens.channel and tokens.mint only, never raw red or cyan hex) and a single light streak across it, then holds. Verbs: enter, exit. Test: the flicker frames and the streak's single pass.

Per devices/CONTRACT.md: index.tsx, state.ts, schema.ts, fixture.json, device.test.ts; register in registry.ts and config/ve/devices.json.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Every number carries its producer. In a layout region (kit/layout.ts isRegion, kit/staging.ts) the device lays out at its natural size and grows to fill the region (kit/regionFit.tsx).

## Motion style: Proof slams onto the stage (from the AI music cut) (ai-music-slam, untested)
Real proof (screens, charts, headlines, clips) slams onto an ink stage over the top of the frame on a back curve and settles tilted, while he talks below; mint is what a human made and hatched ink is what the machine made; the camera never stops pushing and scenes hand over with a horizontal blur whip.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- two materials only: mint for what a human made, hatched ink for what the machine made
- every real thing slams in on a back curve, settles on a small tilt with a soft shadow, and the picture behind it dims
- the camera pushes through every scene and breathes on long holds; nothing is ever still
- scenes hand over with a horizontal blur whip; one crossfade inside a scene at most
- each rebuilt interface carries its rebuilt-from line
Never:
- a third colour for provenance
- a crossfade between scenes
- the series colour anywhere but the pill and the end ticker
- a rebuilt interface passed off as the real one

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/takeover
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-gap-takeover-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
