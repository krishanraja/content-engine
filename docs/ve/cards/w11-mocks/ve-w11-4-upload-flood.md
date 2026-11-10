---
card: ve-w11-4-upload-flood
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 70
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-4-upload-flood
write_allow: [apps/renderer/src/engine/devices/upload_flood/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/devices/leaderboard/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The upload flood: songs pour in, most are AI, almost no one listens

## Goal
Wed 11 Nov under.the.hood, piece 36886e0b, frame 13 of docs/plans/2026-11-11-wednesday/motion-mocks.md (read it). He says: 'On one of the big streaming apps, over half of the new songs uploaded every day are made with AI. And almost no one listens to them. So making a song stopped being the hard part. The hard part is getting a stranger to go looking for it.' Show a day's uploads as a grid of small song tiles pouring in like rain, the AI share hatched, a listens meter that barely moves, then one search bar.

1. `params`: `tiles` (integer 100-600, the grid size drawn), `aiShare` (0..1, from `object.dataset`, e.g. 0.5), `listensShare` (0..1, from `object.dataset`, e.g. 0.02), `query` (string, e.g. 'what is this song'), `answer` ({title, artist}). `object.dataset.producerLabel` is the source line (e.g. 'Deezer, 2026') and is always legible in Plex Mono.
2. `enter`: the empty grid frame and the source line slide in.
3. `fill`: tiles drop into the grid column by column like rain (each tile on the drop token, offset by a deterministic function of its index, the whole pour taking 36 frames). Tiles chosen deterministically by index up to `aiShare` are AI (ink with the hatch); the rest are cream with an ink outline.
4. `count_to`: a big Anton figure counts up to the AI share as a percent ('50%+' when aiShare >= 0.5 and dataset.label says so) beside the grid, with the label 'made with AI'.
5. `draw`: a listens meter (a horizontal bar under the grid) tries to fill and stops at `listensShare`; the AI tiles' little play icons flicker on and go dark one by one.
6. `type`: every tile dims to 40%; a search bar slides to centre and types `query` 2 characters a frame.
7. `pick`: one tile flies out of the grid into the search result slot and turns mint, showing `answer`.
8. `exit`.

## Golden frames
G1 mid-pour, about half the tiles in.
G2 full grid, hatched AI share visible, 50%+ counter landed.
G3 listens meter stopped near empty.
G4 search bar half-typed over the dimmed grid.
G5 the one tile landed mint in the result slot.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, fill, count_to, draw, type, pick, exit; update `verbs.test.ts`; record in `houseGolden.json` (VE_WRITE_HOUSE_GOLDEN=1) with no other entry changing. Numbers follow CONTRACT rule 5 (dataset, producerLabel, unit never changes). Draw the grid in one SVG; tile positions are a pure function of index and box.

## Tests (`device.test.ts`)
- nothing before `enter`; tile count after `fill` + 36 frames equals `tiles`
- AI tile count = round(tiles x aiShare); the meter stops at listensShare x width
- the counter shows the dataset value and producerLabel is drawn
- colours only from tokens: mint is human, AI is `ink` filled with a 45-degree hatch of `inkSoft` lines 6 px apart (one shared helper in your folder, `hatch.ts`), synth and sample are `inkSoft` solid; never raw hex
- tall (1080x1920 slot) and wide (1920x1080 stage, and the 1260x1080 stage beside his face column) fixtures render; nothing drawn outside `box`
- every golden frame named below is in `fixture.json` as a still the verifier renders

## Motion style: Living UI screencast (living-ui, untested)
The real product rebuilt or captured so the camera can zoom in and the interface can act on cue.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- captured or rebuilt from the real interface, with source label and date; never a made-up screen
- zoom to the one element that proves the words, 1.5x to 3x, eased with the utility bezier
- cursor and typing act on his words, not on a timer
- everything outside the proof dims to 40%
Never:
- a fake interface passed off as real
- scrolling a whole page with no focus
- tiny unreadable screenshots

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/upload_flood
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-4-upload-flood", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
