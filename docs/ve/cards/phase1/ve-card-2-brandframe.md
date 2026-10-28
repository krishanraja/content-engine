---
card: ve-card-2-brandframe
kind: engine_core
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-2-brandframe
write_allow: [apps/renderer/src/engine/BrandFrame.tsx, apps/renderer/src/engine/chrome/**, apps/renderer/src/engine/geometry.ts]
read: apps/renderer/src/engine/props.ts, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/devices/types.ts, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/house/components.tsx, apps/renderer/src/house/geometry.ts, apps/renderer/src/v2/HouseShort.tsx
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# BrandFrame: the chrome no ve cut can omit

## Goal
Implement BrandFrame (the stub exists) by wrapping the approved house kit, so every beat carries the publisher mark, channel identity, captions and grain in both aspects.

## Contract
1. `geometry.ts`:
   - `TALL` re-exports `HOUSE` from `../house/geometry` unchanged (caption top 1180, mark 136 at 72/150).
   - `WIDE` is new 1920x1080 geometry: mark tile 112 at 64/56; caption block centred, bottom edge 960, max width 1400, size 54; pill beside the mark.
   - `boxFor(element, aspect)` returns a Box.
2. `chrome/CaptionTrack.tsx`:
   - Render the caption page whose `fromFrame <= frame < toFrame`, words appearing on `atFrame`.
   - Cream Archivo 900 at 112% width, on an ink block with grain and a 12 px `tokens.channel` hard shadow.
   - The `swipeIndex` word gets the mint `Swipe`.
   - At most 2 lines in tall; the block bottom never sits below Y 1500 in tall.
   - Reuse `SwipedText` and `Swipe` from house.
3. `chrome/MarkTile`: use the house `MarkTile` with a 10 px `tokens.channel` hard shadow. It is present on every beat.
4. `chrome/ChannelPill`: use the house `SectionPill`, lowercase Plex Mono on `tokens.channel`, shown only when `beat.sectionBeat` is true.
5. `chrome/IllustrationLabel`: Plex Mono 24 px "ILLUSTRATION" chip on any frame inside `illustrationLabels[]`.
6. `BrandFrame` renders, in order: Grain (behind), MarkTile, ChannelPill, IllustrationLabel, CaptionTrack.
   - The logo is never rotated, and no raw hex is used: colours come from `props.tokens`.
7. Write `chrome/chrome.test.ts`. It checks that:
   - `boxFor` keeps the tall caption bottom at or above 1500;
   - the wide caption sits inside title-safe;
   - the CaptionTrack page selection returns exactly one page per frame and none between pages.

## Acceptance (every command must exit 0 inside your sandbox)
Sandbox note: your sandbox may not reach node_modules, so `npx tsc` or `vitest` may not start. If so, do not install anything, do not change config and do not retry: write the code carefully to the contract, check it by reading, and say so in open_questions. Claude runs every acceptance command outside the sandbox.

npx tsc --noEmit
npx vitest run apps/renderer/src/engine/chrome

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-2-brandframe", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
