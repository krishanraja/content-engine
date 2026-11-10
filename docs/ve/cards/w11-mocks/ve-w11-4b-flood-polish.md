---
card: ve-w11-4b-flood-polish
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 50
max_calls: 70
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-4b-flood-polish
write_allow: [apps/renderer/src/engine/devices/upload_flood/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/upload_flood/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/design-lock.json, config/ve/brand-tokens.json, docs/plans/2026-11-11-wednesday/motion-mocks.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Upload flood, round 2: a real flood of songs, scattered AI, true answer

## Goal
Round 2 of ve-w11-4-upload-flood (built; reviewed 10 Nov). Keep the verbs; fix the look and the fixture.
1. The grid fills the box (inside 6% margins) with the counter overlaid top-right on a cream card, not beside a small grid. Tiles are song tiles: a rounded square cover (4 px radius) with a tiny play triangle; 300 tiles on wide, 360 on tall.
2. AI tiles are scattered, not a block: tile i is AI when hash(i) < aiShare, with hash a fixed integer mix of i (deterministic). AI tiles are ink with the cream 30% hatch; others are cream with a thin ink outline and a small mint dot.
3. The pour reads as rain: tiles fall from above the box with a little rotation that settles to 0, 4 columns at a time.
4. Listens meter: a cream track with an ink outline, the fill mint, stopping at listensShare, labelled at its end '1-3% of listens' (from dataset.listensLabel). Nothing dark fills the track.
5. Search: the bar is a large centred card (60% box width), Archivo 44 px, a mint search icon drawn from shapes. The answer card shows the song cover slot, 'Movin’ To The Sun', 'Imael Angel' in Plex Mono.
6. Fixture: dataset {value: 0.5, label: '50%+', producerLabel: 'Deezer, July 2026', listensLabel: '1-3% of listens'}; answer {title: 'Movin’ To The Sun', artist: 'Imael Angel'}.

Art direction for every frame: fill the box with 6% safe margins on every side; nothing hugs a corner; one clear focal point; cards with 16 px radius and a soft ink shadow (0 18px 40px at 25%); generous type. It must read as a premium, real product at phone size, never a wireframe.

## Contract
Same device, same verbs, same registration; change only its own folder and its houseGolden entry (VE_WRITE_HOUSE_GOLDEN=1, no other entry changing). Tokens only, no raw hex; drift()/progress() only.

## Tests (`device.test.ts`), add to the existing ones
- AI tiles are not contiguous: among the first 40 tiles both kinds occur
- the grid spans at least 80% of the box width
- the meter fill uses mint and the track cream
- the answer markup contains the song title

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
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-4b-flood-polish", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
