---
card: ve-thu-5-split-layout
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-5-split-layout
write_allow: [packages/contracts/src/production-spec.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/layouts/index.ts, apps/renderer/src/engine/layouts/split.test.ts, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/BrandFrame.tsx]
read: apps/renderer/src/engine/**, packages/contracts/src/**, config/ve/design-lock.json, docs/ve/design/formats/F-anatomy.md, docs/ve/design/formats/F-motion.md, fixtures/ve/design-lock/face-with-proof/**
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The SPLIT layout in the renderer: graphics above, his face below, as the frozen face-with-proof lock

## Goal
['Krish froze the face-with-proof 9:16 lock on 3 Nov 2026 ("Looks good to me.") from the round 3 key-frame mocks (apps/renderer/src/engine/mocks/face-with-proof.tsx: FWP_SPLIT_SEAM_Y, FWP_STAGE_SCALE, FWP_SPLIT_CAPTION_ZONE, FWP_POSTER_POSITIONS; golden frames in fixtures/ve/design-lock/face-with-proof/). The real renderer has no such layout, so Thursday\'s cut cannot be drawn the way he approved. Add it as a layout, not per-piece code.\n\n1. Add \'SPLIT\' to VeLayoutSchema (packages/contracts/src/production-spec.ts) and to EngineBeat\'s layout enum (apps/renderer/src/engine/props.ts).\n2. In a SPLIT beat, the canvas is two parts. Top: a cream stage, x 0 to 1080, y 0 to 760 (import the seam from the mocks file, never a second copy of the number). Bottom: the camera plate, x 0 to 1080, y 760 to 1920, object-fit cover, positioned by the beat\'s plate crop when it is a CSS object-position string (for example \'50% 88%\'), else the mocks\' split default. The full-bleed plate does not show in the stage area. Other layouts are unchanged.\n3. slotsFor(\'SPLIT\', \'9:16\', n) gives n boxes that each fill the stage (0, 0, 1080, 760), so devices compose on the stage as on STAGE, clipped to it; the device content is scaled by FWP_STAGE_SCALE about the stage\'s top centre with one wrapper transform. 16:9 SPLIT is refused with a clear error (no wide lock yet).\n4. The caption track sits in FWP_SPLIT_CAPTION_ZONE during SPLIT beats and in its usual zone otherwise; the logo and series tag stay in the header, unscaled.\n\nTests (new file apps/renderer/src/engine/layouts/split.test.ts, plus any you need in the files you may write): the schema accepts SPLIT and still refuses an unknown layout; slotsFor SPLIT boxes are inside y 0 to 760; the camera box is y 760 to 1920; a SPLIT beat\'s caption box lies inside FWP_SPLIT_CAPTION_ZONE and never overlaps y 1080 to 1260; non-SPLIT beats keep their current slots and caption zone (the existing tests stay green); the seam, scale and caption zone are the mocks\' exported values, not new literals.']

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Change no device.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/layouts
npx vitest run apps/renderer/src/engine
npx vitest run packages/contracts
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-5-split-layout", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
