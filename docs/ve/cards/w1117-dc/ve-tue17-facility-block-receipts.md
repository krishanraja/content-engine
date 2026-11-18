---
card: ve-tue17-facility-block-receipts
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-facility-block-receipts
write_allow: [apps/renderer/src/engine/devices/facility_block/**]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/fit.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/engine/props.ts, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# facility_block: receipts and tag sit clear of the block, on top

## Goal
Krish, 18 Nov 2026, on Tue 17's short (b019dbf8): every full-screen beat must use the whole screen and read at a glance. In the 9:16 stills of `facility_block` (apps/renderer/src/engine/devices/facility_block) after the fill change, the two receipt papers (`targets`, here 'Power bill' and 'AI plan') and the moving `tag` ('Your share') are drawn before the block body and at fixed layout positions (x 470, y 140 and 260 in the 780-wide tall layout), so once the block grows to 64% of the box its racks cover them: the receipt pills read 'wer bill' and 'plan', and the tag lands half behind a rack.

Change it so that:
- the receipts and the tag are drawn after the block body, so nothing of the block ever covers them;
- the receipts are placed from the block's drawn bounds, not fixed numbers: in the tall shape they stack in the clear space beside or below the block (whichever has room in the box), in the wide shape to its right; no part of a receipt (paper or pill) overlaps the block's bounding box, racks and lid included, at any state from `enter` through `exit`, and every receipt stays wholly inside the box (nothing clipped);
- the tag's travel ends beside its target receipt, clear of the block and of the other receipt, with its whole pill readable;
- labels keep their current size (at least 34 screen px) and their cream-on-ink pill; nothing else about the verbs, states, schema or the block's own size changes.

## Tests (`device.test.ts`)
- export a pure layout helper (box, aspect, state) that returns the block's bounds and each receipt's and the tag's rect in screen px, and use it in the drawing so the test measures what is drawn;
- for both shapes (a tall 800 x 770 box and a wide 1920 x 1080 box) and for the states at each verb's end, no receipt or tag rect intersects the block bounds or another receipt, and every rect lies inside the box;
- in the markup the receipts and the tag come after the `data-facility-body` group;
- the existing tests still pass.

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Edit only facility_block; keep its registered verbs. Draw in SVG from the frame alone.

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
npx vitest run apps/renderer/src/engine/devices/facility_block
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-facility-block-receipts", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
