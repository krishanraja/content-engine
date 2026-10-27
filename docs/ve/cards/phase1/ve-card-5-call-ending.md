---
card: ve-card-5-call-ending
kind: device_new
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-5-call-ending
write_allow: [apps/renderer/src/engine/chrome/CallCard.tsx, apps/renderer/src/engine/chrome/EndingBand.tsx, apps/renderer/src/engine/chrome/ending.test.ts]
read: apps/renderer/src/engine/props.ts, apps/renderer/src/v2/HouseShort.tsx (HouseCall, HouseBand), apps/renderer/src/house/geometry.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# CallCard and EndingBand in both aspects

## Goal
Port the approved HouseCall (the dated call) and HouseBand (the ending band with ticker, stacked logo, day, pill and URL) into ve chrome, with independently authored 16:9 layouts.

## Contract
- **CallCard.**
  - Renders from `props.call` (statement, due, confidence).
  - Kicker "The call"; headline "Our call."; the statement; a due line built with `houseDueLine`.
  - Slaps in (5 frames) at the call beat's `fromFrame`.
  - Tall geometry follows `HOUSE.call`. Wide: a centred card 1200 px wide.
- **EndingBand.**
  - Starts at `props.ending.fromFrame`.
  - The ticker uses `houseTickerOffset` (a non-repeating offset from arrival; no modulo of the frame).
  - Stacked logo; series day and promise from `props.series`; the URL in Plex Mono.
  - Tall geometry follows `HOUSE.band`. Wide: a full-width band 320 px tall.
- **Tests.** `ending.test.ts` checks that the ticker offset is monotonic over 600 frames and that both cards stay inside their aspect's safe area.

## Acceptance (every command must exit 0 inside your sandbox)
npx tsc --noEmit
npx vitest run apps/renderer/src/engine/chrome/ending.test.ts

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-5-call-ending", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
