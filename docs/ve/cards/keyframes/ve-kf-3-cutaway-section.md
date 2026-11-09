---
card: ve-kf-3-cutaway-section
motion_style: full-visual
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-3-cutaway-section
write_allow: [apps/renderer/src/engine/devices/cutaway_section/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: _corpus/keyframes-full-visual.md, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/devices/evidence_card/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/kit/verbs.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Cut inside: a real object opens to show its layers

## Goal
A device that shows the inside of a real thing (_corpus/keyframes-full-visual.md 2.4). params: `image` (the real object's photo or render, a staged asset path), `layers` (2 to 6 items: {label, image?} from outside in), `axis` ('x' or 'y').

Verbs: enter (the whole object rises in), open (the object splits along `axis` and the layers lift apart in order, staggered 3 frames, each labelled small with a hairline, per 2.8), focus (one layer index scales to 1.15 while the others dim to 40%), close, exit.

## Tests
- before open no layer is offset; 12 frames after open every layer is apart and labelled
- focus dims every other layer and never the focused one
- close returns to the closed geometry
- tall and wide fixtures render

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): Device({object, events, box, tokens, aspect, frame}), a pure function of its props; state only from stateAt(events, object.obj, frame); animation only from progress() and drift() with MOTION timing, and the helpers in kit/verbs.ts once they exist; colours only from tokens (raw hex refused); type roles from HOUSE_FONTS; no Math.random, no f % N, no wall clock; author 1080x1920 and 1920x1080 slots separately. Register the device in devices/registry.ts (one line) and in config/ve/devices.json with exactly the verbs below, and update verbs.test.ts. Follow the builder method in _corpus/keyframes-full-visual.md section 8: the picture comes from object.params (an image path for the real thing, its labels), never a generic shape standing in for it. Verbs, exactly: enter, open, focus, close, exit.

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
npx vitest run apps/renderer/src/engine/devices/cutaway_section
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-3-cutaway-section", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
