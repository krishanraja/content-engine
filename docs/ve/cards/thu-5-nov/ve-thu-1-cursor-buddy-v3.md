---
card: ve-thu-1-cursor-buddy-v3
format: hand-held-screen
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-1-cursor-buddy-v3
write_allow: [apps/renderer/src/engine/devices/cursor_buddy/*]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/sticker/**, apps/renderer/src/engine/devices/logo_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/devices.json, config/logo-registry.json, config/style-references.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The cursor buddy, polished

## Goal
Krish sent these back for marked improvements (2 Nov). Match the polish of his Production Inspo references in config/style-references.json: instagram_DeypYeWN5hL (cute blue cursor character on a light ground, soft shadows, real UI), instagram_DdCY4cJAQZk (app icons on white rounded tiles orbiting a centre, motion-blurred arrivals), instagram_DeZuQ7-lATg (product UI on floating cards with glow). Keep the device's verbs, schema and existing behaviour; improve only the look. Every number below is a minimum the tests must check.

1. Size: the body is at least 1.6 times today's (at least 260 px tall in a 1080x1920 box).
2. A 6 px tokens.ink outline on the body and a soft drop shadow (an offset, lower-opacity shape, no filter).
3. Squash and stretch on arrival and bounce at least twice today's amplitude.
4. Eyes blink once, deterministically, 40 frames after enter (event-free, from drift()).
5. sulk: body tilts 12 degrees and a small sweat drop appears.
6. mood cool: bold sunglasses at least 40% of the head width.
7. prop card: a credit card with a stripe and chip shape, at least 30% of body width.

## Tests
- body height at least 260 px at rest; outline stroke width 6
- the blink closes the eyes at enter+40 and reopens by enter+46
- sulk rotates the body 12 degrees; cool draws the glasses; card draws stripe and chip
- tall and wide fixtures render

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing; colours only from `tokens` (raw hex refused); type roles from `HOUSE_FONTS`; no `Math.random`, no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately. Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. No person, no real brand mascot, no on-screen text beyond what params give. Look: the house tokens on a light ground, soft shadows, real-UI realism, as in Krish's references (light-grey kinetic explainer with a cute cursor character; app logos orbiting a central icon on rings with motion blur on arrival).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/cursor_buddy
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-1-cursor-buddy-v3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
