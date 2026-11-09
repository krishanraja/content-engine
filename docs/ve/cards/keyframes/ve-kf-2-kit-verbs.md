---
card: ve-kf-2-kit-verbs
motion_style: full-visual
kind: kit
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-2-kit-verbs
write_allow: [apps/renderer/src/engine/kit/verbs.ts, apps/renderer/src/engine/kit/verbs.test.ts]
read: _corpus/keyframes-full-visual.md, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/kit/motionProfiles.ts, apps/renderer/src/engine/chrome/tokens.ts, docs/ve/MOTION_STANDARD.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Five motion verbs from the full-visual kit, as pure functions

## Goal
Add apps/renderer/src/engine/kit/verbs.ts with five pure helpers any device may call (_corpus/keyframes-full-visual.md section 3.7). Times are frames at ve's 30 fps; each takes the frame passed in and a start frame, never reads the clock itself.

1. countTo(frame, at, from, to, {frames=18, jitter=0.02, decimals=0}): the shown number, eased with progress(); a small deterministic jitter (from a hash of `at`, never Math.random) that dies out by the last frame; lands exactly on `to` at at+frames and holds.
2. typeOn(frame, at, text, {cps=30}): the visible prefix; cps clamped to 25..40 (the motion floor).
3. drawPath(frame, at, lengthPx, {frames=12}): strokeDashoffset from lengthPx to 0.
4. mix(frame, at, fromToken, toToken, {frames=6}): an interpolated colour between two token colours (tokens only, no raw hex).
5. cursorPath(frame, at, points, {framesPerLeg=10, restFrames=4}): {x, y, pressed} along eased arcs between points, resting before each press.

## Tests (kit/verbs.test.ts)
- countTo is `from` before `at`, exactly `to` from at+frames, and the same value for the same inputs twice
- typeOn shows no characters before `at` and the whole text by at + ceil(len/cps*30)
- drawPath is lengthPx before `at` and 0 at at+frames
- mix returns fromToken before and toToken after
- cursorPath is at points[0] before `at`, pressed only during rests, at the last point at the end

## Contract
Pure functions of their arguments: no useCurrentFrame, no Math.random, no wall clock, no React. Animation easing only from progress() and drift() in ../clock. Export from kit/index if one exists. Do not change any existing kit file's behaviour or any device.

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
npx vitest run apps/renderer/src/engine/kit
npx tsc --noEmit -p apps/renderer

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-2-kit-verbs", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
