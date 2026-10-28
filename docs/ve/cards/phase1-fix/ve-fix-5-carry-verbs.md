---
card: ve-fix-5-carry-verbs
kind: device_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-5-carry-verbs
write_allow: [apps/renderer/src/engine/devices/test_grid/state.ts, apps/renderer/src/engine/devices/test_grid/index.tsx, apps/renderer/src/engine/devices/test_grid/device.test.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json, scripts/velib/compile.py, tests/ve_compile_test.py]
read: apps/renderer/src/engine/devices/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, scripts/velib/compile.py, tests/ve_compile_test.py, fixtures/ve/my-test-19s/spec.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, changes to any device other than test_grid
---

# test_grid draws `carry`; devices declare their verbs; compile refuses undrawn verbs

## Evidence
Cue b5-every-3 is `{obj: grid, verb: carry, to_state: "card shrinks back into its cell: ANSWER DELETED in hollow mono"}`. test_grid's state.ts handles `carry` as a no-op comment, so nothing is drawn and the QC cue check fails. Nothing stops a spec from using a verb a device ignores.

## Part A: test_grid draws `carry`
In `testGridStateAt` (state.ts) and `TestGrid` (index.tsx):
1. After the first `carry` event fires, every cell in the current highlight selection (the last `highlight` event before the carry) that is **not stamped** becomes a *carried* cell. If nothing is highlighted, carry applies to no cell and nothing is drawn.
2. A carried cell shows the text `ANSWER DELETED` in `HOUSE_FONTS.data`, **hollow**: `color: transparent`, `WebkitTextStroke: ${2 * layout.scale}px ${tokens.ink}`, no fill. Font size is `min(30 * layout.scale, cell.height * 0.3, cell.width / (text length * 0.62))` so the text fits on one line inside the cell.
3. Animation: a dashed outline rectangle (2px, `tokens.ink`) in the cell shrinks from scale 2.4 to 1 over `MOTION.dropFrames` with the `ENTER` easing (`progress(sinceFrames, MOTION.dropFrames, ENTER)`), fading in as it shrinks. The text opacity is the same progress. State must be pure and seekable: a function of `frame` only.
4. State fields per cell: `carried: boolean`, `carryProgress: number` (0..1). The DOM cell gets `data-carry="true"` while carried, and its `aria-label` becomes `${row label}, ${col label}: ANSWER DELETED`.
5. Cells that are carried keep opacity 1 and scale 1; non-highlighted cells keep their 0.35 dim. Stamped cells never change.
6. `exit` after carry still fades the whole device.

Add tests to device.test.ts: carried cell is exactly the highlighted unstamped one (use rows claude, chatgpt, deepseek with deepseek:xinjiang highlighted and unstamped), `carryProgress` is 0 at the carry frame, 1 after `MOTION.dropFrames`, monotonic in between, and 0 for every cell before the carry. A carry with no highlight carries nothing.

## Part B: devices declare their verbs
1. New file `config/ve/devices.json`: `{"devices": {"<device id>": {"verbs": [...]}}}` for exactly the ids in `apps/renderer/src/engine/devices/registry.ts`. List a verb for a device **only if its state code reads that verb** (read each device's `state.ts`/`index.tsx`). `exit` counts when the device reads it or its visibility logic does. Never list a verb the device ignores. test_grid gets enter, mark, stamp, highlight, carry, exit.
2. New `apps/renderer/src/engine/devices/verbs.test.ts`: the keys of devices.json equal the keys of `DEVICES` in registry.ts; every verb is a member of the verb enum in `props.ts`.
3. `scripts/velib/compile.py`: for each compiled event, look up the event's object, then its device, then devices.json. A verb not in that list raises `ValueError` naming the event id (`<beat>-<index>`), object, device and verb, so compile writes no output. A device missing from devices.json is also refused by name.
4. `tests/ve_compile_test.py`: a case where a spec uses `carry` on a `query_chip`, which is refused with the names above; the existing fixture still compiles cleanly.

## Acceptance (every command exits 0; if the sandbox cannot reach node_modules say so in open_questions and Claude re-runs them)
npx tsc --noEmit
npx vitest run apps/renderer/src/engine/devices
python tests/ve_compile_test.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-5-carry-verbs", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
