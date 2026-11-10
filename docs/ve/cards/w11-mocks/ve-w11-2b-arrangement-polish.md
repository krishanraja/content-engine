---
card: ve-w11-2b-arrangement-polish
format: face-with-proof
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 70
cwd: /tmp/claude-0/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-2b-arrangement-polish
write_allow: [apps/renderer/src/engine/devices/arrangement/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/arrangement/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/house/geometry.ts, config/ve/design-lock.json, config/ve/brand-tokens.json, docs/plans/2026-11-11-wednesday/motion-mocks.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Arrangement, round 2: a real DAW, filled frame, visible AI

## Goal
Round 2 of ve-w11-2-arrangement (built; Claude reviewed the stills on 10 Nov). Keep the state machine; fix the look and the fixture.
1. Fill the box: lanes share the full region height (max 140 px each), never bunched at the top. A bar ruler (bar numbers 1-16, Plex Mono) runs across the top of the region; faint vertical bar lines run down it.
2. Regions are clips: rounded rectangles (10 px radius) with 6 px gaps between clips, a clip name top-left in Plex Mono (e.g. 'Drums 01'), the waveform inside; never one solid fill edge to edge.
3. Each track header gets a small level meter (two bars) bouncing from progress()/drift(), a mute and solo dot, and its provenance as a slapped pill badge: HUMAN mint on ink, SYNTH and SAMPLE cream outline, AI cream on ink with the hatch. `stamp` tags are the same pill, bigger, landing with a slap and a 4 px overshoot.
4. AI must be obvious: AI clips are ink with a cream hatch at 30% opacity, 45 degrees, 8 px apart, AND a small 'AI' corner flag. 'both' lanes split each clip horizontally, mint top, hatched bottom.
5. The playhead is a 3 px mint line with a soft glow and a triangle head on the ruler.
6. Title in the transport bar is params.title ('Movin’ To The Sun'), never a question.
7. Fixture fixes: choir, sitar and robot are kind 'ai'; add GUITAR (sample) with a stamp 'Splice pack' at G2; G1 must show one full-width waveform mid-split into 4 lanes (no clipped labels); G5 shows two lanes visibly mid-lift (raised, half faded) and two with mint pins; G7 credits via `chip` are 'a healer', 'Suno', 'strangers on TikTok', 'HUGEL', 'Ultra Naté', 'the AI singer', and all six lanes kind 'both'.
8. Tall (1080x1920): headers 200 px, lanes up to 180 px, the ruler and transport bar at the top, the lane stack centred vertically.

Art direction for every frame: fill the box with 6% safe margins on every side; nothing hugs a corner; one clear focal point; cards with 16 px radius and a soft ink shadow (0 18px 40px at 25%); generous type. It must read as a premium, real product at phone size, never a wireframe.

## Contract
Same device, same verbs, same registration; change only its own folder and its houseGolden entry (VE_WRITE_HOUSE_GOLDEN=1, no other entry changing). Tokens only, no raw hex; drift()/progress() only.

## Tests (`device.test.ts`), add to the existing ones
- every golden: the lane stack spans at least 70% of the box height
- an 'ai' lane's markup contains the hatch pattern and an 'AI' flag
- G7 markup contains each who label; G1 has no label overlapping another (distinct y)
- the ruler draws 16 bar numbers

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
npx vitest run apps/renderer/src/engine
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-2b-arrangement-polish", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
