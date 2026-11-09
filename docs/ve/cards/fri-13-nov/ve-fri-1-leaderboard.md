---
card: ve-fri-1-leaderboard
format: face-with-proof
motion_style: data-story
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/claude-0/-home-user-content-engine/a2b398ec-48c8-57a1-bbe0-b1078b2b5a2c/scratchpad/up\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-fri-1-leaderboard
write_allow: [apps/renderer/src/engine/devices/leaderboard/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/stat_strip/**, apps/renderer/src/engine/devices/stamp/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/design-lock.json, config/ve/devices.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The leaderboard: ranks, takes titles, re-sorts, comes down

## Goal
Fri 13 Nov 'Counting rat tails' (format signed: leaderboard as host). One company leaderboard beside his face ranks staff by AI use, stamps titles on top rows (the real one: TOKEN LEGEND), comes down, and at the payoff re-sorts by work done so the order flips.

1. `params`: `rows` (3-7 of {label, value 0..1, alt 0..1?}), `header`, `altHeader?`, `note?` (small footer).
2. `enter`: card rises in with its header, no rows.
3. `add`: rows arrive top to bottom, staggered.
4. `fill`: bars grow to value; no numbers drawn.
5. `stamp` with `toState` = {row, text}: a pill badge stamps onto that row.
6. `move` with `toState` = 'alt': rows travel smoothly to alt order, bars re-grow, header swaps to altHeader.
7. `highlight` with `toState` = {row}: that row lifts and takes the accent.
8. `mark`: one strike line across the board, then it greys.
9. `exit`: the card drops out.

## Tests (`device.test.ts`, stills at frames from `fixture.json`)
- nothing before `enter`; no row before `add`
- after `fill` bar order = value order; after `move` row order = alt order, header = altHeader
- `stamp` badges the named row only; `mark` strikes and greys
- no colour outside tokens; tall (board upper half, face clear below) and wide (board left two thirds, his pillar clear) render

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, add, fill, stamp, move, highlight, mark, exit; update `verbs.test.ts`. Never draw outside the box (his face stays clear). Text only from params/events. Look: house tokens on dark ground, an internal dashboard card, display-face rank numbers, coral for the AI-use ranking and badges, mint for work done.

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
npx vitest run apps/renderer/src/engine/devices/leaderboard
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fri-1-leaderboard", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
