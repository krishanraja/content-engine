---
card: ve-e-1-scribble
kind: device
format: hand-held-screen
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-1-scribble
write_allow: [apps/renderer/src/engine/kit/*, apps/renderer/src/engine/devices/scribble/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/props.ts, packages/contracts/src/production-spec.ts, config/ve/devices.json, scripts/velib/compile.py, scripts/velib/lint.py, tests/ve_scribble_test.py]
read: apps/renderer/src/engine/**, docs/ve/design/formats/ref/H/build.py, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/devices.json, packages/contracts/src/production-spec.ts, scripts/velib/compile.py, scripts/velib/lint.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, Math.random, useCurrentFrame inside a device, raw hex colours in a device, overflow:visible on an svg
---

# The scribble: Krish's annotation language as an engine device

## Why
Krish's direction (28 Oct 2026): "lots of motion and hand-drawn scribbles pointing to the most important thing on the screen in any one go." Each beat has exactly one scribble (loop, underline, arrow, bracket, tick or cross), 8 px stroke in cream or mint over a 16 px ink keyline, hand-wobbled, drawn on over about 10 frames as a single `pathLength=1` dash-offset animation. The approved frames' generators are in `docs/ve/design/formats/ref/H/build.py` (`scribble_loop`, `scribble_line`, `scribble_arrow`, `scribble_bracket`, `_smooth`, `scribble_svg`). Port them; do not invent new shapes.

## Contract
1. `kit/lock.ts`: constants copied from `config/ve/design-lock.json` (`scribble.stroke_px` 8, `keyline_px` 16, `draw_on_frames` 10, zone rectangles, thresholds you need). `kit.test.ts` reads the JSON with `fs` and asserts every constant equals it, so the two cannot drift.
2. `kit/scribblePath.ts` (pure, no DOM): `scribblePath(spec, seed) -> string` returns an SVG path `d` for `{shape: 'loop'|'underline'|'arrow'|'bracket'|'tick'|'cross', ...}`; a seeded PRNG (mulberry32 on a string hash) replaces Python's `random`, so the same seed gives the same path and no `Math.random` exists anywhere. Shapes: `loop` `{cx, cy, u:[x,y], v:[x,y], turns=1.16, sq=2}` (port of `scribble_loop`; `u`,`v` are half-axis vectors so a loop can follow a perspective-skewed rectangle); `underline` `{from:[x,y], to:[x,y], amp=7, double=true}`; `arrow` `{from, to, bend=60, head=46}`; `bracket` `{x, y0, y1, depth=44, side=1}`; `tick` and `cross` `{cx, cy, size}` (a hand-wobbled check mark, and two crossing strokes drawn as one path). Convenience: a `target: {x,y,w,h}` may stand in for loop (centre, `u=(w*0.55,0)`, `v=(0,h*0.55)`) and underline (the bottom edge, 10 px below).
3. `kit/Scribble.tsx`: `<Scribble d colour tokens sinceFrames exiting? />` renders one `<svg>` of exactly 1080x1920 (the canvas, `viewBox` same, NO `overflow:visible`: it hangs headless Chromium) with two `<path pathLength="1" fill="none" stroke-linecap="round" stroke-linejoin="round" strokeDasharray=1>`: the keyline (`tokens.ink`, 16 px) then the stroke (`tokens.cream` or `tokens.mint`, 8 px). `strokeDashoffset = 1 - progress(sinceFrames, 10, ENTER)`; on exit it fades over `MOTION.exitFrames`. Pure function of its props.
4. Device `scribble` in `devices/scribble/` per `devices/CONTRACT.md`: `schema.ts` (zod; `shape`, the shape's fields, `colour: 'cream'|'mint'`, `seed: string`, and optional `perspective: {u:[x,y], v:[x,y]}` for loops), `state.ts`, `index.tsx` (reads `stateAt(events, object.obj, frame)`; draws nothing before the first `draw` event), `fixture.json`, `device.test.ts`. The layout slot is the full canvas (layout `STAGE` exists since card ve-e-0; if it is not on your branch yet, test the device with a fabricated full-canvas `box`).
5. Verb `draw` (enters the scribble) and `exit`. Add `draw` to the verb enums in `props.ts` and `packages/contracts/src/production-spec.ts` (additive), register the device in `devices/registry.ts`, add `"scribble": { "verbs": ["draw", "exit"] }` to `config/ve/devices.json`, make `compile.py` accept `draw` only for devices that list it, and make `lint.py` allow a scribble object's first event to be `draw` (read lint's first-event rule and change nothing else). Update `verbs.test.ts`.
6. Lint (new, in `lint.py`): in a beat of a locked format, at most one `scribble` object may be used (`scribbles_per_beat`); more is a finding `beat <id> uses <n> scribbles, the design lock allows 1`. A beat with none is allowed (some beats are only a stamp).

## Tests
- `scribblePath`: same seed same `d`, another seed another `d`; every shape starts with `M`; loop points stay within the target grown 25%; underline within 20 px of its line; arrow ends at `to` with a head; a loop overshoots its start; no `NaN`.
- `Scribble`/device: dash offset 1 at `sinceFrames` 0, 0 at 10, strictly between at 5, never outside [0,1]; stroke 8, keyline 16 drawn first; colours from tokens only (no `#` in output); no `overflow` in the markup; nothing renders before the first `draw`; after `exit` it fades to zero.
- `tests/ve_scribble_test.py`: compile accepts `draw` on a scribble, refuses `count_to` on it and `draw` on `test_grid`; lint flags two scribbles in a locked-format beat. Existing tests still pass.

## Acceptance (every command exits 0)
npx vitest run apps/renderer/src/engine
python tests/ve_scribble_test.py
python tests/ve_qc_modules_test.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

(Use the repo's vitest invocation if different and report it. If the sandbox cannot run vitest, say so in open_questions.)

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-e-1-scribble", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
