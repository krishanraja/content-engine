---
card: ve-w1116-receipt
format: face-with-proof
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/claude-0/-home-user/667e7380-2542-5a2f-995b-9b8cd0eaf94c/scratchpad/userprofile\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w1116-receipt
write_allow: [apps/renderer/src/engine/devices/receipt/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/record_card/**, apps/renderer/src/engine/devices/stamp/**, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/devices.json, config/channel-safe-zones.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The receipt that prints who paid

## Goal
Week of 16 Nov. Monday 16 Nov follow.the.money, 'What a hyperscaler is and where its money comes from' (piece 8287846b; signed narrative lock docs/plans/2026-11-16-week/narrative-lock-mon.md, The fun: 'the receipt for one AI data centre printing line by line as he talks, each line who paid'). The same device carries Wednesday 18 Nov's exhibit for the case against build (docs/plans/2026-11-16-week/narrative-lock-wed.md, The fun: a tiny first line 'Writing it', then line after line of real posted costs). One object, a till receipt on a dark desk, printing as he talks. A library device any piece can use.

1. `params`: `title` (the receipt's header, short), `lines` [{`label`, `amount?`, `source?` (a short source tag shown small, e.g. 'Oracle filing, 2 Nov 2026')}], up to 8 lines, `total?` {`label`, `amount`}, `stamp?` (one short word stamped across at the end, from params only).
2. `enter`: the paper feeds up out of a slot, a short curl at the top edge, settles.
3. `print` with `toState` = line index: that line prints in, a paper-feed nudge per line (the receipt grows downward and the camera tracks it so the newest line is always readable), the earlier lines stay.
4. `highlight` with `toState` = line index: a marker-style band sweeps across that line (a mark on its own words, F41).
5. `total`: a dashed rule, then the total line prints larger.
6. `stamp`: the params stamp lands across the receipt with a small impact settle.
7. `tear`: the receipt tears off at the bottom and drops out of frame.

## Tests (`device.test.ts`, stills at frames from `fixture.json`)
- nothing drawn before `enter`; settled 12 frames after enter
- after `print` 3, exactly lines 0 to 3 are drawn and line 3 is inside the readable band on the 9:16 frame (its words at least 40 px tall, F44)
- `highlight` draws the band only on that line's own text box
- `total` draws after the last printed line; `stamp` draws no words that are not in params
- tall and wide fixtures render; no colour outside tokens

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing; colours only from `tokens` (raw hex refused); type roles from `HOUSE_FONTS`; no `Math.random`, no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately, nothing a viewer must read inside the channel-safe zones' button areas (config/channel-safe-zones.json). Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Words on it come only from params (never typed into the device), each line is real sourced text the spec gives it. The motion style a piece picks (its card's `## Motion style` section, added at dispatch) governs timing and look; build to the brand tokens and the design lock (config/ve/design-lock.json).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/receipt
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1116-receipt", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
