---
card: ve-p-1-statement-wall
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-p-1-statement-wall
write_allow: [apps/renderer/src/engine/devices/statement_wall/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/headline/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/moves.json, config/ve/devices.json, config/logo-registry.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w3-1-ports/ref/monday26-opener.txt, docs/ve/cards/w3-1-ports/ref/monday26-motion-engine.txt
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The statement wall

## Goal
Monday 26 opened on a statement: a wall of chat tiles pops in from the centre outwards, a headline slams in word by word over a vignette ("MILLIONS MADE FRIENDS HERE."), and on the turn the wall greys, falls tile by tile and clears. Krish asked for a motion-designed, headline-grabbing first frame, never a quiet title.

Port it into the library device `statement_wall` so a spec can draw it and no piece needs its own code for it again (config/ve/moves.json; once `statement_wall` is in devices.json, scripts/ve/check_route.py bans per-piece code for this move). Source: `docs/plans/2026-10-26-monday/video/motion.py (OPENER and OPEN_CSS: tiles, words, the fall)`, excerpted verbatim in monday26-opener.txt, monday26-motion-engine.txt under docs/ve/cards/w3-1-ports/ref/ (read those; docs/plans is not yours to open). Verbs: enter, mark, exit.

## Contract
Rules for every port (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (the source's mint, cream and ink are tokens.mint, tokens.cream, tokens.ink; its butter yellow has no token outside tokens.channel, which marks series identity only and is never a warning, so it becomes tokens.cream with ink type; say so in open_questions if the move loses meaning); type roles from `HOUSE_FONTS`; no `Math.random` (port the source's `rnd(i)` as a seeded hash), no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. No on-screen tag, mark or label that does not name a source, date or record, and no person's name. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Do not invent a look: port the move from the source named here, keeping its timing and motion, onto the house tokens.

1. `params`: `cols`, `rows` (per aspect: 6x6 tall, 9x7 wide as the source), `phrases`: list of `{words: string[], accent: number[]}` (accent words in tokens.mint), `seed`.
2. `enter`: tiles pop in staggered by distance from centre (`back` ease, scale 0.5->1), the headline phrase's words slam in one per stagger (from 1.5x scale and -70 px, blur to sharp). Tiles keep a gentle drift and a live dot.
3. `mark` with `toState` = phrase index: the current phrase leaves (blur out) and that phrase slams in.
4. `exit`: the wall greys and darkens over 15 frames, about 60% of tiles fall with gravity and spin (seeded), the rest fade; the headline goes with them. Nothing redraws between events.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- no tile before `enter`; all tiles at full scale 24 frames after it; tile order follows distance from centre
- each headline word appears at its stagger and is sharp 12 frames later; accent words use tokens.mint
- after `exit` + 40 frames, no tile is inside the box; the same seed gives the same fall
- tall and wide fixtures both render and fill at least 80% of the box

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/statement_wall
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py statement_wall
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-p-1-statement-wall", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
