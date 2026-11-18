---
card: ve-universe-figurines
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-universe-figurines
write_allow: [lab/universe/figurines/index.js]
read: lab/universe/PLAN.md, lab/universe/figurines/check.mjs, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Toy figurines with personalities: the anchor visuals for the work building

## Goal
Krish, 18 Nov 2026: "turn all the characters in to tiny figurines that have their own personalities and do little actions that roughly suit their personalities. make it the smallest available movement or visual trait that can be observed in 1 sec and even on a small screen ... involve Codex to produce the anchor visuals you can animate if needed." Read lab/universe/PLAN.md whole first: the cast table and "The figurine contract" are the brief.

Build lab/universe/figurines/index.js: an ES module with no imports (THREE is passed in) exporting PERSONALITIES (the 20 ids in the contract) and makeFigurine(THREE, spec) -> { group, update(t), actor }.

1. One shared body: chunky toy figurine, matte (MeshStandardMaterial, roughness >= 0.8), big head, short legs, arms that can move, 0.55 to 0.70 tall, standing on y = 0 facing +z. head 'bot': a rounded box with two dark eye dots and a flat front panel carrying spec.headLogo as a decal (a plane with the texture, transparent, slightly in front). head 'human': a sphere head with a hair cap. spec.legLogo, when given, sits as a small decal on the front of each thigh. Colours only from spec.body, spec.accent (eyes, hair, dark prop parts) and spec.skin (the human head); no colour of your own.
2. One prop per personality where the cast table implies one (mug, stamp, binoculars, lightbulb, book, laptop, pen, headset, big button, magnifier, wrench, box, parcel), small and inside the footprint.
3. Each personality's action as a pure function of t and seed (seed shifts the phase only): a 0.8 to 1.6 s loop with a quick, clear move and a short hold, eased (no linear robot motion). The actor (the part that acts) moves >= 0.04 units or turns >= 12 degrees in any 1 s window; everything else stays under 0.012 units (a tiny breath is fine). pacer walks 0.3 units back and forth with alternating legs (actor is the group); courier holds a parcel and bobs its step in place (actor is the group; the scene moves it up the lift).
4. Name every mesh (mesh.name) so a fault names its part.

Never: textures or colours of your own beyond the spec, clocks or randomness, imports, files outside write_allow.

## Contract
The figurine contract in lab/universe/PLAN.md. Pure functions of t and seed. The check is lab/universe/figurines/check.mjs, written by Claude; do not edit it.

## Acceptance (every command must exit 0 inside your sandbox)
node lab/universe/figurines/check.mjs

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-universe-figurines", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
