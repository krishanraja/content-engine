---
card: ve-gap-pull-quote-1
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /home/user/ve-wt/ve-gap-pull-quote-1
write_allow: [apps/renderer/src/engine/devices/pull_quote/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/props.ts, config/ve/devices.json]
read: apps/renderer/src/engine/**, docs/ve/MOTION_STANDARD.md, docs/ve/INGREDIENTS.md, config/ve/design-lock.json, docs/ve/styles/eating-jobs-ladder.card.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# pull_quote: a quote reveals grey to cream word by word, then a highlight sweeps it

## Goal
From Krish's eating-its-own-jobs cut (docs/ve/styles/eating-jobs-ladder.card.json, gaps). Build device `pull_quote`: the quote sits in grey (inkSoft on the dark ground), each word turning cream as it is spoken (word timings from events), then a mint highlight sweeps behind the key words word by word. The attribution draws in the mono role with its date. Verbs: enter, highlight. Fixture and test: per-word colour at the frames that matter.

Per devices/CONTRACT.md: index.tsx, state.ts, schema.ts, fixture.json, device.test.ts; register in registry.ts and config/ve/devices.json.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Every number carries its producer. In a layout region (kit/layout.ts isRegion, kit/staging.ts) the device lays out at its natural size and grows to fill the region (kit/regionFit.tsx).

## Motion style: One object carries the story (from the eating-its-own-jobs cut) (eating-jobs-ladder, untested)
One object, a career ladder, carries the whole piece: every number is counted onto, beside or in place of a part of it, on a vignetted ink desk or in a butter tray over his chest, and every scene that steps away ends by turning back into the ladder, changed.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- one through-line object for the whole piece, changed on screen, never replaced
- numbers roll onto the object on the enter curve and land on their word
- a slow push holds every panel; nothing holds still
- every change is a 10-frame crossfade on its word; no slide or whip exits
- mint marks only the answer; the series colour is never a warning
Never:
- figures or icons acting out a sentence
- on-screen words repeating what he says
- eyebrow labels, kickers or asterisks
- a hard cut between panels except into the end card

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices/pull_quote
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-gap-pull-quote-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
