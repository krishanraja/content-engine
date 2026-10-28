---
card: ve-e-7-wire-h
kind: format_config
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-7-wire-h
write_allow: [scripts/velib/compile.py, scripts/velib/render.py, scripts/velib/lint.py, apps/renderer/scripts/ve-render.mjs, apps/renderer/src/Root.tsx, apps/renderer/src/engine/*.ts, apps/renderer/src/engine/*.tsx, config/ve/formats/hand-held-screen.json, fixtures/ve/hand-held-screen/*, tests/ve_wire_h_test.py, docs/ve/design/formats/H-wiring.md]
read: scripts/velib/compile.py, scripts/velib/render.py, apps/renderer/scripts/ve-render.mjs, apps/renderer/src/engine/**, fixtures/ve/my-test-19s/**, config/ve/formats/*.json, config/ve/design-lock.json, config/ve/devices.json, docs/ve/design/formats/H-anatomy.md, docs/ve/design/formats/H-motion.md, docs/ve/ENGINE.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, editing assets/ or the design lock, raw hex colours, redrawing or retyping the real recording
---

# Wire format H end to end: spec, compile, render staging

## Why
All devices for format `hand-held-screen` now exist (`hand_phone_stage`, `headline`, `sticker`, `scribble`, `stamp`, `stat_strip`, `marquee`, `thread_card`; layout `STAGE`; plates in `assets/plates/hand-held-screen/`). Nothing yet turns a spec into a render of this format: compile refuses plates and passes no device params, and the renderer does not stage the plates. Make one spec reproduce the five approved frames' content on the existing 19.5 s test story.

## Contract
1. `compile.py`: a STAGE beat compiles; each spec object's `params` reach the engine object unchanged (validate with the device's `schema.ts` shape if the repo already does so for other devices; follow it). Plate-backed objects (`hand_phone_stage`) are allowed when the plate sidecar `assets/plates/<format>/plates.json` exists; the `asset plates arrive in Phase 2` refusal stays for any other plate source. A plate on screen must produce an `illustrationLabels` entry covering the beat, so the ILLUSTRATION tag shows (read how `BrandFrame`/`IllustrationLabel` consume it).
2. Render staging (`ve-render.mjs`, `render.py`, `Root.tsx` as needed): copy `assets/plates/<format>/**` and the recording into the bundle's public dir the same way the existing brand images and recording are staged, and make the device's plate loading resolve to those files (see how `kit/` and `hand_phone_stage` load images and reconcile; do not change the device's public params). A missing plate fails the render loudly.
3. `fixtures/ve/hand-held-screen/spec.json` (+ its words file if the test story's words file is not reusable as is): a schema_version 2 spec for format `hand-held-screen`, one tall cut, reusing the `my-test-19s` audio, words, recording and brief. Beats named exactly `open, result_a, result_b, evidence, verdict` (the lock's names), each `layout: STAGE`, each with a `keyFrame` set 80% through the beat. Objects: one `hand_phone_stage` (five cameras from `config/ve/formats/hand-held-screen.json`, `fill` events: prompt, cards, cards, footage, bubble; `move` at each beat start); per beat a `headline`, `sticker`s as `H-anatomy.md` section 4 lists, ONE `scribble` (shapes and targets from `H-motion.md`: loop, tall loop, arrow, underline, loop), a `stat_strip` in open and verdict, a `stamp` ANSWER DELETED with leader in verdict, the `thread_card` in verdict, a `marquee`. Copy comes from the approved frames (British spelling, no em dashes, no exclamation marks); events fire on the word cues in `H-motion.md`. Scribble targets: use the approved frame coordinates in `H-anatomy.md`/`ref/H/build.py` through `Screen.u2c`; where a target depends on the camera, compute it once at authoring time and record it as plain numbers.
4. Lint must be clean on the spec (one scribble per beat; beat ids equal the lock's) and compile must produce props that validate against `EngineRenderPropsSchema`.
5. `docs/ve/design/formats/H-wiring.md` (under 3 KB): the object list per beat, the cue words, where each number came from, and the exact `ve lint|compile|render|qc` commands for the proof.

## Tests: `tests/ve_wire_h_test.py` (unittest)
The spec lints clean with no legacy note; compile produces props whose beats equal the lock's names and layouts are all STAGE; `params` survive compile; an `illustrationLabels` entry covers every beat; each beat has exactly one scribble object in use; every device named in the spec is in `config/ve/devices.json` and every verb used is allowed for it; every event frame lies inside its beat; the props validate (use the same TS or JSON-schema route the other compile tests use); existing ve tests pass.

## Acceptance
python tests/ve_wire_h_test.py
python tests/ve_compile_test.py
python tests/ve_stage_test.py
python scripts/ve.py lint fixtures/ve/hand-held-screen/spec.json
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Final message only JSON per config/ve/task-result.schema.json (`card`, `files_changed`, `commands`, `open_questions`). You cannot run Chromium here: do not try to render; Claude renders. Stop after two failed attempts at the same acceptance command and report it.
