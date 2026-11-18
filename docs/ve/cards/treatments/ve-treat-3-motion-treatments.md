---
card: ve-treat-3-motion-treatments
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-treat-3-motion-treatments
write_allow: [apps/renderer/src/engine/props.ts, apps/renderer/src/engine/treatments/*, apps/renderer/src/engine/FormatMaster.tsx, scripts/velib/compile.py, tests/ve_ingredients_test.py, tests/ve_treatments_test.py, config/ve/treatments.json]
read: docs/ve/TREATMENTS.md, config/ve/treatments.json, scripts/velib/treatments.py, docs/ve/sources/effectcraft.md, config/ve/brand-tokens.json, config/brand-palette.json, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/kit/ingredients.ts, apps/renderer/src/engine/houseGolden.test.ts, docs/ve/INGREDIENTS.md, docs/ve/MOTION_STANDARD.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Motion treatments: draw the planned treatments on each beat, and only the built ones

## Goal
Draw the video treatments velib/treatments.py plans (hook-hit, number-glow, receipt-paper, pivot-split, payoff-glow) in the renderer, and carry the plan into the props. Build after ve-treat-1 and ve-treat-2 have merged. EffectCraft (MIT/Apache, commit 67942cd) is the reference for Shift Channels, Glow, Light Sweep and CC Vignette; docs/ve/sources/effectcraft.md writes out what is needed.

1. apps/renderer/src/engine/props.ts: an optional treatments field, per beat id a list of {treatment, strength}. Absent means none and the cut draws exactly as before (houseGolden.test.ts unchanged).
2. scripts/velib/compile.py: fill props.treatments from velib.treatments.plan_cut, keeping only entries with drawable true. A spec with style.treatments "off" or no built primitives compiles to the props it always did (extend tests/ve_ingredients_test.py).
3. apps/renderer/src/engine/treatments/: one component per primitive (channel-split, glow, highlight-sweep, vignette, grain), on the graphics layer only; the primitives in limits.never_on_face never touch his take. Each is timed from the beat's own frames and its device events, at the strength given.
4. Set channel-split and vignette to built: true in config/ve/treatments.json only when the acceptance passes, then run ve lab render and ve lab diff against the last lab folder: the house look must not move.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props and frame. A still and a render agree frame for frame. Never more than limits.max_treatments_per_beat on a beat.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python3 tests/ve_treatments_test.py
python3 tests/ve_ingredients_test.py
python3 scripts/velib/treatments.py check

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-treat-3-motion-treatments", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
