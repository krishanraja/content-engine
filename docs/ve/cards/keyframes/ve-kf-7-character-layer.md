---
card: ve-kf-7-character-layer
kind: device_new
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 90
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-7-character-layer
write_allow: [apps/renderer/src/engine/character/*, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json, scripts/velib/character_track.py, scripts/velib/compile.py, scripts/velib/character.py, tests/ve_character_track_test.py, tests/ve_character_test.py]
read: [config/ve/character.json, config/channel-safe-zones.json, scripts/velib/character.py, scripts/velib/character_library.py, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/clock.ts, scripts/velib/compile.py, scripts/velib/qc_channel.py, apps/renderer/src/engine/houseGolden.test.ts]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Krish's character acts at the bottom of a 9:16 cut

## Goal
A library layer, character_layer, that draws Krish's approved, drawn character (config/ve/character.json) at the bottom of a 9:16 cut whose spec names it (spec.character: id, cuts, cues of {at_w, pose, spot?, sink_px?}): one layer over every beat, under the captions, one character for the whole cut. Needs scripts/velib/character_library.py (card ve-kf-6) on main.

Each cue's pose is the session's pick for its beat's point (the rule: .agents/skills/motion-designer/references/character.md). Code never picks, adds or swaps a pose; it holds the hard lines: never in the hook beat, 9:16 only, poses only from the built library.

Compile (scripts/velib/character_track.py, called from compile.py only when spec.character names this cut) writes props.character:
- poses: [{fromFrame, pose, spot, sinkPx}], each in place 4 frames before its word; refuse, naming the cue, one in the hook beat, more than 0.8 a second, two within 15 frames, or a 16:9 cut
- mouth: open while a word is said, closed in his pauses and wherever the stem's 30 fps loudness is under the voice floor
- blinks: every 90 to 135 frames, 4 frames each, placed by a hash of piece and cut, only on poses with a blink
- images: staged with character_library.stage() from index(library_dir()), each file checked by sha256

Renderer (apps/renderer/src/engine/character/): one image a frame; a pose change is one swap with a small dip and settle, never a cross-fade; it rises from below on its first pose. Breathing and sway never repeat on a period (each breath 3 to 4.5 s from a hash, sway from drift()). Bust 570 px tall, bottom at y 1985, spots from character.json acting; its opaque box (from the index) never enters a channel's action rail or top bar (config/channel-safe-zones.json), the caption region or the beat's key box: it moves inward or sinks up to 190 px, else compile refuses the cue.

Lint: add character.aspect to scripts/velib/character.py, refusing a named cut whose aspect is not in acting.aspects.

## Tests
- nothing drawn before the first word after the hook
- a pose shows 4 frames before its word and holds; one image a frame
- the mouth is closed in every pause over 3 frames and open inside words
- blinks land 90 to 135 frames apart, the same across two compiles
- the bust clears every action rail and the caption region at every frame
- a 16:9 cut is refused at compile and at lint
- a spec without character compiles byte-identical props to before
- a cut without character draws exactly the element tree it drew before: FormatMaster gains no child at all when props.character is unset, not even a null one (spread the layer into the children only when it is set), so houseGolden.test.ts passes with houseGolden.json unchanged. A first build on 15 Nov added `{props.character ? <CharacterLayer/> : null}`, which moved the frozen digest of docs/plans/2026-11-05-thursday-no-spending/ve/props.short.json

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): a pure function of frame and props; motion from progress() and drift() with MOTION timing; colours only from tokens; no Math.random, no frame modulo, no wall clock; useCurrentFrame only in clock.ts. Add an optional `character` field to props.ts, absent by default; FormatMaster draws the layer only when it is present, so houseGolden.json passes unchanged. Register character_layer in config/ve/devices.json with verbs ["enter", "exit"] (its moves come from props.character, not events) and in devices/registry.ts with a component that throws if used as a beat object; compile refuses such an object. No per-piece code. Never generate an image; never touch the brand kit or Google Drive: tests build a library in a temp folder.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/character
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
npx vitest run apps/renderer/src/engine/houseGolden.test.ts
python tests/ve_character_track_test.py
python tests/ve_character_test.py
python tests/ve_character_library_test.py
python tests/ve_compile_test.py
python scripts/ve/check_route.py
npx tsc --noEmit

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-7-character-layer", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
