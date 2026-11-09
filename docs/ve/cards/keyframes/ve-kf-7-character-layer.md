---
card: ve-kf-7-character-layer
kind: device_new
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 90
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-7-character-layer
write_allow: [apps/renderer/src/engine/character/*, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json, scripts/velib/character_track.py, scripts/velib/compile.py, tests/ve_character_track_test.py, tests/ve_character_test.py]
read: _corpus/keyframes-character.md, config/ve/character.json, config/channel-safe-zones.json, scripts/velib/character.py, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/clock.ts, scripts/velib/compile.py, scripts/velib/qc_channel.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Krish's character acts at the bottom of a cut

## Goal
A library device, character_layer, that draws Krish's approved character (config/ve/character.json, _corpus/keyframes-character.md 6) at the bottom of a 9:16 cut whose spec names it (spec.character: id, cuts, cues of {at_w, pose, spot?, sink_px?}). One layer over every beat, under the captions; one character for the whole cut.

Compile (scripts/velib/character_track.py, called from compile.py only when spec.character names this cut) writes props.character:
- poses: [{fromFrame, pose, spot, sinkPx}], each in place 4 frames before its word, none in the hook beat, at most 0.8 a second, never two within 15 frames (refuse, naming the cue)
- mouth: open intervals from his word clock, open while a word is said, closed in his pauses; where the stem's 30 fps loudness is under the voice floor inside a word, closed
- blinks: one every 90 to 135 frames, 4 frames each, placed by a hash of piece and cut (no random), only on poses whose blink exists
- images: each pose's closed, open and blink file from the library's library.json, staged under assets like any plate

Renderer (apps/renderer/src/engine/character/): one image at a time; a pose change is one swap with a small dip and settle, never a cross-fade; breathing and a slow sway; rises from below on its first pose. Bust 570 px tall, bottom at y 1985, spots from the manifest; the bust's opaque box never enters any channel's action rail or top bar (config/channel-safe-zones.json), the caption region or the beat's key box: move inward or sink up to 190 px, else refuse the cue in compile.

## Tests
- no character frame before the first word after the hook
- a pose shows 4 frames before its word and holds; one image per frame, never two
- the mouth is closed in every pause longer than 3 frames and open inside words
- blinks land 90 to 135 frames apart and are identical across two compiles
- at every frame the bust box clears every action rail and the caption region
- a spec without character compiles byte-identical props to before

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): pure function of frame and props; animation from progress() and drift() with MOTION timing; colours only from tokens; no Math.random, no f % N, no wall clock; useCurrentFrame only in clock.ts. Add an optional character field to props.ts, absent by default; FormatMaster draws the layer only when it is present. Register character_layer in config/ve/devices.json (verbs: rise, pose, sink, exit) and devices/registry.ts as the registry requires. 9:16 only; refuse 16:9. No per-piece code. Never draw a character that is not in the built library; never generate an image.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/character
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_character_track_test.py
python tests/ve_character_test.py
python tests/ve_compile_test.py
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-7-character-layer", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
