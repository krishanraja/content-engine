---
card: ve-p-4-chip-transfer
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-p-4-chip-transfer
write_allow: [apps/renderer/src/engine/devices/chip_transfer/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/query_chip/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/moves.json, config/ve/devices.json, config/logo-registry.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w3-1-ports/ref/monday26-panels.txt, docs/ve/cards/w3-1-ports/ref/monday26-motion-engine.txt
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The chip transfer

## Goal
Monday 26 showed who got what as company cards: the firm's card (its real logo and a tag such as "IN CHAPTER 11") holds labelled chips (THE PEOPLE, THE CODE, THE LAWSUITS); on the turn, chips fly along a curve to the buyer's card, and what is left behind stays as a dashed empty slot.

Port it into the library device `chip_transfer` so a spec can draw it and no piece needs its own code for it again (config/ve/moves.json; once `chip_transfer` is in devices.json, scripts/ve/check_route.py bans per-piece code for this move). Source: `docs/plans/2026-10-26-monday/video/draw_panels.py (box, money_map) and motion.py (GENERIC: .chip with prevRects)`, excerpted verbatim in monday26-panels.txt, monday26-motion-engine.txt under docs/ve/cards/w3-1-ports/ref/ (read those; docs/plans is not yours to open). Verbs: enter, move, exit.

## Contract
Rules for every port (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (the source's mint, cream and ink are tokens.mint, tokens.cream, tokens.ink; its butter yellow has no token outside tokens.channel, which marks series identity only and is never a warning, so it becomes tokens.cream with ink type; say so in open_questions if the move loses meaning); type roles from `HOUSE_FONTS`; no `Math.random` (port the source's `rnd(i)` as a seeded hash), no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. No on-screen tag, mark or label that does not name a source, date or record, and no person's name. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Do not invent a look: port the move from the source named here, keeping its timing and motion, onto the house tokens.

1. `params`: `from` and `to`: `{logo, tag?}` (logo is an asset path from config/logo-registry.json, drawn as an image, never rotated or retyped), `chips`: `{label, moves: bool}`.
2. `enter`: the from-card slides in 220 px with a -4 degree settle, the to-card follows by a stagger, chips pop in one per 6 frames (`back`, scale 0.55->1).
3. `move`: every chip with `moves` flies to the to-card along a quadratic curve over 24 frames (`io` ease, a -9 degree turn that settles), in stagger order; its old place becomes a dashed empty slot. Chips that stay dim.
4. `exit`: both cards leave together.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- no chip before `enter`; every chip visible 30 frames after it
- a moving chip is on the from-card at the `move` frame, strictly between at +12, on the to-card at +24
- a staying chip never moves; the dashed slot appears where a chip left
- logos are <image> elements with no rotation; tall and wide fixtures render

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/chip_transfer
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py chip_transfer
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-p-4-chip-transfer", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
