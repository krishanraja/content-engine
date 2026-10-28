---
card: ve-fix-1-renderer
kind: device_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-1-renderer
write_allow: [apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/BrandFrame.tsx, apps/renderer/src/engine/geometry.ts, apps/renderer/src/engine/fit.ts, apps/renderer/src/engine/fit.test.ts, apps/renderer/src/engine/layouts/index.ts, apps/renderer/src/engine/engine.test.ts, apps/renderer/src/engine/chrome/*, apps/renderer/src/engine/devices/test_grid/*, apps/renderer/src/engine/devices/evidence_card/*, apps/renderer/src/engine/devices/kinetic_stat/*, apps/renderer/src/engine/devices/query_chip/*]
read: apps/renderer/src/engine/props.ts, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/geometry.ts, apps/renderer/src/engine/layouts/index.ts, fixtures/ve/my-test-19s/spec.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow, changing CaptionTrack's line-width measure
---

# Renderer fixes from the independent review of the 19.5 s proof

## Goal
In the proof renders, devices overflow their slots, the wide chrome collides with content, the call card and end band never appear, and the evidence recording is unreadable. Fix all of it so that every element is drawn inside its box by construction, not hidden by the slot clip.

## Contract
1. **Call and ending.**
   - BrandFrame draws `CallCard` while the active beat has role `call`. A call beat without `props.call` throws `ve: call beat without props.call`.
   - BrandFrame draws `EndingBand` when `props.ending` exists and `frame >= props.ending.fromFrame`.
   - `CaptionTrack` draws nothing on any frame where either card is drawn.
2. **Chrome zone.**
   - Export `chromeZone(aspect): Box` from geometry.ts.
     - Wide: `{left:48, top:40, width:812, height:152}`.
     - Tall: the box covering the tall mark tile and pill. It must end above Y 288.
   - MarkTile and ChannelPill must lie inside it. Pill text shrinks to fit and never wraps.
3. **Layouts.** Replace these tables exactly. Boxes are `{left, top, width, height}`; leave every other table unchanged.
   - TALL F1: `[{120,852,660,290}, {120,288,768,400}, {120,700,768,140}]`
   - WIDE P1: `[{96,208,1728,572}, {132,232,640,200}]`
   - WIDE P3: `[{96,208,1026,420}, {1140,54,684,726}, {96,640,1026,140}]`
   - WIDE P6: `[{96,208,1728,572}, {998,400,826,380}]`
   - WIDE F1: `[{1176,54,648,490}, {96,208,1056,572}, {1176,560,648,220}]`
   - WIDE F3: `[{96,208,1728,572}, {900,70,924,96}]`

   F1 now means three things:
   - slot 0 is the persistent context object (here, the grid);
   - slot 1 is the dominant focus object;
   - slot 2 is a stat strip.

   Update the comment in layouts/index.ts to say so.
4. **fit.ts.**
   - `fitScale(natural: {width:number;height:number}, box: Box): number` returns `min(1, box.width/natural.width, box.height/natural.height)`.
   - test_grid, kinetic_stat, query_chip and evidence_card text lay out at their natural size, then scale uniformly into the box (top-anchored, horizontally centred).
   - No element may extend outside its box.
5. **test_grid.**
   - Export a pure `gridLayout(box, rowCount, colCount, aspect)` that returns every element rect: header, row labels, cells, producer footer and the "OUT OF n" line, all already scaled.
   - The device draws from it.
   - Cell state carries across beats unchanged.
6. **evidence_card.**
   - Its `OffthreadVideo` is `muted`.
   - Add an optional param `crop: {x, y, w, h}` in 0–1 fractions of the source frame. When set, the media area shows only that region at full media-area width, aspect preserved, and the card height follows it.
   - **Struck never reverts.** After a `stamp` has applied, later events (`mark`) add to the struck state and never reset it.
   - **Typing.** `fill` typing ends by `min(fill frame + ceil(chars/2), next event on this object − 6)`.
   - **`mark` text** wraps inside the card and shrinks (minimum 28 px tall, 24 px wide). It never clips.
7. **kinetic_stat.** Number, unit and producer label stack vertically with no overlap, shrinking to fit the box.
8. **query_chip.** One line only. The font shrinks to fit the width, at 0.6 em per character in Plex Mono.

## Tests
Add to engine.test.ts, fit.test.ts and the device tests:
- Every slot of every layout in both aspects keeps the existing safe-bound rules and slot counts `{P1:2,P3:3,P6:2,F1:3,F3:2}`, and does not intersect `chromeZone(aspect)`.
- At a frame inside a call beat, CallCard is in the tree and no CaptionTrack is. At a frame at or after `ending.fromFrame`, EndingBand is in the tree and no CaptionTrack is.
- `fitScale`: smaller box, larger box, and a mixed case.
- `gridLayout` for 3 rows × 2 columns into WIDE F1 slot 0 and TALL F1 slot 0 (both aspects): every rect lies inside the box.
- evidence_card:
  - the video is muted;
  - crop `{0.17,0.10,0.73,0.48}` gives the expected media style;
  - the state after a stamp and then a mark is still struck.
- kinetic_stat layout rects lie inside the box and do not overlap.
- query_chip: `"SAME WORK PROMPT · ONLY THE COUNTRY CHANGES"` stays one line inside `{900,70,924,96}` and inside `{120,288,768,72}`.

## Acceptance (every command must exit 0; if your sandbox cannot reach node_modules, say so in open_questions and Claude re-runs them outside)
npx tsc --noEmit
npx vitest run apps/renderer/src/engine

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-1-renderer", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
