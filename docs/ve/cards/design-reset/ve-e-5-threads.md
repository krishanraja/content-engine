---
card: ve-e-5-threads
kind: device
format: hand-held-screen
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-5-threads
write_allow: [apps/renderer/src/engine/kit/threadPath.ts, apps/renderer/src/engine/kit/threads.test.ts, apps/renderer/src/engine/devices/thread_card/*, apps/renderer/src/engine/devices/registry.ts, config/ve/devices.json, tests/ve_threads_test.py]
read: apps/renderer/src/engine/**, docs/ve/design/formats/ref/H/build.py (f5), docs/ve/design/formats/ref/P/tools/build.py and index.template.html (thread, thread_dash, twisted), docs/ve/design/formats/H-anatomy.md, docs/ve/design/formats/P-anatomy.md, config/ve/design-lock.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, Math.random, useCurrentFrame in a device, raw hex colours, svg overflow:visible, a box or table look
---

# thread_card: threads on a time axis that bend and meet, ending in a dated call

## Why
This is mind.the.gap's own device (brand book). It carries the 3x2 result in H frame 5 (three assistant threads, flags planted at stations, one thread parted where the answer was deleted) and the gap in P frame 4 (a solid and a dashed thread meeting at a knot, then a twisted rope to the call). It replaces the rejected grid of cells: a result is never a table. Reference: `ref/H/build.py` `f5()`, `ref/P/tools/build.py` and its template (`thread`, `thread_dash`, `twisted`), and the zone tables in both anatomy files.

## Contract
1. `kit/threadPath.ts` (pure): `weave(from, to, opts)` (S-curve with a seeded hand wobble; use the mulberry32 helper from `kit/scribblePath.ts` if it exists, else write one; never `Math.random`), `twisted(x, y0, y1, phase, amp, period)` (two strands crossing, port of P `twisted`), `parted(from, to, gap)` (a thread broken around a ring, port of the H f5 DeepSeek thread), `pennant(planted, h)` (H `FLAG`/`pennant`: a planted flag on a pole, or a bare pole with a dashed ghost).
2. Device `thread_card` (STAGE slot, per `devices/CONTRACT.md`). Verbs `enter`, `mark`, `stamp`, `exit`. Params `{stations: [{id, label, x}], axis?: {y, x0, x1}, threads: [{id, name, tally?, y, style: 'solid'|'dashed', marks: [{station, state: 'planted'|'bare'|'parted'}]}], knot?: {x, y, label?}, end?: {x, y, label}, tone: 'cream'|'channel'}`.
   - `enter` draws the axis and threads on over `MOTION.slideFrames`, 3-frame stagger per thread (one `pathLength=1` dash-offset animation, like the scribble).
   - `mark` (toState `<thread>:<station>`) plants that pennant (drop 8 frames, rotate -12 to 0) or shows the parted ring.
   - `stamp` (toState `<thread>:<text>`) only records state so a `stamp` device can share the timeline; it draws nothing here.
   - With `end` set, the knot joins a labelled end dot by a twisted rope.
3. Look: threads `tokens.cream` 5 px (or `tokens.channel` when `tone` is `channel`); flags `tokens.mint`; ring and knot dots ink with a cream ring. Labels Plex Mono 30 px +0.14em UPPERCASE; names Archivo 900 stretch 112%, 34 px; tallies Anton 46 px. A failure is an absence (bare pole, parted thread), never a coral warning. No outer box, no cell borders. Everything inside x 72..960, y 150..1170 unless `at` overrides.
4. Register in `registry.ts` and `config/ve/devices.json` with exactly those four verbs. Do not edit format files.

## Tests
`threads.test.ts`: `weave` deterministic by seed and ends exactly at `to`; `twisted` strands cross; `parted` leaves a gap round its ring; `pennant` differs for planted and bare. `device.test.ts` (use the H f5 numbers: stations x 400 and 690, axis y 240 from x 72 to 946, threads y 336, 436, 536, knot (902, 436)): nothing visible before `enter`; dash offset 1 at `enter`+0 and 0 at +`slideFrames`; a `mark` plants its flag only after its frame; markup has no `<table>`, no `#` colour, no `overflow:visible`, every font size >= 30, all text inside the canvas. `tests/ve_threads_test.py`: devices.json lists `thread_card` with exactly `enter, mark, stamp, exit`; compile accepts each only for it; existing tests pass.

## Acceptance
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python tests/ve_threads_test.py
python tests/ve_qc_modules_test.py

## Return
Final message only JSON per config/ve/task-result.schema.json (`card`, `files_changed`, `commands`, `open_questions`). If vitest is blocked (EPERM) say so. Stop after two failed attempts at the same acceptance command and report it.
