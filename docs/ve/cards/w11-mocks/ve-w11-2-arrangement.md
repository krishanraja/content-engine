---
card: ve-w11-2-arrangement
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 90
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-2-arrangement
write_allow: [apps/renderer/src/engine/devices/arrangement/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/devices/leaderboard/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The arrangement: a song as stacked layers, and who made each one

## Goal
Wed 11 Nov, piece 36886e0b. Hero device: frames 8, 9, 10, 14, 15, 16, 17 and 19 of the frame table in docs/plans/2026-11-11-wednesday/motion-mocks.md. A DAW arrangement view in the house look (no product name): lanes top to bottom, a track header left, a moving waveform or MIDI region right, a playhead sweeping. Every song is layers; each layer has a maker. Always moving: playhead runs, live waveforms breathe with `drift()` between events.

1. `params`: `lanes` (1-12 of {id, name, kind: 'human'|'synth'|'sample'|'ai'|'both', who?: string, region?: 'wave'|'midi'}), `title?` (the song name in the transport bar, Plex Mono), `bpm?` (number, shown in the transport bar, default 124), `fromWave?` (bool: enter by opening out of one full-width waveform).
2. `enter`: transport bar (title, bpm, bar:beat counter from the frame) drops first; with fromWave one full-width waveform splits into the lanes over 14 frames, staggered; else lanes slide in from the left.
3. `add` toState=lane id: a `hidden: true` lane drops into its row; rows below push down.
4. `type` toState=JSON {lane, text}: a prompt chip rises, types 2 characters a frame (Plex Mono), flies into the lane header and the lane adds itself ('talk a layer into existence').
5. `stamp` toState=JSON {lane, tag}: a provenance tag (SYNTH, SAMPLE, AI, HUMAN or a short name) slaps onto the header and stays.
6. `mark` toState=lane id: lifts out and rows close up; {lane, pin:true} drops a mint pin and it stays.
7. `highlight` toState=lane id: solo: 3x height, the rest dims to 40%; 'all' clears.
8. `fill` toState=JSON {lane, layers:[{kind, weight}]}: stacked moving waveforms by weight (robot hum: human 0.85, ai 0.15).
9. `chip` toState=JSON {lane, who}: a credit (Fraunces italic, cream pill) slides in at the lane's right end, e.g. 'a healer', 'Suno', 'HUGEL'.
10. `move` toState=JSON {zoom, x?}: camera eases to zoom 1-3 around x (0..1); 'count' rolls the transport bar's lane counter.
11. `exit`: lanes collapse into one waveform and slide out.

## Golden frames (fixture.json; I look at each)
G1 one waveform splitting into DRUMS, BASS, CHORDS, VOICE. G2 4 lanes playing, SYNTH on BASS, SAMPLE on DRUMS, 'Splice pack' on GUITAR. G3 chip half-typed 'add a choir' rising to a new AI lane. G4 7 lanes (choir, sitar, robot added), counter 7. G5 two lanes lifting out, two pinned, sample-library DRUMS, SYNTH BASS, PIANO, STRINGS dropping in. G6 VOICE soloed: mint on top, thin hatched hum under. G7 six lanes, each with a who chip, all two-tone. All readable at phone size, tall.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, add, type, stamp, mark, highlight, fill, chip, move, exit; update `verbs.test.ts`; record the device in `houseGolden.json` (VE_WRITE_HOUSE_GOLDEN=1) with no other entry changing. Draw in SVG and divs. Waveforms: a deterministic function of (lane id, x), animated by drift()/progress(); no Math.random, no f % N. Headers 280 px (wide), 220 px (tall). Anton for the song title, Archivo for lane names, Plex Mono for tags, counter and bpm, Fraunces italic for `chip` credits.

## Tests (`device.test.ts`)
- nothing before `enter`; a hidden lane only after its `add`/`type`; `type` 2 chars a frame
- `mark` removes unless pinned; `highlight` dims others to 0.4; `fill` heights follow weights
- playhead x differs between f and f+1
- tokens only: mint human; AI = `ink` with a 45-degree `inkSoft` hatch (`hatch.ts`); synth/sample `inkSoft`
- tall 1080x1920, wide 1920x1080 and 1260x1080 fixtures render inside `box`; each golden is a fixture still

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
npx vitest run apps/renderer/src/engine/devices/arrangement
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-2-arrangement", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
