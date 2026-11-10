---
card: ve-fri-6b-swarm-polish
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-6b-swarm-polish
write_allow: [apps/renderer/src/engine/devices/agent_swarm/*, apps/renderer/src/engine/houseGolden.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/agent_swarm/**, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/devices/cursor_buddy/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/house/geometry.ts, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Agent swarm polish: bigger, livelier agents, a meter that spins, a strike that lands

## Goal
The agent_swarm device (built, on this branch) works but looks plain: 20 px glyph agents, a default bubble, a static-looking meter. Krish's bar: "world-class motion animation".

1. Bubble: cream, ink text in Fraunces semibold at 64 px (tall) / 56 px (wide), a hard house shadow, the comment typed on word by word.
2. Agents: 72 px robot tokens (cream body, ink visor, mint eyes), arriving on a spiral from off-box, staggered 2 frames, each with a fading coral trail; once arrived they bob and peck (small 4 px nudges toward the bubble, out of phase).
3. Meter: 'TOKENS' in Plex Mono 36 px above an Anton 180 px number in coral that rolls like an odometer and slows hard into tokens.to.
4. Rank: a departure-board chip (ink, cream Plex Mono 56 px digits that flip) climbing from rank.from to rank.to.
5. Mark: a thick coral hand-drawn strike across the bubble drawn on over 10 frames, then the agents and meter desaturate to ink-soft while the strike stays.
6. Fixture: comment 'Can we put more AI on this?', agents 10, tokens 120 to 3,147,000, rank 48 to 1, source line 'ONE ENGINEER\'S POST · 2026'.

## Contract
Change only the agent_swarm device and its fixture/tests; verbs unchanged. Colours only from tokens. Keep every existing test passing and add: agents are at least 64 px; no text under 30 px; the meter reads tokens.to formatted with thousands separators after fill.

## Motion style: Data story (data-story, untested)
Real numbers drawn mark by mark, with the source on screen and one annotation that says what changed.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- every number comes from a named source shown in IBM Plex Mono with its date
- axes start at zero for bars; the scale is linear unless the point is growth
- marks draw in order of the argument, the deciding mark last and in mint
- one annotation per chart, at most 6 words, pointing at the mark that matters
- a count is plain: win, lose or draw with numbers, never a vague word
Never:
- invented or rounded-up numbers
- 3D charts
- legends the viewer has to decode
- a chart that holds still

## Recipe: The Ladder: one object, every number on it
One object carries the whole piece, and every number is drawn on, beside or instead of a part of it, so the viewer always knows what a number is about. Krish, on the chart: "The chart makes a boring research report instantly understandable."
Invariants:
- One through-line object for the whole piece, decided before the storyboard (spec style.idea.object); it never morphs into a different object.
- One number per frame, on the object; the number that matters most takes the series colour as its underline only.
- Every number carries its producer at the foot of the frame, in the mono face: PRODUCER · DATE.
- Real logos appear once, at the size of a part of the object, never redrawn; a real page is shown as itself, its one line highlighted, with a slow push.
- Every move means something: the object changes state to say what the voice says (a count, a thinning, a growth, marks lost or copied, a light, a line, the camera resting on a gap).
- Scenes that step away from the object end by turning back into it, changed.
Signature devices (one or two a beat):
- the count on a part: a number counts down or up in one second while its part thins or grows (Monday's 27% to 9% on the junior rung)
- two bars side by side, one growing to its multiple (Monday's agent hours against staff hours)
- unit marks: a field of marks loses or gains some, or copies itself (Monday's 20 tellers to 13, then 43% more branches)
- the missing part: the object returns with a part gone and the camera rests on the gap (the frame the cover echoes)
- the line: one part lights and a line runs to another (2030's top rung to the missing junior rung)
Worked example: Who trains your 2030 seniors (Monday 2 Nov 2026), cuts mon02-wide, mon02-tall (config/ve/recipes/data-story.json).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/agent_swarm
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-6b-swarm-polish", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
