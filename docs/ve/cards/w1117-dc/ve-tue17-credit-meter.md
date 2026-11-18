---
card: ve-tue17-credit-meter
motion_style: eating-jobs-ladder
kind: device
model: gpt-6.1-sol
effort: medium
max_minutes: 90
max_calls: 80
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-credit-meter
write_allow: [apps/renderer/src/engine/devices/credit_meter/**, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/devices/verbs.test.ts, config/ve/devices.json]
read: [apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/kinetic_stat/**, apps/renderer/src/engine/devices/through_line/**, apps/renderer/src/engine/devices/evidence_card/**, packages/moves/**, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/props.ts, apps/renderer/src/engine/kit/**, config/ve/devices.json, config/channel-safe-zones.json, docs/ve/MOTION_STANDARD.md]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# credit_meter: a bonus that fills month one and drains after it

## Goal
Krish's own words for Tue 17 Nov's piece (b019dbf8), typed on its production plan: "A really clear visual about being enticed to upgrade with free credits, but the small print actually reducing your overall monthly limits to the tool". Build the library device `credit_meter`: one tall tank of credits that fills its box, so a viewer sees in two seconds that a bonus fills month one and is gone after it.

`params`: `plan` and `bonus` (each {label at most 3 words, row: a dataset row label}), `days` (the bonus life in days, 1..90), `src` (optional: a real screenshot crop of the small print, relative to the assets folder, shown as itself, never retyped), `source` (its outlet and date). The numbers come only from the object's dataset (value and producer_label), shown with thousands grouped and a space before a word unit ("2,400 credits").

Verbs and meanings (each lands in 0.6 s or less; the tank never rests: a slow liquid shimmer between events):
- `enter`: the empty tank rises into place with its scale.
- `fill` (toState the plan row): the plan's credits pour in and settle at their level; the number counts up in whole steps.
- `add` (toState the bonus row): a bright bonus layer pours in on top in the series colour; the total counts up.
- `mark`: the real small-print crop slides in pinned to the bonus layer, its key line ringed in mint.
- `count_to` (toState a day number): a day counter beside the tank ticks from day 1 to that day.
- `drop` (toState the plan row): at the end of the bonus life the bonus layer drains away, leaving the plan level; the total counts down.
- `exit`.

His floor (floor.py --format motion): every state change moves the object, never an arrival that sits, a crossfade or an arrow; brand tokens with light, depth and texture (a glass tank, liquid with a meniscus), never icons, clipart or emoji; on-screen words only the labels, the day counter and the dataset's numbers. No caption box. Fill the box: tall from y 280 to y 1050 and x 60 to 860; wide, the whole slot.

## Tests (`device.test.ts`, stills from `fixture.json`)
- after `add` the drawn level is higher than after `fill`; after `drop` it equals the plan level again
- the shown number is the dataset value with thousands grouped, never a decimal mid-count of whole numbers
- `src` is drawn as an image, never as text; the same frame twice renders identical markup; tall and wide render

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. Register `credit_meter` in `devices/registry.ts` and `config/ve/devices.json` with exactly enter, fill, add, mark, count_to, drop, exit; update `verbs.test.ts`. Draw in SVG from the frame alone; texture seeded by the frame number. Read numbers as kinetic_stat and through_line read their dataset. Reuse packages/moves. Add no motion profile.

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
npx vitest run apps/renderer/src/engine/devices/credit_meter
npx vitest run apps/renderer/src/engine/devices/verbs.test.ts
python scripts/ve/check_route.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-credit-meter", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
