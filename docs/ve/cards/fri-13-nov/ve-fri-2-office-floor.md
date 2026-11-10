---
card: ve-fri-2-office-floor
format: face-with-proof
motion_style: isometric-world
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /tmp/claude-0/-home-user-content-engine/a2b398ec-48c8-57a1-bbe0-b1078b2b5a2c/scratchpad/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-2-office-floor
write_allow: [apps/renderer/src/engine/devices/office_floor/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/leaderboard/**, apps/renderer/src/engine/devices/cursor_buddy/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/design-lock.json, config/ve/devices.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The office floor: staff climbing an AI-use tower

## Goal
Fri 13 Nov 'Counting rat tails' (docs/plans/2026-11-09-week/fri-storyboard.md). A miniature isometric office shows, step by step, how staff game an AI-use leaderboard. It enters from a 1902 rat-farm shot on the same grid, so crates become desks.

1. `params`: `figures` (3-8 of {id, label?}), `towerLabel`, `fromCrates?` (bool), `target?` (0..1).
2. `enter`: tiles drop in one at a time; with fromCrates, crates sit on the tiles first and morph into desks.
3. `add` toState=id: that figure drops in at its desk.
4. `fill` toState={id,to}: coins arc from the desk into the central tower; its meter fills to `to`.
5. `move` toState={id,rank}: its marker climbs the tower to that rank.
6. `send` toState=id: three agent robots appear on a treadmill by the desk, running laps going nowhere, coins streaming.
7. `stamp` toState={id,text}: a pill badge lands on the tower top (TOKEN LEGEND).
8. `carry` toState=id: the figure ships a box, a small bell rings (visual), its marker does not move.
9. `highlight` toState=id: that figure takes mint; others dim.
10. `draw` toState=to: the tower's target line moves to `to`; coin streams above it stop.
11. `mark`: the tower topples onto the floor.
12. `exit`: tiles lift away.

## Tests (`device.test.ts`, stills from `fixture.json`)
- nothing before `enter`; a figure only after its `add`
- after `move`, marker order matches ranks; `carry` never moves a marker
- `send` draws 3 agents; `draw` moves the target line; `mark` topples the tower
- colours only from tokens: coral for counted coins, mint for real work; tall (upper half) and wide (left two thirds) render

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, add, fill, move, send, stamp, carry, highlight, draw, mark, exit; update `verbs.test.ts`; record the device in `houseGolden.json` (VE_WRITE_HOUSE_GOLDEN=1) with no other entry changing. Draw in SVG: true isometric (30 degree) tiles on one grid, one light direction, flat house fills, a soft floor shadow; figures are simple rounded people, never a real brand or person. Motion: drops use the drop token, one actor at a time; coins arc on an ease. Never draw outside the box; his face stays clear. Legible at phone size.

## Motion style: Isometric miniature world (isometric-world, untested)
A small diorama builds block by block so a whole system with parts can be seen at once.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- orthographic camera at true isometric angles; tiles on one grid
- blocks drop in with the drop token, one actor at a time, in the order he names them
- flat brand fills with one light direction; the part that matters is mint
- labels float as Plex Mono tags pinned to their block
Never:
- a busy city with no focus
- cute characters
- camera spinning around the model

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/office_floor
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-2-office-floor", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
