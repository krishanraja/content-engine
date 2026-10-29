---
card: ve-p-5-ringed-recording
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-p-5-ringed-recording
write_allow: [apps/renderer/src/engine/devices/ringed_recording/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/hand_phone_stage/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/moves.json, config/ve/devices.json, config/logo-registry.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w3-1-ports/ref/monday26-whatitis.txt, docs/ve/cards/w3-1-ports/ref/monday26-panels.txt
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The ringed screen recording

## Goal
Monday 26 explained the product with his own screen recording of its home page: the frame pushes in on the row that matters, and hand-drawn rings land one after another on the words that carry the point ("Psychologist", "Ella - dating coach", "79.1m"). The recording is evidence: it is never enlarged past its pixels or retyped.

Port it into the library device `ringed_recording` so a spec can draw it and no piece needs its own code for it again (config/ve/moves.json; once `ringed_recording` is in devices.json, scripts/ve/check_route.py bans per-piece code for this move). Source: `docs/plans/2026-10-26-monday/video/whatitis.py (SCHED, ring_points, the push) and draw_panels.py (spotlight)`, excerpted verbatim in monday26-whatitis.txt, monday26-panels.txt under docs/ve/cards/w3-1-ports/ref/ (read those; docs/plans is not yours to open). Verbs: enter, move, mark, exit.

## Contract
Rules for every port (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (the source's mint, cream and ink are tokens.mint, tokens.cream, tokens.ink; its butter yellow has no token outside tokens.channel, which marks series identity only and is never a warning, so it becomes tokens.cream with ink type; say so in open_questions if the move loses meaning); type roles from `HOUSE_FONTS`; no `Math.random` (port the source's `rnd(i)` as a seeded hash), no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. No on-screen tag, mark or label that does not name a source, date or record, and no person's name. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Do not invent a look: port the move from the source named here, keeping its timing and motion, onto the house tokens.

1. `params`: `src` (a footage asset path, as evidence_card and hand_phone_stage take media), `sourceLabel` (names the recording and its date), `crop`: the first frame's visible region, `push`: `{to: {x, y, w, h}}` in source pixels, `rings`: `{x, y, rx, ry, rotDeg, seed}` in source pixels.
2. `enter`: the recording appears at `crop`; `move`: it pushes in to `push.to` over 24 frames (`io`).
3. `mark` with `toState` = ring index: that ring draws on over 10 frames using `kit/scribblePath.ts` loops (the lock's stroke and keyline), mapped from source to box pixels through the current push, so rings stay on their words while the frame moves.
4. Never scale the recording above 1:1 source pixels (refuse in the schema if `push.to` would); `sourceLabel` stays visible. `exit` fades.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- before `move` the crop is unchanged; at +24 it equals `push.to`; scale never exceeds 1.0 source pixel per pixel
- ring i absent before its `mark`, fully drawn 10 frames after; drawn rings track their target through the push
- sourceLabel visible from `enter` to `exit`; tall and wide fixtures render

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/ringed_recording
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py ringed_recording
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-p-5-ringed-recording", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
