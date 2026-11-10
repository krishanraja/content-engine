---
card: ve-w11-1-clip
format: face-with-proof
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: /tmp/claude-0/userprofile\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w11-1-clip
write_allow: [apps/renderer/src/engine/devices/clip/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/sticker/**, apps/renderer/src/engine/kit/glass/footage.tsx, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/engine/FormatMaster.tsx, config/ve/design-lock.json, config/ve/devices.json, tests/ve_port_acceptance_test.py, docs/ve/cards/w11-clip/ref/opener-mock-v6.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The clip: an outside video shown as itself

## Goal
Wednesday 11 Nov (under.the.hood, piece 36886e0b) opens on two short videos people already know, a wedding toast and a dancing cat, each set to the song the piece is about. Krish, 9 Nov 2026: "I want the audio and the video to play at the start of this track of this video to draw people in and make it clear what I'm talking about." Today ve can put an outside video on screen only inside the hand-held phone, which is retired for evidence (the 2 Nov post-mortem: a phone inside a phone, unreadable and cut off). Compile refuses asset plates ("asset plates arrive in Phase 2").

Build the library device `clip`: a real outside video, frame-accurate, filling its slot or the whole frame. It is the picture only; its sound is laid by ve premix (velib/audio.py), so the device is always muted. Approved mock of the look and timing (read it): docs/ve/cards/w11-clip/ref/opener-mock-v6.md.

## Contract
Rules for every device (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`; animation only from `progress()` with `MOTION` timing; colours only from `tokens`; no `Math.random`, no `f % N`, no wall clock; author 1080x1920 and 1920x1080 separately. Register in `devices/registry.ts` and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`.

1. `params`: `src` (the asset path, a video file), `from_s` (the in-point in the source, seconds, default 0), `focus?` ({x, y} as fractions of the source, default {0.5, 0.5}: the point kept in view under objectFit cover), `full?` (boolean: fill the whole canvas, not the slot; used on a STAGE beat whose plate is none), `edge?` (the seam colour drawn on the side it meets his picture: 'channel' or none; 16 px tall, tokens.channel).
2. Playback: an `OffthreadVideo` that is ALWAYS `muted`, inside a `Sequence` that starts on the frame of its `enter` event, with `trimBefore = round(from_s * fps)`, so source frame and render frame stay locked on the one clock (INV-ONE-CLOCK). objectFit cover, objectPosition from `focus`. Hold its last frame if the clip runs out before `exit`.
3. `enter`: the clip slides in from the top edge of its slot (or from the top of the canvas when `full`) over 13 frames on the house hero ease, on EVERY frame even when the motion profile is on twos (a whole-frame move stepped on twos reads as stutter; Krish, 9 Nov: "The fade out of the cat video is glitchy"). `toState: "cut"` enters with no move.
4. `exit`: the clip slides out the way it came over 13 frames, every frame. `toState: "cut"` leaves with no move.
5. Nothing is drawn over the clip by this device: no tag, label, chip or frame. The clip's own burned-in captions stay as they are.

## Tests (`device.test.ts`, stills at frames from `fixture.json`)
- before `enter` nothing renders; after `enter` + 13 frames the clip fills its box (or the canvas when `full`)
- the video element is muted in every state
- the Sequence starts on the enter frame and trimBefore equals round(from_s * fps)
- the enter and exit moves change position on consecutive frames under a twos profile
- tall and wide fixtures render

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/clip
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_port_acceptance_test.py clip
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w11-1-clip", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
