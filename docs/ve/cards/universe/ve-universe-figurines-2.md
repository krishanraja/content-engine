---
card: ve-universe-figurines-2
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-universe-figurines-2
write_allow: [lab/universe/figurines/index.js]
read: lab/universe/PLAN.md, lab/universe/figurines/check.mjs, lab/universe/figurines/index.js, docs/ve/cards/universe/ve-universe-figurines.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Figurines, second pass: Claude marks on dark legs, props you can read on a phone

## Goal
Revise lab/universe/figurines/index.js (your first pass, now on main). Claude reviewed it in the building at full size: the toy proportions and the head logos read well; keep them. Fix exactly these, nothing else:

1. The check's three faults: binoculars/human footprint (x 0.403, z 0.350) and chin bot/human (z 0.395 and 0.421). Keep every figure, props included, inside 0.45 by 0.35 with a little margin (z <= 0.34).
2. Legs and feet in spec.accent (dark), not spec.body, so the leg logo reads. spec.legLogo becomes a decal about 0.075 square on the front of each thigh, just proud of the surface, facing +z. Krish asked for Claude logos on legs: on a phone they must be seen.
3. Head logo on bot heads at least 55% of the face width, centred below the eyes.
4. Every prop readable on a phone: its largest side at least 0.09 units, in spec.accent or spec.skin so it contrasts with the body; the lightbulb in spec.skin with an emissive glow; the mug, stamp, binoculars, headset, magnifier, wrench, box, book, laptop, pen and big button all clearly their thing in silhouette.
5. A little personality in silhouette, cheaply: a small antenna for bulb and scanner, headset arcs for caller and talker, a box on the courier's shoulder held in both hands. Nothing outside the footprint.

Keep the contract in lab/universe/PLAN.md and every rule the first card had (no imports, no clocks or randomness, no colours of your own, names on every mesh). Read the first card, docs/ve/cards/universe/ve-universe-figurines.md.

## Contract
The figurine contract in lab/universe/PLAN.md. The check is lab/universe/figurines/check.mjs, written by Claude; do not edit it.

## Acceptance (every command must exit 0 inside your sandbox)
node lab/universe/figurines/check.mjs

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-universe-figurines-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
