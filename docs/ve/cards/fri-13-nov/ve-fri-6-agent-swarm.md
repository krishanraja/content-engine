---
card: ve-fri-6-agent-swarm
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-6-agent-swarm
write_allow: [apps/renderer/src/engine/devices/agent_swarm/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/typing_bubble/**, apps/renderer/src/engine/devices/cursor_buddy/**, apps/renderer/src/engine/devices/stat_strip/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/design-lock.json, config/ve/devices.json, config/ve/brand-tokens.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Agent swarm: ten agents loose on one comment, the token meter spins, the rank climbs

## Goal
Fri 13 Nov 'Counting rat tails', 5-minute cut. Words it carries: AI helpers called agents keep working on a task by themselves; some people set agents running on pointless jobs just to use up more AI; one engineer joked online that whenever his manager said something stupid he would set 10 agents loose on the comment, not to fix anything, just to climb the chart.

1. `params`: `comment` (the manager's line, short), `agents` (count, default 10), `tokens` {from, to} for the meter, `rank` {from, to}, `labels` {meter, rank}.
2. `enter`: a chat bubble with the comment arrives, typed on.
3. `add`: the agents arrive one after another from the edges (small robot cursors, staggered over 20 frames), each trailing a thin line to the bubble.
4. `fill`: they orbit and peck at the bubble; a token meter beside it spins up from tokens.from to tokens.to (counting up and slowing hard into its value).
5. `move` with `toState` = 'rank': a small rank chip climbs from rank.from to rank.to, the number flipping like a departure board.
6. `mark`: one hand-drawn strike across the bubble, 'nothing fixed' (at most 6 words), the agents freezing grey.
7. `exit`.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in devices/registry.ts and config/ve/devices.json with exactly enter, add, fill, move, mark, exit; update verbs.test.ts. Text only from params; counts only from params. Reuse the look of typing_bubble and cursor_buddy (read them), not their code paths if that breaks their tests. Draw inside the box only. Colours only from brand tokens (coral for tokens burned, mint never used here). Tests (device.test.ts): nothing before enter; exactly `agents` agents after add; meter shows tokens.to after fill settles; rank shows rank.to after move; after mark everything but the strike is greyed; tall and wide render.

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
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-6-agent-swarm", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
