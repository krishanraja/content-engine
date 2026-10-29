---
card: ve-p-6-logo-card
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-p-6-logo-card
write_allow: [apps/renderer/src/engine/devices/logo_card/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/sticker/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/moves.json, config/ve/devices.json, config/logo-registry.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w3-1-ports/ref/monday26-panels.txt, docs/ve/cards/w3-1-ports/ref/monday26-motion-engine.txt
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The logo card

## Goal
Monday 26 named its companies with their real marks: one firm's logo alone with a dated label ("DISNEY · DEC 2025"), or a row of three logos arriving one by one ("TWO BUYERS · ONE COMPANY"). Krish asked that every company discussed shows its real logo, never a typed wordmark or a stand-in.

Port it into the library device `logo_card` so a spec can draw it and no piece needs its own code for it again (config/ve/moves.json; once `logo_card` is in devices.json, scripts/ve/check_route.py bans per-piece code for this move). Source: `docs/plans/2026-10-26-monday/video/draw_panels.py (logos3, logo, pages l01 l02 l05 l09)`, excerpted verbatim in monday26-panels.txt, monday26-motion-engine.txt under docs/ve/cards/w3-1-ports/ref/ (read those; docs/plans is not yours to open). Verbs: enter, highlight, exit.

## Contract
Rules for every port (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (the source's mint, cream and ink are tokens.mint, tokens.cream, tokens.ink; its butter yellow has no token outside tokens.channel, which marks series identity only and is never a warning, so it becomes tokens.cream with ink type; say so in open_questions if the move loses meaning); type roles from `HOUSE_FONTS`; no `Math.random` (port the source's `rnd(i)` as a seeded hash), no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. No on-screen tag, mark or label that does not name a source, date or record, and no person's name. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Do not invent a look: port the move from the source named here, keeping its timing and motion, onto the house tokens.

1. `params`: `logos`: 1 to 4 `{id}` resolved through config/logo-registry.json to an asset path (refuse an id not in the registry; never draw text in place of a logo), `label?` (Plex Mono, names who and when).
2. `enter`: logos arrive one per stagger from 0.35x scale with a -6 degree settle and fade (`back`), centred as a row with equal cells; the label types on after the last.
3. `highlight` with `toState` = logo index: that logo lifts (scale 1.08) and the others dim to 40% opacity.
4. `exit`: the row slides out together.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- no logo before `enter`; logo i arrives at enter + 3i frames and settles 12 frames later at rotation 0
- every logo is an <image> whose href comes from the registry; no logo is ever rotated once settled
- after `highlight`, only the chosen logo is at full opacity
- cells are equal width; tall and wide fixtures render

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/logo_card
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py logo_card
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-p-6-logo-card", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
