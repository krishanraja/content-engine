---
card: ve-thu-4-fwp-keyframe-mocks-v3
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-4-fwp-keyframe-mocks-v3
write_allow: [apps/renderer/src/engine/mocks/face-with-proof.tsx, apps/renderer/src/engine/mocks/face-with-proof.test.ts]
read: apps/renderer/src/engine/devices/**, apps/renderer/src/engine/props.ts, apps/renderer/src/house/**, docs/ve/design/TEMPLATE.md, docs/ve/design/formats/F-anatomy.md, docs/ve/design/formats/F-motion.md, config/ve/design-lock.json, config/logo-registry.json, fixtures/ve/my-test-19s/**, fixtures/ve/design-lock/approved/**, docs/plans/2026-11-02-week/thu-storyboard.md, apps/renderer/src/engine/devices/logo_orbit/**
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-with-proof key-frame mocks, round 3: a higher split so his whole head fits

## Goal
['Round 2 (merged on main: apps/renderer/src/engine/mocks/face-with-proof.tsx) passed Claude\'s review. Krish\'s only note: "How do you recommend we don\'t have so much of my head cut off when the screen splits? That\'s the only visual issue I have." He approved the fix Claude mocked: move the split up. Change only this; keep everything else from round 2 (caption zone, equal marks, the three scribbles and their targets\' meaning).\n\n1. Move the split seam from y 1000 to y 760. Export it as FWP_SPLIT_SEAM_Y = 760 so the lock can carry it. The proof stage is 1080 x 760 on cream; the camera plate starts at y 760 and is 1080 x 1160, object-fit cover.\n2. Fit the stage\'s graphics to the shorter stage with one wrapper transform: scale 0.76 (export FWP_STAGE_SCALE), centred horizontally, top origin. The header (wordmark and series tag) stays where it is and unscaled. Scale FWP_TARGETS by the same transform (export the scaled boxes) so each scribble still marks its element: the underline under \'Done!\', the loop round the Amazon tile, the tick beside NO SENDING.\n3. Change the split beats\' FWP_POSTER_POSITIONS default to \'50% 88%\' (hook, proof, close); the face beat stays \'50% 0%\'. With Krish\'s Thursday take this puts the top of his hair just under the seam and his eyes near y 1150.\n4. The split caption zone stays x 72, y 1460, w 900, h 180, under his chin.\n\nTests: the split seam is 760 and the plate\'s box is y 760 to 1920; every stage child\'s scaled box lies inside y 0 to 760 and x 0 to 1080; no caption pixel box overlaps the band y 1080 to 1260; each scribble\'s scaled target box still intersects its named element\'s scaled box; every mark\'s fitted long side, after the stage scale, is 140 x 0.76 px within 1 px; the face beat is unchanged (same seam-free layout and caption zone as round 2).']

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Reuse devices as they are; scale with a wrapper transform only. Pure functions of props, no Math.random, no wall clock.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/mocks/face-with-proof.test.ts
npx vitest run apps/renderer/src/engine/devices
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-4-fwp-keyframe-mocks-v3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
