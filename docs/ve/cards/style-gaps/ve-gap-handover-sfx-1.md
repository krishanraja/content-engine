---
card: ve-gap-handover-sfx-1
kind: engine
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /home/user/ve-wt/ve-gap-handover-sfx-1
write_allow: [packages/contracts/src/production-spec.ts, scripts/velib/compile.py, scripts/velib/sfx.py, scripts/velib/guards.py, tests/ve_sound_test.py, tests/ve_ingredients_test.py]
read: scripts/velib/**, apps/renderer/src/engine/kit/ingredients.ts, apps/renderer/src/engine/audio.tsx, config/sfx-approved.json, config/ve/sfx-candidates.json, docs/ve/INGREDIENTS.md, docs/ve/sources/openmontage.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# style.sound: a handover sound and a hit sound, placed just before the picture changes, from approved sounds only

## Goal
Krish asked for sound effects on handovers and hits (14 Nov 2026). The timing rule (docs/ve/sources/openmontage.md, Sound): a whoosh starts 10 to 20 ms before the visual change and peaks on it.

1. Contract (packages/contracts/src/production-spec.ts, the style object): optional `style.sound` = {handover?: string, hit?: string, gainDb?: number <= 0, reason: string}. Each id must be an approved row in config/sfx-approved.json; ve lint and compile refuse any other id by name.
2. Compile (scripts/velib/compile.py, beside ingredient_props): for each beat handover (every beat start after the first, the same frames kit/ingredients.ts lastHandover uses) place the handover sound, and for each device hit (the frames kit/ingredients.ts hitFrames picks, only when style.camera.hits is on) place the hit sound, into props.audio.sfx as {src, atFrame, gainDb}. At 30 fps a 10 to 20 ms lead rounds to one frame early: atFrame = change frame - 1, never below 0. Never two sounds within 6 frames of each other (the later one is dropped), and never a hit on a frame that already has a handover. The src is the staged path compile already uses for approved sounds (velib/sfx.py stage).
3. Default gain -14 dB for handovers and -12 dB for hits, under his voice.
4. With no style.sound, props are byte-identical (tests/ve_ingredients_test.py style test).
5. Tests: tests/ve_sound_test.py (placement, the one-frame lead, the 6-frame spacing, refusal of an unapproved id) using a temporary approved list.

Nothing here approves a sound: config/sfx-approved.json is written only from Krish's press or words. The shortlist for his ear is config/ve/sfx-candidates.json; do not edit config/sfx-approved.json.

## Contract
One signed spec. Never edit config/sfx-approved.json. Pure placement from the props and spec; no wall clock.

## Acceptance (every command must exit 0 inside your sandbox)
python3 -m unittest tests/ve_sound_test.py tests/ve_ingredients_test.py
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-gap-handover-sfx-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
