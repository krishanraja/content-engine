---
card: ve-p-3-receipt-print
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-p-3-receipt-print
write_allow: [apps/renderer/src/engine/devices/receipt_print/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/record_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/moves.json, config/ve/devices.json, config/logo-registry.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w3-1-ports/ref/monday26-panels.txt, docs/ve/cards/w3-1-ports/ref/monday26-motion-engine.txt
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The printing receipt with count-up

## Goal
Monday 26 showed deals as till receipts: torn-edged paper rises in, its header and rules draw, its priced lines print one at a time, the total counts up from 0 under a mint highlight, and a VOID can slam on a deal that died.

Port it into the library device `receipt_print` so a spec can draw it and no piece needs its own code for it again (config/ve/moves.json; once `receipt_print` is in devices.json, scripts/ve/check_route.py bans per-piece code for this move). Source: `docs/plans/2026-10-26-monday/video/draw_panels.py (receipt, void, torn) and motion.py (GENERIC: .receipt, count)`, excerpted verbatim in monday26-panels.txt, monday26-motion-engine.txt under docs/ve/cards/w3-1-ports/ref/ (read those; docs/plans is not yours to open). Verbs: enter, fill, count_to, stamp, exit.

## Contract
Rules for every port (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (the source's mint, cream and ink are tokens.mint, tokens.cream, tokens.ink; its butter yellow has no token outside tokens.channel, which marks series identity only and is never a warning, so it becomes tokens.cream with ink type; say so in open_questions if the move loses meaning); type roles from `HOUSE_FONTS`; no `Math.random` (port the source's `rnd(i)` as a seeded hash), no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. No on-screen tag, mark or label that does not name a source, date or record, and no person's name. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Do not invent a look: port the move from the source named here, keeping its timing and motion, onto the house tokens.

1. `params`: `header`, `lines`: `{left, right?, total?: bool, subs?: string[]}`, `footer` (the source, required), `void?: string`. Numbers come from `object.dataset` (rows feed the priced lines; `producerLabel` is shown in the footer); `unit` and `denominator` never change.
2. `enter`: the paper rises 520 px with a 9 degree settle (`back`), header then rules draw left to right. The paper keeps its full length from the start so it never jumps.
3. `fill` with `toState` = n: lines up to n print, each sliding 46 px from the left, subs following.
4. `count_to`: the total counts from 0 to its dataset value over 28 frames (`out` ease), formatted as the source does (commas, decimals, prefix and suffix), and its mint highlight grows behind it.
5. `stamp`: the VOID text slams from 3.6x scale and -26 degrees in 5 frames. `exit` drops the paper.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- the paper height is the same at every frame; no line before its `fill`
- the total reads 0 or its prefix at the `count_to` frame and the exact dataset value 28 frames later, never above
- producerLabel is visible whenever the total is; VOID absent before `stamp`
- torn edge drawn as an SVG path; tall and wide fixtures render

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/receipt_print
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py receipt_print
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-p-3-receipt-print", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
