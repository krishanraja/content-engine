---
card: ve-w1116-vote-tally
format: face-with-proof
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/claude-0/-home-user/667e7380-2542-5a2f-995b-9b8cd0eaf94c/scratchpad/userprofile\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-w1116-vote-tally
write_allow: [apps/renderer/src/engine/devices/vote_tally/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/stat_strip/**, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/devices/test_grid/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, config/ve/devices.json, config/channel-safe-zones.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The vote tally: 41 local votes, one by one

## Goal
Week of 16 Nov. Tuesday 17 Nov mind.the.gap, 'After the midterms, where will AI get built?' (piece b019dbf8; narrative lock docs/plans/2026-11-16-week/narrative-lock-tue.md, Style recipe, experiment: 'data-story, the 41 town votes as a map, each town flipping to no, as the opening shot'). CNBC, 5 Nov 2026, citing Ballotpedia: 'Out of 41 local ballot measures across 10 states, voters backed restrictions or rejected pro-development measures for all but one.' No real map geometry is claimed: the device is a grid of 41 tiles grouped under 10 state labels (the spec gives which state each tile sits under and its result), so it shows the count and the spread honestly without drawing borders we have not sourced. A library device any piece can use for any tally.

1. `params`: `groups` [{`label` (e.g. a state's name), `items` [{`result`: 'no' | 'yes' | 'open'}]}], `yes_label`, `no_label` (short words from params, e.g. 'For the data centre', 'Against'), `source` (a small source tag).
2. `enter`: the tiles fade up grey, group labels in place.
3. `flip` with `toState` = group index or 'all': that group's tiles flip one after another to their result colour (no = one token colour, yes = another), a crisp card-flip with a short stagger.
4. `count`: a running counter beside the grid ticks up with each 'no' flip and lands on the final count; the one 'yes' tile pulses once when the counter lands.
5. `focus` with `toState` = group index: the other groups dim, that group scales up to read.
6. `exit`.

## Tests (`device.test.ts`, stills at frames from `fixture.json`)
- nothing drawn before `enter`
- after `flip` 'all' with a 41-item fixture (40 no, 1 yes), exactly 40 tiles carry the no colour and 1 the yes colour
- the counter's final value equals the number of 'no' items in params, never a typed number
- group labels and the source tag are readable on the 9:16 frame (at least 40 px, F44) and clear of the button zones
- tall and wide fixtures render; no colour outside tokens

## Contract
Rules for every device (apps/renderer/src/engine/devices/CONTRACT.md): `Device({object, events, box, tokens, aspect, frame})`, a pure function of its props; state only from `stateAt(events, object.obj, frame)`, animation only from `progress()` and `drift()` with `MOTION` timing; colours only from `tokens` (raw hex refused); type roles from `HOUSE_FONTS`; no `Math.random`, no `f % N`, no wall clock; author 1080x1920 and 1920x1080 slots separately, nothing a viewer must read inside the channel-safe zones' button areas (config/channel-safe-zones.json). Register the device in `devices/registry.ts` (one line) and in `config/ve/devices.json` with exactly the verbs below, and update `verbs.test.ts`. Words on it come only from params (never typed into the device), each line is real sourced text the spec gives it. The motion style a piece picks (its card's `## Motion style` section, added at dispatch) governs timing and look; build to the brand tokens and the design lock (config/ve/design-lock.json).

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/vote_tally
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1116-vote-tally", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
