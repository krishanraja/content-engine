---
card: ve-universe-figurines-3
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 120
max_calls: 150
cwd: /root\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-universe-figurines-3
write_allow: [lab/universe/figurines/index.js]
read: lab/universe/PLAN.md, lab/universe/figurines/roles.json, lab/universe/figurines/check-roles.mjs, lab/universe/figurines/index.js, docs/ve/cards/universe/ve-universe-figurines.md, docs/ve/cards/universe/ve-universe-figurines-2.md, lab/universe/scene/scene.js
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Figurines, version 4: one figurine per job, each one doing its job at a glance

## Goal
Rebuild lab/universe/figurines/index.js so every worker in the building is its own figurine that shows its job at a glance. Krish watched the master video (Inside my AI-native firm, floor by floor) and said, 18 Nov 2026: "I dont think the characters in the original video have enough personality for what they do, visually". Today 20 shared poses stand in for about 50 jobs: a fact checker and a tester hold the same magnifier, a scheduler and a deployer press the same button, and most are the same terracotta box. You own the art direction of the figures within the rules below; this is the creative heart of the piece, so be generous with detail.

The jobs are lab/universe/figurines/roles.json: 49 ids, each with what the figure does ('do') and what makes it readable ('look'). Build every one. Treat 'do' and 'look' as the brief, not a cage: if a better visual gag says the same job faster, use it and say which in your report.

What makes a figure good here, in order:
1. You can name the job from the silhouette and the action alone, on a phone, at about 70 pixels tall, with the label hidden. Props are big (largest side at least 0.1 units), high contrast against the body, and held where the camera sees them (the camera looks from front right and a little above, toward -z).
2. Each one has a character: a costume detail (hat, glasses, visor, headset, apron, tool belt, collar), a posture (leaning in, standing tall, hunched over the keys) and a rhythm of its own. Small secondary life is welcome: a blink, a breath, a head turn, a foot tap on the walker. No two figures share a silhouette.
3. The house style stays: chunky toy figurines, rounded and matte (MeshStandardMaterial, roughness 0.75 and up), big head, short legs; the scene's lighting does the rest. Every prop's colour comes from spec.palette, the body from spec.body, eyes, hair and dark parts from spec.accent, skin from spec.skin. Glowing parts (a lightbulb, a screen, a rocket flame) use spec.palette.glow as emissive.
4. Logos stay exactly as Krish approved: a bot head carries spec.headLogo as a decal named head-logo, at least 55% of the face width, under the eyes; every figure carries spec.legLogo as two decals named leg-logo, about 0.075 square, on the front of each thigh, legs in spec.accent so the mark reads. Never draw a logo or a word yourself.
5. The chief-of-staff is the one in charge: the most detail, and the scene draws it 1.6 times bigger. The ceo is the only human head (spec.head 'human'), calm, in the mint body the scene gives it.

The contract, version 4 (replaces the personality contract in lab/universe/PLAN.md):
- export const ROLES = [every id in roles.json]
- export function makeFigurine(THREE, spec) -> { group, update(t), actor }
- spec: { role, body, accent, skin, palette: { ink, cream, mint, butter, lilac, coral, wood, metal, paper, glow }, head: 'human' | 'bot', headLogo: THREE.Texture | null, legLogo: THREE.Texture | null, seed }
- Units: stands on y = 0, faces +z, 0.55 to 0.85 tall (a hat or a bulb may take it up), inside 0.50 by 0.40 with props (the courier may be wider). Two meshes whose names start with foot; they stay put (only follow-up, who paces, and courier may move them).
- update(t) is a pure function of t and seed (seed offsets the loop phase only). actor is the part doing the job: within any 1 s window it travels at least 0.05 units or turns at least 15 degrees. Loops of 2 to 4 s read best.
- No imports, no clock, no randomness, no raw colours (no #hex, no 0x literals), a name on every mesh, 14 meshes or more per figure.

The scene (lab/universe/scene/scene.js, Claude's) will pass spec.role and spec.palette; you do not edit it. Read lab/universe/PLAN.md for the whole piece and Krish's words, and the two earlier cards for what he already approved. Report: each role in one line with the gag you chose, and anything in roles.json you changed and why.

## Contract
Version 4 above; lab/universe/figurines/roles.json lists the jobs. The check is lab/universe/figurines/check-roles.mjs, written by Claude; do not edit it or roles.json.

## Acceptance (every command must exit 0 inside your sandbox)
node lab/universe/figurines/check-roles.mjs

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-universe-figurines-3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
