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
Thursday 12's off-day short is pure voiceover (Krish, 9 Nov). Its one picture: a single chat thread on near-black that grows with the voice while the camera travels down it, no hard cuts, something new every 1.5 to 3 s. A Codex attempt was rejected as "terrible and tacky" (pale ground, input fields, boxed captions, small screenshot) and the next as "nothing about it looks like it's come from my media channel brand engine": this is house motion design, not an app mock. The thread is an explanatory diagram, never a product screen; `living-ui` applies to the pinned screenshot, the only real interface.

Build the library device `chat_world`. Verbs: enter, send, flip, resolve, gate, pin, mark, pull, exit.

## Contract
Rules (devices/CONTRACT.md): a pure `Device(props)`; state only from `stateAt`, animation only from `progress()`/`drift()` with `MOTION` timing; colours only from `tokens` (ground tokens.ink, faint grid at most 6% contrast; bubbles tokens.cream, ink type; one accent tokens.mint; the resolved state uses the lock's warning role; never tokens.channel, an off day carries no series colour); no `Math.random`, `f % N` or clock; author 9:16 and 16:9 separately. No label that names no source, date or record; no names. Type: Archivo for bubbles, IBM Plex Mono for times, Anton only for a stop's label; no input fields, cursors or boxed captions. Marks only from config/logo-registry.json by key, never redrawn, and only on a `mark_row` named by the voice, never on a bubble: no real brand beside an illustrative message or state. The pinned image is a real screenshot path; draw it as itself, never re-type it. Register in `devices/registry.ts`, `config/ve/devices.json` (these verbs) and `verbs.test.ts`. STAGE: absolute canvas coordinates.

1. `params`: `messages`: `{id, side: 'me'|'ai', text, time?: 'HH:MM', accent?: number[]}`; `mark_row`: logo keys; `gates`: list of `{id, label}` (at most 2); `pin`: `{src, highlights: [{id, x, y, w, h}]}` in image pixels; `seed`.
2. The canvas is one tall column; the camera is a `Cam` (kit/camera.ts) eased between stops with `lerpCam`, never cut. After each event it settles with the newest element inside the safe area (config/channel-safe-zones.json); between events a slow `drift()`, never still over 1 s.
3. `enter`: the first message rises 40-60 px, fading in over 4-7 frames.
4. `send` with `toState` = message id: that bubble arrives on its side (me right, ai left) with its time; the camera follows.
5. `flip`: later `ai` messages arrive first, unprompted; one eased camera swing of at most 12 degrees, level again within 12 frames.
6. `resolve` with `toState` = message id: a status chip ('Paid' or the spec's text) appears under it with no tap, in the warning role; the camera rests on it.
7. `gate` with `toState` = gate id: an approval stop: a hairline across the column with its label, no bars, locks or machinery; later `ai` messages stop above it at 45% opacity with a 'yes?' chip.
8. `pin` then `mark` with `toState` = highlight id: the screenshot (light, about 1000x750) pins at 89% of the width as a lit card; each highlight outlines its box in tokens.mint.
9. `pull`: the camera eases back over 24 frames until the whole thread fits the safe area.
10. `exit`: fade over 6 frames. Nothing redraws between events.

## Tests (`device.test.ts`, stills at given frames from `fixture.json`)
- nothing before `enter`; a sent bubble is opaque 7 frames on, inside the safe area once settled
- after `flip` the next `ai` bubble has no `me` before it; rotation 0 within 12 frames
- after `gate` a later `ai` bubble stops above the stop at 0.45 opacity
- the pinned image's pixels are unchanged except highlight outlines
- the camera never jumps: adjacent frames differ by under 60 px and 4% scale
- tall and wide fixtures render

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
