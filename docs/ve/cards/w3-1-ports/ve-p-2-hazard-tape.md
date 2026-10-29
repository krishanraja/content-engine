---
card: ve-p-2-hazard-tape
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-p-2-hazard-tape
write_allow: [apps/renderer/src/engine/devices/hazard_tape/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/stamp/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/moves.json, config/ve/devices.json, config/logo-registry.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w3-1-ports/ref/monday26-opener.txt, docs/ve/cards/w3-1-ports/ref/monday26-motion-engine.txt
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The hazard-tape slam

## Goal
On the word "bust" Monday 26 slammed two striped hazard tapes across the frame from opposite sides (tilted -6 and 3.5 degrees), one in Anton ("CHAPTER 11"), one in Plex Mono with the dated source ("FILED 12 OCT 2026 · COURT FILING"), their text crawling, with a white flash and a short camera shake.

Port it into the library device `hazard_tape` so a spec can draw it and no piece needs its own code for it again (config/ve/moves.json; once `hazard_tape` is in devices.json, scripts/ve/check_route.py bans per-piece code for this move). Source: `docs/plans/2026-10-26-monday/video/motion.py (OPENER: #t1 #t2 tape, flash, shake)`, excerpted verbatim in monday26-opener.txt, monday26-motion-engine.txt under docs/ve/cards/w3-1-ports/ref/ (read those; docs/plans is not yours to open). Verbs: stamp, exit.

## Contract
Rules for every port (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (the source's mint, cream and ink are tokens.mint, tokens.cream, tokens.ink; its butter yellow has no token outside tokens.channel, which marks series identity only and is never a warning, so it becomes tokens.cream with ink type; say so in open_questions if the move loses meaning); type roles from `HOUSE_FONTS`; no `Math.random` (port the source's `rnd(i)` as a seeded hash), no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. No on-screen tag, mark or label that does not name a source, date or record, and no person's name. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Do not invent a look: port the move from the source named here, keeping its timing and motion, onto the house tokens.

1. `params`: `tapes`: one or two `{text, role: "headline"|"source", tiltDeg (-8..8), y (0..1 of the box), from: "left"|"right"}`; the source tape text must name a source or date.
2. `stamp`: each tape slides in across 1.6x the box width with a `back` ease (second tape 3 frames later), a flash peaks at about 0.85 opacity for 3 frames and the device shakes up to 16 px for 15 frames (a deterministic shake from the event frame). The text crawls at a constant speed and loops seamlessly.
3. The tape is tokens.cream with ink type and ink chevron edges (two 14 px bands of 45 degree stripes, drawn as SVG patterns, no CSS gradients with hex).
4. `exit`: the tapes slide off the way they came over 6 frames.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- nothing before `stamp`; both tapes fully across the box 12 frames after it; the second lags the first by 3
- flash opacity peaks within 3 frames of `stamp` and is 0 by 9; shake is 0 by 15 frames
- the crawl offset at frame f+1 minus f is constant; text never leaves the tape
- tilts stay within [-8, 8]; tall and wide fixtures render

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/hazard_tape
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py hazard_tape
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-p-2-hazard-tape", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
