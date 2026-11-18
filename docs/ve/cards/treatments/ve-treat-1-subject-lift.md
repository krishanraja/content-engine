---
card: ve-treat-1-subject-lift
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-treat-1-subject-lift
write_allow: [scripts/velib/matte.py, tests/ve_matte_test.py, apps/renderer/src/engine/treatments/*, config/ve/treatments.json, tests/ve_treatments_test.py]
read: docs/ve/TREATMENTS.md, config/ve/treatments.json, scripts/velib/treatments.py, docs/ve/sources/effectcraft.md, config/ve/brand-tokens.json, config/brand-palette.json, apps/renderer/src/engine/devices/CONTRACT.md, scripts/velib/faceflags.py, scripts/frame_smear.py, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/houseGolden.test.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Subject lift: cut Krish out of his take and treat the background behind him

## Goal
Krish, 2026-10-17 (learning upgrade-the-edit-style): "The background of the person has also been treated when he's talking so it doesn't look too amateur." Build the subject-lift treatment from config/ve/treatments.json: the primitives subject-matte, matte-choke, exposure, gaussian-blur and rim-light, by the parameters there. EffectCraft (MIT/Apache, commit 67942cd) is the reference for behaviour and parameter names: its Roto Brush with SAM 2.1 Tiny (docs/roto-brush-sam2.md), Matte Choker, Exposure, Gaussian Blur and Glow; their parameters and behaviour are written out in docs/ve/sources/effectcraft.md (the card has no network); rebuild the behaviour, vendor no Rust.

1. scripts/velib/matte.py: make_matte(take_media, out_dir) writes <take>.matte.mp4 (8-bit grey alpha, same frame count and fps as the take) and <take>.matte.json {model, model_sha256, frames, sha256, mean_edge_confidence}. Pick the model by measured edge quality on hair and hands (use MediaPipe's segmentation, already a ve dependency through ve faces: the card may add no dependency; if its edge on hair and hands fails the smear receipt, stop and say so in matte.json and the report, naming the model you would add for Krish to approve). The matte is made once per take, offline, never inside the render. Exit 1 and write nothing when a frame has no subject.
2. apps/renderer/src/engine/treatments/SubjectLift.tsx: draws the take three times from one clock: the background plate (exposure and blur by strength), the rim glow from the matte edge in mint, then Krish over it through the matte, choked by matte-choke. Pure function of props and frame. Strength scales every parameter linearly; strength 0 draws the take unchanged byte for byte.
3. Set primitives subject-matte, matte-choke, exposure, gaussian-blur and rim-light to built: true in config/ve/treatments.json only when the acceptance below passes.

Never: move, crop, rescale or recolour Krish himself; draw the rim over his face; touch any cut that does not ask for the treatment (houseGolden.test.ts stays unchanged).

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). No Math.random, no wall clock. Colours only from config/ve/brand-tokens.json. A hand-built composite fits every plate by cover with its dimensions asserted and carries a smeared-picture receipt (scripts/frame_smear.py, F53). The matte is timed on the take's own frames, never on a transcript (F55).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python3 tests/ve_treatments_test.py
python3 tests/ve_matte_test.py
python3 scripts/velib/treatments.py check

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-treat-1-subject-lift", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
