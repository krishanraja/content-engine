---
card: ve-card-3-test-grid
kind: device_new
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-3-test-grid
write_allow: [apps/renderer/src/engine/devices/test_grid/**, apps/renderer/src/engine/devices/registry.ts]
read: apps/renderer/src/engine/props.ts, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/devices/types.ts, apps/renderer/src/engine/devices/CONTRACT.md, fixtures/ve/my-test-19s/spec.json, apps/renderer/src/house/components.tsx
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Device test_grid: the persistent scoreboard

## Goal
Build test_grid, the hero device of the scoreboard-test format. It is a grid of rows by columns that fills on the words that name each result, keeps one unit and one denominator, and is never re-laid out.

## Contract
1. Params schema (`schema.ts`), validated against `object.params`:
   `rows[{id,label,logoSrc?}]`, `cols[{id,label}]`, `cells[{row,col,datasetLabel}]`, `answerKey: boolean`.
   - Values come from `object.dataset.rows`, matched by label.
   - Show `dataset.producerLabel` in Plex Mono under the grid, always.
2. States are driven by events through `stateAt`. The device reads `toState` and keys on the verb:
   - `enter`: the grid drops in (8 frames, ENTER); cells empty with a 2 px ink border, cream cards, square corners, hard shadow.
   - `mark`: dotted ghost ticks appear in every cell (stagger 3 frames).
   - `stamp`: the cells named in `toState` (row and column ids, comma-separated, e.g. "claude:*" or "deepseek:turkmenistan") slap in (5 frames) with a solid `tokens.mint` tick.
   - `highlight`: the named cells stay; the others go to 35% opacity; the named cell scales 1.08.
   - `carry`: hold the current state, with ambient drift only.
   - `exit`: fade out over 6 frames.
3. A cell never changes its value back. The grid's layout and the denominator never change during the object's life.
4. Author tall (inside a 768 px-wide slot) and wide (inside a 1100 px-wide slot) separately. Column heads and row labels are Plex Mono, at least 32 px tall.
5. Register `test_grid` in `registry.ts` (one line).
6. `device.test.ts` drives the pure state function with fixture events. It checks:
   - no tick before its stamp frame;
   - a tick 6 frames after it;
   - the ghost ticks only after `mark`;
   - the same cell count at every frame.

## Acceptance (every command must exit 0 inside your sandbox)
Sandbox note: your sandbox may not reach node_modules, so `npx tsc` or `vitest` may not start. If so, do not install anything, do not change config and do not retry: write the code carefully to the contract, check it by reading, and say so in open_questions. Claude runs every acceptance command outside the sandbox.

npx tsc --noEmit
npx vitest run apps/renderer/src/engine/devices/test_grid

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-3-test-grid", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
