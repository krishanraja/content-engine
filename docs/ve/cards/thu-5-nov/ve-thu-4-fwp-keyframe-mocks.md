---
card: ve-thu-4-fwp-keyframe-mocks
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-4-fwp-keyframe-mocks
write_allow: [apps/renderer/src/engine/mocks/face-with-proof.tsx, apps/renderer/src/engine/mocks/face-with-proof.test.ts]
read: apps/renderer/src/engine/devices/**, apps/renderer/src/engine/props.ts, apps/renderer/src/house/**, docs/ve/design/TEMPLATE.md, docs/ve/design/formats/F-anatomy.md, docs/ve/design/formats/F-motion.md, config/ve/design-lock.json, config/logo-registry.json, fixtures/ve/my-test-19s/**, fixtures/ve/design-lock/approved/**, docs/plans/2026-11-02-week/thu-storyboard.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-with-proof: the four key-frame mocks for Krish's Gate 2, built from the library devices

## Goal
Krish chose (2 Nov) to finish Thursday 5 Nov through the engine. The face-with-proof format is a draft lock (config/ve/design-lock.json drafts, beats hook, face, proof, close, all four key-frame slots empty), so the engine cannot lay devices over his face until he approves one still per beat and `ve lock freeze` hashes them. Build the four mock compositions; Claude renders them to stills (Codex cannot run Chromium) and puts them to him.

Write apps/renderer/src/engine/mocks/face-with-proof.tsx exporting `FWP_MOCKS`: four pure React components (hook, face, proof, close), each drawing one 1080x1920 frame from the existing library devices (cursor_buddy, typing_bubble, logo_card, stamp, scribble) at a fixed frame, plus `apps/renderer/src/engine/mocks/face-with-proof.test.ts` that renders each to static markup and checks the rules below. No new device, no per-piece code, nothing under docs/plans.

The look (his references DeZuQ7-lATg and DeypYeWN5hL; the signed storyboard docs/plans/2026-11-02-week/thu-storyboard.md, read only): a split frame. The top 1000 px is a light stage (tokens.cream) where the proof device plays, scaled up to fill it; the camera plate sits below in the face band (use the my-test-19s fixture recording's poster frame as an <img>, never redrawn), his eyes never covered; one caption line in the lock's caption zone (x 72, y 1180, w 900, h 320) in the house caption style; the brand dress (logo top left, series tag top right).
- hook: cursor_buddy (at least 420 px tall) proud, a notification typing_bubble above it: 'Done! Booked the team offsite in Ibiza'. Caption 'Proactive AI is coming'.
- face: his face full frame (no stage), one kinetic label from the headline device or a caption only. Caption 'It doesn't spend my money'.
- proof: logo_card with Meta, Amazon, Google over xAI, Anthropic (official marks from config/logo-registry.json), each mark at least 140 px. Caption 'Amazon for your groceries'.
- close: two slabs NO SPENDING / NO SENDING (stamp device scaled so its words are at least 72 px; ink on mint, never coral fill), cursor_buddy sulking beside them. Caption 'no spending, no sending'.
Rules: TEMPLATE.md anti-patterns (no coral as a status or fill, no mint type on cream, nothing under 30 px, no tag or provenance label); colours only from tokens; type roles from HOUSE_FONTS; composition fill at least 80% outside the caption zone; nothing key beyond x 960 or y 1640.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Reuse devices as they are; scale with a wrapper transform only. Pure functions of props, no Math.random, no wall clock.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/mocks/face-with-proof.test.ts
npx vitest run apps/renderer/src/engine/devices
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-4-fwp-keyframe-mocks", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
