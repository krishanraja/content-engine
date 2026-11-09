---
card: ve-t12-1-chat-world
format: hand-held-screen
motion_style: living-ui
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: /root\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-t12-1-chat-world
write_allow: ['apps/renderer/src/engine/devices/chat_world/*', 'apps/renderer/src/engine/devices/registry.ts', 'apps/renderer/src/engine/devices/verbs.test.ts', 'config/ve/devices.json']
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/devices.json, config/logo-registry.json, config/channel-safe-zones.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The chat world: one thread the camera travels

## Goal
Thursday 12 Nov's off-day short is pure voiceover (Krish, 2026-11-09: "Pure voiceover, Thursday 12th"). Its one picture: a single chat thread on near-black that grows with the script while the camera travels down it, no hard cuts, something new every 1.5 to 3 s.

Build the library device `chat_world` (config/ve/moves.json; once in devices.json, check_route.py bans per-piece code for it). Verbs: enter, send, flip, resolve, gate, pin, mark, pull, exit.

## Contract
Rules for every device (devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing (enter 12, exit 6, stagger 3, slap 5, drop 8 frames); colours only from `tokens` (ground tokens.ink, faint grid at most 6% contrast; bubbles tokens.cream, ink type; one accent tokens.mint; the resolved state uses the lock's warning role; never tokens.channel, an off day carries no series colour); type roles from `HOUSE_FONTS`; no `Math.random`, no `f % N`, no wall clock; author 1080x1920 and 1920x1080 separately. No label that does not name a source, date or record; no person's name. Marks only from config/logo-registry.json by key, never redrawn. The pinned image is a real screenshot path; draw it as itself, never re-type it. Register it in `devices/registry.ts` and `config/ve/devices.json` with exactly these verbs; update `verbs.test.ts`. STAGE: absolute canvas coordinates, no surrounding surface.

1. `params`: `messages`: list of `{id, side: 'me'|'ai', text, mark?: logo key, time?: 'HH:MM', accent?: number[] (word indexes in tokens.mint)}`; `gates`: list of `{id, label}` (at most 2); `pin`: `{src, highlights: [{id, x, y, w, h}]}` in the image's own pixels; `seed`.
2. The canvas is one tall column; the camera is a `Cam` (kit/camera.ts) eased between stops with `lerpCam`, never cut. After each event it settles with the newest element inside the safe area (config/channel-safe-zones.json); between events a slow `drift()`, never still over 1 s.
3. `enter`: the first message rises 40 to 60 px and fades in over 4 to 7 frames.
4. `send` with `toState` = message id: that bubble arrives on its side (me right, ai left), mark and time beside it; the camera follows.
5. `flip`: later `ai` messages arrive first, unprompted; one eased camera swing of at most 12 degrees, level again within 12 frames.
6. `resolve` with `toState` = message id: a status chip ('Paid' or the spec's text) appears under it with no tap, in the warning role; the camera rests on it.
7. `gate` with `toState` = gate id: a labelled bar drops across the column; later `ai` messages stop above it at 45% opacity with a 'yes?' chip.
8. `pin` then `mark` with `toState` = highlight id: the image pins beside the gates at 89% of the width; each highlight outlines its box in tokens.mint.
9. `pull`: the camera eases back over 24 frames until the whole thread fits the safe area.
10. `exit`: everything fades over 6 frames. Nothing redraws between events.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- nothing before `enter`; a sent bubble is at full opacity 7 frames after its event and sits inside the safe area after the camera settles
- after `flip` no `me` bubble precedes the next `ai` bubble; the camera rotation is back to 0 within 12 frames
- after `gate`, a later `ai` bubble's centre stops above the gate bar and its opacity is 0.45
- the pinned image's pixels are unchanged except highlight outlines
- the camera never jumps: adjacent frames differ by under 60 px and 4% scale
- tall and wide fixtures render and fill 80% of the box outside the caption zone

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
npx vitest run apps/renderer/src/engine/devices/chat_world
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python tests/ve_route_test.py
python scripts/ve/check_route.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-t12-1-chat-world", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
