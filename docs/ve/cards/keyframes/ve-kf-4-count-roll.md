---
card: ve-kf-4-count-roll
motion_style: full-visual
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-4-count-roll
write_allow: [apps/renderer/src/engine/devices/count_roll/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: _corpus/keyframes-full-visual.md, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/kit/verbs.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# A number that rolls to its word, on the real thing it measures

## Goal
A device for a number that is never static (_corpus/keyframes-full-visual.md 3.6), shown on or beside the real thing it measures. params: `image` (optional, the real object), `unit`, `denominator?`; the value comes from object.dataset with dataset.producerLabel shown legibly (CONTRACT rule 5).

Verbs: enter, roll (digits roll like an odometer from the previous value to the event's value, via countTo in kit/verbs.ts, landing on the event frame + 18), fill (a bar or ring on the object fills to the value as a share of denominator), exit. unit and denominator never change during the object's life.

## Tests
- the shown value equals the target from roll + 18 and never overshoots it
- producerLabel is drawn
- fill is 0 before its event and the share after
- tall and wide fixtures render

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): Device({object, events, box, tokens, aspect, frame}), a pure function of its props; state only from stateAt(events, object.obj, frame); animation only from progress() and drift() with MOTION timing, and the helpers in kit/verbs.ts once they exist; colours only from tokens (raw hex refused); type roles from HOUSE_FONTS; no Math.random, no f % N, no wall clock; author 1080x1920 and 1920x1080 slots separately. Register the device in devices/registry.ts (one line) and in config/ve/devices.json with exactly the verbs below, and update verbs.test.ts. Follow the builder method in _corpus/keyframes-full-visual.md section 8: the picture comes from object.params (an image path for the real thing, its labels), never a generic shape standing in for it. Verbs, exactly: enter, roll, fill, exit.

## Motion style: Full visual: the real thing, opened up (full-visual, untested)
For how-it-works and who-pays-whom pieces. No presenter on screen: his voice explains and the screen is the explanation. Under a word-by-word caption, the real thing each sentence is about is redrawn from real photos and screens, and changes on the word that changes it.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- a new real thing for every sentence group, redrawn from real photos and screens at their real geometry and copy
- a change of state happens to the object already on screen: it recolours, opens, breaks or grows, and is not replaced
- a picture hands over only in a pause he left (ve qc beats.handover_in_gaps), as one move, and the ground is never bare
- a number is never static: it counts, rolls or fills and lands on its word
- the invisible part (a charge, a cost, a flow) gets one shape and one colour, the mint, for the whole cut; everything else keeps its real colours
- fill the stage: foreground, subject, depth behind, one secondary motion; never one small object on an empty ground
- cut inside when the mechanism is inside: a side-on section, a shell turning see-through, layers lifting out
Never:
- a metaphor or stock icon where a real thing exists
- flat boxes and generic shapes that read as coded
- blur, frost or a vague panel standing in for the mechanism
- a still stretch over 1.2 s
- a synthetic voice in place of his

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/count_roll
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-4-count-roll", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
