---
card: ve-e-0-stage
kind: format_config
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-0-stage
write_allow: [apps/renderer/src/engine/props.ts, apps/renderer/src/engine/layouts/index.ts, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/engine.test.ts, apps/renderer/src/engine/layouts/stage.test.ts, packages/contracts/src/production-spec.ts, packages/contracts/src/production-spec.test.ts, scripts/velib/compile.py, scripts/velib/lint.py, scripts/velib/qc.py, config/ve/formats/hand-held-screen.json, config/ve/formats/two-passports.json, tests/ve_stage_test.py]
read: apps/renderer/src/engine/**, packages/contracts/src/production-spec.ts, scripts/velib/compile.py, scripts/velib/lint.py, scripts/velib/qc.py, config/ve/formats/*.json, config/ve/design-lock.json, docs/ve/design/TEMPLATE.md, docs/ve/ENGINE.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, changing the geometry or behaviour of the existing layouts P1 P3 P6 F1 F3, changing any existing format file
---

# STAGE layout: devices that compose the whole screen, and the two approved format ids

## Why (root cause F19)
Every beat layout today is a set of small fixed slot boxes (key content x 120-888, y 288-840) and each device is clipped to its slot. That is why proofs looked like widgets in corners. The approved formats (`hand-held-screen`, `two-passports`; see `docs/ve/design/TEMPLATE.md` and `config/ve/design-lock.json`) compose the full 1080x1920 screen: a hero object fills it and devices draw anywhere inside the lock's zones. This card adds the full-canvas layout. It changes nothing for P1, P3, P6, F1, F3.

## Contract
1. `apps/renderer/src/engine/props.ts`:
   - beat `layout` enum gains `'STAGE'`;
   - render-props `format` enum gains `'hand-held-screen'` and `'two-passports'`;
   - `EngineBeatSchema` gains optional `keyFrame: Frame` (the frame, inside the beat, that is its approved key frame; absent means 80% through the beat);
   - nothing else changes; the strict schemas still reject unknown keys.
2. `layouts/index.ts`: add `STAGE` to both tables as one full-canvas box, written in exactly the same literal syntax as the others (tall `{ left: 0, top: 0, width: 1080, height: 1920 }`, wide `{ left: 0, top: 0, width: 1920, height: 1080 }`) so `scripts/velib/qc.py::_renderer_layouts()` still parses it. `slotsFor(layout, aspect, count?)` returns, for STAGE only, `count` copies of that one box (default 1); other layouts ignore `count` and behave exactly as now. `FormatMaster.tsx` passes `beat.uses.length`. A STAGE device gets the full canvas as its `box`, so its clip is the whole frame.
3. `packages/contracts/src/production-spec.ts`: wherever the spec declares allowed beat layouts and format ids, add the same three values (`STAGE`, the two formats). Spec `schema_version` stays 2 (this is additive). Add a test that a spec with a STAGE beat and `format: "hand-held-screen"` parses, and one with `layout: "XX"` does not.
4. `config/ve/formats/hand-held-screen.json` and `two-passports.json`: mirror the keys of `config/ve/formats/voice-led-pictures.json` (read it and `compile.py` to learn which keys compile and lint need). Beats come from `config/ve/design-lock.json` `formats.<id>.beats` (five each), every beat `layout: "STAGE"`. Add `"design_lock": "<id>"`. Where the format file needs device or technique names that do not exist yet (phone_stage, plate_stage, passport_page, scribble, thread_card), list them under a clearly named key `pending_devices` and make compile/lint treat that list as: refuse to compile a spec using the format with the message `format <id> needs devices not built yet: <names>` until each name is present in `config/ve/devices.json`. That makes the format fail loudly, not silently.
5. `compile.py` / `lint.py` / `qc.py`: accept the `STAGE` layout and the two format ids without changing behaviour for existing ones. `qc.py` `_renderer_layouts()` must return a `STAGE` entry equal to the canvas.

## Tests
- `apps/renderer/src/engine/layouts/stage.test.ts` (vitest, match the style of `fit.test.ts`): STAGE tall returns the full canvas; with `count: 3` returns 3 equal boxes; the five old layouts return exactly the boxes they returned before (assert at least P1 and F1 literal values); wide STAGE is 1920x1080.
- `engine.test.ts`: a props fixture with a STAGE beat and `format: "two-passports"` validates; a beat with `keyFrame` validates; an unknown format still fails.
- `tests/ve_stage_test.py` (unittest): `_renderer_layouts()` contains STAGE equal to the canvas for both aspects; the two format JSONs load, have five beats each matching the lock, and compile refuses a spec for either with the exact message above (build the spec by copying `fixtures/ve/my-test-19s/spec.json` and changing `format`); `tests/ve_qc_modules_test.py` and the other existing ve python tests still pass.

## Acceptance (every command exits 0)
npx vitest run apps/renderer/src/engine packages/contracts
python tests/ve_stage_test.py
python tests/ve_qc_modules_test.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

(If vitest is not run that way in this repo, use the command in `package.json` scripts or `docs/ve/ENGINE.md`; report the one you used. If the sandbox cannot run vitest, run what you can and say so in open_questions.)

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-e-0-stage", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
