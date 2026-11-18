---
card: ve-tue17-facility-block-fill
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-facility-block-fill
write_allow: [apps/renderer/src/engine/devices/facility_block/**]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/fit.ts, apps/renderer/src/engine/kit/**, apps/renderer/src/engine/props.ts, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# facility_block: no box of its own, fills its slot, readable labels

## Goal
Krish, 18 Nov 2026, on Tue 17's short (b019dbf8), whose full-screen beats now sit on a real or Codex-made photograph behind the graphics (a beat's `backdrop`): the screen must be used, not "a black screen with not much on it". `facility_block` (apps/renderer/src/engine/devices/facility_block) still draws inside its own opaque ink rectangle at a fixed small size, so over a photograph it reads as a dark card pasted in a corner.

Change it so that:
- it draws no background rectangle of its own: the block, its shadow, city, pylons, ballot box, tag and receipts sit directly on whatever is behind (a soft ground shadow under the block is fine);
- it scales to fill its box: the block's footprint is at least 60% of the box width, centred in the box, in both shapes (tall boxes are about 800 x 770; wide boxes the whole slot);
- every label it draws (place label, tag, receipt labels) is at least 34 px tall at 1080 x 1920 and stays readable on a light or dark photograph (cream on an ink pill);
- nothing else about its verbs, states or schema changes.

## Tests (`device.test.ts`)
- the device markup contains no full-box background rect (no element filling the box with an opaque fill)
- at the final state in a 800 x 770 box the block's drawn width is at least 480 px
- the label font sizes are at least 34; the existing tests still pass

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
{"card": "ve-tue17-facility-block-fill", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
