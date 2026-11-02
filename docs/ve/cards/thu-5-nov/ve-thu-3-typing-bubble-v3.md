---
card: ve-thu-3-typing-bubble-v3
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-3-typing-bubble-v3
write_allow: [apps/renderer/src/engine/devices/typing_bubble/*]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/sticker/**, apps/renderer/src/engine/devices/logo_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/devices.json, config/logo-registry.json, config/style-references.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The typing bubble, polished

## Goal
Krish sent these back for marked improvements (2 Nov). Match the polish of his Production Inspo references in config/style-references.json: instagram_DeypYeWN5hL (cute blue cursor character on a light ground, soft shadows, real UI), instagram_DdCY4cJAQZk (app icons on white rounded tiles orbiting a centre, motion-blurred arrivals), instagram_DeZuQ7-lATg (product UI on floating cards with glow). Keep the device's verbs, schema and existing behaviour; improve only the look. Every number below is a minimum the tests must check.

1. kind chat is a full phone chat screen card at least 920 px wide: a header with an avatar circle (initials), the made-up name and "online"; received bubbles left in tokens.cream, sent bubbles right in tokens.mint; text at least 44 px Archivo; a timestamp; Delivered ticks after send.
2. kind order: a confirmation card with a big "Order placed" header and check mark, a product row with quantity and price, and the status line.
3. kind email: subject line, a To: chip that can read a count (e.g. 3,000 recipients), body preview.
4. kind choice: a settings list like a real app: section headers (A, B, C), each option a row with a radio; pick fills the radio with a ring animation.
5. All cards: radius 36 px, soft drop shadow, scale-in from 0.92 on enter.
6. Typing dots animate while a row types (from drift()).

## Tests
- chat card at least 920 px wide with header, avatar and both bubble sides
- text size at least 44 px; Delivered appears only after send
- order, email and choice each render their header and rows; pick fills exactly one radio
- every colour from tokens; tall and wide fixtures render

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing; colours only from `tokens` (raw hex refused); type roles from `HOUSE_FONTS`; no `Math.random`, no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. No person, no real brand mascot, no on-screen text beyond what params give. Look: the house tokens on a light ground, soft shadows, real-UI realism, as in Krish's references (light-grey kinetic explainer with a cute cursor character; app logos orbiting a central icon on rings with motion blur on arrival).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/typing_bubble
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-3-typing-bubble-v3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
