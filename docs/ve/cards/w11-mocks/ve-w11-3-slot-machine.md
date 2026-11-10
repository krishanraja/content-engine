---
card: ve-w11-3-slot-machine
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 75
max_calls: 80
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-3-slot-machine
write_allow: [apps/renderer/src/engine/devices/slot_machine/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, apps/renderer/src/engine/houseGolden.json, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/devices/leaderboard/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/devices.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The song slot machine: two boxes, one button, two songs pay out

## Goal
Wed 11 Nov under.the.hood, piece 36886e0b, frames 6 and 7 of docs/plans/2026-11-11-wednesday/motion-mocks.md (read it). He says: 'There's one box for your lyrics. In another, you describe the sound, like deep house, female singer, summer. You press a button, and a few moments later you get two whole songs back… you just press the button again. It's basically a slot machine that pays out in songs.' Rebuild the shape of Suno's create screen (a lyrics box and a style box, an orange-free house version, labelled with a Plex Mono source line `params.source`), then the same panel becomes a slot machine: a lever on the right, two reels in the middle, a payout tray below.

1. `params`: `lyrics` (string, up to 4 short lines), `style` (string), `source` (string, e.g. 'rebuilt from suno.com, Nov 2026'), `songs` (2 of {title, length}), `logo?` (image: the real Suno wordmark, shown top-left, never rotated).
2. `enter`: the panel slides up; both boxes empty with a blinking caret (blink from the frame, 15 frames on, 15 off, via progress()).
3. `type` toState='lyrics' then toState='style': that box types its text 2 characters a frame; the camera (`zoom` within the device) eases to 1.6x on the box being typed and back.
4. `pick`: the button press. The button depresses 8 px, then the panel's frame morphs into the slot machine over 12 frames (boxes shrink to a header strip; lever and reels grow in).
5. `send`: the lever pulls down and springs back; the two reels spin as vertical scrolls of waveform tiles, motion-blurred by drawing 3 offset copies at falling opacity, then stop one after the other with a bounce (reel 1 at +18 frames, reel 2 at +26).
6. `fill`: two song cards (title, length, a little moving waveform, a play triangle) pay out of the tray one after the other and fan out; coins are waveform glyphs, not money.
7. `bounce`: 'press it again': the cards flip away, the lever pulls again, the reels spin again (same timing as `send`).
8. `highlight` toState=1|2: that card lifts and the other dims to 40%.
9. `exit`: slides down.

## Golden frames
G1 lyrics box half-typed, zoomed 1.6x.
G2 style box full: 'deep house, female singer, summer'.
G3 mid-morph from panel to machine.
G4 reels spinning, lever at its lowest.
G5 two song cards fanned out of the tray.
G6 card 1 highlighted.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, type, pick, send, fill, bounce, highlight, exit; update `verbs.test.ts`; record in `houseGolden.json` (VE_WRITE_HOUSE_GOLDEN=1) with no other entry changing. Never draw Suno's own UI pixels or colours: a house rebuild of its layout, cream panel, ink type, mint for the button and the payout. The logo comes in as an image. Plex Mono for the boxes' typed text and the source line, Archivo for labels, Anton for song titles.

## Tests (`device.test.ts`)
- nothing before `enter`; typed length = min(text length, 2 x frames since the type event)
- reels stop in order, reel 1 before reel 2; no card before `fill`; `bounce` respins
- the lever's angle differs frame to frame during `send`
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
npx vitest run apps/renderer/src/engine/devices/slot_machine
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-3-slot-machine", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
